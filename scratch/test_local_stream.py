import asyncio
import websockets
import json
import numpy as np

async def test_local_stream():
    url = "ws://localhost:8000/ws/v1/audio/local-test-session-999"
    print(f"Attempting to connect to local backend: {url}")
    try:
        async with websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=10,
            additional_headers={"Origin": "http://localhost:3000"}
        ) as ws:
            print("Connected successfully!")
            
            # Read first message (status)
            status_msg = await ws.recv()
            print(f"Initial server status: {status_msg}")
            
            # Send 5 chunks of dummy audio (150ms each at 16kHz linear16 = 2400 samples * 2 bytes = 4800 bytes)
            dummy_chunk = np.zeros(2400, dtype=np.int16).tobytes()
            
            for i in range(5):
                print(f"Sending chunk {i+1} ({len(dummy_chunk)} bytes)...")
                await ws.send(dummy_chunk)
                await asyncio.sleep(0.15)
                
            print("All chunks sent. Waiting to see if connection is closed or kept alive...")
            
            # Keep listening for 5 seconds
            try:
                while True:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    print(f"Received from server: {msg}")
            except asyncio.TimeoutError:
                print("No further messages from server (still open/idle).")
                
    except Exception as e:
        print(f"Connection failed or dropped: {e}")

if __name__ == "__main__":
    asyncio.run(test_local_stream())
