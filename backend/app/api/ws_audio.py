"""
Project Cura - WebSocket Audio Endpoint.

Accepts streaming audio over WebSocket, buffers chunks,
runs transcription with speaker diarization, and returns
real-time transcript updates.
"""

import asyncio
import json
import logging
import time

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.audio_storage import save_audio_to_storage
from app.services.transcriber import transcribe_audio

logger = logging.getLogger(__name__)

router = APIRouter()

# Audio parameters
SAMPLE_RATE = 16000  # 16kHz
BYTES_PER_SAMPLE = 2  # 16-bit PCM
BUFFER_DURATION_SECONDS = 2.0  # 2 seconds for highly responsive real-time STT
BUFFER_SIZE_BYTES = int(SAMPLE_RATE * BUFFER_DURATION_SECONDS * BYTES_PER_SAMPLE)

# Speaker diarization - energy-based
SILENCE_ENERGY_THRESHOLD = 0.02  # RMS below this = silence
SPEAKER_CHANGE_SILENCE_MS = 800  # 800ms silence = speaker change


def _detect_speaker(
    audio_chunk: np.ndarray,
    prev_speaker: str,
    chunk_index: int,
) -> str:
    """
    Simple energy-based speaker detection.

    Uses audio energy patterns and conversation flow to alternate
    between Doctor and Patient speakers.

    For real-time streaming, we use a simple heuristic:
    - First speaker is always 'Doctor'
    - Detect silence gaps > 800ms within the chunk
    - If a significant pause is detected, toggle the speaker
    - Also look at energy variance — questions have rising intonation (higher variance)
    """
    if chunk_index == 0:
        return "Doctor"

    # Analyze the chunk in small frames (50ms each)
    frame_size = int(SAMPLE_RATE * 0.05)  # 800 samples = 50ms
    num_frames = len(audio_chunk) // frame_size
    if num_frames < 2:
        return prev_speaker

    frames = audio_chunk[: num_frames * frame_size].reshape(num_frames, frame_size)
    frame_energies = np.sqrt(np.mean(frames ** 2, axis=1))

    # Count consecutive silent frames
    silence_threshold = max(SILENCE_ENERGY_THRESHOLD, np.mean(frame_energies) * 0.15)
    silent_frames = frame_energies < silence_threshold

    # Find longest consecutive silence
    max_silence_run = 0
    current_run = 0
    for is_silent in silent_frames:
        if is_silent:
            current_run += 1
            max_silence_run = max(max_silence_run, current_run)
        else:
            current_run = 0

    silence_duration_ms = max_silence_run * 50  # Each frame = 50ms

    # If there's a significant pause (>800ms), toggle speaker
    if silence_duration_ms >= SPEAKER_CHANGE_SILENCE_MS:
        new_speaker = "Patient" if prev_speaker == "Doctor" else "Doctor"
        logger.debug(
            "Speaker change detected: %dms silence, %s -> %s",
            silence_duration_ms,
            prev_speaker,
            new_speaker,
        )
        return new_speaker

    return prev_speaker


@router.websocket("/ws/v1/audio/{session_id}")
async def audio_websocket(
    websocket: WebSocket,
    session_id: str,
    language: str | None = None
) -> None:
    """
    WebSocket endpoint for real-time audio streaming and transcription.

    Protocol:
        - Client sends binary audio chunks (16kHz, 16-bit PCM, mono).
        - Client can also send JSON control messages:
          {"type": "control", "action": "pause|resume|stop", "patient_id": "..."}
        - Server responds with JSON transcript updates:
          {"type": "transcript", "data": {"text": "...", "speaker": "Doctor|Patient", "timestamp": 0.0, "is_final": false}}
    """
    await websocket.accept()
    logger.info("[%s] WebSocket connected", session_id)

    audio_buffer = bytearray()
    all_audio_data = bytearray()
    is_paused = False
    patient_id = "unknown"
    segment_counter = 0
    start_time = time.monotonic()
    current_speaker = "Doctor"

    audio_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=100)

    async def process_audio_chunks() -> None:
        """Background task that processes audio chunks from the queue."""
        nonlocal segment_counter, current_speaker

        while True:
            try:
                chunk_bytes = await audio_queue.get()
                if chunk_bytes is None:
                    break

                num_samples = len(chunk_bytes) // BYTES_PER_SAMPLE
                if num_samples == 0:
                    continue

                audio_array = np.frombuffer(chunk_bytes, dtype=np.int16).astype(
                    np.float32
                )
                audio_array = audio_array / 32768.0  # Normalize to [-1, 1]

                # Detect speaker from audio energy patterns
                current_speaker = _detect_speaker(
                    audio_array, current_speaker, segment_counter
                )

                # Run transcription
                lang_code = language if (language and language != "auto") else None
                segments = transcribe_audio(audio_array, language=lang_code)

                for seg in segments:
                    text = seg.get("text", "").strip()
                    if not text:
                        continue

                    # Skip Whisper hallucinations (common artifacts)
                    lower = text.lower()
                    if lower in (
                        "thank you.",
                        "thanks for watching.",
                        "you",
                        "...",
                        "thank you for watching.",
                        "bye.",
                        "subscribe",
                        "thanks.",
                    ):
                        continue

                    segment_counter += 1
                    elapsed = time.monotonic() - start_time
                    response = {
                        "type": "transcript",
                        "data": {
                            "text": text,
                            "speaker": current_speaker,
                            "timestamp": round(elapsed, 2),
                            "is_final": False,
                        },
                    }

                    try:
                        await websocket.send_json(response)
                    except Exception:
                        return

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[%s] Audio processing error: %s", session_id, e)

    processor_task = asyncio.create_task(process_audio_chunks())

    # Heartbeat task to detect dead connections
    async def heartbeat() -> None:
        """Send periodic ping to keep the connection alive."""
        while True:
            try:
                await asyncio.sleep(30)
                await websocket.send_json({"type": "ping", "data": {"ts": time.time()}})
            except Exception:
                break

    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                raise WebSocketDisconnect(code=message.get("code", 1000))

            if "bytes" in message and message["bytes"]:
                if is_paused:
                    continue

                raw_bytes = message["bytes"]
                audio_buffer.extend(raw_bytes)
                all_audio_data.extend(raw_bytes)

                if len(audio_buffer) >= BUFFER_SIZE_BYTES:
                    try:
                        audio_queue.put_nowait(bytes(audio_buffer))
                    except asyncio.QueueFull:
                        logger.warning(
                            "[%s] Audio queue full, dropping chunk", session_id
                        )
                    audio_buffer.clear()

            elif "text" in message and message["text"]:
                try:
                    control = json.loads(message["text"])
                except json.JSONDecodeError:
                    logger.warning(
                        "[%s] Invalid JSON control message", session_id
                    )
                    continue

                msg_type = control.get("type", "")
                action = control.get("action", "")

                if msg_type == "control":
                    if action == "pause":
                        is_paused = True
                        logger.info("[%s] Audio paused", session_id)
                        await websocket.send_json(
                            {"type": "status", "data": {"status": "paused"}}
                        )

                    elif action == "resume":
                        is_paused = False
                        logger.info("[%s] Audio resumed", session_id)
                        await websocket.send_json(
                            {"type": "status", "data": {"status": "recording"}}
                        )

                    elif action == "stop":
                        patient_id = control.get("patient_id", patient_id)
                        logger.info(
                            "[%s] Stop received, saving audio...", session_id
                        )

                        if len(audio_buffer) > 0:
                            try:
                                audio_queue.put_nowait(bytes(audio_buffer))
                            except asyncio.QueueFull:
                                pass
                            audio_buffer.clear()

                        if all_audio_data:
                            try:
                                file_url = await save_audio_to_storage(
                                    session_id=session_id,
                                    patient_id=patient_id,
                                    audio_data=bytes(all_audio_data),
                                    sample_rate=SAMPLE_RATE,
                                )
                                await websocket.send_json(
                                    {
                                        "type": "status",
                                        "data": {
                                            "status": "stopped",
                                            "audio_url": file_url,
                                            "segments_transcribed": segment_counter,
                                        },
                                    }
                                )
                            except Exception as e:
                                logger.error(
                                    "[%s] Failed to save audio: %s",
                                    session_id,
                                    e,
                                )
                                await websocket.send_json(
                                    {
                                        "type": "status",
                                        "data": {
                                            "status": "stopped",
                                            "audio_url": "",
                                            "segments_transcribed": segment_counter,
                                            "error": str(e),
                                        },
                                    }
                                )
                        else:
                            await websocket.send_json(
                                {
                                    "type": "status",
                                    "data": {
                                        "status": "stopped",
                                        "audio_url": "",
                                        "segments_transcribed": segment_counter,
                                    },
                                }
                            )
                        break

                    if "patient_id" in control:
                        patient_id = control["patient_id"]

    except WebSocketDisconnect:
        logger.info("[%s] WebSocket disconnected", session_id)
    except Exception as e:
        logger.error("[%s] WebSocket error: %s", session_id, e)
    finally:
        heartbeat_task.cancel()
        try:
            audio_queue.put_nowait(None)
        except asyncio.QueueFull:
            pass
        processor_task.cancel()
        try:
            await processor_task
        except asyncio.CancelledError:
            pass
        logger.info(
            "[%s] WebSocket session ended (segments: %d)",
            session_id,
            segment_counter,
        )

