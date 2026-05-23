"""
Project Cura - Simple Energy-Based Speaker Diarization.

Analyzes audio energy levels and silence gaps to detect speaker changes.
No external ML model required - uses numpy for energy calculations.
"""

import logging

import numpy as np

from app.models.schemas import SpeakerSegment

logger = logging.getLogger(__name__)

# Minimum silence gap (in seconds) to consider a speaker change
SILENCE_GAP_THRESHOLD = 1.5

# Energy threshold fraction (relative to mean energy) below which audio is silence
SILENCE_ENERGY_RATIO = 0.15

# Minimum segment duration in seconds to avoid micro-segments
MIN_SEGMENT_DURATION = 0.3

# Frame size for energy calculation (in samples at 16kHz)
FRAME_SIZE = 1600  # 100ms at 16kHz


def _compute_frame_energies(audio_data: np.ndarray, frame_size: int) -> np.ndarray:
    """
    Compute RMS energy per frame.

    Args:
        audio_data: Mono audio samples as float32.
        frame_size: Number of samples per frame.

    Returns:
        Array of RMS energy values, one per frame.
    """
    num_frames = len(audio_data) // frame_size
    if num_frames == 0:
        return np.array([0.0])

    # Trim audio to exact multiple of frame_size
    trimmed = audio_data[: num_frames * frame_size]
    frames = trimmed.reshape(num_frames, frame_size)
    energies = np.sqrt(np.mean(frames ** 2, axis=1))
    return energies


def _detect_silence_gaps(
    energies: np.ndarray,
    sample_rate: int,
    frame_size: int,
    silence_threshold: float,
) -> list[tuple[float, float]]:
    """
    Detect silence gaps in the audio based on energy levels.

    Args:
        energies: Per-frame RMS energy values.
        sample_rate: Audio sample rate in Hz.
        frame_size: Samples per frame.
        silence_threshold: Energy threshold below which a frame is silent.

    Returns:
        List of (start_time, end_time) tuples for silence gaps longer than SILENCE_GAP_THRESHOLD.
    """
    frame_duration = frame_size / sample_rate
    is_silent = energies < silence_threshold
    gaps: list[tuple[float, float]] = []

    gap_start: float | None = None
    for i, silent in enumerate(is_silent):
        time = i * frame_duration
        if silent:
            if gap_start is None:
                gap_start = time
        else:
            if gap_start is not None:
                gap_end = time
                gap_duration = gap_end - gap_start
                if gap_duration >= SILENCE_GAP_THRESHOLD:
                    gaps.append((gap_start, gap_end))
                gap_start = None

    # Handle trailing silence
    if gap_start is not None:
        gap_end = len(energies) * frame_duration
        if (gap_end - gap_start) >= SILENCE_GAP_THRESHOLD:
            gaps.append((gap_start, gap_end))

    return gaps


def diarize_segments(
    audio_data: np.ndarray,
    sample_rate: int,
    transcript_segments: list[dict],
) -> list[SpeakerSegment]:
    """
    Perform simple energy-based speaker diarization.

    Analyzes silence gaps in the audio and assigns alternating speakers
    (Doctor first, then Patient) at each detected speaker change boundary.

    Args:
        audio_data: Mono audio samples as float32 numpy array.
        sample_rate: Audio sample rate in Hz (typically 16000).
        transcript_segments: List of transcript segment dicts with keys:
            text, start, end.

    Returns:
        List of SpeakerSegment objects with speaker labels.
    """
    if not transcript_segments:
        return []

    # Ensure float32
    if audio_data.dtype != np.float32:
        audio_data = audio_data.astype(np.float32)

    # Compute frame energies
    energies = _compute_frame_energies(audio_data, FRAME_SIZE)

    # Determine silence threshold
    mean_energy = np.mean(energies)
    silence_threshold = mean_energy * SILENCE_ENERGY_RATIO

    # Detect silence gaps that might indicate speaker changes
    silence_gaps = _detect_silence_gaps(
        energies, sample_rate, FRAME_SIZE, silence_threshold
    )

    logger.info(
        "Detected %d silence gaps (threshold=%.4f, mean_energy=%.4f)",
        len(silence_gaps),
        silence_threshold,
        mean_energy,
    )

    # Build speaker change timestamps from silence gap midpoints
    change_times: list[float] = []
    for gap_start, gap_end in silence_gaps:
        midpoint = (gap_start + gap_end) / 2.0
        change_times.append(midpoint)

    # Assign speakers to transcript segments
    speakers = ["Doctor", "Patient"]
    current_speaker_idx = 0
    change_idx = 0
    results: list[SpeakerSegment] = []

    for seg in transcript_segments:
        seg_start = seg.get("start", 0.0)
        seg_end = seg.get("end", 0.0)
        seg_text = seg.get("text", "").strip()

        if not seg_text:
            continue

        # Skip very short segments
        if (seg_end - seg_start) < MIN_SEGMENT_DURATION:
            if results:
                # Merge into the previous segment
                results[-1].text += " " + seg_text
                results[-1].end_time = seg_end
                continue

        # Check if any speaker change boundary falls before this segment
        while change_idx < len(change_times) and change_times[change_idx] <= seg_start:
            current_speaker_idx = 1 - current_speaker_idx  # Toggle speaker
            change_idx += 1

        results.append(
            SpeakerSegment(
                speaker=speakers[current_speaker_idx],
                text=seg_text,
                start_time=seg_start,
                end_time=seg_end,
            )
        )

    # If no silence gaps were detected, still label first speaker as Doctor
    if not results and transcript_segments:
        for seg in transcript_segments:
            seg_text = seg.get("text", "").strip()
            if seg_text:
                results.append(
                    SpeakerSegment(
                        speaker="Doctor",
                        text=seg_text,
                        start_time=seg.get("start", 0.0),
                        end_time=seg.get("end", 0.0),
                    )
                )

    logger.info("Diarized %d segments across speakers", len(results))
    return results
