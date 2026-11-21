import re
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Inches, Pt

# Paths
repo_root = Path('F:/major_project')
template_path = repo_root / 'Project work 22CSP706-PPTExamTemplate.pptx'
output_path = repo_root / 'Project work 22CSP706-PPTExamTemplate_filled.pptx'
report_md = repo_root / 'ANAVAYA_MAJOR_PROJECT_REPORT.md'

if not template_path.exists():
    print(f'Template not found: {template_path}', file=sys.stderr)
    sys.exit(1)

# Read markdown report and extract sections
section_titles = [
    'Project Title',
    'Abstract',
    'Objectives',
    'Methodologies and Implementation',
    'Conclusion of the Project',
    'Outcome of the Project'
]
sections = {}
current_title = None
with report_md.open('r', encoding='utf-8') as f:
    for line in f:
        # Detect markdown headings (e.g., ## Project Title)
        heading_match = re.match(r'^(#+)\s*(.+)', line)
        if heading_match:
            title = heading_match.group(2).strip()
            if title in section_titles:
                current_title = title
                sections[current_title] = []
                continue
        if current_title:
            sections[current_title].append(line.rstrip())
# Clean up sections (join lines)
for k, v in sections.items():
    sections[k] = '\n'.join(v).strip()

# Load template
prs = Presentation(str(template_path))
# Remove all existing slides except title slide (assuming first slide is title)
while len(prs.slides) > 1:
    rId = prs.slides._sldIdLst[1].rId
    prs.part.drop_rel(rId)
    del prs.slides._sldIdLst[1]

# Function to add a slide with title and content
def add_content_slide(title, content):
    # Use layout 1 (Title and Content) if available
    slide_layout = prs.slide_layouts[1] if len(prs.slide_layouts) > 1 else prs.slide_layouts[0]
    slide = prs.slides.add_slide(slide_layout)
    slide.shapes.title.text = title
    # Add content in the first placeholder (body)
    body = slide.shapes.placeholders[1]
    tf = body.text_frame
    tf.clear()
    for para in content.split('\n'):
        p = tf.add_paragraph()
        p.text = para
        p.font.size = Pt(14)
        p.level = 0

# Populate slides
for sec in section_titles:
    if sec in sections:
        add_content_slide(sec, sections[sec])

prs.save(str(output_path))
print(f'Filled PPT saved to {output_path}')
