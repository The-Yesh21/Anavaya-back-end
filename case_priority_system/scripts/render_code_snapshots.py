#!/usr/bin/env python3
"""
render_code_snapshots.py
------------------------
Renders publication-quality, high-contrast DARK THEME IDE snapshot graphics
for the Anavaya Major Project Report using PIL/Pillow and Pygments.

Theme: Deep Obsidian JetBrains / VS Code Dark+
Background: #0B0F19 (Deep Obsidian Navy Black)
Gutter: #0E1422 with crisp line numbers and divider
Header: #161F30 with macOS window controls and dark IDE tabs
Syntax: Vibrant, high-contrast, glowing code syntax highlighting

Outputs:
- code_snap_decision_tree.png
- code_snap_whole_case_merge.png
- code_snap_constitutional_engine.png
- code_snap_chakshu_factcheck.png
"""

import os
import shutil
import pygments
from pygments.lexers import PythonLexer
from pygments.token import Token
from PIL import Image, ImageDraw, ImageFont

# =============================================================================
# DEEP OBSIDIAN DARK THEME PALETTE
# =============================================================================
BG_COLOR = (11, 15, 25)           # #0B0F19 - Deep Obsidian Dark Canvas
GUTTER_BG = (14, 20, 34)          # #0E1422 - Distinct Dark Gutter
HEADER_BG = (22, 31, 48)          # #161F30 - Sleek Window Chrome
BORDER_COLOR = (56, 71, 102)      # #384766 - Refined Dark Border
LINE_NUM_COLOR = (85, 101, 133)   # #556585 - Legible Slate Line Numbers
LINE_DIVIDER = (31, 41, 61)       # #1F293D - Subtle Gutter Divider
TITLE_COLOR = (241, 245, 249)     # #F1F5F9 - Bright Clean Title
TEXT_DEFAULT = (248, 250, 252)    # #F8FAFC - Pure Crisp White Code Text
TAB_BG = (28, 39, 60)             # #1C273C - Active IDE File Tab
TAB_BORDER = (71, 85, 115)        # #475573 - Tab Border
BADGE_TEXT = (203, 166, 247)      # #CBA6F7 - Mauve Badge

# Window Controls (macOS Traffic Light style)
BTN_RED = (239, 68, 68)           # #EF4444
BTN_YELLOW = (245, 158, 11)       # #F59E0B
BTN_GREEN = (16, 185, 129)        # #10B981

# High-Contrast Dark-Mode Syntax Color Map
TOKEN_COLORS = {
    Token.Keyword: (192, 132, 252),             # #C084FC - Vivid Purple/Mauve
    Token.Keyword.Constant: (251, 146, 60),     # #FB923C - Vibrant Coral
    Token.Keyword.Declaration: (192, 132, 252), # #C084FC
    Token.Keyword.Namespace: (192, 132, 252),   # #C084FC
    Token.Keyword.Type: (252, 211, 77),         # #FCD34D - Warm Gold
    Token.Name.Function: (56, 189, 248),        # #38BDF8 - Electric Cyan Blue
    Token.Name.Function.Magic: (56, 189, 248),  # #38BDF8
    Token.Name.Class: (252, 211, 77),           # #FCD34D - Warm Gold Class Names
    Token.Name.Builtin: (34, 211, 238),         # #22D3EE - Bright Cyan
    Token.Name.Builtin.Pseudo: (244, 114, 182), # #F472B6 - Soft Pink (self, cls)
    Token.Name.Decorator: (251, 191, 36),       # #FBBF24 - Golden Decorator
    Token.Literal.String: (74, 222, 128),       # #4ADE80 - Bright Mint Emerald
    Token.Literal.String.Doc: (148, 163, 184),  # #94A3B8 - Clear Silver Docstrings
    Token.Literal.String.Single: (74, 222, 128),
    Token.Literal.String.Double: (74, 222, 128),
    Token.Literal.String.Affix: (192, 132, 252),
    Token.Literal.Number: (251, 146, 60),       # #FB923C - Coral/Orange Numbers
    Token.Literal.Number.Integer: (251, 146, 60),
    Token.Literal.Number.Float: (251, 146, 60),
    Token.Operator: (34, 211, 238),             # #22D3EE - Cyan Operators
    Token.Operator.Word: (192, 132, 252),       # #C084FC - Purple (in, is, and, or)
    Token.Punctuation: (148, 163, 184),         # #94A3B8 - Silver Brackets & Colons
    Token.Comment: (120, 135, 160),             # #7887A0 - Muted Slate Comments
    Token.Comment.Single: (120, 135, 160),
    Token.Comment.Multiline: (120, 135, 160),
}


def get_token_color(token_type):
    while token_type in TOKEN_COLORS:
        return TOKEN_COLORS[token_type]
    if token_type.parent:
        return get_token_color(token_type.parent)
    return TEXT_DEFAULT


def render_code_card(
    title: str,
    code_snippet: str,
    file_label: str = "Python 3.12 · Dark+",
    font_path: str = "C:/Windows/Fonts/CascadiaCode.ttf",
) -> Image.Image:
    """Renders a stunning dark-mode IDE window card with syntax highlighting."""
    code_font_size = 23
    title_font_size = 17
    line_font_size = 20
    badge_font_size = 14

    code_font = ImageFont.truetype(font_path, code_font_size)
    title_font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", title_font_size)
    num_font = ImageFont.truetype(font_path, line_font_size)
    badge_font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", badge_font_size)

    # Process code lines and tokens
    lines = code_snippet.strip("\n").split("\n")
    lexer = PythonLexer()

    token_stream = list(pygments.lex(code_snippet.strip("\n"), lexer))

    line_tokens = []
    current_line = []
    for t_type, t_val in token_stream:
        parts = t_val.split("\n")
        for idx, part in enumerate(parts):
            if idx > 0:
                line_tokens.append(current_line)
                current_line = []
            if part:
                current_line.append((t_type, part))
    line_tokens.append(current_line)

    # Metrics calculation
    line_height = 36
    header_height = 58
    padding_x = 28
    padding_y = 26
    line_num_col_width = 75
    gutter_width = padding_x + line_num_col_width
    code_start_x = gutter_width + 24

    dummy_img = Image.new("RGBA", (1, 1))
    draw_test = ImageDraw.Draw(dummy_img)

    max_code_w = 0
    for l_tokens in line_tokens:
        w = 0
        for t_type, t_val in l_tokens:
            w += draw_test.textlength(t_val, font=code_font)
        if w > max_code_w:
            max_code_w = w

    title_w = draw_test.textlength(title, font=title_font)
    badge_w = draw_test.textlength(file_label, font=badge_font)

    inner_width = max(int(code_start_x + max_code_w + padding_x + 30), int(title_w + badge_w + 280))
    inner_height = int(header_height + padding_y * 2 + len(line_tokens) * line_height)

    # Add outer margin for shadow/border prominence
    margin = 8
    total_width = inner_width + margin * 2
    total_height = inner_height + margin * 2

    img = Image.new("RGBA", (total_width, total_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    card_rect = [margin, margin, margin + inner_width - 1, margin + inner_height - 1]
    corner_radius = 16

    # 1. Base Dark Card
    draw.rounded_rectangle(
        card_rect, radius=corner_radius, fill=BG_COLOR, outline=BORDER_COLOR, width=2
    )

    # 2. Gutter Background (Dark contrast strip on left)
    gutter_rect = [margin, margin + header_height, margin + gutter_width, margin + inner_height - 1]
    draw.rectangle(gutter_rect, fill=GUTTER_BG)

    # 3. Header Window Chrome
    header_mask = Image.new("L", (total_width, total_height), 0)
    h_draw = ImageDraw.Draw(header_mask)
    h_draw.rounded_rectangle(card_rect, radius=corner_radius, fill=255)

    h_clip = Image.new("RGBA", (total_width, total_height), (0, 0, 0, 0))
    hc_draw = ImageDraw.Draw(h_clip)
    hc_draw.rectangle([margin, margin, margin + inner_width, margin + header_height], fill=HEADER_BG)
    img.paste(h_clip, (0, 0), header_mask)

    # Re-draw outline
    draw.rounded_rectangle(card_rect, radius=corner_radius, outline=BORDER_COLOR, width=2)
    # Header bottom divider
    draw.line(
        [(margin, margin + header_height), (margin + inner_width, margin + header_height)],
        fill=LINE_DIVIDER,
        width=1,
    )

    # Window Control buttons (macOS Traffic Lights)
    btn_y = margin + (header_height // 2)
    btn_r = 7
    btn_start_x = margin + 24
    btn_gap = 22
    draw.ellipse(
        [btn_start_x - btn_r, btn_y - btn_r, btn_start_x + btn_r, btn_y + btn_r],
        fill=BTN_RED,
    )
    draw.ellipse(
        [btn_start_x + btn_gap - btn_r, btn_y - btn_r, btn_start_x + btn_gap + btn_r, btn_y + btn_r],
        fill=BTN_YELLOW,
    )
    draw.ellipse(
        [btn_start_x + btn_gap * 2 - btn_r, btn_y - btn_r, btn_start_x + btn_gap * 2 + btn_r, btn_y + btn_r],
        fill=BTN_GREEN,
    )

    # IDE Active Tab Chip in Header
    tab_x = margin + 105
    tab_w = title_w + 36
    tab_rect = [tab_x, margin + 10, tab_x + tab_w, margin + header_height - 1]
    draw.rounded_rectangle(tab_rect, radius=8, fill=TAB_BG, outline=TAB_BORDER, width=1)
    draw.text((tab_x + 18, btn_y - 11), title, font=title_font, fill=TITLE_COLOR)

    # Right Badge (Python 3.12 · Dark+)
    badge_x = margin + inner_width - badge_w - 32
    draw.rounded_rectangle(
        [badge_x - 12, btn_y - 13, badge_x + badge_w + 12, btn_y + 13],
        radius=6,
        fill=(18, 25, 40),
        outline=BORDER_COLOR,
        width=1,
    )
    draw.text((badge_x, btn_y - 9), file_label, font=badge_font, fill=BADGE_TEXT)

    # Vertical Gutter Divider Line
    num_divider_x = margin + gutter_width
    draw.line(
        [(num_divider_x, margin + header_height), (num_divider_x, margin + inner_height - 1)],
        fill=LINE_DIVIDER,
        width=1,
    )

    # Draw Code & Line Numbers
    curr_y = margin + header_height + padding_y
    for idx, l_tokens in enumerate(line_tokens):
        # Line number
        line_num_str = f"{idx + 1:2d}"
        ln_w = draw.textlength(line_num_str, font=num_font)
        draw.text(
            (num_divider_x - 16 - ln_w, curr_y + 2),
            line_num_str,
            font=num_font,
            fill=LINE_NUM_COLOR,
        )

        # Tokens
        curr_x = margin + code_start_x
        for t_type, t_val in l_tokens:
            color = get_token_color(t_type)
            draw.text((curr_x, curr_y), t_val, font=code_font, fill=color)
            curr_x += draw.textlength(t_val, font=code_font)

        curr_y += line_height

    return img


# =============================================================================
# SNIPPET DEFINITIONS (Production Algorithms)
# =============================================================================
SNIPPETS = {
    "code_snap_decision_tree.png": (
        "inference_pipeline.py",
        "CART Decision Tree Contract · Deterministic Triage",
        """def build_model_input(model_data: dict, features: dict, text_description: str):
    \"\"\"Constructs one-hot encoded and vectorised feature vector for CART Decision Tree inference.\"\"\"
    tfidf = model_data['tfidf']
    encoders = model_data['encoders']
    ohe = model_data.get('ohe')

    STRUCTURED_COLS = ['case_category', 'crime_type', 'severity', 'vulnerability', 'influence']

    if ohe is not None:
        structured_row = pd.DataFrame([{
            'case_category': features.get('case_category', 'General Civil'),
            'crime_type': features.get('crime_type', 'Non-Violent'),
            'severity': features.get('severity', 'No Injury'),
            'vulnerability': features.get('vulnerability', 'Low'),
            'influence': features.get('influence', 'Low'),
        }])
        ohe_cols = list(ohe.get_feature_names_out(STRUCTURED_COLS))
        structured_data = pd.DataFrame(ohe.transform(structured_row[STRUCTURED_COLS]), columns=ohe_cols)
    else:
        structured_values = {
            'crime_type_enc': safe_transform_encoder(encoders, 'crime', features.get('crime_type', 'Non-Violent')),
            'severity_enc': safe_transform_encoder(encoders, 'severity', features.get('severity', 'No Injury')),
            'vulnerability_enc': safe_transform_encoder(encoders, 'vulnerability', features.get('vulnerability', 'Low')),
            'influence_enc': safe_transform_encoder(encoders, 'influence', features.get('influence', 'Low')),
        }
        structured_data = pd.DataFrame([structured_values])

    text_feat = tfidf.transform([text_description]).toarray()
    text_df = pd.DataFrame(text_feat, columns=tfidf.get_feature_names_out())
    X = pd.concat([structured_data, text_df], axis=1)

    feature_names = model_data.get('feature_names')
    if feature_names:
        for column in feature_names:
            if column not in X.columns:
                X[column] = 0
        X = X[feature_names]
    return X


def predict_priority(model_data: dict, features: dict, text_description: str) -> str:
    \"\"\"Uses only the local Decision Tree model to predict case priority (High/Medium/Low).\"\"\"
    clf = model_data['model']
    encoders = model_data['encoders']
    X = build_model_input(model_data, features, text_description)

    # Founding Invariant: The LLM extracts facts; Decision Tree alone assigns priority
    pred_idx = clf.predict(X)[0]
    return encoders['priority'].inverse_transform([pred_idx])[0]""",
    ),
    "code_snap_whole_case_merge.png": (
        "whole_case_analysis.py",
        "Multi-Document Fusion & Provenance Engine",
        """def merge_case_features(case) -> tuple[dict, dict]:
    \"\"\"Fuse per-document features into ONE case-level feature set.

    Deterministic, safety-first merge rules:
    - severity: worst value across documents wins (Fatal > Major > Minor > None)
    - vulnerability: highest value wins (High > Medium > Low)
    - influence: highest value wins (High > Low)
    - case_category: majority vote, ties toward the more serious category
    - crime_type: majority vote of document crime_types, same tie-break
    - main_parties: deduplicated union across documents
    - plain_summary: whole-case narrative naming every document
    \"\"\"
    docs = [d for d in case.documents if d.analysis]
    if not docs:
        return {}, {}

    def val(doc, key):
        return (doc.analysis.get(key) or "").strip()

    def worst(key: str, rank: dict) -> tuple[str, list[str]]:
        vals = [val(d, key) for d in docs]
        valid = [v for v in vals if v in rank]
        if not valid:
            return "", []
        best = max(set(valid), key=lambda v: rank[v])
        return best, [d.filename for d in docs if val(d, key) == best]

    severity, severity_src = worst("severity", SEVERITY_RANK)
    vulnerability, vuln_src = worst("vulnerability", VULN_RANK)
    influence, infl_src = worst("influence", INFLUENCE_RANK)

    cat_vals = [val(d, "case_category") for d in docs]
    case_category = _mode([v for v in cat_vals if v in _VALID_CATEGORY],
                          seriousness=_CATEGORY_SERIOUSNESS) or "General Civil"
    cat_sources = [d.filename for d in docs if val(d, "case_category") == case_category]

    crime_vals = [val(d, "crime_type") for d in docs]
    crime_type = _mode([v for v in crime_vals if v in _VALID_CRIME],
                       seriousness=_CRIME_SERIOUSNESS) or "Non-Violent"

    # Merge provenance tracking: records which documents drove each decision
    merge_info = {
        "severity": {"value": severity, "rule": "worst value wins", "sources": severity_src},
        "vulnerability": {"value": vulnerability, "rule": "highest value wins", "sources": vuln_src},
        "influence": {"value": influence, "rule": "highest value wins", "sources": infl_src},
        "case_category": {"value": case_category, "rule": "majority vote (ties -> more serious)", "sources": cat_sources},
    }
    return merged_features, merge_info""",
    ),
    "code_snap_constitutional_engine.png": (
        "constitutional_analysis.py",
        "Rule-Based Constitutional Rights Grounding",
        """SEVERITY_CONSTITUTIONAL_IMPACT = {
    "Fatal": {
        "article": "Article 21",
        "urgency": "Highest — right to life violated irreversibly.",
        "analysis": "Right to life extinguished. State is under affirmative constitutional duty to investigate, prosecute, and provide immediate victim reparation without docket delay."
    },
    "Major": {
        "article": "Article 21",
        "urgency": "High — right to health, bodily integrity, and dignity threatened.",
        "analysis": "Article 21 guarantees healthcare access and prompt judicial redress for debilitating injuries."
    }
}

def analyze_constitutional_rights(features: dict) -> dict:
    \"\"\"Evaluates engaged Indian Constitutional provisions via deterministic statutory rules.\"\"\"
    category = features.get("case_category", "General Civil")
    severity = features.get("severity", "No Injury")
    vulnerability = features.get("vulnerability", "Low")

    category_info = CATEGORY_CONSTITUTIONAL_MAP.get(category, CATEGORY_CONSTITUTIONAL_MAP["General Civil"])
    engaged_rights = []

    # Map primary rights (e.g. Article 14 Equality, Article 21 Life/Liberty)
    for article_key in category_info["primary_articles"]:
        info = CONSTITUTIONAL_ARTICLES[article_key]
        engaged_rights.append({
            "article": article_key, "title": info["title"],
            "principles": info["key_principles"], "primary": True
        })

    # Rule-based severity impact: Fatal / Major automatically engages Article 21
    severity_impact = SEVERITY_CONSTITUTIONAL_IMPACT.get(severity)
    vulnerability_impact = VULNERABILITY_FACTORS.get(vulnerability)

    return {
        "engaged_rights": engaged_rights,
        "severity_analysis": severity_impact,
        "vulnerability_analysis": vulnerability_impact,
        "constitutional_doctrines": category_info.get("doctrines", [])
    }""",
    ),
    "code_snap_chakshu_factcheck.png": (
        "fact_checker.py",
        "Chakshu Geo-Temporal Contradiction Engine",
        """def _rule_verdict(claim: dict, evidence: list):
    \"\"\"Deterministic geo-temporal & event contradiction detection against evidence exhibits.
    Returns (verdict, reason, evidence_dict) where verdict in ('contradicted', 'consistent').
    \"\"\"
    ctype = claim["type"]
    matches = _match_evidence(evidence, ctype, claim["value"])

    if ctype == "location":
        if matches:
            evidence_item = matches[0]
            if not claim["negated"]:
                return ("consistent", f"Exhibits corroborate presence at {evidence_item['display']}.", evidence_item)

            # Contradiction: Subject denied location, but telemetry/records place activity there on that date
            claim_dates = claim.get("dates") or ()
            if claim_dates:
                activity_on_date = [
                    e for e in evidence
                    if e["type"] == "event" and e["value"][1] == claim_dates
                ]
                if activity_on_date:
                    return (
                        "contradicted",
                        f"Telemetry places subject at {evidence_item['display']} on stated date, contrary to denial.",
                        evidence_item
                    )
        return None

    if ctype == "event":
        family, dates = claim["value"]
        same_family = [f for f in evidence if f["type"] == "event" and f["value"][0] == family]
        if dates:
            same_date = [f for f in same_family if f["value"][1] == dates]
            if same_date:
                f = same_date[0]
                if claim["negated"]:
                    return ("contradicted", f"Exhibits record '{f['display']}' on date subject denied it.", f)
                return ("consistent", f"Exhibits corroborate '{f['display']}' on stated date.", f)
        return None""",
    ),
}


def main():
    dest_dirs = [
        r"F:\major_project\docs\report_assets",
        r"C:\Users\Yeshwanth\.gemini\antigravity-cli\brain\fee4464e-747c-4266-a02c-0c9ce5a061a9",
    ]

    for d in dest_dirs:
        os.makedirs(d, exist_ok=True)

    for filename, (title, label, snippet) in SNIPPETS.items():
        print(f"Rendering Dark-Theme Code Snapshot: {filename}...")
        img = render_code_card(title, snippet, file_label=label)

        # Save to primary repo assets
        primary_path = os.path.join(dest_dirs[0], filename)
        img.save(primary_path, "PNG", optimize=True)
        print(f"  Saved {primary_path} ({img.size[0]}x{img.size[1]}px, {os.path.getsize(primary_path)} bytes)")

        # Copy to remaining destinations
        for d in dest_dirs[1:]:
            dst = os.path.join(d, filename)
            shutil.copy2(primary_path, dst)
            print(f"  Copied to {dst}")

    print("\nAll 4 dark theme code snapshots successfully rendered and persisted across all target locations.")


if __name__ == "__main__":
    main()
