import asyncio
import websockets
import json

async def test_conn():
    url = "wss://project-cura-backend.onrender.com/ws/v1/audio/test-session-12345"
    print(f"Attempting to connect to: {url}")
    try:
        async with websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=10,
        ) as ws:
            print("Connected successfully!")
            
            # Wait for any status messages or ping
            while True:
                msg = await ws.recv()
                print(f"Received message: {msg}")
                data = json.loads(msg)
                if data.get("type") == "ping":
                    # Respond to ping
                    await ws.send(json.dumps({"type": "pong", "data": data.get("data")}))
                    print("Sent pong!")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
