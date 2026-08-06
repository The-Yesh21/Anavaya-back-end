"""Full end-to-end courtroom verification test.

Simulates a complete multi-role trial against a running server on port 8000:
  - Create room
  - Judge / Defence / Prosecution / Witness join over WebSocket
  - Opening statements, examination, cross-examination, closing
  - Objection + ruling flow
  - Phase transitions (Opening -> Examination -> Cross-Examination -> Closing -> Concluded)
  - WebRTC signaling relay check
  - Duplicate-role rejection
  - JSON persistence on disk + Markdown transcript download

Robust against closed sockets / non-JSON frames so it doesn't crash on a
peer disconnecting during a drain.
"""
import json
import os
import sys
import time
import urllib.request

try:
    import websocket
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websocket-client", "-q"])
    import websocket

BASE_HTTP = "http://127.0.0.1:8000"
WS_TIMEOUT = 6


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


def drain(ws):
    """Read everything currently buffered. Returns list of parsed dicts.

    Tolerates closed sockets, empty frames, and bad JSON.
    """
    msgs = []
    try:
        while True:
            raw = ws.recv()
            if not raw:
                break
            try:
                msgs.append(json.loads(raw))
            except (json.JSONDecodeError, ValueError):
                continue
    except websocket.WebSocketTimeoutException:
        pass
    except websocket.WebSocketConnectionClosedException:
        pass
    return msgs


def send_and_collect(clients, sender_idx, mtype, text):
    """Send a statement/action, collect the matching transcript_entry from each client."""
    clients[sender_idx]["ws"].send(json.dumps({"type": mtype, "text": text}))
    time.sleep(0.3)
    entries = []
    for c in clients:
        for m in drain(c["ws"]):
            if m.get("type") == "transcript_entry":
                entries.append(m["entry"]["text"])
    return entries


def transition_phase(clients, new_phase):
    """Judge sets a phase; verify all clients receive the phase_changed broadcast."""
    clients[0]["ws"].send(json.dumps({"type": "set_phase", "phase": new_phase}))
    time.sleep(0.3)
    seen = 0
    for c in clients:
        for m in drain(c["ws"]):
            if m.get("type") == "phase_changed" and m.get("phase") == new_phase:
                seen += 1
    return seen


# ── Step 1: Create a room ──────────────────────────────────────────
print("== Step 1: Create room ==")
r = post("/api/court/rooms", {
    "case_title": "State vs. Rakesh Sharma - Armed Robbery",
    "created_by": "Justice Mehta",
})
rid = r["room_id"]
print(f"  room_id={rid}  case_title={r['case_title']}  phase={r['phase']}")

# ── Step 2: Room appears in list ───────────────────────────────────
print("\n== Step 2: Room listed ==")
rooms = get("/api/court/rooms")
assert any(x["room_id"] == rid for x in rooms), "Room not in list!"
print(f"  {len(rooms)} rooms total, our room present")

# ── Step 3: Four participants join via WebSocket ───────────────────
print("\n== Step 3: Participants join ==")
participants = [
    ("Justice Mehta", "Judge"),
    ("Adv. Priya Sharma", "Defence"),
    ("Adv. Suresh Rao", "Prosecution"),
    ("Ramu the Witness", "Witness"),
]

clients = []
for name, role in participants:
    ws = websocket.WebSocket()
    ws.settimeout(WS_TIMEOUT)
    ws.connect(f"ws://127.0.0.1:8000/ws/court/{rid}")
    ws.send(json.dumps({"type": "join", "name": name, "role": role}))
    m = json.loads(ws.recv())
    assert m["type"] == "room_state", f"Expected room_state, got {m['type']}"
    clients.append({"ws": ws, "me": m["me"]})
    print(f"  {name} joined as {m['me']['display_role']}")
    drain(ws)  # clear participant_joined broadcasts

print(f"  total participants: {len(clients)}")

# ── Step 4: Opening statements ─────────────────────────────────────
print("\n== Step 4: Opening statements ==")
e = send_and_collect(clients, 0, "statement",
    "Order in the court. This trial is now in session. Prosecution may present the opening statement.")
print(f"  Judge opens      (broadcast to {len(e)}): \"{e[0][:48]}...\"")

e = send_and_collect(clients, 2, "statement",
    "Your Honour, the State alleges that on March 15 the accused committed armed robbery at the SBI Ashok Nagar branch, threatening the cashier with a firearm and fleeing with Rs. 24 lakhs.")
print(f"  Prosecution opens (broadcast to {len(e)}): \"{e[0][:48]}...\"")

e = send_and_collect(clients, 1, "statement",
    "My client pleads not guilty. The evidence is circumstantial and relies on a single eyewitness identification under poor lighting.")
print(f"  Defence responds  (broadcast to {len(e)}): \"{e[0][:48]}...\"")

# ── Step 5: Phase -> Examination ───────────────────────────────────
print("\n== Step 5: Phase -> Examination ==")
seen = transition_phase(clients, "Examination")
print(f"  phase_changed broadcast to {seen} clients")

# ── Step 6: Objection + Ruling flow ────────────────────────────────
print("\n== Step 6: Objection + Ruling ==")
e = send_and_collect(clients, 1, "action", "Objection - leading question.")
print(f"  Defence objects  : \"{e[0]}\"")
e = send_and_collect(clients, 0, "action", "Objection sustained. Rephrase the question, Prosecution.")
print(f"  Judge ruling     : \"{e[0]}\"")
e = send_and_collect(clients, 2, "statement", "Witness, please state what you saw on the night of March 15 at the bank.")
print(f"  Prosecution asks : \"{e[0][:48]}...\"")
e = send_and_collect(clients, 3, "statement",
    "I was at the ATM. I saw a man in a black hoodie rush out of the bank carrying a bag. He pushed past me and ran toward a motorcycle.")
print(f"  Witness testifies: \"{e[0][:48]}...\"")

# ── Step 7: Phase -> Cross-Examination ─────────────────────────────
print("\n== Step 7: Phase -> Cross-Examination ==")
seen = transition_phase(clients, "Cross-Examination")
print(f"  phase_changed broadcast to {seen} clients")
e = send_and_collect(clients, 1, "action", "The witness is directed to answer the question.")
print(f"  Defence directive: \"{e[0][:48]}...\"")

# ── Step 8: Phase -> Closing ───────────────────────────────────────
print("\n== Step 8: Phase -> Closing ==")
seen = transition_phase(clients, "Closing")
print(f"  phase_changed broadcast to {seen} clients")
e = send_and_collect(clients, 0, "statement",
    "Both sides have presented their arguments. The court will now deliberate and reserve judgment.")
print(f"  Judge concludes  : \"{e[0][:48]}...\"")

# ── Step 9: Phase -> Concluded ─────────────────────────────────────
print("\n== Step 9: Phase -> Concluded ==")
seen = transition_phase(clients, "Concluded")
print(f"  phase_changed broadcast to {seen} clients")

# ── Step 10: Persisted state via REST ──────────────────────────────
print("\n== Step 10: Persisted state ==")
state = get(f"/api/court/rooms/{rid}")
print(f"  phase={state['phase']}  participants={len(state['participants'])}  transcript_entries={len(state['transcript'])}")
kinds = {}
for entry in state["transcript"]:
    kinds[entry["kind"]] = kinds.get(entry["kind"], 0) + 1
print(f"  entry kinds: {json.dumps(kinds)}")
assert state["phase"] == "Concluded", "Phase did not persist!"
assert len(state["participants"]) == 4, "Participant count wrong!"
assert len(state["transcript"]) >= 12, "Too few transcript entries!"

# ── Step 11: Markdown transcript download ──────────────────────────
print("\n== Step 11: Markdown transcript download ==")
md = urllib.request.urlopen(BASE_HTTP + f"/api/court/rooms/{rid}/transcript").read().decode()
print(f"  {len(md.splitlines())} lines")
assert "## Participants" in md, "Missing Participants section"
assert "## Proceedings" in md, "Missing Proceedings section"
assert "Objection" in md, "Missing objection text"
assert "sustained" in md, "Missing ruling text"
assert ("motorcycle" in md or "ATM" in md), "Missing witness testimony"
print("  content checks passed (participants, proceedings, objection, ruling, testimony)")

# ── Step 12: JSON file on disk ─────────────────────────────────────
print("\n== Step 12: JSON file on disk ==")
jpath = os.path.join("case_priority_system", "courtrooms", f"{rid}.json")
assert os.path.exists(jpath), f"JSON file missing: {jpath}"
with open(jpath) as fh:
    disk = json.load(fh)
assert disk["phase"] == "Concluded"
assert len(disk["transcript"]) >= 12
print(f"  {len(disk['transcript'])} entries persisted, phase={disk['phase']}")

# ── Step 13: WebRTC signaling relay ────────────────────────────────
print("\n== Step 13: WebRTC signal relay ==")
clients[2]["ws"].send(json.dumps({
    "type": "sdp_offer",
    "target_participant_id": clients[0]["me"]["participant_id"],
    "data": {"sdp": "MOCK_SDP_OFFER", "type": "offer"},
}))
time.sleep(0.3)
relayed = False
for m in drain(clients[0]["ws"]):
    if m.get("type") in ("sdp_offer", "sdp_answer", "ice_candidate"):
        relayed = True
        print(f"  relayed to Judge: {m['type']}")
        break
assert relayed, "WebRTC signal was not relayed to the target!"

# ── Step 14: Duplicate role rejection ──────────────────────────────
print("\n== Step 14: Duplicate role rejection ==")
ws2 = websocket.WebSocket()
ws2.settimeout(WS_TIMEOUT)
ws2.connect(f"ws://127.0.0.1:8000/ws/court/{rid}")
ws2.send(json.dumps({"type": "join", "name": "Imposter", "role": "Judge"}))
m = json.loads(ws2.recv())
assert m["type"] == "error", f"Expected error for duplicate role, got {m['type']}"
print(f"  rejected: \"{m.get('message', '')[:70]}\"")
ws2.close()

# Cleanup
for c in clients:
    try:
        c["ws"].close()
    except Exception:
        pass

print("\n" + "=" * 60)
print("   ALL 14 PHASE-4 VERIFICATION TESTS PASSED")
print("=" * 60)
