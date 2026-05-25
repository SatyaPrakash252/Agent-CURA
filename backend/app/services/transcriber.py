"""
Project Cura - Whisper & Deepgram Transcription Service.

Provides dual-engine audio transcription:
1. Deepgram Cloud STT (high speed, 0% CPU, cloud diarization)
2. Local faster-whisper Fallback (failsafe greedy decoding)
"""

import io
import wave
import logging
from pathlib import Path

import httpx
import numpy as np
from faster_whisper import WhisperModel

from app.config import get_settings

logger = logging.getLogger(__name__)

_whisper_model: WhisperModel | None = None
_model_loaded: bool = False


def is_model_loaded() -> bool:
    """Check whether the local Whisper model has been loaded."""
    return _model_loaded


def load_model() -> WhisperModel:
    """
    Load the local Whisper model (singleton). The model is loaded once and reused.

    Returns:
        The loaded WhisperModel instance.
    """
    global _whisper_model, _model_loaded

    if _whisper_model is not None:
        return _whisper_model

    settings = get_settings()
    model_root = Path(settings.MODEL_DOWNLOAD_ROOT).resolve()
    model_path = model_root / f"models--Systran--faster-whisper-{settings.WHISPER_MODEL_SIZE}"

    # Check if the local path has the actual model file
    local_model_bin = model_path / "model.bin"

    if model_path.exists() and (local_model_bin.exists() or (model_path / "config.json").exists()):
        model_source = str(model_path)
        logger.info("Loading Whisper model from local path: %s", model_source)
    else:
        # Download from HuggingFace
        model_source = f"Systran/faster-whisper-{settings.WHISPER_MODEL_SIZE}"
        logger.info(
            "Downloading Whisper model from HuggingFace: %s (will cache to %s)",
            model_source,
            model_root,
        )

    _whisper_model = WhisperModel(
        model_source,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
        download_root=str(model_root),
    )
    _model_loaded = True
    logger.info(
        "Whisper model loaded (size=%s, device=%s, compute=%s)",
        settings.WHISPER_MODEL_SIZE,
        settings.WHISPER_DEVICE,
        settings.WHISPER_COMPUTE_TYPE,
    )
    return _whisper_model


def _convert_to_wav(audio_data: np.ndarray, sample_rate: int = 16000) -> bytes:
    """Convert float32 raw PCM audio samples to 16-bit signed WAV bytes."""
    # Ensure audio is float32 and normalized to [-1, 1]
    if audio_data.dtype != np.float32:
        audio_data = audio_data.astype(np.float32)

    max_val = np.max(np.abs(audio_data))
    if max_val > 1.0:
        audio_data = audio_data / max_val

    # Convert to 16-bit PCM scale
    pcm_data = (audio_data * 32767).astype(np.int16).tobytes()

    # Write WAV binary header and payload
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)   # 16-bit (2 bytes per sample)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)

    return wav_buffer.getvalue()


def _transcribe_deepgram(
    audio_bytes: bytes, api_key: str, language: str | None = None
) -> list[dict]:
    """Transcribe audio WAV bytes using the Deepgram Nova-2 REST API."""
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "audio/wav",
    }

    # Setup query parameters for greedy real-time Nova-2 STT with speaker diarization
    params = {
        "model": "nova-2",
        "smart_format": "true",
        "diarize": "true",
        "punctuate": "true",
        "utterances": "true",
    }

    # Force selected language or use automatic detection
    if language and language != "auto":
        params["language"] = language
    else:
        params["detect_language"] = "true"

    try:
        logger.info("Dispatching audio chunk to Deepgram Cloud (Nova-2 API)...")
        with httpx.Client() as client:
            response = client.post(
                "https://api.deepgram.com/v1/listen",
                headers=headers,
                params=params,
                content=audio_bytes,
                timeout=12.0,
            )

        if response.status_code != 200:
            logger.error("Deepgram API Error: %d - %s", response.status_code, response.text)
            return []

        payload = response.json()
        channels = payload.get("results", {}).get("channels", [])
        if not channels:
            return []

        alternative = channels[0].get("alternatives", [{}])[0]
        detected_language = payload.get("results", {}).get("channels", [{}])[0].get("detected_language", "en")
        
        results = []

        # Parse structural paragraphs for highest diarization accuracy
        paragraphs_block = alternative.get("paragraphs", {})
        paragraphs = paragraphs_block.get("paragraphs", [])

        if paragraphs:
            for p in paragraphs:
                speaker_id = p.get("speaker", 0)
                # Map speaker 0 -> Doctor, speaker 1 -> Patient (or alternate)
                speaker_label = "Patient" if speaker_id == 1 else "Doctor"
                
                sentences = p.get("sentences", [])
                p_text = " ".join([s.get("text", "") for s in sentences]).strip()
                
                if p_text:
                    results.append({
                        "text": p_text,
                        "start": p.get("start", 0.0),
                        "end": p.get("end", 0.0),
                        "speaker": speaker_label,
                        "language": detected_language,
                    })
        else:
            # Fall back to words list if paragraphs are not structured
            words = alternative.get("words", [])
            if words:
                current_speaker_id = None
                current_text_words = []
                start_time = words[0].get("start", 0.0)

                for w in words:
                    spk_id = w.get("speaker", 0)
                    if current_speaker_id is None:
                        current_speaker_id = spk_id

                    if spk_id != current_speaker_id:
                        spk_label = "Patient" if current_speaker_id == 1 else "Doctor"
                        text_str = " ".join(current_text_words).strip()
                        if text_str:
                            results.append({
                                "text": text_str,
                                "start": start_time,
                                "end": w.get("start", 0.0),
                                "speaker": spk_label,
                                "language": detected_language,
                            })
                        current_speaker_id = spk_id
                        current_text_words = []
                        start_time = w.get("start", 0.0)

                    current_text_words.append(w.get("word", ""))

                if current_text_words:
                    spk_label = "Patient" if current_speaker_id == 1 else "Doctor"
                    text_str = " ".join(current_text_words).strip()
                    if text_str:
                        results.append({
                            "text": text_str,
                            "start": start_time,
                            "end": words[-1].get("end", 0.0),
                            "speaker": spk_label,
                            "language": detected_language,
                        })
            else:
                # Absolute baseline fallback (no diarization)
                transcript = alternative.get("transcript", "").strip()
                if transcript:
                    results.append({
                        "text": transcript,
                        "start": 0.0,
                        "end": 2.0,
                        "speaker": "Doctor",
                        "language": detected_language,
                    })

        logger.info("Deepgram Cloud completed: extracted %d diarized segments", len(results))
        return results

    except Exception as e:
        logger.error("Deepgram HTTP Exception: %s", e)
        return []


def transcribe_audio(
    audio_data: np.ndarray, language: str | None = None
) -> list[dict]:
    """
    Transcribe audio data using Deepgram Cloud STT (primary) or local Whisper (fallback).

    Args:
        audio_data: NumPy array of audio samples (float32, mono, 16kHz).
        language: Optional language code to force (e.g., 'en', 'hi', 'es').

    Returns:
        List of segment dicts with keys: text, start, end, speaker, language.
    """
    settings = get_settings()

    # 1. Primary Engine: Deepgram Cloud STT (if key is configured)
    if settings.DEEPGRAM_API_KEY and len(settings.DEEPGRAM_API_KEY.strip()) > 0:
        try:
            # Convert float32 array to 16-bit signed WAV bytes
            wav_bytes = _convert_to_wav(audio_data, sample_rate=16000)
            segments = _transcribe_deepgram(wav_bytes, settings.DEEPGRAM_API_KEY, language=language)
            
            if segments:
                return segments
            logger.warning("Deepgram returned empty segments. Falling back to local Whisper...")
        except Exception as e:
            logger.error("Failsafe trigger: Deepgram Cloud failed (%s). Toggling local Whisper fallback...", e)

    # 2. Failsafe Fallback: Local faster-whisper Model
    logger.info("Executing Local Whisper Failsafe Fallback...")
    model = load_model()

    # Ensure audio is float32 and normalized
    if audio_data.dtype != np.float32:
        audio_data = audio_data.astype(np.float32)

    max_val = np.max(np.abs(audio_data))
    if max_val > 1.0:
        audio_data = audio_data / max_val

    transcribe_kwargs: dict = {
        "beam_size": 1,  # Greedy decoding for ultra-low latency
        "vad_filter": True,
        "vad_parameters": {
            "min_silence_duration_ms": 300,
        },
    }
    if language:
        transcribe_kwargs["language"] = language

    try:
        segments_gen, info = model.transcribe(audio_data, **transcribe_kwargs)
        detected_language = info.language if info else "en"
        results: list[dict] = []

        for segment in segments_gen:
            results.append(
                {
                    "text": segment.text.strip(),
                    "start": segment.start,
                    "end": segment.end,
                    "speaker": "Doctor",  # Local Whisper baseline has no diarization context
                    "language": detected_language,
                }
            )

        logger.info(
            "Local Whisper completed: transcribed %d segments, detected language: %s",
            len(results),
            detected_language,
        )
        return results

    except Exception as e:
        logger.error("Local Whisper failsafe error: %s", e)
        return []
