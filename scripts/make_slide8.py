# -*- coding: utf-8 -*-
"""
슬라이드 8(데이터셋 카드) 단독 생성기 — '단일 출처' 카드를 'negative control · 기권 설계'로 교체한 버전.
make_ppt.py와 동일한 에디토리얼 그리드 테마/헬퍼를 사용하되 1페이지만 출력한다.
실행: python scripts/make_slide8.py
출력: 발표_슬라이드8_negative-control.pptx (프로젝트 루트)
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ---- 색상 (화이트 배경 전제) — make_ppt.py와 동일 ----
INK    = RGBColor(0x0F, 0x17, 0x2A)
NAVY   = RGBColor(0x1E, 0x3A, 0x8A)
BLUE   = RGBColor(0x25, 0x63, 0xEB)
SKY    = RGBColor(0x60, 0xA5, 0xFA)
AMBER  = RGBColor(0xB4, 0x53, 0x09)
GREY   = RGBColor(0x47, 0x55, 0x69)
FAINT  = RGBColor(0x94, 0xA3, 0xB8)
HAIR   = RGBColor(0xE2, 0xE8, 0xF0)
BARGREY= RGBColor(0xCB, 0xD5, 0xE1)
ZEBRA  = RGBColor(0xF8, 0xFA, 0xFC)
CARD   = RGBColor(0xF1, 0xF5, 0xF9)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "맑은 고딕"
TOTAL = 14

# ---- 그리드 ----
M  = 0.65
CW = 13.333 - 2 * M

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def _ea(run):
    rPr = run._r.get_or_add_rPr()
    from pptx.oxml.ns import qn
    for tag in ("a:latin", "a:ea", "a:cs"):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {}); rPr.append(el)
        el.set("typeface", FONT)


def style_run(run, size, bold=False, color=INK):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    _ea(run)


def add_box(slide, x, y, w, h, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = 0; tf.margin_right = 0
    tf.margin_top = 0; tf.margin_bottom = 0
    return tf


def add_shape(slide, x, y, w, h, fill, shape=MSO_SHAPE.RECTANGLE,
              line_color=None, line_w=0.75):
    sp = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sp.fill.background()
    else:
        sp.fill.solid(); sp.fill.fore_color.rgb = fill
    if line_color is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line_color; sp.line.width = Pt(line_w)
    sp.shadow.inherit = False
    return sp


def card(slide, x, y, w, h, fill=CARD, line=None, line_w=0.75, radius=0.07):
    sp = add_shape(slide, x, y, w, h, fill, MSO_SHAPE.ROUNDED_RECTANGLE,
                   line_color=line, line_w=line_w)
    try:
        sp.adjustments[0] = radius
    except Exception:
        pass
    tf = sp.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = Inches(0.16); tf.margin_right = Inches(0.16)
    tf.margin_top = Inches(0.06); tf.margin_bottom = Inches(0.06)
    return sp, tf


def para(tf, runs, align=PP_ALIGN.LEFT, before=0, after=0, line=1.04, first=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    if before: p.space_before = Pt(before)
    if after:  p.space_after = Pt(after)
    p.line_spacing = line
    for (txt, size, bold, color) in runs:
        r = p.add_run(); style_run(r, size, bold, color); r.text = txt
    return p


def stat_card(slide, x, y, w, h, value, label, vcolor=INK, fill=CARD, vsize=30):
    sp, tf = card(slide, x, y, w, h, fill=fill)
    para(tf, [(value, vsize, True, vcolor)], align=PP_ALIGN.CENTER, first=True)
    para(tf, [(label, 12.5, False, GREY)], align=PP_ALIGN.CENTER, before=3)
    return sp


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def header(slide, kicker, title, star=False):
    tf = add_box(slide, M, 0.46, CW, 0.34)
    para(tf, [(kicker, 13, True, BLUE)], first=True)
    tf2 = add_box(slide, M, 0.80, CW, 0.72)
    runs = [(title, 30, True, INK)]
    if star:
        runs.append(("  ★", 21, True, AMBER))
    para(tf2, runs, first=True)
    add_shape(slide, M, 1.60, 1.05, 0.045, BLUE)


def footer(slide, page):
    tfL = add_box(slide, M, 7.08, 7, 0.3)
    para(tfL, [("Career-Path Navigator", 9, False, FAINT)], first=True)
    tfR = add_box(slide, 13.333 - M - 1.6, 7.05, 1.6, 0.32)
    para(tfR, [(f"{page:02d}", 12, True, GREY), (f" / {TOTAL:02d}", 12, False, FAINT)],
         align=PP_ALIGN.RIGHT, first=True)


# ============================================================
# 슬라이드 8 — 데이터셋 카드 (기권 설계 버전)
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "데이터", "데이터셋 카드 — 균형 · 난이도 · 기권 설계")

stats8 = [("84", "평가셋 (16개 도메인 × 5 균형)"),
          ("30", "실제 자소서 PDF (홀드아웃)"),
          ("130", "사전계산 SBERT 임베딩"),
          ("600+", "도메인 키워드 사전")]
kw8 = (12.033 - 3 * 0.3) / 4
for i, (v, lab) in enumerate(stats8):
    stat_card(s, M + i * (kw8 + 0.3), 1.95, kw8, 1.15, v, lab, vsize=26)

# 평가셋 구성 누적 막대
tf = add_box(s, M, 3.5, 12.033, 0.35)
para(tf, [("평가셋 구성 — 쉬운 문장만 넣지 않았다", 16, True, INK)], first=True)
segs = [("synthetic", 61, BLUE), ("lexical_gap", 11, SKY),
        ("stress_test", 8, AMBER), ("negative", 4, BARGREY)]
bx8, bw8 = M, 12.033
x = bx8
for name, n, color in segs:
    w = bw8 * n / 84.0
    add_shape(s, x, 3.95, w - 0.02, 0.5, color)
    if w > 1.0:
        tfs = add_box(s, x, 4.0, w - 0.02, 0.4)
        para(tfs, [(str(n), 14, True, WHITE)], align=PP_ALIGN.CENTER, first=True)
    x += w
tf = add_box(s, M, 4.62, 12.033, 0.35)
para(tf, [("■ ", 12, False, BLUE), ("synthetic 61    ", 13, False, GREY),
          ("■ ", 12, False, SKY), ("lexical_gap 11 — 키워드 없이 의미로만 판단    ", 13, False, GREY),
          ("■ ", 12, False, AMBER), ("stress_test 8 — 도메인 혼재    ", 13, False, GREY),
          ("■ ", 12, False, BARGREY), ("negative 4 — 직무 정보 없음", 13, False, GREY)], first=True)

# 하단 카드 — negative control · 기권 설계
sp, tfc = card(s, M, 5.35, 12.033, 1.15, fill=ZEBRA, line=HAIR)
add_shape(s, M, 5.5, 0.05, 0.85, AMBER)
tfc.margin_left = Inches(0.32)
para(tfc, [("함정 샘플 · 기권 설계 — ", 15.5, True, NAVY),
           ("직무 정보 없는 negative control 4개는 '증거 부족 → 기권'이 정답", 15.5, False, INK)],
     first=True)
para(tfc, [("억지로 한 도메인을 단정하지 않고 모르면 기권 — Coverage < 100%는 결함이 아니라 의도된 안전장치",
            13.5, False, GREY)], before=5)
footer(s, 8)
notes(s, "평가셋은 16개 도메인을 각 5개씩 균형 있게 80개, 여기에 negative control 4개를 더해 84개로 "
          "구성했습니다. 키워드 없이 의미로만 판단해야 하는 lexical_gap, 도메인이 섞인 stress_test를 "
          "일부러 넣어 난이도를 높였습니다. 특히 직무 정보가 전혀 없는 negative control 4개는 어느 "
          "도메인을 찍는 게 아니라 '증거 부족으로 기권'하는 것이 정답입니다. 모르면 모른다고 말하는 "
          "설계라 Coverage가 100%가 아닌 것은 결함이 아니라 의도된 것입니다. 또 실제 자소서 PDF 30개를 "
          "별도 확보해 홀드아웃으로 씁니다.")

out = os.path.join(os.path.dirname(__file__), "..", "발표_슬라이드8_negative-control.pptx")
prs.save(out)
print("생성 완료:", os.path.abspath(out))
