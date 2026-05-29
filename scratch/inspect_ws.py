import asyncio
import websockets

async def main():
    try:
        # Just creating the connection object without entering the context manager
        # websockets.connect returns a Connect object, but wait, when we await it:
        conn = websockets.connect("wss://api.deepgram.com")
        async with conn as ws:
            print("Attributes on ws:")
            for attr in sorted(dir(ws)):
                print(attr)
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(main())
