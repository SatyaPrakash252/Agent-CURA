import asyncio
import httpx
import websockets
import json

async def test_local_server():
    print("Testing HTTP Health Endpoint...")
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get("http://127.0.0.1:8000/api/v1/health", timeout=5.0)
            print(f"HTTP Status: {res.status_code}")
            print(f"HTTP Response: {res.text}")
    except Exception as e:
        print("HTTP request failed:")
        import traceback
        traceback.print_exc()

    print("\nTesting WebSocket Connection...")
    try:
        async with websockets.connect("ws://127.0.0.1:8000/ws/v1/audio/test-session") as ws:
            print("Connected to WebSocket successfully!")
            await ws.send(json.dumps({"type": "pong", "data": {"ts": 0}}))
            print("Sent pong control packet.")
            
            # Wait for any status or ping message
            try:
                res = await asyncio.wait_for(ws.recv(), timeout=2.0)
                print(f"Received from WebSocket: {res}")
            except asyncio.TimeoutError:
                print("No message received (timeout), closing.")
    except Exception as e:
        print("WebSocket connection failed:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_local_server())
