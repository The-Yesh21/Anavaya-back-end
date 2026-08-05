"""Surgical probe: join 4 clients, do phase change + objection round,
printing EVERY raw payload per client (repr) with hard recv caps so nothing hangs."""
import json, time, urllib.request
import websocket

BASE_HTTP = "http://127.0.0.1:8000"

def post(path, body):
    req = urllib.request.Request(BASE_HTTP + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req).read())

def recv_capped(ws, cap=20, label=""):
    """Drain up to `cap` messages, printing each raw payload. Returns list of parsed msgs."""
    out = []
    for k in range(cap):
        try:
            raw = ws.recv()
        except websocket.WebSocketTimeoutException:
            print(f"  [{label}] recv #{k}: TIMEOUT (done)")
            break
        except Exception as e:
            print(f"  [{label}] recv #{k}: EXC {type(e).__name__}: {e}")
            break
        if raw == "":
            print(f"  [{label}] recv #{k}: <EMPTY/CLOSED>  <<<< THE FAILURE MODE")
            # do NOT loop forever
            break
        try:
            m = json.loads(raw)
            print(f"  [{label}] recv #{k}: {m.get('type', '?')} | keys={sorted(m.keys())}")
            if m.get("type") == "transcript_entry":
                out.append(m["entry"]["text"])
        except Exception as e:
            print(f"  [{label}] recv #{k}: NON-JSON {raw[:60]!r} ({e})")
    return out

r = post("/api/court/rooms", {"case_title": "Probe Trial", "created_by": "Prober"})
rid = r["room_id"]
print(f"Room: {rid}")

participants = [("Justice Mehta", "Judge"), ("Adv. Priya Sharma", "Defence"),
                ("Adv. Suresh Rao", "Prosecution"), ("Ramu the Witness", "Witness")]
clients = []
for name, role in participants:
    ws = websocket.WebSocket()
    ws.settimeout(1.5)
    ws.connect(f"ws://127.0.0.1:8000/ws/court/{rid}")
    ws.send(json.dumps({"type": "join", "name": name, "role": role}))
    m = json.loads(ws.recv())
    assert m["type"] == "room_state", m
    clients.append({"ws": ws, "name": name})
    print(f"joined: {name}")
    for c in clients:
        recv_capped(c["ws"], label=f"{c['name']} post-join")

print("\n--- phase change (judge) ---")
clients[0]["ws"].send(json.dumps({"type": "set_phase", "phase": "Examination"}))
time.sleep(0.3)
for i, c in enumerate(clients):
    got = recv_capped(c["ws"], label=f"{c['name']} phase")
    phases = [g for g in got if g]
    print(f"  {c['name']} read {len(got)} msgs")

print("\n--- objection round (client 1 sends) ---")
clients[1]["ws"].send(json.dumps({"type": "action", "text": "Objection - leading question."}))
time.sleep(0.3)
for i, c in enumerate(clients):
    got = recv_capped(c["ws"], label=f"{c['name']} objection")
    print(f"  {c['name']} read {len(got)} msgs: {got[:1]}")

for c in clients:
    try:
        c["ws"].close()
    except Exception:
        pass
print("\nPROBE DONE")
