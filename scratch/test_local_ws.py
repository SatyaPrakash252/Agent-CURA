import asyncio
import websockets
import json
import numpy as np

async def test_conn():
    url = "ws://localhost:8000/ws/v1/audio/local-test-session"
    print(f"Attempting to connect to local backend: {url}")
    try:
        async with websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=10,
        ) as ws:
            print("Connected successfully!")
            
            # Read first message (status)
            msg = await ws.recv()
            print(f"Received status message: {msg}")
            
            # Send 1 second of dummy float32 audio downsampled and converted to 16-bit signed PCM
            # 16000 samples * 2 bytes = 32000 bytes
            dummy_pcm = np.zeros(16000, dtype=np.int16).tobytes()
            print(f"Sending {len(dummy_pcm)} bytes of dummy audio data...")
            await ws.send(dummy_pcm)
            print("Audio sent!")
            
            # Wait for any transcript or status message
            try:
                for _ in range(5):
                    response = await asyncio.wait_for(ws.recv(), timeout=3.0)
                    print(f"Server response: {response}")
            except asyncio.TimeoutError:
                print("No response from server within timeout.")
                
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
