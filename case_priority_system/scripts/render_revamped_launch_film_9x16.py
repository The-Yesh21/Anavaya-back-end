import os, sys, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

scratch_dir = r'C:\Users\Yeshwanth\.gemini\antigravity-cli\brain\fee4464e-747c-4266-a02c-0c9ce5a061a9\scratch'
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
audio_path = os.path.join(scratch_dir, 'master_soundtrack_v3_crystal.wav')

WIDTH, HEIGHT = 1080, 1920
FPS = 30
TOTAL_SECONDS = 60
TOTAL_FRAMES = FPS * TOTAL_SECONDS

# ========================================================
# PALETTE
# ========================================================
OBSIDIAN_WINE = (16, 4, 7)
BURGUNDY_DARK = (27, 4, 7)
BURGUNDY_RICH = (45, 8, 14)
BURGUNDY_MED  = (74, 14, 23)
IVORY_WHITE   = (255, 253, 249)
IVORY_BASE    = (250, 247, 242)
IVORY_WARM    = (245, 239, 235)
IVORY_CREAM   = (234, 219, 200)
GOLD_ANTIQUE  = (197, 160, 89)
GOLD_WAX      = (212, 175, 55)
CRIMSON_DEEP  = (142, 30, 45)
CRIMSON_GLOW  = (225, 29, 72)
GREEN_SAGE    = (46, 125, 50)

# Fonts
font_dir = r'C:\Windows\Fonts'
try:
    font_hero_display = ImageFont.truetype(os.path.join(font_dir, 'timesbd.ttf'), 74)
    font_hero_h1 = ImageFont.truetype(os.path.join(font_dir, 'georgia.ttf'), 56)
    font_hero_h2 = ImageFont.truetype(os.path.join(font_dir, 'georgia.ttf'), 40)
    font_sans_hero = ImageFont.truetype(os.path.join(font_dir, 'segoeuib.ttf'), 38)
    font_sans_label = ImageFont.truetype(os.path.join(font_dir, 'segoeuib.ttf'), 28)
    font_sans_sub = ImageFont.truetype(os.path.join(font_dir, 'segoeui.ttf'), 24)
    font_mono_hero = ImageFont.truetype(os.path.join(font_dir, 'consolab.ttf'), 32)
    font_mono_label = ImageFont.truetype(os.path.join(font_dir, 'consolab.ttf'), 24)
    font_mono_sm = ImageFont.truetype(os.path.join(font_dir, 'consola.ttf'), 18)
    font_caption = ImageFont.truetype(os.path.join(font_dir, 'segoeui.ttf'), 24)
except Exception:
    font_hero_display = font_hero_h1 = font_hero_h2 = ImageFont.load_default()
    font_sans_hero = font_sans_label = font_sans_sub = ImageFont.load_default()
    font_mono_hero = font_mono_label = font_mono_sm = font_caption = ImageFont.load_default()

out_mp4 = r'F:\major_project\anavaya-film\Anavaya_Launch_Film_9x16.mp4'
root_mp4 = r'F:\major_project\anavaya_launch_film_9x16_vertical.mp4'

cmd = [
    ffmpeg_exe, '-y',
    '-f', 'rawvideo', '-vcodec', 'rawvideo',
    '-s', f'{WIDTH}x{HEIGHT}', '-pix_fmt', 'rgb24', '-r', str(FPS),
    '-i', '-',
    '-i', audio_path,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '18',
    '-c:a', 'aac', '-b:a', '256k', '-shortest',
    out_mp4
]

print("Launching ffmpeg video encoder for Revamped 9:16 Vertical Cut...", flush=True)
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

captions_data = [
    (0.2, 9.8, 'Fifty-four million cases. Stacked in dark corridors. Ignored. Forgotten. Why are we still triaging human lives on paper?'),
    (10.2, 17.8, 'This is Anavaya. The intelligent judicial operating system built to end the pendency crisis.'),
    (18.2, 27.8, 'In milliseconds, our deterministic triage engine scores Article 21 constitutional liberty. High-risk bail pleas rise to the top.'),
    (28.2, 37.8, 'During live testimony, Chakshu listens. Powered by Whisper speech processing, Chakshu catches contradictions in under a second.'),
    (38.2, 47.8, 'Under the hood: GPU-accelerated Whisper, and a 241-feature CART Tree. The LLM extracts facts; the Decision Tree assigns priority.'),
    (48.2, 59.5, 'No more forgotten files. No more delayed lives. This is the court of the twenty-first century. Anavaya. Justice, accelerated.')
]

def draw_glass_card(draw, rect, border_color=(197, 160, 89, 70), fill_color=(35, 6, 12, 235), radius=16):
    x0, y0, x1, y1 = rect
    draw.rounded_rectangle([x0+4, y0+8, x1+4, y1+8], radius=radius, fill=(5, 1, 2, 180))
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill_color, outline=border_color, width=1)
    draw.line([(x0+radius, y0+1), (x1-radius, y0+1)], fill=(255, 253, 249, 35), width=1)

print(f"Rendering {TOTAL_FRAMES} frames of Revamped 9:16 Vertical Video...", flush=True)

for frame_idx in range(TOTAL_FRAMES):
    t = frame_idx / FPS
    img = Image.new('RGB', (WIDTH, HEIGHT), OBSIDIAN_WINE)
    draw = ImageDraw.Draw(img, 'RGBA')

    cam_pan_y = int(math.sin(t * 0.2) * 8)

    # ----------------------------------------------------
    # SCENE 1: (0:00 - 0:10) THE BACKLOG
    # ----------------------------------------------------
    if t < 10.0:
        beat_title = "01 THE BACKLOG"
        draw.ellipse([WIDTH//2 - 400, 500 - 300 + cam_pan_y, WIDTH//2 + 400, 500 + 300 + cam_pan_y], fill=(45, 8, 14, 110))

        shake = int(math.sin(t * 90) * 14) if (8.6 <= t <= 8.9) else 0

        # Zoom-through transition into Scene 2
        zoom_s1 = 1.0
        if t >= 9.2:
            prog_z = (t - 9.2) / 0.8
            zoom_s1 = 1.0 + (prog_z ** 2.2) * 4.0

        draw.text((70, 200 + shake + cam_pan_y), "NATIONAL JUDICIAL DATA GRID • AUDIT", font=font_mono_label, fill=GOLD_ANTIQUE)
        
        prog_count = min(1.0, max(0.0, t / 6.2)) ** 1.9
        count_val = int(48000000 + (54082190 - 48000000) * prog_count)
        draw.text((70, 245 + shake + cam_pan_y), f"{count_val:,}", font=font_hero_display, fill=IVORY_WHITE)
        draw.text((70, 335 + shake + cam_pan_y), "PENDING CASES", font=font_mono_hero, fill=GOLD_ANTIQUE)

        draw_glass_card(draw, [70, 420 + shake, 1010, 720 + shake], border_color=(197, 160, 89, 90))
        draw.text((100, 450 + shake), "PHYSICAL SCALE", font=font_mono_sm, fill=GOLD_ANTIQUE)
        draw.text((100, 490 + shake), "540 KM TALL", font=font_sans_hero, fill=IVORY_WHITE)
        draw.text((100, 540 + shake), "60x Mount Everest", font=font_sans_label, fill=GOLD_ANTIQUE)
        draw.text((100, 580 + shake), "Penetrates Earth's thermosphere", font=font_sans_sub, fill=IVORY_CREAM)

        draw_glass_card(draw, [70, 770 + shake, 1010, 1140 + shake], border_color=(197, 160, 89, 80))
        draw.text((100, 800 + shake), "BAIL APPLICATION • PENDING SINCE 2018", font=font_mono_sm, fill=GOLD_ANTIQUE)
        quote = '"Bail plea unheard since Oct 12, 2018."'
        n = len(quote) if t >= 4.8 else (0 if t < 2.0 else int((t - 2.0) / 2.8 * len(quote)))
        draw.text((100, 845 + shake), quote[:n], font=font_hero_h2, fill=IVORY_WHITE)

        if t >= 5.0:
            strike_w = int(min(1.0, (t - 5.0) / 1.5) * 680)
            draw.line([(100, 870 + shake), (100 + strike_w, 870 + shake)], fill=CRIMSON_DEEP, width=3)
            days = min(2840, int((t - 5.0) / 2.0 * 2840))
            draw.text((100, 930 + shake), f"[ DETAINED ]  +{days:,} DAYS", font=font_mono_hero, fill=CRIMSON_DEEP)

        if 8.6 <= t:
            wave_rad = int(((t - 8.6) / 1.4) * 1200 * zoom_s1)
            draw.ellipse([WIDTH//2 - wave_rad, 960 - wave_rad, WIDTH//2 + wave_rad, 960 + wave_rad], outline=GOLD_WAX, width=int(5 * zoom_s1))

    # ----------------------------------------------------
    # SCENE 2: (0:10 - 0:18) CRISIS RATIO & ANAVAYA
    # Vertical Animated Graph: Delay vs Innocents Punished Ratio
    # ----------------------------------------------------
    elif t < 18.0:
        bt = t - 10.0
        beat_title = "02 CRISIS RATIO & ANAVAYA"

        draw.text((70, 160), "HUMAN LIBERTY AUDIT • CRISIS RATIO", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((70, 200), "The Cost of Judicial Delay", font=font_hero_h1, fill=IVORY_WHITE)
        draw.text((70, 270), "76.1% UNDER-TRIALS PUNISHED", font=font_mono_hero, fill=CRIMSON_GLOW)

        # Graph Card
        draw_glass_card(draw, [70, 330, 1010, 940], border_color=(197, 160, 89, 90), fill_color=(25, 5, 10, 240))
        draw.text((100, 360), "AVERAGE DELAY (YRS) VS. UNCONVICTED PRISONERS (%)", font=font_mono_sm, fill=GOLD_ANTIQUE)

        # Vertical layout Graph area
        gx0, gy0, gx1, gy1 = 120, 420, 960, 860
        for y_step in range(gy0, gy1 + 1, 80):
            draw.line([(gx0, y_step), (gx1, y_step)], fill=(74, 14, 23, 100), width=1)
        
        raw_pts = [
            (gx0, gy1 - int(0.42 * (gy1 - gy0))),
            (gx0 + 140, gy1 - int(0.54 * (gy1 - gy0))),
            (gx0 + 280, gy1 - int(0.63 * (gy1 - gy0))),
            (gx0 + 420, gy1 - int(0.69 * (gy1 - gy0))),
            (gx0 + 560, gy1 - int(0.73 * (gy1 - gy0))),
            (gx0 + 700, gy1 - int(0.752 * (gy1 - gy0))),
            (gx0 + 840, gy1 - int(0.761 * (gy1 - gy0)))
        ]

        anim_prog = min(1.0, max(0.0, (bt - 0.4) / 4.6))
        max_idx = int(anim_prog * (len(raw_pts) - 1))
        frac = (anim_prog * (len(raw_pts) - 1)) - max_idx

        curr_pts = []
        for i in range(max_idx + 1):
            curr_pts.append(raw_pts[i])
        if max_idx < len(raw_pts) - 1:
            pA = raw_pts[max_idx]
            pB = raw_pts[max_idx + 1]
            inter_x = int(pA[0] + frac * (pB[0] - pA[0]))
            inter_y = int(pA[1] + frac * (pB[1] - pA[1]))
            curr_pts.append((inter_x, inter_y))

        if len(curr_pts) >= 2:
            poly_pts = [(gx0, gy1)] + curr_pts + [(curr_pts[-1][0], gy1)]
            draw.polygon(poly_pts, fill=(142, 30, 45, 95))
            for i in range(len(curr_pts) - 1):
                draw.line([curr_pts[i], curr_pts[i+1]], fill=CRIMSON_GLOW, width=4)

        # Highlight Ratio Callout Card
        draw_glass_card(draw, [70, 980, 1010, 1260], border_color=CRIMSON_DEEP, fill_color=(45, 8, 14, 240))
        draw.text((100, 1010), "PRISON POPULATION BREAKDOWN", font=font_mono_sm, fill=GOLD_ANTIQUE)
        draw.text((100, 1045), "76.1% HELD WITHOUT CONVICTION", font=font_sans_hero, fill=IVORY_WHITE)
        draw.text((100, 1100), "3.2x more undertrials locked up than convicts.", font=font_sans_sub, fill=IVORY_CREAM)
        
        # Comparison Bar
        draw.rectangle([100, 1150, 980, 1180], fill=(35, 8, 12))
        bar_w = int(0.761 * 880)
        draw.rectangle([100, 1150, 100 + bar_w, 1180], fill=CRIMSON_DEEP)
        draw.text((110, 1155), "UNDERTRIALS: 76.1%", font=font_mono_sm, fill=IVORY_WHITE)
        draw.text((100 + bar_w + 10, 1155), "CONVICTED: 23.9%", font=font_mono_sm, fill=IVORY_CREAM)

        # Anavaya Mission Card
        draw_glass_card(draw, [70, 1300, 1010, 1540], border_color=(197, 160, 89, 90))
        draw.text((100, 1330), "ANAVAYA OPERATING SYSTEM", font=font_mono_sm, fill=GOLD_ANTIQUE)
        draw.text((100, 1365), "ARTICLE 21 SPEED TRIAGE", font=font_sans_hero, fill=GOLD_ANTIQUE)
        draw.text((100, 1420), "Deterministic AI prioritizes forgotten bail pleas,", font=font_sans_sub, fill=IVORY_WHITE)
        draw.text((100, 1455), "senior citizens & medical emergencies in 474ms.", font=font_sans_sub, fill=IVORY_WHITE)

        # Match-cut zoom box into Scene 3
        if bt >= 6.8:
            z_scale = (bt - 6.8) / 1.2
            draw.rectangle([int(70 - z_scale*70), int(330 - z_scale*330), int(1010 + z_scale*70), int(940 + z_scale*300)], outline=GOLD_WAX, width=int(3 + z_scale * 6))

    # ----------------------------------------------------
    # SCENE 3: (0:18 - 0:28) CONSTITUTIONAL TRIAGE
    # ----------------------------------------------------
    elif t < 28.0:
        bt = t - 18.0
        beat_title = "03 CONSTITUTIONAL TRIAGE"

        draw.text((70, 180), "ARTICLE 21 LIBERTY ENGINE", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((70, 220), "Deterministic Triage", font=font_hero_h1, fill=IVORY_WHITE)

        draw_glass_card(draw, [70, 310, 1010, 780], border_color=(197, 160, 89, 90))
        draw.text((100, 340), "INGESTED DOSSIER • SEC 439 CrPC", font=font_mono_sm, fill=GOLD_ANTIQUE)

        draw.rectangle([100, 390, 500, 435], fill=(74, 14, 23, 220))
        draw.text((110, 398), "Senior Citizen (Age 82)", font=font_sans_label, fill=GOLD_ANTIQUE)

        draw.rectangle([100, 450, 680, 495], fill=(142, 30, 45, 220))
        draw.text((110, 458), "Stage-4 Respiratory Trauma", font=font_sans_label, fill=IVORY_WHITE)

        draw.rectangle([100, 510, 640, 555], fill=(45, 8, 14, 220))
        draw.text((110, 518), "Article 21 Personal Liberty", font=font_sans_label, fill=GOLD_ANTIQUE)

        if bt < 3.2:
            beam_y = 330 + int((bt / 3.2) * 430)
            draw.line([(70, beam_y), (1010, beam_y)], fill=GOLD_WAX, width=3)

        draw_glass_card(draw, [70, 830, 1010, 1460], border_color=(197, 160, 89, 80))
        draw.text((100, 860), "WHITE-BOX CART DECISION PATH", font=font_mono_sm, fill=GOLD_ANTIQUE)

        n1_col = GOLD_ANTIQUE if bt >= 1.8 else (74, 14, 23)
        n2_col = GOLD_ANTIQUE if bt >= 3.2 else (74, 14, 23)
        n3_col = GOLD_ANTIQUE if bt >= 4.8 else (74, 14, 23)

        draw.rounded_rectangle([100, 910, 580, 965], radius=8, fill=(35, 8, 14), outline=n1_col, width=1)
        draw.text((120, 924), "[ 01 ] Liberty Threat: TRUE", font=font_mono_label, fill=IVORY_WHITE if bt >= 1.8 else IVORY_CREAM)

        draw.rounded_rectangle([140, 990, 620, 1045], radius=8, fill=(35, 8, 14), outline=n2_col, width=1)
        draw.text((160, 1004), "[ 02 ] Vulnerability: SENIOR", font=font_mono_label, fill=IVORY_WHITE if bt >= 3.2 else IVORY_CREAM)

        draw.rounded_rectangle([180, 1070, 660, 1125], radius=8, fill=(35, 8, 14), outline=n3_col, width=1)
        draw.text((200, 1084), "[ 03 ] Severity: CRITICAL", font=font_mono_label, fill=IVORY_WHITE if bt >= 4.8 else IVORY_CREAM)

        conf_pct = int(min(1.0, bt / 5.5) * 99.8)
        draw.text((100, 1170), f"CONFIDENCE: {conf_pct}%", font=font_mono_hero, fill=GREEN_SAGE)
        draw.text((100, 1220), "QUEUE: #4,812 ➔ #1 EXPEDITED", font=font_mono_label, fill=GOLD_ANTIQUE)

        if bt >= 6.2:
            draw.rounded_rectangle([100, 1290, 520, 1370], radius=12, outline=CRIMSON_DEEP, width=4)
            draw.text((125, 1315), "PRIORITY: HIGH", font=font_sans_hero, fill=CRIMSON_DEEP)

    # ----------------------------------------------------
    # SCENE 4: (0:28 - 0:38) CHAKSHU ENGINE
    # ----------------------------------------------------
    elif t < 38.0:
        bt = t - 28.0
        beat_title = "04 CHAKSHU ENGINE"

        draw.text((70, 180), "CHAKSHU TRIAL GUARDIAN • REAL-TIME", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((70, 220), "Testimony Verification", font=font_hero_h1, fill=IVORY_WHITE)

        alert_state = bt >= 4.2
        w_border = CRIMSON_DEEP if alert_state else GREEN_SAGE
        draw_glass_card(draw, [70, 310, 1010, 660], border_color=w_border, fill_color=(45, 8, 14, 240) if alert_state else (27, 4, 7, 240))

        for bx in range(100, 980, 24):
            bar_h = int(abs(math.sin(t * 18 + bx * 0.1)) * 28 + 6)
            draw.rectangle([bx, 420 - bar_h, bx + 12, 420 + bar_h], fill=CRIMSON_DEEP if alert_state else GREEN_SAGE)

        draw.text((100, 480), '"I was asleep at my farmhouse in Sector 4."', font=font_hero_h2, fill=IVORY_WHITE)
        if alert_state:
            draw.rectangle([100, 570, 840, 620], fill=CRIMSON_DEEP)
            draw.text((120, 580), "[ ALERT ] CONTRADICTION DETECTED — CITED", font=font_mono_sm, fill=IVORY_WHITE)

        if bt >= 4.8:
            draw_glass_card(draw, [70, 710, 1010, 1060], border_color=CRIMSON_DEEP)
            draw.text((100, 740), "EXHIBIT #03 • CCTV TOLL PLAZA", font=font_mono_sm, fill=GOLD_ANTIQUE)
            draw.rectangle([100, 780, 980, 940], fill=(16, 4, 7))
            draw.rectangle([340, 820, 740, 900], outline=CRIMSON_DEEP, width=2)
            draw.text((360, 848), "TARGET VEHICLE: 02:15 AM", font=font_mono_sm, fill=CRIMSON_DEEP)
            draw.text((100, 970), "Contradicts alibi: vehicle verified at toll plaza 02:15 AM.", font=font_sans_sub, fill=IVORY_WHITE)

        if bt >= 6.0:
            draw_glass_card(draw, [70, 1100, 1010, 1460], border_color=CRIMSON_DEEP)
            draw.text((100, 1130), "EXHIBIT #07 • CELL TOWER LOG", font=font_mono_sm, fill=GOLD_ANTIQUE)
            draw.rectangle([100, 1170, 980, 1330], fill=(16, 4, 7))
            draw.ellipse([520, 1230, 560, 1270], fill=CRIMSON_DEEP)
            draw.text((380, 1285), "SECTOR-9 HIGHWAY TOWER", font=font_mono_sm, fill=IVORY_WHITE)
            draw.text((100, 1360), "Cellular ping logged 18 miles from claimed alibi.", font=font_sans_sub, fill=IVORY_WHITE)

    # ----------------------------------------------------
    # SCENE 5: (0:38 - 0:48) ARCHITECTURE
    # ----------------------------------------------------
    elif t < 48.0:
        bt = t - 38.0
        beat_title = "05 ARCHITECTURE"

        draw.text((70, 180), "SYSTEM BLUEPRINT & BENCHMARKS", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((70, 220), "White-Box Architecture", font=font_hero_h1, fill=IVORY_WHITE)

        draw_glass_card(draw, [70, 310, 1010, 400], border_color=(197, 160, 89, 90))
        draw.text((100, 335), "[ LLM INGEST ] Extracts Facts ➔ [ CART TREE ] Assigns Priority", font=font_mono_label, fill=GOLD_ANTIQUE)

        tiers = [
            ("TIER 01 • INGEST", "Multi-Modal Ingest", "FastAPI • WebRTC", GOLD_ANTIQUE),
            ("TIER 02 • SPEECH", "Whisper CUDA FP16", "6.06% WER • 474ms", GREEN_SAGE),
            ("TIER 03 • TRIAGE", "CART Decision Tree", "99.81% 5-Fold CV", GOLD_ANTIQUE),
            ("TIER 04 • AUDIT", "D3 Decision Graph", "Constitutional Due Process", IVORY_WHITE)
        ]
        for i, (tag, h, tech, col) in enumerate(tiers):
            cy = 440 + i * 260
            active = bt >= (i * 1.5 + 0.4)
            b_col = col if active else (74, 14, 23)
            draw_glass_card(draw, [70, cy, 1010, cy + 225], border_color=b_col)
            draw.text((100, cy + 25), tag, font=font_mono_sm, fill=col if active else IVORY_CREAM)
            draw.text((100, cy + 65), h, font=font_sans_hero, fill=IVORY_WHITE)
            draw.text((100, cy + 130), tech, font=font_mono_label, fill=col)

    # ----------------------------------------------------
    # SCENE 6: (0:48 - 1:00) CLIMAX & CTA
    # ----------------------------------------------------
    else:
        bt = t - 48.0
        beat_title = "06 THE FUTURE OF JUSTICE"

        draw.text((WIDTH//2 - 25, 300), "✦", font=font_hero_display, fill=GOLD_ANTIQUE)
        draw.text((WIDTH//2 - 220, 420), "ANAVAYA", font=font_hero_display, fill=IVORY_WHITE)
        draw.text((WIDTH//2 - 240, 550), "JUSTICE, ACCELERATED.", font=font_mono_hero, fill=GOLD_ANTIQUE)

        draw_glass_card(draw, [70, 680, 1010, 1040], border_color=(197, 160, 89, 80))
        draw.text((100, 720), "99.81%  5-Fold Accuracy", font=font_hero_h2, fill=GOLD_ANTIQUE)
        draw.text((100, 820), "< 500 MS  Trial Contradiction", font=font_hero_h2, fill=GOLD_ANTIQUE)
        draw.text((100, 920), "100%  White-Box Audit", font=font_hero_h2, fill=GOLD_ANTIQUE)

        draw.rounded_rectangle([140, 1150, 940, 1260], radius=16, fill=GOLD_ANTIQUE)
        draw.text((280, 1185), "Explore the Platform ➔", font=font_sans_hero, fill=OBSIDIAN_WINE)

        draw_glass_card(draw, [140, 1310, 940, 1420], border_color=(197, 160, 89, 90), radius=16)
        draw.text((300, 1345), "Request Judicial Pilot", font=font_sans_hero, fill=IVORY_WHITE)

    # Overlays
    prog_ratio = t / TOTAL_SECONDS
    draw.rectangle([0, HEIGHT - 10, WIDTH, HEIGHT], fill=(27, 4, 7))
    draw.rectangle([0, HEIGHT - 10, int(WIDTH * prog_ratio), HEIGHT], fill=GOLD_ANTIQUE)

    # Captions
    active_caption = ""
    for c_start, c_end, c_text in captions_data:
        if c_start <= t < c_end:
            active_caption = c_text
            break
    if active_caption:
        draw_glass_card(draw, [60, HEIGHT - 140, WIDTH - 60, HEIGHT - 40], border_color=(74, 14, 23), radius=12, fill_color=(20, 4, 8, 240))
        draw.text((80, HEIGHT - 110), active_caption, font=font_caption, fill=IVORY_WHITE)

    proc.stdin.write(img.tobytes())

proc.stdin.close()
proc.wait()

print(f"9:16 Vertical Video encoded successfully: {out_mp4}", flush=True)
subprocess.run(['copy', '/Y', out_mp4, root_mp4], shell=True, stdout=subprocess.DEVNULL)
print("Mirrored to root:", root_mp4, flush=True)
