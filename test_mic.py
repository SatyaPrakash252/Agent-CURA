import sounddevice as sd
import numpy as np

def test_mic():
    print("Testing mic for 5 seconds... say something!")
    try:
        duration = 5  # seconds
        fs = 16000
        recording = sd.rec(int(duration * fs), samplerate=fs, channels=1)
        sd.wait()
        print("Mic works! Recording finished.")
    except Exception as e:
        print(f"Mic Error: {e}")

if __name__ == "__main__":
    test_mic()