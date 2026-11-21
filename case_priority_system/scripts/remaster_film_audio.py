import os, sys, math, subprocess, wave
import numpy as np
import imageio_ffmpeg

scratch_dir = r'C:\Users\Yeshwanth\.gemini\antigravity-cli\brain\fee4464e-747c-4266-a02c-0c9ce5a061a9\scratch'
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

sr = 44100
total_len = 60.0
n_samples = int(sr * total_len)

vo_starts = {
    'vo1.mp3': 0.35,
    'vo2.mp3': 10.25,
    'vo3.mp3': 18.25,
    'vo4.mp3': 28.25,
    'vo5.mp3': 38.25,
    'vo6.mp3': 48.25
}

# 1. Decode each VO mp3 into raw PCM
vo_track = np.zeros(n_samples, dtype=np.float32)
ducking_envelope = np.zeros(n_samples, dtype=np.float32)

ramp_in = int(0.18 * sr)   # 180ms fade down
ramp_out = int(0.35 * sr)  # 350ms fade up

for fname, start_t in vo_starts.items():
    p = os.path.join(scratch_dir, fname)
    if not os.path.exists(p):
        print(f"Warning: {p} missing")
        continue
    cmd = [ffmpeg_exe, '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(sr), '-']
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    samples = np.frombuffer(res.stdout, dtype=np.int16).astype(np.float32) / 32768.0
    
    # Mild speech presence boost / level normalization per clip
    peak = np.max(np.abs(samples))
    if peak > 0:
        samples = samples / peak * 0.95
        
    start_idx = int(start_t * sr)
    end_idx = min(n_samples, start_idx + len(samples))
    usable_len = end_idx - start_idx
    if usable_len > 0:
        vo_track[start_idx:end_idx] += samples[:usable_len]
        
        # Build smooth ducking envelope (1.0 = ducked, 0.0 = full music)
        d_start = max(0, start_idx - ramp_in)
        d_end = min(n_samples, end_idx + ramp_out)
        
        # Ramp down
        fade_down_len = min(ramp_in, start_idx - d_start)
        if fade_down_len > 0:
            ducking_envelope[d_start:d_start + fade_down_len] = np.maximum(
                ducking_envelope[d_start:d_start + fade_down_len],
                0.5 * (1 - np.cos(np.linspace(0, np.pi, fade_down_len)))
            )
        # Full duck
        ducking_envelope[start_idx:end_idx] = 1.0
        # Ramp up
        fade_up_len = min(ramp_out, d_end - end_idx)
        if fade_up_len > 0:
            ducking_envelope[end_idx:end_idx + fade_up_len] = np.maximum(
                ducking_envelope[end_idx:end_idx + fade_up_len],
                0.5 * (1 + np.cos(np.linspace(0, np.pi, fade_up_len)))
            )

# 2. Synthesize Cinematic Music Bed
music_track = np.zeros(n_samples, dtype=np.float32)

def add_synth_tone(track, start_s, dur_s, f0, f1, amp, decay_rate=6.0):
    s = int(start_s * sr)
    d = int(dur_s * sr)
    e = min(n_samples, s + d)
    l = e - s
    if l <= 0: return
    t = np.linspace(0, dur_s, d, False)[:l]
    freq = np.linspace(f0, f1, l)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    env = np.exp(-t * decay_rate / dur_s)
    track[s:e] += np.sin(phase) * env * amp

# Ambient drone (warm sub harmonic)
t_full = np.linspace(0, total_len, n_samples, False)
music_track += (
    np.sin(2 * np.pi * 55 * t_full) * 0.09 +
    np.sin(2 * np.pi * 110 * t_full) * 0.05 +
    np.sin(2 * np.pi * 165 * t_full) * 0.02
)

# Heartbeat sub drops in Scene 1 (The Backlog tension)
for pt in [0.8, 2.6, 4.4, 6.2]:
    add_synth_tone(music_track, pt, 0.45, 120, 36, 0.35, decay_rate=4.5)

# Gavel strike at 8.6s (Punchy transient + sub boom in pause before Scene 2)
add_synth_tone(music_track, 8.6, 1.4, 180, 28, 0.85, decay_rate=3.0)
s_gv = int(8.6 * sr)
l_gv = int(0.18 * sr)
if s_gv + l_gv < n_samples:
    crack = (np.random.rand(l_gv) * 2 - 1) * np.exp(-np.linspace(0, 7, l_gv)) * 0.45
    music_track[s_gv:s_gv+l_gv] += crack

# 124 BPM pulse across tech beats (10.0s to 58.0s)
interval = 60.0 / 124.0
curr = 10.0
while curr < 58.0:
    # Kick / pulse
    add_synth_tone(music_track, curr, 0.18, 95, 38, 0.28, decay_rate=8.0)
    # Crisp hi-hat click
    h_idx = int((curr + interval * 0.5) * sr)
    h_len = int(0.025 * sr)
    if h_idx + h_len < n_samples:
        music_track[h_idx:h_idx+h_len] += (np.random.rand(h_len) * 2 - 1) * 0.06
    curr += interval

# Key SFX Accents in pauses or transitions
# Scene 2 Graph reveal riser (14.0s - 16.0s)
add_synth_tone(music_track, 14.2, 1.8, 120, 480, 0.15, decay_rate=1.0)
# Scene 2 to Scene 3 Zoom Whoosh / Sub drop (17.4s - 18.2s)
add_synth_tone(music_track, 17.5, 0.8, 300, 40, 0.5, decay_rate=4.0)

# Scene 3 Stamp slam (26.5s)
add_synth_tone(music_track, 26.6, 0.7, 160, 32, 0.65, decay_rate=4.5)
# Scene 3 to Scene 4 Transition sweep (27.6s)
add_synth_tone(music_track, 27.6, 0.7, 180, 600, 0.25, decay_rate=2.0)

# Scene 4 Chakshu Sonar chime (32.8s)
add_synth_tone(music_track, 32.8, 0.6, 920, 460, 0.35, decay_rate=3.5)
# Scene 4 Exhibit lock impact (37.2s)
add_synth_tone(music_track, 37.2, 0.8, 220, 35, 0.55, decay_rate=4.0)

# Scene 5 Tier 04 Audit star chime (46.8s)
add_synth_tone(music_track, 46.8, 1.2, 660, 880, 0.3, decay_rate=2.5)

# Grand climax chord at 54.0s - 59.5s
add_synth_tone(music_track, 54.0, 5.5, 110, 55, 0.35, decay_rate=1.5)
add_synth_tone(music_track, 54.0, 5.5, 220, 110, 0.28, decay_rate=1.5)
add_synth_tone(music_track, 54.0, 5.5, 330, 165, 0.20, decay_rate=1.5)
add_synth_tone(music_track, 54.0, 5.5, 440, 220, 0.15, decay_rate=1.5)

# 3. Apply Deep Dynamic Ducking:
# When VO is active (ducking_envelope == 1.0), music drops to 16% (-16dB)!
# When VO is paused, music rises to 100% of nominal bed volume.
duck_gain = (1.0 - ducking_envelope * 0.84)
music_ducked = music_track * duck_gain

# 4. Master Composite:
# VO is front-and-center at full broadcast scale; music sits underneath with pristine clarity
master_track = vo_track * 0.95 + music_ducked * 0.55

# Ensure no clipping before normalization
max_amp = np.max(np.abs(master_track))
if max_amp > 0.98:
    master_track = master_track / max_amp * 0.96

raw_wav = os.path.join(scratch_dir, 'raw_master_audio_v3.wav')
with wave.open(raw_wav, 'w') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(sr)
    wf.writeframes((master_track * 32767).astype(np.int16).tobytes())

# 5. Broadcast EBU R128 / -14 LUFS mastering via ffmpeg loudnorm
lufs_wav = os.path.join(scratch_dir, 'master_soundtrack_v3_crystal.wav')
norm_cmd = [
    ffmpeg_exe, '-y',
    '-i', raw_wav,
    '-af', 'loudnorm=I=-14:LRA=7:tp=-1.5',
    '-ar', '48000',
    '-c:a', 'pcm_s16le',
    lufs_wav
]
subprocess.run(norm_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Copy to canonical audio path so renderer picks it up
canonical_wav = os.path.join(scratch_dir, 'master_soundtrack_14lufs.wav')
subprocess.run(['copy', '/Y', lufs_wav, canonical_wav], shell=True, stdout=subprocess.DEVNULL)

print("Remastered crystal voice audio rendered successfully:")
print("Output:", lufs_wav)
print("File size:", os.path.getsize(lufs_wav), "bytes")
