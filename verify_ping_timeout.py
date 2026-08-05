"""Verify the hypothesis: uvicorn's default WS ping timeout (20s) closes
connections that aren't read/ponged in time. Connect a client, join a room,
then go silent for 25s and see if the connection survives."""
import json, time, urllib.request
import websocket

BASE_HTTP = "http://127.0.0.1:8000"

def post(path, body):
    req = urllib.request.Request(BASE_HTTP + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req).read())

r = post("/api/court/rooms", {"case_title": "Ping Timeout Probe", "created_by": "Prober"})
rid = r["room_id"]
print(f"Room: {rid}")

ws = websocket.WebSocket()
ws.settimeout(3)
ws.connect(f"ws://127.0.0.1:8000/ws/court/{rid}")
ws.send(json.dumps({"type": "join", "name": "Silent Client", "role": "Judge"}))
m = json.loads(ws.recv())
print(f"joined, got {m['type']}")

print("Going silent for 45s (no reads, no sends)...")
t0 = time.time()
time.sleep(45)
elapsed = time.time() - t0
print(f"waited {elapsed:.1f}s")

try:
    raw = ws.recv()
    print(f"recv after silence: {raw[:60]!r}")
except websocket.WebSocketTimeoutException:
    print("recv: TIMEOUT -> connection ALIVE (no ping kill)")
except Exception as e:
    print(f"recv: EXC {type(e).__name__}: {e}")

try:
    ws.close()
except Exception:
    pass
