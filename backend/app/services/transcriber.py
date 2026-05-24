"""
Project Cura - Whisper Transcription Service.

Provides singleton model loading and audio transcription
using the faster-whisper library.
"""

import logging
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

from app.config import get_settings

logger = logging.getLogger(__name__)

_whisper_model: WhisperModel | None = None
_model_loaded: bool = False


def is_model_loaded() -> bool:
    """Check whether the Whisper model has been loaded."""
    return _model_loaded


def load_model() -> WhisperModel:
    """
    Load the Whisper model (singleton). The model is loaded once and reused.

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
    local_model_ct2 = model_path / "model.bin"  # CTranslate2 format

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


def transcribe_audio(
    audio_data: np.ndarray, language: str | None = None
) -> list[dict]:
    """
    Transcribe audio data using the Whisper model.

    Args:
        audio_data: NumPy array of audio samples (float32, mono, 16kHz).
        language: Optional language code to force (e.g., 'en', 'hi').

    Returns:
        List of segment dicts with keys: text, start, end, language.
    """
    model = load_model()

    # Ensure audio is float32 and normalized
    if audio_data.dtype != np.float32:
        audio_data = audio_data.astype(np.float32)

    # Normalize to [-1, 1] range if needed
    max_val = np.max(np.abs(audio_data))
    if max_val > 1.0:
        audio_data = audio_data / max_val

    transcribe_kwargs: dict = {
        "beam_size": 5,
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
                    "language": detected_language,
                }
            )

        logger.info(
            "Transcribed %d segments, detected language: %s",
            len(results),
            detected_language,
        )
        return results

    except Exception as e:
        logger.error("Transcription error: %s", e)
        return []
