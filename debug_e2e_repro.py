"""Verbose repro of the courtroom e2e flow to locate the empty-recv failure."""
import json, time, urllib.request
import websocket

BASE_HTTP = "http://127.0.0.1:8000"

def post(path, body):
    req = urllib.request.Request(BASE_HTTP + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req).read())

def drain(clients, label):
    """Read whatever is pending on each client; print raw payloads (repr)."""
    for i, c in enumerate(clients):
        got = []
        while True:
            try:
                raw = c["ws"].recv
            except websocket.WebSocketTimeoutException:
                break
            if raw == "":
                got.append("<EMPTY/CLOSED>")
                continue
            try:
                m = json.loads(raw)
                got.append(m.get("type", raw[:40]))
            except Exception as e:
                got.append(f"<NON-JSON {raw[:40]!r}>")
        if got:
            print(f"  [{label}] client {i} ({c['name']}) pending: {got}")
        else:
            print(f"  [{label}] client {i} ({c['name']}) nothing pending")

def send_and_collect(clients, sender_idx, mtype, text):
    clients[sender_idx]["ws"].send(json.dumps({"type": mtype, "text": text}))
    time.sleep(0.3)
    entries = []
    for i, c in enumerate(clients):
        while True:
            try:
                raw = c["ws"].recv()
            except websocket.WebSocketTimeoutException:
                break
            if raw == "":
                print(f"  !!! client {i} ({c['name']}) recv returned EMPTY (closed) during {mtype}")
                entries.append("<!EMPTY!>")
                continue
            try:
                m = json.loads(raw)
            except Exception as e:
                print(f"  !!! client {i} ({c['name']}) NON-JSON payload: {raw[:60]!r}")
                continue
            if m.get("type") == "transcript_entry":
                entries.append(m["entry"]["text"])
    print(f"  [{mtype}] collected {len(entries)} entries")
    return entries

r = post("/api/court/rooms", {"case_title": "Debug Repro Trial", "created_by": "Debugger"})
rid = r["room_id"]
print(f"Room: {rid}")

participants = [("Justice Mehta", "Judge"), ("Adv. Priya Sharma", "Defence"),
                ("Adv. Suresh Rao", "Prosecution"), ("Ramu the Witness", "Witness")]
clients = []
for name, role in participants:
    ws = websocket.WebSocket()
    ws.settimeout(4)
    ws.connect(f"ws://127.0.0.1:8000/ws/court/{rid}")
    ws.send(json.dumps({"type": "join", "name": name, "role": role}))
    m = json.loads(ws.recv())
    assert m["type"] == "room_state", m
    clients.append({"ws": ws, "name": name, "me": m["me"]})
    drain(clients, f"after {name} joined")

print("\n--- Opening statements ---")
send_and_collect(clients, 0, "statement", "Order in the court. Trial in session.")
send_and_collect(clients, 2, "statement", "The State alleges armed robbery on March 15.")
send_and_collect(clients, 1, "statement", "My client pleads not guilty.")

print("\n--- Phase change ---")
clients[0]["ws"].send(json.dumps({"type": "set_phase", "phase": "Examination"}))
time.sleep(0.3)
for i, c in enumerate(clients):
    while True:
        try:
            raw = c["ws"].recv()
        except websocket.WebSocketTimeoutException:
            break
        if raw == "":
            print(f"  !!! client {i} EMPTY during phase read")
            break
        m = json.loads(raw)
        if m.get("type") == "phase_changed":
            print(f"  client {i} phase: {m['phase']}")
            break

print("\n--- Objection + Ruling ---")
send_and_collect(clients, 1, "action", "Objection - leading question.")
send_and_collect(clients, 0, "action", "Objection sustained. Rephrase, Prosecution.")

print("\n--- Post-ruling drain ---")
drain(clients, "post-ruling")

for c in clients:
    try:
        c["ws"].close()
    except Exception:
        pass
print("\nDONE")
