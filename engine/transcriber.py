import queue
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

class CuraTranscriber:
    def __init__(self, model_size="small"): 
        # Optimized for your Vivobook CPU
        self.model = WhisperModel(
            model_size, 
            device="cpu", 
            compute_type="int8", 
            download_root="./models" 
        )
        self.audio_queue = queue.Queue()
        self.sample_rate = 16000
        # Reduced buffer size for instant feedback
        self.buffer_duration = 0.5 

    def _audio_callback(self, indata, frames, time, status):
        self.audio_queue.put(indata.copy())

    def capture_and_transcribe(self):
        # We use a larger sliding window (internal to Whisper) to keep context
        # but we trigger the transcription much faster
        with sd.InputStream(samplerate=self.sample_rate, channels=1, callback=self._audio_callback):
            while True:
                # Accumulate only 0.8 seconds for near-instant display
                chunks = []
                for _ in range(int(self.sample_rate / 1024 * 0.8)):
                    chunks.append(self.audio_queue.get())
                
                audio_data = np.concatenate(chunks).flatten()
                
                # FAST-STREAM PARAMS:
                segments, _ = self.model.transcribe(
                    audio_data,
                    beam_size=1,        # Beam size 1 is much faster for real-time
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=300),
                    initial_prompt="Patient name Satya. Symptoms: stomach pain, constipation, cough.",
                    # Critical for speed:
                    no_speech_threshold=0.6,
                    language="en" # Set to None for auto-detect if needed
                )
                
                for segment in segments:
                    if segment.text.strip():
                        yield segment.text.strip()