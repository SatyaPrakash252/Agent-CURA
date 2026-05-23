"""
Project Cura - Audio Storage Service.

Handles persisting recorded audio. Tries Supabase Storage first,
falls back to local file storage.
"""

import io
import logging
import os
import wave

from app.config import get_settings
from app.models.database import get_supabase, save_audio_metadata

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "audio-recordings"
LOCAL_AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "audio")


def _bytes_to_wav(audio_bytes: bytes, sample_rate: int) -> bytes:
    """Convert raw PCM audio bytes (16-bit signed, mono) to WAV format."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_bytes)
    return buf.getvalue()


async def save_audio_to_storage(
    session_id: str,
    patient_id: str,
    audio_data: bytes,
    sample_rate: int,
) -> str:
    """
    Save audio to storage and record metadata.
    Tries Supabase Storage first, falls back to local disk.
    """
    if not audio_data:
        logger.warning("No audio data to save for session %s", session_id)
        return ""

    try:
        wav_data = _bytes_to_wav(audio_data, sample_rate)
        num_samples = len(audio_data) // 2
        duration_seconds = num_samples / sample_rate if sample_rate > 0 else 0.0

        file_url = ""

        # Try Supabase Storage
        try:
            file_path = f"{patient_id}/{session_id}.wav"
            client = get_supabase()
            try:
                client.storage.from_(STORAGE_BUCKET).upload(
                    path=file_path,
                    file=wav_data,
                    file_options={"content-type": "audio/wav"},
                )
            except Exception as upload_err:
                if "Duplicate" in str(upload_err) or "already exists" in str(upload_err):
                    client.storage.from_(STORAGE_BUCKET).update(
                        path=file_path,
                        file=wav_data,
                        file_options={"content-type": "audio/wav"},
                    )
                else:
                    raise

            public_url_response = client.storage.from_(STORAGE_BUCKET).get_public_url(file_path)
            file_url = public_url_response if isinstance(public_url_response, str) else str(public_url_response)
            logger.info("Audio uploaded to Supabase Storage: %s", file_path)
        except Exception as e:
            # Fallback: save locally
            logger.warning("Supabase Storage unavailable (%s), saving locally", e)
            os.makedirs(LOCAL_AUDIO_DIR, exist_ok=True)
            local_path = os.path.join(LOCAL_AUDIO_DIR, f"{session_id}.wav")
            with open(local_path, "wb") as f:
                f.write(wav_data)
            file_url = f"local://{local_path}"
            logger.info("Audio saved locally: %s", local_path)

        # Save metadata
        await save_audio_metadata(session_id, patient_id, file_url, duration_seconds)

        logger.info(
            "Audio saved for session %s (%.1fs, %d bytes WAV)",
            session_id, duration_seconds, len(wav_data),
        )
        return file_url

    except Exception as e:
        logger.error("Failed to save audio for session %s: %s", session_id, e)
        return ""
