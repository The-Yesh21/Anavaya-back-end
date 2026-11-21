import os, sys, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

scratch_dir = r'C:\Users\Yeshwanth\.gemini\antigravity-cli\brain\fee4464e-747c-4266-a02c-0c9ce5a061a9\scratch'
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
audio_path = os.path.join(scratch_dir, 'master_soundtrack_v3_crystal.wav')

WIDTH, HEIGHT = 1920, 1080
FPS = 30
TOTAL_SECONDS = 60
TOTAL_FRAMES = FPS * TOTAL_SECONDS

# ========================================================
# PALETTE: Deep Velvet Wine & Warm Ivory Cream with Antique Gold
# ========================================================
OBSIDIAN_WINE = (16, 4, 7)         # Canvas base
BURGUNDY_DARK = (27, 4, 7)         # Background panels
BURGUNDY_RICH = (45, 8, 14)        # Card fills
BURGUNDY_MED  = (74, 14, 23)       # Highlight cards
IVORY_WHITE   = (255, 253, 249)    # Headlines
IVORY_BASE    = (250, 247, 242)    # Body text
IVORY_WARM    = (245, 239, 235)    # Secondary
IVORY_CREAM   = (234, 219, 200)    # Muted captions
GOLD_ANTIQUE  = (197, 160, 89)     # Judicial accent
GOLD_WAX      = (212, 175, 55)     # Seal / star highlight
CRIMSON_DEEP  = (142, 30, 45)      # Alert / high priority / undertrial ratio
CRIMSON_GLOW  = (225, 29, 72)      # Accent crimson
GREEN_SAGE    = (46, 125, 50)      # Verified badge / low latency
HAIRLINE      = (197, 160, 89, 45) # Hairline border

# Fonts
font_dir = r'C:\Windows\Fonts'
try:
    font_hero_display = ImageFont.truetype(os.path.join(font_dir, 'timesbd.ttf'), 92)
    font_hero_h1 = ImageFont.truetype(os.path.join(font_dir, 'georgia.ttf'), 74)
    font_hero_h2 = ImageFont.truetype(os.path.join(font_dir, 'georgia.ttf'), 48)
    font_sans_hero = ImageFont.truetype(os.path.join(font_dir, 'segoeuib.ttf'), 44)
    font_sans_label = ImageFont.truetype(os.path.join(font_dir, 'segoeuib.ttf'), 28)
    font_sans_sub = ImageFont.truetype(os.path.join(font_dir, 'segoeui.ttf'), 24)
    font_mono_hero = ImageFont.truetype(os.path.join(font_dir, 'consolab.ttf'), 34)
    font_mono_label = ImageFont.truetype(os.path.join(font_dir, 'consolab.ttf'), 26)
    font_mono_sm = ImageFont.truetype(os.path.join(font_dir, 'consola.ttf'), 20)
    font_caption = ImageFont.truetype(os.path.join(font_dir, 'segoeui.ttf'), 24)
except Exception:
    font_hero_display = font_hero_h1 = font_hero_h2 = ImageFont.load_default()
    font_sans_hero = font_sans_label = font_sans_sub = ImageFont.load_default()
    font_mono_hero = font_mono_label = font_mono_sm = font_caption = ImageFont.load_default()

out_mp4 = r'F:\major_project\anavaya-film\Anavaya_ The Weight of Justice.mp4'
root_mp4 = r'F:\major_project\anavaya_launch_film_1080p.mp4'

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

print("Launching ffmpeg video encoder for Revamped 1080p Cinema Master...")
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

captions_data = [
    (0.2, 9.8, 'Fifty-four million cases. Stacked in dark corridors. Ignored. Forgotten. Why are we still triaging human lives on paper?'),
    (10.2, 17.8, 'This is Anavaya. The intelligent judicial operating system built to end the pendency crisis.'),
    (18.2, 27.8, 'In milliseconds, our deterministic triage engine scores Article 21 constitutional liberty. High-risk bail pleas rise to the top.'),
    (28.2, 37.8, 'During live testimony, Chakshu listens. Powered by Whisper speech processing, Chakshu catches contradictions in under a second.'),
    (38.2, 47.8, 'Under the hood: GPU-accelerated Whisper, and a 241-feature CART Tree. The LLM extracts facts; the Decision Tree assigns priority.'),
    (48.2, 59.5, 'No more forgotten files. No more delayed lives. This is the court of the twenty-first century. Anavaya. Justice, accelerated.')
]

# Random particles seed for floating dust
np.random.seed(42)
num_particles = 120
px = np.random.uniform(0, WIDTH, num_particles)
py = np.random.uniform(0, HEIGHT, num_particles)
pspeed = np.random.uniform(0.3, 1.2, num_particles)
psize = np.random.uniform(2, 5, num_particles)

def draw_glass_card(draw, rect, border_color=(197, 160, 89, 70), fill_color=(35, 6, 12, 235), radius=16):
    x0, y0, x1, y1 = rect
    draw.rounded_rectangle([x0+4, y0+8, x1+4, y1+8], radius=radius, fill=(5, 1, 2, 180))
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill_color, outline=border_color, width=1)
    draw.line([(x0+radius, y0+1), (x1-radius, y0+1)], fill=(255, 253, 249, 35), width=1)

print(f"Rendering {TOTAL_FRAMES} frames of Revamped 1080p Master...")

for frame_idx in range(TOTAL_FRAMES):
    t = frame_idx / FPS
    
    img = Image.new('RGB', (WIDTH, HEIGHT), OBSIDIAN_WINE)
    draw = ImageDraw.Draw(img, 'RGBA')

    # Continuous subtle camera drift
    cam_pan_x = int(math.sin(t * 0.2) * 10)
    cam_pan_y = int(math.cos(t * 0.25) * 6)

    # ----------------------------------------------------
    # SCENE 1: (0:00 - 0:10) THE BACKLOG
    # ----------------------------------------------------
    if t < 10.0:
        beat_title = "01 THE BACKLOG"
        
        # Courtroom God-ray beam
        spot_center = (WIDTH // 2 + cam_pan_x, int(HEIGHT * 0.45) + cam_pan_y)
        draw.ellipse([spot_center[0] - 650, spot_center[1] - 400, spot_center[0] + 650, spot_center[1] + 400], fill=(45, 8, 14, 110))
        draw.ellipse([spot_center[0] - 380, spot_center[1] - 220, spot_center[0] + 380, spot_center[1] + 220], fill=(74, 14, 23, 120))

        # Floating dust particles
        for i in range(num_particles):
            px_curr = (px[i] + math.sin(t * pspeed[i]) * 15 + cam_pan_x) % WIDTH
            py_curr = (py[i] - t * pspeed[i] * 12 + cam_pan_y) % HEIGHT
            draw.ellipse([px_curr, py_curr, px_curr + psize[i], py_curr + psize[i]], fill=(212, 175, 55, 75))

        # Gavel strike camera shake (8.6s - 8.9s)
        shake_x = shake_y = 0
        if 8.6 <= t <= 8.9:
            shake_x = int(math.sin(t * 90) * 16)
            shake_y = int(math.cos(t * 90) * 12)

        # SPATIAL ZOOM-OUT TRANSITION TO SCENE 2 (9.2s - 10.0s)
        # The central gavel seal and shockwave ring zoom toward the camera
        zoom_s1 = 1.0
        if t >= 9.2:
            prog_z = (t - 9.2) / 0.8
            zoom_s1 = 1.0 + (prog_z ** 2.2) * 4.2

        # Header Audit Tag
        draw.text((120 + shake_x, 100 + shake_y), "NATIONAL JUDICIAL DATA GRID • AUDIT", font=font_mono_label, fill=GOLD_ANTIQUE)

        # Rolling Odometer
        prog_count = min(1.0, max(0.0, t / 6.2)) ** 1.9
        count_val = int(48000000 + (54082190 - 48000000) * prog_count)
        draw.text((120 + shake_x, 150 + shake_y), f"{count_val:,}", font=font_hero_display, fill=IVORY_WHITE)
        draw.text((820 + shake_x, 195 + shake_y), "PENDING CASES", font=font_mono_hero, fill=GOLD_ANTIQUE)

        # Physical scale card
        draw_glass_card(draw, [1180 + shake_x, 140 + shake_y, 1800 + shake_x, 560 + shake_y], border_color=(197, 160, 89, 90))
        draw.text((1220 + shake_x, 175 + shake_y), "PHYSICAL SCALE", font=font_mono_sm, fill=GOLD_ANTIQUE)
        draw.text((1220 + shake_x, 215 + shake_y), "540 KM TALL", font=font_sans_hero, fill=IVORY_WHITE)
        draw.text((1220 + shake_x, 275 + shake_y), "60x Mount Everest", font=font_sans_label, fill=GOLD_ANTIQUE)
        draw.text((1220 + shake_x, 320 + shake_y), "Penetrates Earth's thermosphere", font=font_sans_sub, fill=IVORY_CREAM)
        
        # Vertical Bar gauge
        gauge_h = int(min(1.0, max(0.0, (t - 0.5) / 6.5)) * 140)
        draw.rectangle([1220 + shake_x, 500 - 140 + shake_y, 1270 + shake_x, 500 + shake_y], fill=(35, 8, 12))
        if gauge_h > 0:
            draw.rectangle([1220 + shake_x, 500 - gauge_h + shake_y, 1270 + shake_x, 500 + shake_y], fill=CRIMSON_DEEP)

        # Typewriter Petition Card
        draw_glass_card(draw, [120 + shake_x, 340 + shake_y, 1080 + shake_x, 620 + shake_y], border_color=(197, 160, 89, 80))
        draw.text((160 + shake_x, 375 + shake_y), "BAIL APPLICATION • PENDING SINCE 2018", font=font_mono_sm, fill=GOLD_ANTIQUE)
        
        quote = '"Bail plea unheard since Oct 12, 2018."'
        if t < 2.0:
            quote_show = ""
        elif t < 4.8:
            n = int((t - 2.0) / 2.8 * len(quote))
            quote_show = quote[:n] + "|"
        else:
            quote_show = quote
        draw.text((160 + shake_x, 420 + shake_y), quote_show, font=font_hero_h2, fill=IVORY_WHITE)

        if t >= 5.0:
            strike_w = int(min(1.0, (t - 5.0) / 1.5) * 720)
            draw.line([(160 + shake_x, 445 + shake_y), (160 + strike_w + shake_x, 445 + shake_y)], fill=CRIMSON_DEEP, width=4)
            days = min(2840, int((t - 5.0) / 2.0 * 2840))
            draw.text((160 + shake_x, 510 + shake_y), f"[ DETAINED ]  +{days:,} DAYS UNTOUCHED", font=font_mono_hero, fill=CRIMSON_DEEP)

        # Expanding Gavel Shockwave Ring (morphs into Scene 2 zoom-through)
        if 8.6 <= t:
            wave_rad = int(((t - 8.6) / 1.4) * 1100 * zoom_s1)
            stroke_w = max(2, int(6 * zoom_s1))
            draw.ellipse([960 - wave_rad, 540 - wave_rad, 960 + wave_rad, 540 + wave_rad], outline=GOLD_WAX, width=stroke_w)
            # Central expanding emblem
            emb_r = int(50 * zoom_s1)
            draw.ellipse([960 - emb_r, 540 - emb_r, 960 + emb_r, 540 + emb_r], fill=(212, 175, 55, int(min(255, 40 * zoom_s1))))

    # ----------------------------------------------------
    # SCENE 2: (0:10 - 0:18) THE CRISIS RATIO & AWAKENING
    # Featuring: Animated Graph comparing Trial Delay vs Innocents Punished Ratio
    # + Continuous Spatial Zoom into the peak data node
    # ----------------------------------------------------
    elif t < 18.0:
        bt = t - 10.0
        beat_title = "02 CRISIS RATIO & ANAVAYA"

        # Continuous camera transition from Scene 1
        zoom_s2 = 1.0
        focus_x, focus_y = 740, 500  # Position of 76.1% peak crisis point
        if bt >= 6.8:
            # Zoom into the peak node before Scene 3
            z_prog = (bt - 6.8) / 1.2
            zoom_s2 = 1.0 + (z_prog ** 2.0) * 3.2

        # Header Branding
        draw.text((120, 75), "HUMAN LIBERTY AUDIT • DELAY VS. UNCONVICTED PUNISHMENT", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((120, 115), "The Cost of Judicial Delay", font=font_hero_h1, fill=IVORY_WHITE)
        draw.text((1420, 120), "76.1% UNDER-TRIALS", font=font_mono_hero, fill=CRIMSON_GLOW)

        # Main Graph Container Glass Card
        draw_glass_card(draw, [120, 200, 1800, 750], border_color=(197, 160, 89, 90), fill_color=(25, 5, 10, 240))

        # --- DUAL-AXIS ANIMATED GRAPH ---
        gx0, gy0, gx1, gy1 = 180, 260, 1120, 680
        # Background subtle graph grid
        for y_step in range(gy0, gy1 + 1, 70):
            draw.line([(gx0, y_step), (gx1, y_step)], fill=(74, 14, 23, 100), width=1)
        for x_step in range(gx0, gx1 + 1, 155):
            draw.line([(x_step, gy0), (x_step, gy1)], fill=(74, 14, 23, 100), width=1)

        # X-Axis Labels: Trial Delay (Years)
        x_labels = ["0y", "2y", "5y", "8y", "11y", "14y", "17y+"]
        for idx, lbl in enumerate(x_labels):
            lx = gx0 + idx * 155 - 12
            draw.text((lx, gy1 + 12), lbl, font=font_mono_sm, fill=IVORY_CREAM)
        draw.text((gx0 + 380, gy1 + 38), "TRIAL PENDENCY / SYSTEM DELAY (YEARS)", font=font_mono_sm, fill=GOLD_ANTIQUE)

        # Y-Axis Left Label: Ratio of Incarcerated Who Are Unconvicted (%)
        draw.text((gx0, gy0 - 32), "▲ UNDER-TRIAL RATIO (%)", font=font_mono_sm, fill=CRIMSON_GLOW)

        # Data Curve: Delay vs Undertrials punished without conviction
        # Points: (0y: 42%), (2y: 54%), (5y: 63%), (8y: 69%), (11y: 73%), (14y: 75.2%), (17y: 76.1%)
        raw_pts = [
            (gx0, gy1 - int(0.42 * (gy1 - gy0))),
            (gx0 + 155, gy1 - int(0.54 * (gy1 - gy0))),
            (gx0 + 310, gy1 - int(0.63 * (gy1 - gy0))),
            (gx0 + 465, gy1 - int(0.69 * (gy1 - gy0))),
            (gx0 + 620, gy1 - int(0.73 * (gy1 - gy0))),
            (gx0 + 775, gy1 - int(0.752 * (gy1 - gy0))),
            (gx0 + 930, gy1 - int(0.761 * (gy1 - gy0)))
        ]

        # Animate line drawing over time (from bt=0.5s to bt=5.2s)
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

        # Draw Crimson Area Fill under Curve
        if len(curr_pts) >= 2:
            poly_pts = [(gx0, gy1)] + curr_pts + [(curr_pts[-1][0], gy1)]
            draw.polygon(poly_pts, fill=(142, 30, 45, 95))
            # Draw Thick Glowing Crimson Line
            for i in range(len(curr_pts) - 1):
                draw.line([curr_pts[i], curr_pts[i+1]], fill=CRIMSON_GLOW, width=4)
                # Outer glow
                draw.line([curr_pts[i], curr_pts[i+1]], fill=(225, 29, 72, 80), width=8)

        # Pulse marker on current animated tip
        if len(curr_pts) > 0:
            tip = curr_pts[-1]
            draw.ellipse([tip[0] - 6, tip[1] - 6, tip[0] + 6, tip[1] + 6], fill=IVORY_WHITE)
            pulse_r = 6 + int(abs(math.sin(t * 12)) * 10)
            draw.ellipse([tip[0] - pulse_r, tip[1] - pulse_r, tip[0] + pulse_r, tip[1] + pulse_r], outline=CRIMSON_GLOW, width=2)

        # --- RIGHT AUDIT PANELS (Ratio Breakdown & Real Human Cost) ---
        rx0 = 1180
        # Card 1: The Ratio Disparity Callout
        draw_glass_card(draw, [rx0, 240, 1740, 460], border_color=CRIMSON_DEEP, fill_color=(45, 8, 14, 240))
        draw.text((rx0 + 25, 265), "PRISON POPULATION BREAKDOWN", font=font_mono_sm, fill=GOLD_ANTIQUE)
        draw.text((rx0 + 25, 300), "76.1% PUNISHED BEFORE TRIAL", font=font_sans_hero, fill=IVORY_WHITE)
        draw.text((rx0 + 25, 355), "3.2x more undertrials locked up than convicted convicts.", font=font_sans_sub, fill=IVORY_CREAM)
        
        # Horizontal Ratio Comparison Bar
        draw.rectangle([rx0 + 25, 395, rx0 + 515, 425], fill=(35, 8, 12))
        bar_fill_w = int(0.761 * 490)
        draw.rectangle([rx0 + 25, 395, rx0 + 25 + bar_fill_w, 425], fill=CRIMSON_DEEP)
        draw.text((rx0 + 35, 400), "UNDERTRIALS: 76.1%", font=font_mono_sm, fill=IVORY_WHITE)
        draw.text((rx0 + 25 + bar_fill_w + 10, 400), "CONVICTED: 23.9%", font=font_mono_sm, fill=IVORY_CREAM)

        # Card 2: The Anavaya Mission Solution
        draw_glass_card(draw, [rx0, 480, 1740, 710], border_color=(197, 160, 89, 90), fill_color=(30, 6, 12, 240))
        draw.text((rx0 + 25, 505), "ANAVAYA TRIAGE INTERVENTION", font=font_mono_sm, fill=GOLD_ANTIQUE)
        draw.text((rx0 + 25, 540), "PRIORITIZE LIBERTY", font=font_sans_hero, fill=GOLD_ANTIQUE)
        draw.text((rx0 + 25, 595), "Article 21 speed algorithm detects senior citizens,", font=font_sans_sub, fill=IVORY_WHITE)
        draw.text((rx0 + 25, 625), "critical illness, and prolonged unlawful detention.", font=font_sans_sub, fill=IVORY_WHITE)
        draw.text((rx0 + 25, 665), "LATENCY: 474 MS • DETERMINISTIC AUDIT", font=font_mono_label, fill=GREEN_SAGE)

        # SPATIAL ZOOM-THROUGH TO SCENE 3
        # When bt >= 6.8s, the camera zooms into the 76.1% peak crisis point
        if bt >= 6.8:
            z_scale = (bt - 6.8) / 1.2
            # Expanding box framing Scene 3's dossier
            bx0 = int(120 - z_scale * 120)
            by0 = int(200 - z_scale * 200)
            bx1 = int(1800 + z_scale * 120)
            by1 = int(750 + z_scale * 200)
            draw.rectangle([bx0, by0, bx1, by1], outline=GOLD_WAX, width=int(3 + z_scale * 8))

    # ----------------------------------------------------
    # SCENE 3: (0:18 - 0:28) CONSTITUTIONAL TRIAGE
    # Spatial Match-Cut from Scene 2 into Ingested Dossier & CART Tree
    # ----------------------------------------------------
    elif t < 28.0:
        bt = t - 18.0
        beat_title = "03 CONSTITUTIONAL TRIAGE"

        draw.text((120, 80), "ARTICLE 21 LIBERTY ENGINE", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((120, 125), "Deterministic Case Triage", font=font_hero_h1, fill=IVORY_WHITE)

        # Left: Exploded Dossier Card
        draw_glass_card(draw, [120, 220, 920, 720], border_color=(197, 160, 89, 90))
        draw.text((160, 260), "INGESTED DOSSIER • SEC 439 CrPC", font=font_mono_sm, fill=GOLD_ANTIQUE)
        
        # Highlight boxes in archival tones
        draw.rectangle([160, 310, 540, 355], fill=(74, 14, 23, 220))
        draw.text((170, 318), "Senior Citizen (Age 82)", font=font_sans_label, fill=GOLD_ANTIQUE)
        
        draw.rectangle([160, 370, 700, 415], fill=(142, 30, 45, 220))
        draw.text((170, 378), "Stage-4 Respiratory Trauma", font=font_sans_label, fill=IVORY_WHITE)

        draw.rectangle([160, 430, 680, 475], fill=(45, 8, 14, 220))
        draw.text((170, 438), "Article 21 Personal Liberty", font=font_sans_label, fill=GOLD_ANTIQUE)

        # Scanning Gold Laser Beam
        if bt < 3.2:
            beam_y = 240 + int((bt / 3.2) * 450)
            draw.line([(120, beam_y), (920, beam_y)], fill=GOLD_WAX, width=3)

        # Split screen: Manual vs Anavaya
        draw_glass_card(draw, [160, 540, 880, 670], border_color=(197, 160, 89, 45), fill_color=(20, 4, 8, 240))
        draw.text((190, 565), "MANUAL: 8 WEEKS", font=font_mono_label, fill=IVORY_CREAM)
        draw.text((540, 565), "ANAVAYA: 474 MS", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((190, 610), "Backlogged in clerk queue", font=font_sans_sub, fill=IVORY_CREAM)
        draw.text((540, 610), "Deterministic triage", font=font_sans_sub, fill=GREEN_SAGE)

        # Right: CART Decision Tree & Confidence
        draw_glass_card(draw, [980, 220, 1800, 720], border_color=(197, 160, 89, 80))
        draw.text((1020, 260), "WHITE-BOX CART DECISION PATH", font=font_mono_sm, fill=GOLD_ANTIQUE)

        n1_col = GOLD_ANTIQUE if bt >= 1.8 else (74, 14, 23)
        n2_col = GOLD_ANTIQUE if bt >= 3.2 else (74, 14, 23)
        n3_col = GOLD_ANTIQUE if bt >= 4.8 else (74, 14, 23)

        draw.rounded_rectangle([1020, 310, 1420, 365], radius=8, fill=(35, 8, 14), outline=n1_col, width=1)
        draw.text((1040, 324), "[ 01 ] Liberty Threat: TRUE", font=font_mono_label, fill=IVORY_WHITE if bt >= 1.8 else IVORY_CREAM)

        draw.rounded_rectangle([1100, 390, 1500, 445], radius=8, fill=(35, 8, 14), outline=n2_col, width=1)
        draw.text((1120, 404), "[ 02 ] Vulnerability: SENIOR", font=font_mono_label, fill=IVORY_WHITE if bt >= 3.2 else IVORY_CREAM)

        draw.rounded_rectangle([1180, 470, 1580, 525], radius=8, fill=(35, 8, 14), outline=n3_col, width=1)
        draw.text((1200, 484), "[ 03 ] Severity: CRITICAL", font=font_mono_label, fill=IVORY_WHITE if bt >= 4.8 else IVORY_CREAM)

        # Confidence Dial & Queue Resort
        conf_pct = int(min(1.0, bt / 5.5) * 99.8)
        draw.text((1020, 580), f"CONFIDENCE: {conf_pct}%", font=font_mono_hero, fill=GREEN_SAGE)
        draw.text((1020, 630), "QUEUE: #4,812 ➔ #1 EXPEDITED", font=font_mono_label, fill=GOLD_ANTIQUE)

        # PRIORITY: HIGH Stamp Slam at 6.2s
        stamp_scale = 1.0
        if bt >= 6.2:
            # Stamp zooms forward into Scene 4 at 9.0s (bt >= 9.0)
            if bt >= 9.0:
                prog_st = (bt - 9.0) / 1.0
                stamp_scale = 1.0 + (prog_st ** 2.2) * 3.5

            sx0 = int(1380 - (stamp_scale - 1.0) * 400)
            sy0 = int(560 - (stamp_scale - 1.0) * 200)
            sx1 = int(1740 + (stamp_scale - 1.0) * 400)
            sy1 = int(650 + (stamp_scale - 1.0) * 200)
            draw.rounded_rectangle([sx0, sy0, sx1, sy1], radius=int(12 * stamp_scale), outline=CRIMSON_DEEP, width=int(4 * stamp_scale))
            draw.text((sx0 + int(25 * stamp_scale), sy0 + int(25 * stamp_scale)), "PRIORITY: HIGH", font=font_sans_hero, fill=CRIMSON_DEEP)

    # ----------------------------------------------------
    # SCENE 4: (0:28 - 0:38) CHAKSHU ENGINE
    # Continuous Waveform morph from Scene 3 stamp
    # ----------------------------------------------------
    elif t < 38.0:
        bt = t - 28.0
        beat_title = "04 CHAKSHU ENGINE"

        draw.text((120, 80), "CHAKSHU TRIAL GUARDIAN • REAL-TIME", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((120, 125), "Testimony Cross-Examination", font=font_hero_h1, fill=IVORY_WHITE)
        draw.text((1400, 125), "LATENCY: <500 MS", font=font_mono_hero, fill=GOLD_ANTIQUE)

        # Waveform Box
        alert_state = bt >= 4.2
        w_border = CRIMSON_DEEP if alert_state else GREEN_SAGE
        draw_glass_card(draw, [120, 210, 1800, 400], border_color=w_border, fill_color=(45, 8, 14, 240) if alert_state else (27, 4, 7, 240))
        
        # Audio bars
        for bx in range(160, 1760, 24):
            bar_h = int(abs(math.sin(t * 18 + bx * 0.1)) * 28 + 6)
            draw.rectangle([bx, 280 - bar_h, bx + 12, 280 + bar_h], fill=CRIMSON_DEEP if alert_state else GREEN_SAGE)

        draw.text((160, 335), '"I was asleep at my farmhouse in Sector 4 until morning."', font=font_hero_h2, fill=IVORY_WHITE)
        if alert_state:
            draw.rectangle([160, 420, 820, 465], fill=CRIMSON_DEEP)
            draw.text((180, 430), "[ ALERT ] CONTRADICTION DETECTED — CITED", font=font_mono_sm, fill=IVORY_WHITE)

        # Exhibit Cards
        if bt >= 4.8:
            draw_glass_card(draw, [120, 480, 920, 780], border_color=CRIMSON_DEEP)
            draw.text((160, 510), "EXHIBIT #03 • CCTV TOLL PLAZA", font=font_mono_sm, fill=GOLD_ANTIQUE)
            draw.rectangle([160, 550, 880, 680], fill=(16, 4, 7))
            draw.rectangle([420, 580, 660, 650], outline=CRIMSON_DEEP, width=2)
            draw.text((435, 605), "TARGET VEHICLE: 02:15 AM", font=font_mono_sm, fill=CRIMSON_DEEP)
            draw.text((160, 710), "Contradicts alibi: vehicle verified at toll plaza 02:15 AM.", font=font_sans_sub, fill=IVORY_WHITE)

        if bt >= 6.0:
            draw_glass_card(draw, [1000, 480, 1800, 780], border_color=CRIMSON_DEEP)
            draw.text((1040, 510), "EXHIBIT #07 • CELL TOWER LOG", font=font_mono_sm, fill=GOLD_ANTIQUE)
            draw.rectangle([1040, 550, 1760, 680], fill=(16, 4, 7))
            draw.ellipse([1380, 595, 1420, 635], fill=CRIMSON_DEEP)
            draw.text((1310, 645), "SECTOR-9 HIGHWAY TOWER", font=font_mono_sm, fill=IVORY_WHITE)
            draw.text((1040, 710), "Cellular ping logged 18 miles from claimed alibi.", font=font_sans_sub, fill=IVORY_WHITE)

        # SPATIAL ZOOM-THROUGH INTO SCENE 5
        # Exhibit 03 golden seal scales up into Tier 01 Ingest
        if bt >= 9.0:
            prog_ex = (bt - 9.0) / 1.0
            ex_scale = 1.0 + (prog_ex ** 2.2) * 4.0
            draw.ellipse([540 - int(40 * ex_scale), 615 - int(40 * ex_scale), 540 + int(40 * ex_scale), 615 + int(40 * ex_scale)], outline=GOLD_WAX, width=int(3 * ex_scale))

    # ----------------------------------------------------
    # SCENE 5: (0:38 - 0:48) ARCHITECTURE
    # ----------------------------------------------------
    elif t < 48.0:
        bt = t - 38.0
        beat_title = "05 ARCHITECTURE"

        draw.text((120, 80), "SYSTEM BLUEPRINT & BENCHMARKS", font=font_mono_label, fill=GOLD_ANTIQUE)
        draw.text((120, 125), "White-Box Judicial Architecture", font=font_hero_h1, fill=IVORY_WHITE)

        # Rule Split Banner
        draw_glass_card(draw, [120, 210, 1800, 290], border_color=(197, 160, 89, 90))
        draw.text((160, 235), "[ LLM INGESTION ] Extracts Facts", font=font_mono_label, fill=IVORY_WHITE)
        draw.text((880, 230), "➔", font=font_sans_hero, fill=GOLD_ANTIQUE)
        draw.text((960, 235), "[ CART TREE ] Assigns Priority (100% White-Box)", font=font_mono_label, fill=GOLD_ANTIQUE)

        # 4 Pipeline Tiers
        tiers = [
            ("TIER 01 • INGEST", "Multi-Modal Ingest", "Petitions, FIRs, Audio", "FastAPI • WebRTC", GOLD_ANTIQUE),
            ("TIER 02 • SPEECH", "Whisper CUDA FP16", "Courtroom Lexicon ASR", "6.06% WER • 474ms", GREEN_SAGE),
            ("TIER 03 • TRIAGE", "CART Decision Forest", "241 OHE + TF-IDF Features", "99.81% 5-Fold CV", GOLD_ANTIQUE),
            ("TIER 04 • AUDIT", "D3 Decision Graph", "Constitutional Due Process", "React 19 • D3.js", IVORY_WHITE)
        ]
        for i, (tag, h, sub, tech, col) in enumerate(tiers):
            active = bt >= (i * 1.5 + 0.4)
            cx = 120 + i * 430
            b_col = col if active else (74, 14, 23)
            draw_glass_card(draw, [cx, 320, cx + 400, 700], border_color=b_col)
            draw.text((cx + 30, 350), tag, font=font_mono_sm, fill=col if active else IVORY_CREAM)
            draw.text((cx + 30, 395), h, font=font_sans_hero, fill=IVORY_WHITE)
            draw.text((cx + 30, 460), sub, font=font_sans_sub, fill=IVORY_CREAM)
            
            draw.rectangle([cx + 30, 600, cx + 370, 650], fill=(20, 4, 8))
            draw.text((cx + 45, 615), tech, font=font_mono_label, fill=col)

        # SPATIAL ZOOM-THROUGH INTO SCENE 6
        # Tier 04 Audit Star scales up to hero star
        if bt >= 9.0:
            prog_s5 = (bt - 9.0) / 1.0
            s5_scale = 1.0 + (prog_s5 ** 2.2) * 5.0
            draw.text((1560 - int(20 * s5_scale), 350 - int(20 * s5_scale)), "✦", font=font_hero_display, fill=GOLD_ANTIQUE)

    # ----------------------------------------------------
    # SCENE 6: (0:48 - 1:00) CLIMAX & CTA
    # ----------------------------------------------------
    else:
        bt = t - 48.0
        beat_title = "06 THE FUTURE OF JUSTICE"

        draw.text((920, 160), "✦", font=font_hero_display, fill=GOLD_ANTIQUE)
        draw.text((660, 270), "ANAVAYA", font=font_hero_display, fill=IVORY_WHITE)
        draw.text((620, 390), "JUSTICE, ACCELERATED.", font=font_mono_hero, fill=GOLD_ANTIQUE)

        # Proof Banner
        draw_glass_card(draw, [360, 460, 1560, 580], border_color=(197, 160, 89, 80))
        draw.text((420, 490), "99.81%", font=font_hero_h2, fill=GOLD_ANTIQUE)
        draw.text((420, 540), "5-Fold Accuracy", font=font_sans_sub, fill=IVORY_CREAM)

        draw.text((860, 490), "< 500 MS", font=font_hero_h2, fill=GOLD_ANTIQUE)
        draw.text((860, 540), "Trial Contradiction", font=font_sans_sub, fill=IVORY_CREAM)

        draw.text((1300, 490), "100%", font=font_hero_h2, fill=GOLD_ANTIQUE)
        draw.text((1300, 540), "White-Box Audit", font=font_sans_sub, fill=IVORY_CREAM)

        # CTA Buttons
        draw.rounded_rectangle([520, 630, 920, 710], radius=16, fill=GOLD_ANTIQUE)
        draw.text((570, 655), "Explore the Platform ➔", font=font_sans_hero, fill=OBSIDIAN_WINE)

        draw_glass_card(draw, [1000, 630, 1400, 710], border_color=(197, 160, 89, 90), radius=16)
        draw.text((1045, 655), "Request Judicial Pilot", font=font_sans_hero, fill=IVORY_WHITE)

    # ----------------------------------------------------
    # PERSISTENT OVERLAYS
    # ----------------------------------------------------
    # Bottom timeline progress rail
    prog_ratio = t / TOTAL_SECONDS
    draw.rectangle([0, HEIGHT - 8, WIDTH, HEIGHT], fill=(27, 4, 7))
    draw.rectangle([0, HEIGHT - 8, int(WIDTH * prog_ratio), HEIGHT], fill=GOLD_ANTIQUE)

    # Beat indicator badge
    draw_glass_card(draw, [80, HEIGHT - 80, 380, HEIGHT - 26], border_color=(197, 160, 89, 70), radius=8)
    draw.text((100, HEIGHT - 64), beat_title, font=font_mono_label, fill=GOLD_ANTIQUE)

    # Synchronized Captions
    active_caption = ""
    for c_start, c_end, c_text in captions_data:
        if c_start <= t < c_end:
            active_caption = c_text
            break
    if active_caption:
        draw_glass_card(draw, [410, HEIGHT - 80, 1620, HEIGHT - 26], border_color=(74, 14, 23), radius=12, fill_color=(20, 4, 8, 240))
        draw.text((430, HEIGHT - 62), active_caption, font=font_caption, fill=IVORY_WHITE)

    # Timer at bottom right
    mins = int(t // 60)
    secs = int(t % 60)
    draw.text((1680, HEIGHT - 62), f"{mins:02d}:{secs:02d} / 01:00", font=font_mono_label, fill=IVORY_CREAM)

    proc.stdin.write(img.tobytes())

    if frame_idx % 300 == 0:
        print(f"Rendered {frame_idx}/{TOTAL_FRAMES} frames ({t:.1f}s / {TOTAL_SECONDS}s)")

proc.stdin.close()
proc.wait()

print(f"1080p Master Film encoded successfully: {out_mp4}")
# Mirror to root as well
subprocess.run(['copy', '/Y', out_mp4, root_mp4], shell=True, stdout=subprocess.DEVNULL)
print("Mirrored to root:", root_mp4)
