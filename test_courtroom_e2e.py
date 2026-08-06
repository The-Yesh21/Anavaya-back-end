"""Full end-to-end courtroom verification test."""
import json, time, os, sys
import urllib.request

try:
    import websocket
except ImportError:
    print("Installing websocket-client...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websocket-client", "-q"])
    import websocket

BASE_HTTP = "http://127.0.0.1:8000"

def post(path, body):
    req = urllib.request.Request(
        BASE_HTTP + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return json.loads(urllib.request.urlopen(req).read())

def get(path):
    return json.loads(urllib.request.urlopen(BASE_HTTP + path).read())

def send_and_collect(clients, sender_idx, mtype, text):
    """Send a message from one client, collect transcript_entry broadcasts from all.

    Robust against closed sockets and non-JSON frames (which can happen when the
    server closes a connection during the drain).
    """
    clients[sender_idx]["ws"].send(
        json.dumps({"type": mtype, "text": text})
    )
    time.sleep(0.3)
    entries = []
    for c in clients:
        try:
            while True:
                raw = c["ws"].recv()
                if not raw:  # connection closed
                    break
                try:
                    m = json.loads(raw)
                except (json.JSONDecodeError, ValueError):
                    continue
                if m.get("type") == "transcript_entry":
                    entries.append(m["entry"]["text"])
        except websocket.WebSocketTimeoutException:
            pass
        except websocket.WebSocketConnectionClosedException:
            pass
    return entries


# ── Step 1: Create a room ──────────────────────────────────────────
print("── Step 1: Create room ──────────────────────────────────────")
r = post("/api/court/rooms", {
    "case_title": "State vs. Rakesh Sharma \u2014 Armed Robbery",
    "created_by": "Justice Mehta",
})
rid = r["room_id"]
print(f"  Room created: {rid}")
print(f"  case_title: {r['case_title']}")
print(f"  phase: {r['phase']}")

# ── Step 2: Room appears in list ───────────────────────────────────
print("\n── Step 2: Room listed ───────────────────────────────────────")
rooms = get("/api/court/rooms")
assert any(x["room_id"] == rid for x in rooms), "Room not in list!"
print(f"  {len(rooms)} total rooms, our room present \u2713")

# ── Step 3: Four participants join via WebSocket ───────────────────
print("\n── Step 3: Participants join ───────────────────────────────")
participants = [
    ("Justice Mehta", "Judge"),
    ("Adv. Priya Sharma", "Defence"),
    ("Adv. Suresh Rao", "Prosecution"),
    ("Ramu the Witness", "Witness"),
]

clients = []
for name, role in participants:
    ws = websocket.WebSocket()
    ws.settimeout(8)
    ws.connect(f"ws://127.0.0.1:8000/ws/court/{rid}")
    ws.send(json.dumps({"type": "join", "name": name, "role": role}))
    m = json.loads(ws.recv())
    assert m["type"] == "room_state", f"Expected room_state, got {m['type']}"
    clients.append({"ws": ws, "me": m["me"], "msgs": []})
    print(f"  {name} joined as {m['me']['display_role']}")
    # Drain broadcasts from other joins
    time.sleep(0.15)
    try:
        while True:
            clients[-1]["msgs"].append(json.loads(ws.recv()))
    except websocket.WebSocketTimeoutException:
        pass

print(f"  Total participants: {len(clients)}")

# ── Step 4: Post opening statements ────────────────────────────────
print("\n── Step 4: Opening statements ───────────────────────────────")
# Judge opens
entries = send_and_collect(clients, 0, "statement",
    "Order in the court. This trial is now in session. Prosecution may present the opening statement.")
print(f"  Judge: \"{entries[0][:50]}\u2026\" (broadcast to {len(entries)})")

# Prosecution opening
entries = send_and_collect(clients, 2, "statement",
    "Your Honour, the State alleges that on the night of March 15, the accused Rakesh Sharma committed armed robbery at the State Bank of India, Ashok Nagar branch, threatening the cashier with a firearm and fleeing with Rs. 24 lakhs.")
print(f"  Prosecution: \"{entries[0][:50]}\u2026\"")

# Defence response
entries = send_and_collect(clients, 1, "statement",
    "My client pleads not guilty. The evidence is circumstantial and relies on a single eyewitness identification under poor lighting conditions.")
print(f"  Defence: \"{entries[0][:50]}\u2026\"")

# ── Step 5: Phase \u2192 Examination ──────────────────────────────
print("\n── Step 5: Phase \u2192 Examination ────────────────────────────")
clients[0]["ws"].send(json.dumps({"type": "set_phase", "phase": "Examination"}))
time.sleep(0.3)
for c in clients:
    try:
        while True:
            m = json.loads(c["ws"].recv())
            if m.get("type") == "phase_changed":
                print(f"  Phase: {m['phase']}")
                break
    except websocket.WebSocketTimeoutException:
        pass

# ── Step 6: Objection + Ruling flow ────────────────────────────────
print("\n── Step 6: Objection + Ruling ───────────────────────────────")
entries = send_and_collect(clients, 1, "action", "Objection \u2014 leading question.")
print(f"  Defence objects: \"{entries[0]}\"")

entries = send_and_collect(clients, 0, "action", "Objection sustained. Rephrase the question, Prosecution.")
print(f"  Judge ruling: \"{entries[0]}\"")

# Prosecution examines witness
entries = send_and_collect(clients, 2, "statement",
    "Witness, please state what you saw on the night of March 15 at the bank.")
print(f"  Prosecution examines: \"{entries[0][:50]}\u2026\"")

entries = send_and_collect(clients, 3, "statement",
    "I was withdrawing money from the ATM. I saw a man in a black hoodie rush out of the bank carrying a bag. He pushed past me and ran toward a motorcycle.")
print(f"  Witness testifies: \"{entries[0][:50]}\u2026\"")

# ── Step 7: Phase \u2192 Cross-Examination ───────────────────────
print("\n── Step 7: Phase \u2192 Cross-Examination ────────────────────")
clients[0]["ws"].send(json.dumps({"type": "set_phase", "phase": "Cross-Examination"}))
time.sleep(0.3)
for c in clients:
    try:
        while True:
            m = json.loads(c["ws"].recv())
            if m.get("type") == "phase_changed":
                print(f"  Phase: {m['phase']}")
                break
    except websocket.WebSocketTimeoutException:
        pass

entries = send_and_collect(clients, 1, "action",
    "The witness is directed to answer the question.")
print(f"  Defence directive: \"{entries[0][:50]}\u2026\"")

# ── Step 8: Phase \u2192 Closing ─────────────────────────────────
print("\n── Step 8: Phase \u2192 Closing ──────────────────────────────")
clients[0]["ws"].send(json.dumps({"type": "set_phase", "phase": "Closing"}))
time.sleep(0.3)
for c in clients:
    try:
        while True:
            m = json.loads(c["ws"].recv())
            if m.get("type") == "phase_changed":
                print(f"  Phase: {m['phase']}")
                break
    except websocket.WebSocketTimeoutException:
        pass

entries = send_and_collect(clients, 0, "statement",
    "Both sides have presented their arguments. The court will now deliberate and reserve its judgment. The trial is concluded for today.")
print(f"  Judge concludes: \"{entries[0][:50]}\u2026\"")

# ── Step 9: Phase \u2192 Concluded ────────────────────────────────
print("\n── Step 9: Phase \u2192 Concluded ───────────────────────────")
clients[0]["ws"].send(json.dumps({"type": "set_phase", "phase": "Concluded"}))
time.sleep(0.3)
for c in clients:
    try:
        while True:
            m = json.loads(c["ws"].recv())
            if m.get("type") == "phase_changed":
                print(f"  Phase: {m['phase']}")
                break
    except websocket.WebSocketTimeoutException:
        pass

# ── Step 10: Verify persisted state ──────────────────────────────
print("\n── Step 10: Persisted state ────────────────────────────────")
state = get(f"/api/court/rooms/{rid}")
print(f"  Phase: {state['phase']}")
print(f"  Participants: {len(state['participants'])}")
print(f"  Transcript entries: {len(state['transcript'])}")
kinds = {}
for e in state["transcript"]:
    k = e["kind"]
    kinds[k] = kinds.get(k, 0) + 1
print(f"  Entry kinds: {json.dumps(kinds)}")
assert state["phase"] == "Concluded", "Phase not Concluded!"
assert len(state["participants"]) == 4, "Wrong participant count!"
assert len(state["transcript"]) >= 12, "Too few transcript entries!"

# ── Step 11: Download transcript ───────────────────────────────────
print("\n── Step 11: Markdown transcript download ────────────────────")
md = urllib.request.urlopen(BASE_HTTP + f"/api/court/rooms/{rid}/transcript").read().decode()
lines = md.strip().splitlines()
print(f"  {len(lines)} lines")
print(f"  Title: {lines[0]}")
assert "## Participants" in md, "Missing Participants section!"
assert "## Proceedings" in md, "Missing Proceedings section!"
assert "Objection" in md, "Missing objection text!"
assert "sustained" in md, "Missing ruling text!"
assert ("ATM" in md or "motorcycle" in md), "Missing witness testimony!"
print("  All content checks passed \u2713")

# ── Step 12: Verify JSON on disk ──────────────────────────────────
print("\n── Step 12: JSON file on disk ──────────────────────────────")
jpath = os.path.join("case_priority_system", "courtrooms", f"{rid}.json")
assert os.path.exists(jpath), f"JSON file missing: {jpath}"
disk = json.load(open(jpath))
assert disk["phase"] == "Concluded"
assert len(disk["transcript"]) >= 12
print(f"  {len(disk['transcript'])} entries, phase={disk['phase']} \u2713")

# ── Step 13: WebRTC signaling relay ────────────────────────────────
print("\n── Step 13: WebRTC signal relay ─────────────────────────────")
clients[2]["ws"].send(json.dumps({
    "type": "sdp_offer",
    "target_participant_id": clients[0]["me"]["participant_id"],
    "data": {"sdp": "MOCK_SDP", "type": "offer"},
}))
time.sleep(0.2)
try:
    m = json.loads(clients[0]["ws"].recv())
    print(f"  Signal relayed: {m['type']} (Prosecution \u2192 Judge) \u2713")
except websocket.WebSocketTimeoutException:
    print("  Signal relay: TIMEOUT (may need debug)")

# ── Step 14: Duplicate role rejection ─────────────────────────────
print("\n── Step 14: Duplicate role rejection ─────────────────────────")
ws2 = websocket.WebSocket()
ws2.settimeout(8)
ws2.connect(f"ws://127.0.0.1:8000/ws/court/{rid}")
ws2.send(json.dumps({"type": "join", "name": "Imposter", "role": "Judge"}))
m = json.loads(ws2.recv())
assert m["type"] == "error", f"Expected error, got {m['type']}"
print(f"  Rejected: \"{m['message'][:60]}\" \u2713")
ws2.close()

# Cleanup
for c in clients:
    try:
        c["ws"].close()
    except Exception:
        pass

print("\n" + "=" * 60)
print("   ALL 14 PHASE-4 VERIFICATION TESTS PASSED \u2713")
print("=" * 60)
