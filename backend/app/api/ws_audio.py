"""
Project Cura - WebSocket Audio Endpoint.

Accepts streaming audio over WebSocket, streams directly to Deepgram WebSocket
for instant transcription, and returns real-time transcript updates.
Falls back to local Whisper buffering if Deepgram is unavailable.
"""

import asyncio
import json
import logging
import time

import numpy as np
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.services.audio_storage import save_audio_to_storage
from app.services.transcriber import transcribe_audio

logger = logging.getLogger(__name__)

router = APIRouter()

# Audio parameters
SAMPLE_RATE = 16000  # 16kHz
BYTES_PER_SAMPLE = 2  # 16-bit PCM
FALLBACK_BUFFER_SECONDS = 2.0  # Only used if falling back to local Whisper
FALLBACK_BUFFER_BYTES = int(SAMPLE_RATE * FALLBACK_BUFFER_SECONDS * BYTES_PER_SAMPLE)

# Speaker diarization - energy-based (only for fallback)
SILENCE_ENERGY_THRESHOLD = 0.02
SPEAKER_CHANGE_SILENCE_MS = 800


def _detect_speaker(
    audio_chunk: np.ndarray,
    prev_speaker: str,
    chunk_index: int,
) -> str:
    """Simple energy-based speaker detection (used only for local Whisper fallback)."""
    if chunk_index == 0:
        return "Doctor"

    frame_size = int(SAMPLE_RATE * 0.05)  # 50ms
    num_frames = len(audio_chunk) // frame_size
    if num_frames < 2:
        return prev_speaker

    frames = audio_chunk[: num_frames * frame_size].reshape(num_frames, frame_size)
    frame_energies = np.sqrt(np.mean(frames ** 2, axis=1))

    silence_threshold = max(SILENCE_ENERGY_THRESHOLD, np.mean(frame_energies) * 0.15)
    silent_frames = frame_energies < silence_threshold

    max_silence_run = 0
    current_run = 0
    for is_silent in silent_frames:
        if is_silent:
            current_run += 1
            max_silence_run = max(max_silence_run, current_run)
        else:
            current_run = 0

    silence_duration_ms = max_silence_run * 50

    if silence_duration_ms >= SPEAKER_CHANGE_SILENCE_MS:
        new_speaker = "Patient" if prev_speaker == "Doctor" else "Doctor"
        return new_speaker

    return prev_speaker


@router.websocket("/ws/v1/audio/{session_id}")
async def audio_websocket(
    websocket: WebSocket,
    session_id: str,
    language: str | None = None
) -> None:
    await websocket.accept()
    logger.info("[%s] WebSocket connected", session_id)

    settings = get_settings()
    dg_api_key = settings.DEEPGRAM_API_KEY
    use_deepgram = bool(dg_api_key and len(dg_api_key.strip()) > 0)
    dg_ws = None

    if use_deepgram:
        # Explicitly use model=nova-2 for Google/YouTube-level accuracy
        # Set endpointing to 300ms for more natural sentence segmentation
        url = "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&diarize=true&smart_format=true&interim_results=true&endpointing=300&utterance_end_ms=1000&vad_events=true"
        if language and language != "auto":
            url += f"&language={language}"
        else:
            url += "&detect_language=true"

        try:
            dg_ws = await websockets.connect(
                url,
                additional_headers={"Authorization": f"Token {dg_api_key}"}
            )
            logger.info("[%s] Connected to Deepgram Streaming WebSocket", session_id)
        except Exception as e:
            logger.error("[%s] Deepgram WebSocket connection failed: %s. Falling back to local.", session_id, e)
            use_deepgram = False

    all_audio_data = bytearray()
    fallback_buffer = bytearray()
    is_paused = False
    patient_id = "unknown"
    segment_counter = 0
    start_time = time.monotonic()
    current_speaker = "Doctor"
    speaker_map = {} # Maps Deepgram speaker ID to "Doctor" or "Patient"

    async def receive_deepgram_transcripts():
        """Listen for Deepgram responses and forward them to the frontend."""
        nonlocal segment_counter
        try:
            while dg_ws and not dg_ws.closed:
                res = await dg_ws.recv()
                data = json.loads(res)
                
                if data.get("type") == "Results":
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if alternatives:
                        alt = alternatives[0]
                        text = alt.get("transcript", "").strip()
                        if not text:
                            continue

                        # Extract diarized speaker if available
                        speaker_label = "Doctor"
                        words = alt.get("words", [])
                        if words:
                            spk = words[0].get("speaker", 0)
                            if spk not in speaker_map:
                                if len(speaker_map) == 0:
                                    speaker_map[spk] = "Doctor"
                                elif len(speaker_map) == 1:
                                    speaker_map[spk] = "Patient"
                                else:
                                    speaker_map[spk] = "Patient"
                            speaker_label = speaker_map[spk]

                        is_final = data.get("is_final", False)
                        if is_final:
                            segment_counter += 1
                        elapsed = time.monotonic() - start_time
                        
                        response = {
                            "type": "transcript",
                            "data": {
                                "text": text,
                                "speaker": speaker_label,
                                "timestamp": round(elapsed, 2),
                                "is_final": is_final,
                            },
                        }
                        try:
                            await websocket.send_json(response)
                        except Exception:
                            break
        except Exception as e:
            logger.error("[%s] Deepgram receive error: %s", session_id, e)

    dg_receive_task = None
    if use_deepgram and dg_ws:
        dg_receive_task = asyncio.create_task(receive_deepgram_transcripts())

    async def process_fallback_audio():
        """Fallback processing using Local Whisper REST if Deepgram fails."""
        nonlocal segment_counter, current_speaker, fallback_buffer
        if not fallback_buffer:
            return
            
        chunk_bytes = bytes(fallback_buffer)
        fallback_buffer.clear()
        
        num_samples = len(chunk_bytes) // BYTES_PER_SAMPLE
        if num_samples == 0:
            return

        audio_array = np.frombuffer(chunk_bytes, dtype=np.int16).astype(np.float32)
        audio_array = audio_array / 32768.0

        current_speaker = _detect_speaker(audio_array, current_speaker, segment_counter)
        lang_code = language if (language and language != "auto") else None
        
        segments = transcribe_audio(audio_array, language=lang_code)

        for seg in segments:
            text = seg.get("text", "").strip()
            if not text:
                continue

            lower = text.lower()
            if lower in ("thank you.", "thanks for watching.", "you", "...", "thank you for watching.", "bye.", "subscribe", "thanks."):
                continue

            segment_counter += 1
            elapsed = time.monotonic() - start_time
            response = {
                "type": "transcript",
                "data": {
                    "text": text,
                    "speaker": current_speaker,
                    "timestamp": round(elapsed, 2),
                    "is_final": True,  # Whisper fallback segments are final chunks
                },
            }
            try:
                await websocket.send_json(response)
            except Exception:
                pass

    # Heartbeat task to detect dead connections
    async def heartbeat() -> None:
        while True:
            try:
                await asyncio.sleep(30)
                await websocket.send_json({"type": "ping", "data": {"ts": time.time()}})
                if dg_ws and not dg_ws.closed:
                    await dg_ws.send(json.dumps({"type": "KeepAlive"}))
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
                all_audio_data.extend(raw_bytes)

                if use_deepgram and dg_ws:
                    try:
                        await dg_ws.send(raw_bytes)
                    except Exception as e:
                        logger.error("[%s] Failed to send to Deepgram: %s", session_id, e)
                else:
                    # Fallback buffering
                    fallback_buffer.extend(raw_bytes)
                    if len(fallback_buffer) >= FALLBACK_BUFFER_BYTES:
                        await process_fallback_audio()

            elif "text" in message and message["text"]:
                try:
                    control = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                msg_type = control.get("type", "")
                action = control.get("action", "")

                if msg_type == "control":
                    if action == "pause":
                        is_paused = True
                        await websocket.send_json({"type": "status", "data": {"status": "paused"}})

                    elif action == "resume":
                        is_paused = False
                        await websocket.send_json({"type": "status", "data": {"status": "recording"}})

                    elif action == "stop":
                        patient_id = control.get("patient_id", patient_id)
                        
                        if not use_deepgram and len(fallback_buffer) > 0:
                            await process_fallback_audio()

                        # Close Deepgram connection gracefully
                        if use_deepgram and dg_ws:
                            try:
                                await dg_ws.send(json.dumps({"type": "CloseStream"}))
                                await asyncio.sleep(1) # give time for final transcripts
                            except Exception:
                                pass

                        if all_audio_data:
                            try:
                                file_url = await save_audio_to_storage(
                                    session_id=session_id,
                                    patient_id=patient_id,
                                    audio_data=bytes(all_audio_data),
                                    sample_rate=SAMPLE_RATE,
                                )
                                await websocket.send_json({
                                    "type": "status",
                                    "data": {
                                        "status": "stopped",
                                        "audio_url": file_url,
                                        "segments_transcribed": segment_counter,
                                    }
                                })
                            except Exception as e:
                                logger.error("[%s] Failed to save audio: %s", session_id, e)
                                await websocket.send_json({
                                    "type": "status",
                                    "data": {
                                        "status": "stopped",
                                        "audio_url": "",
                                        "segments_transcribed": segment_counter,
                                        "error": str(e),
                                    }
                                })
                        else:
                            await websocket.send_json({
                                "type": "status",
                                "data": {
                                    "status": "stopped",
                                    "audio_url": "",
                                    "segments_transcribed": segment_counter,
                                }
                            })
                        break

                    if "patient_id" in control:
                        patient_id = control["patient_id"]

    except WebSocketDisconnect:
        logger.info("[%s] WebSocket disconnected", session_id)
    except Exception as e:
        logger.error("[%s] WebSocket error: %s", session_id, e)
    finally:
        heartbeat_task.cancel()
        if dg_receive_task:
            dg_receive_task.cancel()
        if dg_ws:
            try:
                await dg_ws.close()
            except Exception:
                pass
        logger.info("[%s] WebSocket session ended (segments: %d)", session_id, segment_counter)
