# Virtual Courtroom WebRTC Protocol & Mesh Architecture

## 1. Network Topology
The courtroom uses a decentralized peer-to-peer WebRTC mesh topology designed for up to 4 concurrent participants:
- Presiding Judge (Host / Moderator)
- Defence Advocate
- Public Prosecutor
- Sworn Witness

## 2. Signaling State Machine
1. **Join Handshake**: Client connects to `ws://host:8000/api/court/ws/{room_id}` with participant credentials.
2. **Peer Discovery**: Server broadcasts `peer_joined` to active room members with role metadata.
3. **Staggered Offer Dispatch**: Existing participants generate SDP offers with a 120ms stagger delay to prevent signaling storms.
4. **ICE Candidate Queueing**: Trickle ICE candidates arriving prior to `setRemoteDescription` are buffered in `peer.pendingIceCandidates` and drained immediately upon SDP settlement.
5. **Bitrate Envelope**: WebRTC video senders enforce `maxBitrate: 400000` (400 kbps) and `maxFramerate: 24` via `RTCRtpSender.setParameters` to prevent network jitter on multi-party calls.
