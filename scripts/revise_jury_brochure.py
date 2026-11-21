"""Produce the exhibition revision from the approved anime-layout brochure."""
import pymupdf as pdf
from math import sin, cos, pi

doc = pdf.open("Anavaya_Jury_Brochure_Anime.pdf")
p = doc[0]
def rgb(r,g,b): return (r/255,g/255,b/255)
wine, sand, paper, ink, green = rgb(119,23,48),rgb(234,215,185),rgb(249,237,218),rgb(37,25,33),rgb(199,219,161)
for link in p.get_links():
    if "github.com" in link.get("uri",""): p.delete_link(link)
for rect, color in [
    ((25,15,320,31),wine), ((28,60,640,105),wine), ((34,256,412,333),sand), ((437,256,809,333),sand),
    ((295,623,547,743),sand), ((295,753,546,827),sand),
    ((48,976,432,1020),paper), ((450,858,803,955),paper), ((614,960,805,1034),paper)
]:
    p.add_redact_annot(rect,fill=color)
p.apply_redactions(images=2,graphics=0)
p.insert_font(fontname="TimesNR",fontfile="C:/Windows/Fonts/times.ttf")
p.insert_font(fontname="TimesBold",fontfile="C:/Windows/Fonts/timesbd.ttf")
def txt(x,y,s,size=12,font="TimesNR",color=ink):
    p.insert_text((x,y),s,fontname=font,fontsize=size,color=color)
def block(rect,s,size):
    room=p.insert_textbox(rect,s,fontname="TimesNR",fontsize=size,color=ink,align=3,lineheight=1.13)
    assert room>=0,(room,s)
def star(x,y,r):
    points=[(x+(r if i%2==0 else r*.27)*cos(i*pi/4),y+(r if i%2==0 else r*.27)*sin(i*pi/4)) for i in range(8)]
    p.draw_polyline(points+[points[0]],color=green,fill=green,width=.3)
def justified(rect, paragraph, size):
    face = pdf.Font(fontfile="C:/Windows/Fonts/times.ttf")
    left, top, right, bottom = rect
    width = right - left
    lines = [[]]
    for word in paragraph.split():
        if lines[-1] and face.text_length(" ".join(lines[-1] + [word]), fontsize=size) > width:
            lines.append([])
        lines[-1].append(word)
    for index, words in enumerate(lines):
        baseline = top + size + index * size * 1.18
        assert baseline + size * .25 <= bottom
        if index == len(lines) - 1 or len(words) == 1:
            txt(left, baseline, " ".join(words), size)
            continue
        lengths = [face.text_length(word, fontsize=size) for word in words]
        gap = (width - sum(lengths)) / (len(words) - 1)
        x = left
        for word, length in zip(words, lengths):
            txt(x, baseline, word, size)
            x += length + gap

title_size = 48
txt(34,105,"COURT CASE TRIAGE",title_size,"hebo",paper)
star(558,87,6)
txt(807-pdf.get_text_length("ANAVAYA",fontname="hebo",fontsize=title_size),105,"ANAVAYA",title_size,"hebo",paper)
justified((35,258,408,334),"An FIR may describe the incident. A clinical report may establish severity. Other exhibits may show who is vulnerable. Reviewers need to see those facts together to assess urgency.",13.1)
justified((438,258,806,335),"The project report draws on LEGAL-BERT (Chalkidis et al., 2020) and CART (Breiman et al., 1984). Anavaya combines local extraction, multi-document evidence merging and inspectable classification with a separate constitutional rules engine.",12.5)
p.draw_rect((296,623,546,741),color=wine,fill=wine)
for i,label in enumerate(["FIR","Clinical report","Witness statement"]):
    y=636+29*i
    p.draw_rect((306,y,403,y+20),color=paper,fill=paper)
    txt(311,y+14,label,10,"TimesBold")
    p.draw_line((404,y+10),(415,y+10),color=green,width=1.3)
p.draw_line((415,646),(415,704),color=green,width=1.3)
p.draw_line((415,675),(431,675),color=green,width=1.3)
p.draw_rect((431,651,535,700),color=green,fill=green)
txt(438,672,"Whole-case",13,"TimesBold");txt(438,689,"report",13,"TimesBold")
txt(296,767,"Build a case report",16,"TimesBold")
txt(296,787,"Multi-document analysis",11,"TimesBold",wine)
block((296,798,544,830),"Combine exhibits and inspect the whole-case PDF report.",11.4)
txt(49,981,"Accuracy (%) = 100 × trace(C) / sum(C)",15,"TimesBold")
txt(49,997,"C is the three-class confusion matrix. Its diagonal counts exact",12)
txt(49,1011,"priority matches; its total counts all evaluated predictions.",12)
txt(49,1028,"scikit-learn metrics: accuracy_score  |  macro F1: 0.9238",11.5,"TimesBold",wine)
txt(451,875,"EXPLORE THE LIVE DEMO",11,"hebo",wine)
block((451,890,790,952),"Scan the dashboard code to open a demonstration case. Compare the source exhibits, assigned priority and decision path.",13.3)
out="Anavaya_Jury_Revised"
doc.subset_fonts()
doc.save(out+".pdf",garbage=4,deflate=True)
with pdf.open(out+".pdf") as revised:
    page=revised[0]
    page.get_pixmap(matrix=pdf.Matrix(1.6,1.6)).save(out+".png")
    text=page.get_text()
    assert all(v not in text for v in ["265 held-out","Code & docs","Check a claim"])
    assert "COURT CASE TRIAGE" in text and len(page.get_links())==1
