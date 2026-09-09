# -*- coding: utf-8 -*-
"""
Career-Path Navigator 기말 발표 덱 생성기 — 에디토리얼 그리드 테마.
PPT_OUTLINE.md (14장) 기반. 흰 배경 + 남색 액센트, 카드·네이티브 차트 중심 레이아웃.
모든 콘텐츠는 좌우 0.65" 그리드에 정렬. 발표 스크립트는 발표자 노트에 삽입.
실행: python scripts/make_ppt.py
출력: 발표_Career-Path-Navigator.pptx (프로젝트 루트)
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.oxml.ns import qn

# ---- 색상 (화이트 배경 전제) ----
INK    = RGBColor(0x0F, 0x17, 0x2A)   # 제목/본문 (짙은 남색)
NAVY   = RGBColor(0x1E, 0x3A, 0x8A)
BLUE   = RGBColor(0x25, 0x63, 0xEB)   # 액센트
SKY    = RGBColor(0x60, 0xA5, 0xFA)   # 보조 액센트
PALE   = RGBColor(0xDB, 0xEA, 0xFE)   # 옅은 파랑 배경
AMBER  = RGBColor(0xB4, 0x53, 0x09)   # 강조 (정직성·★)
GREY   = RGBColor(0x47, 0x55, 0x69)   # 보조 본문
FAINT  = RGBColor(0x94, 0xA3, 0xB8)   # 푸터/마커
HAIR   = RGBColor(0xE2, 0xE8, 0xF0)   # 가는 선
BARGREY= RGBColor(0xCB, 0xD5, 0xE1)   # 차트 보조 막대
ZEBRA  = RGBColor(0xF8, 0xFA, 0xFC)   # 옅은 줄무늬
CARD   = RGBColor(0xF1, 0xF5, 0xF9)   # 카드 배경
HLROW  = RGBColor(0xFE, 0xF3, 0xC7)   # 표 강조행
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "맑은 고딕"
TOTAL = 14

# ---- 그리드 ----
M  = 0.65                  # 좌우 여백 (inch)
CW = 13.333 - 2 * M        # 콘텐츠 폭 = 12.033
TOP = 1.85                 # 본문 시작 y
BOT = 6.85                 # 본문 끝 y

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]


def _ea(run):
    rPr = run._r.get_or_add_rPr()
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
    """내부 여백 0의 텍스트박스 — 그리드에 정확히 정렬되도록."""
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
    """둥근 카드 + 여백 정돈된 내부 텍스트프레임 반환."""
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
    """runs: [(text, size, bold, color), ...] 한 단락."""
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


def conn(slide, x1, y1, x2, y2, color=BLUE, w=2.5):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT,
                                   Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = color
    c.line.width = Pt(w)
    c.shadow.inherit = False
    return c


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
    add_shape(slide, M, 1.60, 1.05, Pt(3.5) / 914400 * 0 + 0.045, BLUE)


def footer(slide, page):
    tfL = add_box(slide, M, 7.08, 7, 0.3)
    para(tfL, [("Career-Path Navigator", 9, False, FAINT)], first=True)
    tfR = add_box(slide, 13.333 - M - 1.6, 7.05, 1.6, 0.32)
    para(tfR, [(f"{page:02d}", 12, True, GREY), (f" / {TOTAL:02d}", 12, False, FAINT)],
         align=PP_ALIGN.RIGHT, first=True)


# --- 표: 테두리 없는 스타일 + 직접 채색/밑줄 ---
NO_STYLE = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"


def clear_table_style(tbl):
    tblPr = tbl._tbl.tblPr
    for el in tblPr.findall(qn('a:tableStyleId')):
        tblPr.remove(el)
    se = tblPr.makeelement(qn('a:tableStyleId'), {})
    se.text = NO_STYLE
    tblPr.append(se)


def cell_bottom(cell, hexc, pt):
    tcPr = cell._tc.get_or_add_tcPr()
    for el in tcPr.findall(qn('a:lnB')):
        tcPr.remove(el)
    ln = tcPr.makeelement(qn('a:lnB'), {'w': str(int(Pt(pt))), 'cap': 'flat'})
    sf = ln.makeelement(qn('a:solidFill'), {})
    c = sf.makeelement(qn('a:srgbClr'), {'val': hexc})
    sf.append(c); ln.append(sf)
    tcPr.insert(0, ln)


def add_table(slide, headers, rows, x, y, w, h, hl_row=None, fs=13, col_w=None):
    nrows, ncols = len(rows) + 1, len(headers)
    tbl = slide.shapes.add_table(nrows, ncols, Inches(x), Inches(y),
                                 Inches(w), Inches(h)).table
    clear_table_style(tbl)
    if col_w:
        for i, cwv in enumerate(col_w):
            tbl.columns[i].width = Inches(cwv)
    for c, htext in enumerate(headers):
        cell = tbl.cell(0, c)
        cell.fill.solid(); cell.fill.fore_color.rgb = WHITE
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_top = Pt(5); cell.margin_bottom = Pt(5)
        cell.margin_left = Pt(8); cell.margin_right = Pt(4)
        pr = cell.text_frame.paragraphs[0]
        pr.alignment = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER
        rn = pr.add_run(); style_run(rn, fs, True, NAVY); rn.text = htext
        cell_bottom(cell, "1E3A8A", 2.0)
    for ri, row in enumerate(rows, start=1):
        is_hl = (hl_row is not None and ri == hl_row)
        for c, val in enumerate(row):
            cell = tbl.cell(ri, c)
            cell.fill.solid()
            cell.fill.fore_color.rgb = HLROW if is_hl else (WHITE if ri % 2 else ZEBRA)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_top = Pt(4); cell.margin_bottom = Pt(4)
            cell.margin_left = Pt(8); cell.margin_right = Pt(4)
            pr = cell.text_frame.paragraphs[0]
            pr.alignment = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER
            rn = pr.add_run()
            style_run(rn, fs, is_hl, AMBER if is_hl else INK); rn.text = str(val)
            cell_bottom(cell, "E2E8F0", 0.75)
    return tbl


# ============================================================
# 슬라이드 1 — 표지
# ============================================================
s = prs.slides.add_slide(BLANK)
add_shape(s, 0, 0, 0.22, 7.5, BLUE)

tf = add_box(s, 1.0, 1.45, 11.0, 0.4)
para(tf, [("자연어처리 기말 프로젝트", 15, True, BLUE)], first=True)

tf = add_box(s, 1.0, 1.88, 11.7, 1.1)
para(tf, [("Universal Career-Path Navigator", 44, True, INK)], first=True)

add_shape(s, 1.0, 3.05, 1.4, 0.055, BLUE)

tf = add_box(s, 1.0, 3.30, 11.4, 0.8)
para(tf, [("자소서 한 장으로 — 직무 도메인 판정부터 직무·연구실 추천, 판정 근거까지",
           18, False, GREY)], first=True)

# KPI 스트립 — 프로젝트 강점 4가지를 표지에서 바로 어필
kpis = [("16", "직무 도메인 범용 분류"),
        ("7-way", "Ablation + 95% CI 평가"),
        ("90.5%", "SBERT Hybrid 정확도"),
        ("29건", "실제 자소서 홀드아웃")]
kw = (12.033 - 3 * 0.3) / 4
for i, (v, lab) in enumerate(kpis):
    x = 1.0 + i * (kw + 0.3)
    vcol = BLUE if i == 2 else INK
    stat_card(s, x, 4.45, kw, 1.25, v, lab, vcolor=vcol, vsize=28)

tf = add_box(s, 1.0, 6.35, 11.4, 0.8)
para(tf, [("팀명 [팀명 입력]    ·    팀원 [4명 이름]", 14, False, FAINT)], first=True)
para(tf, [("과목 자연어처리    ·    발표일 2026-06-__", 14, False, FAINT)], before=4)
notes(s, "자소서를 올리면 어떤 직무에 맞는지 분석하고 직무와 연구실을 추천해 주는 "
          "NLP 시스템, Career-Path Navigator를 발표하겠습니다.")

# ============================================================
# 슬라이드 2 — 문제 정의
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "도입", "문제 정의 — 막연한 고민을 측정 가능한 문제로")

# 좌: 두 개의 고민 인용 카드
qx, qw = M, 5.75
for i, (q, sub) in enumerate([
        ("“내가 어떤 직무에 맞는 사람일까?”", "적합성을 본인도 설명하기 어렵다"),
        ("“내 경험에 맞는 직무·연구실은 어디일까?”", "수백 개 선택지를 하나씩 찾아보는 탐색 비용")]):
    cy = 2.05 + i * 1.55
    sp, tfc = card(s, qx, cy, qw, 1.3, fill=ZEBRA, line=HAIR)
    add_shape(s, qx, cy + 0.18, 0.05, 0.94, BLUE)
    tfc.margin_left = Inches(0.3)
    para(tfc, [(q, 17, True, INK)], first=True)
    para(tfc, [(sub, 13.5, False, GREY)], before=5)

# 우: 재정의 패널
rx = M + qw + 0.45
rw = 12.033 - qw - 0.45
sp, tfc = card(s, rx, 2.05, rw, 2.85, fill=NAVY)
tfc.margin_left = Inches(0.35); tfc.margin_right = Inches(0.3)
para(tfc, [("우리의 재정의", 13, True, SKY)], first=True)
para(tfc, [("입력 텍스트의 특성이 답하게 한다", 21, True, WHITE)], before=6)
for step in ["1   자소서 텍스트 입력 (PDF·TXT·MD)",
             "2   NLP로 16개 도메인 중 적합 도메인 판정",
             "3   판정 근거와 함께 직무·연구실 추천"]:
    para(tfc, [(step, 14.5, False, PALE)], before=9)

# 하단: 차별점 한 줄
add_shape(s, M, 5.35, 12.033, 0.012, HAIR)
tf = add_box(s, M, 5.62, 12.033, 1.0)
para(tf, [("목표는 점수만 주는 블랙박스가 아니라 ", 17, False, GREY),
          ("근거를 함께 보여주는 설명 가능한 추천", 17, True, AMBER),
          ("입니다", 17, False, GREY)], first=True)
para(tf, [("어떤 키워드가, 어떤 유사도가 판정을 만들었는지 Audit Panel로 공개", 14, False, FAINT)],
     before=5)
footer(s, 2)
notes(s, "자소서를 쓸 때 가장 큰 고민은 '내가 어떤 직무에 맞는가'입니다. 이 막연한 질문을, "
          "입력된 텍스트의 특성을 분석해 정량적으로 답하는 문제로 정의했습니다. 점수만 주는 게 "
          "아니라 판정 근거까지 보여주는 게 목표입니다.")

# ============================================================
# 슬라이드 3 — 16개 도메인
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "도입", "범용(General Purpose) — 16개 직무 도메인")
tf = add_box(s, M, 1.82, 12.033, 0.4)
para(tf, [("특정 개인·직군에 묶이지 않고 입력 텍스트 특성으로 판단  ·  활용: 취업 준비 / 자소서 점검 / 연구실 탐색 / 직무 전환",
           14.5, False, GREY)], first=True)

domains = ["공학", "데이터", "기획", "연구", "관리", "행정", "경제·금융", "경영",
           "간호·보건", "자연과학", "인문사회", "예술·디자인",
           "제조·생산", "에너지·발전", "항공·우주", "미디어·콘텐츠"]
gap = 0.14
cw = (12.033 - 3 * gap) / 4
ch = 0.86
gy = 2.42
for i, d in enumerate(domains):
    rr_, cc_ = divmod(i, 4)
    x = M + cc_ * (cw + gap)
    y = gy + rr_ * (ch + gap)
    sp, tfc = card(s, x, y, cw, ch, fill=CARD, line=HAIR)
    para(tfc, [(d, 16, True, INK)], align=PP_ALIGN.CENTER, first=True)

tf = add_box(s, M, 6.45, 12.033, 0.4)
para(tf, [("같은 코드·같은 사전 구조로 도메인만 추가하면 확장 — ", 14.5, False, GREY),
          ("이공계 전용이 아닌 전 직군 대응", 14.5, True, AMBER)], first=True)
footer(s, 3)
notes(s, "취업·진학 준비생을 대상으로 16개 직무 도메인을 다룹니다. 특정 직군에 국한되지 않고 "
          "입력 텍스트 특성으로 판단하는 범용 시스템입니다.")

# ============================================================
# 슬라이드 4 — 파이프라인
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "시스템", "전체 파이프라인 — 업로드부터 추천까지")

stages = [
    ("입력",   "PDF / TXT / MD 업로드", "pdf.js 텍스트 추출", 0),
    ("전처리", "한국어 문장 분리 · 정규화 · 불용어 처리", "자체 문장 경계 규칙", 0),
    ("분류",   "4개 분류기 — 키워드 · BoN · SBERT · 학습헤드", "브라우저 실시간 SBERT (Transformers.js, 384-d)", 2),
    ("결합",   "Hybrid 결합 = 키워드 0.45 + 의미 0.55", "sweep 실험으로 검증한 가중치", 1),
    ("출력",   "도메인 판정 + 직무·연구실 추천 + 근거 제시", "Audit Panel · Mind-Map", 0),
]
y = 1.95
row_h = 0.74
chip_w, box_w, note_w = 1.15, 7.3, 3.1
gap_x = 0.22
bx = M + chip_w + gap_x
nx = bx + box_w + gap_x
for i, (stage, label, note, kind) in enumerate(stages):
    # 좌측 단계 칩
    sp, tfc = card(s, M, y + 0.09, chip_w, row_h - 0.18, fill=WHITE, line=HAIR)
    para(tfc, [(stage, 13, True, NAVY)], align=PP_ALIGN.CENTER, first=True)
    # 중앙 본문 박스
    if kind == 2:
        fill, lc, tc = BLUE, None, WHITE
    elif kind == 1:
        fill, lc, tc = PALE, None, NAVY
    else:
        fill, lc, tc = ZEBRA, HAIR, INK
    sp, tfc = card(s, bx, y, box_w, row_h, fill=fill, line=lc)
    para(tfc, [(label, 16, kind != 0, tc)], align=PP_ALIGN.CENTER, first=True)
    # 우측 기술 주석
    tfn = add_box(s, nx, y, note_w, row_h, anchor=MSO_ANCHOR.MIDDLE)
    para(tfn, [(note, 12.5, False, FAINT)], first=True)
    y += row_h + 0.21
    if i < len(stages) - 1:
        ar = add_box(s, bx, y - 0.205, box_w, 0.19, anchor=MSO_ANCHOR.MIDDLE)
        para(ar, [("▼", 10, True, FAINT)], align=PP_ALIGN.CENTER, first=True)
footer(s, 4)
notes(s, "전체 흐름입니다. 문서를 올리면 텍스트를 추출·전처리하고, 네 가지 분류기를 거쳐 "
          "하이브리드로 결합한 뒤 도메인을 판정하고 추천합니다. 모든 추론이 서버 없이 "
          "브라우저 안에서 끝납니다. 이제 분류기를 하나씩 보겠습니다.")

# ============================================================
# 슬라이드 5 — 분류 방법 ①②③ ★
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "방법론", "분류 방법 ①②③ — 단계적 고도화", star=True)
add_table(s,
    ["방법", "원리", "합성 정확도", "한계"],
    [["① 키워드 (Baseline)", "600+ 도메인 사전 매칭", "86.9%", "단어 의미·맥락 모름"],
     ["② BoN 코사인", "음절 2~3-gram 빈도 벡터", "Hybrid 89.3%", "어휘 겹침만 봄"],
     ["③ SBERT 코사인", "MiniLM-L12 384-d 의미 임베딩", "78.6% (단독)", "한국어 특화 아님"]],
    M, 1.95, 12.033, 2.55, fs=15,
    col_w=[3.1, 4.65, 2.25, 2.033])

sp, tfc = card(s, M, 4.95, 12.033, 1.55, fill=ZEBRA, line=HAIR)
add_shape(s, M, 5.15, 0.05, 1.15, AMBER)
tfc.margin_left = Inches(0.32)
para(tfc, [("핵심 관찰 — SBERT 단독(78.6%)이 키워드(86.9%)보다 낮다", 19, True, AMBER)],
     first=True)
para(tfc, [("키워드는 전문 용어를 정확히 잡고, SBERT는 맥락을 잡는다. 약점이 서로 다르다 → 결합의 근거 (다음 장)",
            15, False, GREY)], before=7)
footer(s, 5)
notes(s, "키워드는 'Docker' 같은 전문 용어를 정확히 잡지만 맥락을 모릅니다. SBERT는 의미를 "
          "잡지만 다국어 범용 모델이라 한국어 전문 용어엔 약합니다. 흥미롭게도 SBERT 단독은 "
          "키워드보다 낮습니다. 약점이 서로 다르기 때문에, 둘을 합칠 근거가 됩니다.")

# ============================================================
# 슬라이드 6 — Hybrid 결합 ★ (좌 설명 + 우 막대차트)
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "방법론", "Hybrid 결합 — 1 + 1 > 2", star=True)

lw = 6.7
sp, tfc = card(s, M, 2.0, lw, 0.95, fill=NAVY)
para(tfc, [("최종 점수 = 키워드 × 0.45 + SBERT × 0.55", 19, True, WHITE)],
     align=PP_ALIGN.CENTER, first=True)

tf = add_box(s, M, 3.3, lw, 3.3)
para(tf, [("서로 다른 약점을 보완", 17, True, INK)], first=True)
para(tf, [("전문 용어(키워드) + 문맥 의미(SBERT) → 단독 최고치 대비 +3.6%p",
           14.5, False, GREY)], before=4)
para(tf, [("가중치 0.45는 임의값이 아니다", 17, True, INK)], before=14)
para(tf, [("0→1 전 구간 sweep: 0.3~0.9에서 정확도 고원(plateau) 확인",
           14.5, False, GREY)], before=4)
para(tf, [("→ 특정 값에 과적합되지 않은 안정 구간 내 선택", 14.5, False, GREY)], before=3)

# 우: 네이티브 막대 차트 (Keyword 86.9 / SBERT 78.6 / Hybrid 90.5)
cx0 = M + lw + 0.45
cw_ = 12.033 - lw - 0.45
plot_bottom, plot_h = 5.55, 3.1
vmin, vmax = 60.0, 95.0
bars = [("키워드", 86.9, BARGREY, INK), ("SBERT", 78.6, BARGREY, INK),
        ("Hybrid", 90.5, BLUE, BLUE)]
bw_ = 0.95
gap_b = (cw_ - 3 * bw_) / 4
add_shape(s, cx0, plot_bottom, cw_, 0.014, HAIR)          # 축
for i, (name, v, fill, vcol) in enumerate(bars):
    h = (v - vmin) / (vmax - vmin) * plot_h
    x = cx0 + gap_b + i * (bw_ + gap_b)
    add_shape(s, x, plot_bottom - h, bw_, h, fill)
    tfv = add_box(s, x - 0.25, plot_bottom - h - 0.36, bw_ + 0.5, 0.32)
    para(tfv, [(f"{v}%", 16, True, vcol)], align=PP_ALIGN.CENTER, first=True)
    tfn = add_box(s, x - 0.25, plot_bottom + 0.08, bw_ + 0.5, 0.3)
    para(tfn, [(name, 13.5, i == 2, INK if i == 2 else GREY)],
         align=PP_ALIGN.CENTER, first=True)
tfc2 = add_box(s, cx0, 6.15, cw_, 0.3)
para(tfc2, [("합성 평가셋 84개 기준 · 축 60~95% 구간", 11, False, FAINT)],
     align=PP_ALIGN.CENTER, first=True)
footer(s, 6)
notes(s, "키워드 45%, 의미 55%로 합치면 90.5%로, 각 단독보다 높습니다. 서로의 약점을 보완하기 "
          "때문입니다. 가중치도 0.3~0.9 구간이 모두 비슷한 고원이라, 0.45가 안정적인 선택임을 "
          "민감도 분석으로 확인했습니다.")

# ============================================================
# 슬라이드 7 — 학습 헤드 ★ (좌 고도화 3종 + 우 LogReg vs MLP)
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "방법론", "학습 헤드 — frozen SBERT 위 지도학습", star=True)

lw = 6.4
items7 = [("① 표준화", "StandardScaler — 차원별 스케일 정렬"),
          ("② 클래스 가중", "class_weight='balanced' — 소수 도메인 보호"),
          ("③ nested LOOCV", "바깥 LOOCV × 안쪽 CV — 누수 없는 C 선택")]
for i, (t, d) in enumerate(items7):
    cy = 2.0 + i * 1.02
    sp, tfc = card(s, M, cy, lw, 0.86, fill=ZEBRA, line=HAIR)
    tfc.margin_left = Inches(0.26)
    para(tfc, [(t + "   ", 16, True, NAVY), (d, 13.5, False, GREY)], first=True)
tf = add_box(s, M, 5.3, lw, 0.9)
para(tf, [("nested LOOCV 정확도  ", 15, True, INK),
          ("42.6% → 76.5% → ", 15, False, GREY),
          ("79.8%", 17, True, BLUE)], first=True)
para(tf, [("(초기 → 고도화 3종 → 평가셋 균형화)", 12.5, False, FAINT)], before=3)

# 우: LogReg vs MLP 대결 카드
rx = M + lw + 0.45
rw = 12.033 - lw - 0.45
sp, tfc = card(s, rx, 2.0, rw, 2.5, fill=CARD)
para(tfc, [("같은 조건, 알고리즘만 교체", 13.5, True, GREY)], align=PP_ALIGN.CENTER, first=True)
para(tfc, [("LogReg 79.8%", 24, True, BLUE)], align=PP_ALIGN.CENTER, before=8)
para(tfc, [("vs", 13, False, FAINT)], align=PP_ALIGN.CENTER, before=2)
para(tfc, [("MLP(은닉128) 67.9%", 19, True, GREY)], align=PP_ALIGN.CENTER, before=2)
sp, tfc = card(s, rx, 4.75, rw, 1.5, fill=ZEBRA, line=HAIR)
tfc.margin_left = Inches(0.26)
para(tfc, [("클래스당 5개 소규모 → 선형이 승", 15.5, True, AMBER)], first=True)
para(tfc, [("배포도 LogReg — 브라우저 W·x+b 추론과 호환", 13.5, False, GREY)], before=5)
footer(s, 7)
notes(s, "단순 코사인을 넘어, SBERT 위에 로지스틱 회귀 헤드를 학습시켰습니다. 표준화·클래스가중·"
          "누수 없는 교차검증으로 LOOCV를 79.8%까지 올렸습니다. 비선형 MLP도 같은 조건에서 "
          "실험했는데 67.9%로 오히려 낮았습니다. 데이터가 적을 때는 선형이 낫다는 걸 실험으로 "
          "확인했고, 배포는 LogReg로 갑니다.")

# ============================================================
# 슬라이드 8 — 데이터셋 카드
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "데이터", "데이터셋 카드 — 균형 · 난이도 · 단일 출처")

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
          ("■ ", 12, False, BARGREY), ("negative 4", 13, False, GREY)], first=True)

sp, tfc = card(s, M, 5.35, 12.033, 1.15, fill=ZEBRA, line=HAIR)
add_shape(s, M, 5.5, 0.05, 0.85, BLUE)
tfc.margin_left = Inches(0.32)
para(tfc, [("단일 출처 원칙 — ", 15.5, True, NAVY),
           ("evaluationDataset.js → exportEvalDataset.mjs → JSON 자동 생성", 15.5, False, INK)],
     first=True)
para(tfc, [("앱·Python 학습·평가 스크립트가 항상 같은 데이터를 본다 (수동 동기화 폐지)",
            13.5, False, GREY)], before=5)
footer(s, 8)
notes(s, "평가셋은 16개 도메인을 각 5개씩 균형 있게 84개로 구성했습니다. 특히 키워드 없이 "
          "의미로만 판단해야 하는 문장과 도메인이 섞인 문장을 일부러 넣어 난이도를 높였습니다. "
          "또 실제 자소서 PDF 30개를 별도 확보해 홀드아웃으로 씁니다.")

# ============================================================
# 슬라이드 9 — 7-way Ablation ★
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "평가", "7-way Ablation — 같은 조건, 7가지 방법", star=True)
add_table(s,
    ["방법", "Accuracy", "95% CI", "Macro F1", "Coverage"],
    [["Keyword-only", "86.9%", "[79.8, 94.0]", "87.4%", "89.3%"],
     ["BoN Hybrid", "89.3%", "[82.1, 95.2]", "89.4%", "91.7%"],
     ["SBERT-only", "78.6%", "[69.0, 86.9]", "79.5%", "89.3%"],
     ["SBERT Hybrid  ★", "90.5%", "[83.3, 96.4]", "90.7%", "91.7%"],
     ["SBERT Hybrid + Threshold", "90.5%", "[83.3, 96.4]", "90.7%", "91.7%"],
     ["Learned Head (LOOCV)", "79.8%", "[70.2, 86.9]", "78.6%", "100%"],
     ["Learned Head Hybrid (참고)", "92.9%", "[86.9, 97.6]", "89.7%", "100%"]],
    M, 1.92, 12.033, 4.35, hl_row=4, fs=14,
    col_w=[4.4, 1.85, 2.35, 1.75, 1.683])

sp, tfc = card(s, M, 6.42, 12.033, 0.52, fill=ZEBRA, line=HAIR)
para(tfc, [("부트스트랩 2,000회 · 시드 고정으로 재현 가능 · 서비스 기본값 = SBERT Hybrid 90.5%",
            13.5, True, GREY)], align=PP_ALIGN.CENTER, first=True)
footer(s, 9)
notes(s, "7가지 방법을 동일 조건에서 비교했습니다. 기본값인 SBERT Hybrid가 90.5%로 가장 "
          "안정적이고, 부트스트랩 2,000회로 95% 신뢰구간까지 함께 보고합니다. 부트스트랩은 "
          "시드를 고정해 누가 다시 돌려도 같은 수치가 나옵니다.")

# ============================================================
# 슬라이드 10 — 정직성 ★★ (3개 증거 카드)
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "평가 · 핵심 차별점", "정직한 평가 — 잘 나온 숫자만 보여주지 않는다", star=True)

cards10 = [
    ("일반화 갭 공개", "90.5% → 72.4%", AMBER,
     "합성 평가셋 → 실제 자소서 29건 홀드아웃.",
     "단, 실데이터 Macro F1은 SBERT Hybrid 86.4% > 키워드 79.0% — 의미 임베딩 가치는 실데이터에서 더 분명"),
    ("과대평가 자체 교정", "97.1% → 90.5%", NAVY,
     "평가셋을 68→84개로 키우고 어렵게 만든 결과.",
     "성능 하락이 아니라 쉬운 평가셋이 만든 거품을 스스로 걷어낸 수치"),
    ("음성 결과도 보고", "79.8% → 77.4%", GREY,
     "실데이터 PDF를 학습에 추가하자 오히려 하락.",
     "자동 판단으로 미배포 — “데이터 무작정 확대는 답이 아니다”를 실험으로 입증"),
]
cw10 = (12.033 - 2 * 0.35) / 3
for i, (title10, big, color, l1, l2) in enumerate(cards10):
    x = M + i * (cw10 + 0.35)
    sp, tfc = card(s, x, 2.05, cw10, 4.35, fill=ZEBRA, line=HAIR)
    sp.adjustments[0] = 0.045
    tfc.vertical_anchor = MSO_ANCHOR.TOP
    tfc.margin_left = Inches(0.26); tfc.margin_right = Inches(0.24)
    tfc.margin_top = Inches(0.3)
    para(tfc, [(title10, 14.5, True, color)], first=True)
    para(tfc, [(big, 26, True, INK)], before=10)
    para(tfc, [(l1, 13.5, False, GREY)], before=12, line=1.15)
    para(tfc, [(l2, 13.5, False, GREY)], before=8, line=1.15)
    add_shape(s, x, 2.05, cw10, 0.07, color)
footer(s, 10)
notes(s, "가장 강조하고 싶은 부분입니다. 합성 90.5%가 실제 자소서에선 72.4%로 떨어집니다. "
          "이 일반화 갭을 숨기지 않고 공개합니다. 평가셋을 어렵게 키우면서 과대평가도 스스로 "
          "교정했습니다. 또 실데이터를 학습에 더 넣어봤더니 오히려 성능이 떨어졌는데, 이 음성 "
          "결과까지 그대로 보고합니다. 데이터는 양이 아니라 질이라는 걸 실험으로 보여줍니다.")

# ============================================================
# 슬라이드 11 — 학습곡선 (네이티브 라인 차트)
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "평가", "학습곡선 — 한계는 알고리즘이 아니라 데이터 양")

# 좌: 수동 라인 차트
pts = [(14, 41.7), (28, 66.7), (42, 71.4), (56, 76.2)]
px0, px1 = 1.05, 6.9
pbot, ptop = 5.9, 2.35
vmin11, vmax11 = 30.0, 95.0


def xmap(n):
    return px0 + (n - 14) / (56 - 14) * (px1 - px0)


def ymap(v):
    return pbot - (v - vmin11) / (vmax11 - vmin11) * (pbot - ptop)


add_shape(s, px0 - 0.15, pbot, px1 - px0 + 0.3, 0.014, HAIR)   # x축
# 기준선: 코사인 Hybrid 90.5%
yb = ymap(90.5)
add_shape(s, px0 - 0.15, yb, px1 - px0 + 0.3, 0.022, AMBER)
tfb = add_box(s, px0 - 0.15, yb - 0.34, px1 - px0 + 0.3, 0.3)
para(tfb, [("코사인 Hybrid 90.5% (기준선)", 12, True, AMBER)], align=PP_ALIGN.RIGHT, first=True)
# 꺾은선 + 점 + 라벨
for i in range(len(pts) - 1):
    conn(s, xmap(pts[i][0]), ymap(pts[i][1]), xmap(pts[i + 1][0]), ymap(pts[i + 1][1]),
         color=BLUE, w=2.75)
for n, v in pts:
    x, yv = xmap(n), ymap(v)
    add_shape(s, x - 0.07, yv - 0.07, 0.14, 0.14, BLUE, shape=MSO_SHAPE.OVAL)
    tfv = add_box(s, x - 0.55, yv - 0.42, 1.1, 0.3)
    para(tfv, [(f"{v}%", 13.5, True, INK)], align=PP_ALIGN.CENTER, first=True)
    tfn = add_box(s, x - 0.55, pbot + 0.08, 1.1, 0.3)
    para(tfn, [(f"n={n}", 12.5, False, GREY)], align=PP_ALIGN.CENTER, first=True)
tfc11 = add_box(s, px0 - 0.15, 6.45, px1 - px0 + 0.3, 0.3)
para(tfc11, [("Learned Head LOOCV Accuracy · 랜덤 기준 6.25%", 11, False, FAINT)],
     align=PP_ALIGN.CENTER, first=True)

# 우: 해석
rx = 7.6
rw = 12.033 + M - rx
sp, tfc = card(s, rx, 2.2, rw, 1.5, fill=ZEBRA, line=HAIR)
tfc.margin_left = Inches(0.28)
para(tfc, [("곡선이 아직 오르는 중", 17, True, BLUE)], first=True)
para(tfc, [("n이 2배 될 때마다 상승 지속 · 고원 미도달", 14, False, GREY)], before=5)
sp, tfc = card(s, rx, 3.9, rw, 1.5, fill=ZEBRA, line=HAIR)
tfc.margin_left = Inches(0.28)
para(tfc, [("병목은 데이터 양", 17, True, AMBER)], first=True)
para(tfc, [("알고리즘 한계가 아니므로, 질 좋은 데이터 확충 시 기준선(90.5%) 접근 가능",
            14, False, GREY)], before=5, line=1.12)
footer(s, 11)
notes(s, "학습 데이터를 늘릴수록 헤드 성능이 계속 오르고 아직 고원에 도달하지 않았습니다. 즉 "
          "헤드의 한계는 알고리즘이 아니라 데이터 양임을 정량적으로 보여줍니다.")

# ============================================================
# 슬라이드 12 — 라이브 데모
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "데모", "라이브 데모 — 업로드 한 번에 판정·근거·추천")

lw = 5.9
steps12 = [("1", "자소서 PDF 업로드", "도메인 판정 + 레이더 차트"),
           ("2", "Audit Panel", "판정 근거 — 키워드·가중치·유사도 공개"),
           ("3", "Career Mind-Map", "역량 중심 → 직무·연구실 연결 시각화")]
for i, (no, t, d) in enumerate(steps12):
    cy = 2.05 + i * 1.18
    sp, tfc = card(s, M, cy, lw, 1.0, fill=ZEBRA, line=HAIR)
    tfc.margin_left = Inches(0.75)
    para(tfc, [(t, 16.5, True, INK)], first=True)
    para(tfc, [(d, 13, False, GREY)], before=3)
    nsp = add_shape(s, M + 0.18, cy + 0.27, 0.46, 0.46, BLUE, shape=MSO_SHAPE.OVAL)
    ntf = nsp.text_frame; ntf.word_wrap = False
    ntf.margin_left = 0; ntf.margin_right = 0; ntf.margin_top = 0; ntf.margin_bottom = 0
    ntf.vertical_anchor = MSO_ANCHOR.MIDDLE
    para(ntf, [(no, 16, True, WHITE)], align=PP_ALIGN.CENTER, first=True)

# 우: 스크린샷 자리
rx = M + lw + 0.45
rw = 12.033 - lw - 0.45
sp, tfc = card(s, rx, 2.05, rw, 3.5, fill=ZEBRA, line=FAINT, line_w=1.0)
para(tfc, [("앱 스크린샷", 15, True, FAINT)], align=PP_ALIGN.CENTER, first=True)
para(tfc, [("(분석 결과 화면 캡처를 여기에 배치)", 12.5, False, FAINT)],
     align=PP_ALIGN.CENTER, before=4)

sp, tfc = card(s, M, 5.85, 12.033, 0.72, fill=HLROW)
para(tfc, [("SBERT 첫 로딩 수 초 소요 → 데모 영상 사전 녹화 권장", 14.5, True, AMBER)],
     align=PP_ALIGN.CENTER, first=True)
footer(s, 12)
notes(s, "실제로 자소서를 올려보겠습니다. 도메인이 분류되고, 어떤 키워드가 근거였는지, "
          "그리고 어떤 직무·연구실이 추천되는지 한눈에 보입니다.")

# ============================================================
# 슬라이드 13 — 한계 → 향후 (매핑)
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "마무리", "한계와 대응 — 하나씩 짝지어 답한다")

pairs = [
    ("다국어 범용 SBERT — 한국어 전문어 약함", "한국어 특화 임베딩(bge-m3-ko) 교체"),
    ("평가셋 84개 — 통계적 한계는 CI로 보완", "평가셋 확대 — 학습곡선이 효과를 보장"),
    ("합성 ↔ 실데이터 일반화 갭 (72.4%)", "실제 자소서 수집 + 도메인 fine-tuning"),
    ("추천 풀이 정적 데이터에 고정", "채용공고 크롤링 — 실시간 직무 매칭"),
]
lw13 = 5.55
rx13 = M + lw13 + 0.95
tf = add_box(s, M, 1.92, lw13, 0.35)
para(tf, [("한계", 15, True, GREY)], first=True)
tf = add_box(s, rx13, 1.92, lw13, 0.35)
para(tf, [("향후 방향", 15, True, BLUE)], first=True)
for i, (lim, plan) in enumerate(pairs):
    cy = 2.38 + i * 1.06
    sp, tfc = card(s, M, cy, lw13, 0.88, fill=ZEBRA, line=HAIR)
    tfc.margin_left = Inches(0.24)
    para(tfc, [(lim, 14.5, False, INK)], first=True)
    ar = add_box(s, M + lw13 + 0.1, cy, 0.75, 0.88, anchor=MSO_ANCHOR.MIDDLE)
    para(ar, [("→", 18, True, FAINT)], align=PP_ALIGN.CENTER, first=True)
    sp, tfc = card(s, rx13, cy, lw13, 0.88, fill=PALE)
    tfc.margin_left = Inches(0.24)
    para(tfc, [(plan, 14.5, True, NAVY)], first=True)
footer(s, 13)
notes(s, "한계를 향후 계획과 짝지어 정리했습니다. 임베딩 모델 교체, 평가셋 확대, 실데이터 "
          "fine-tuning, 그리고 채용공고 크롤링 매칭으로 확장 가능합니다.")

# ============================================================
# 슬라이드 14 — 팀 & 마무리
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "마무리", "팀 역할분담 & 협업")
add_table(s,
    ["팀원", "담당", "산출물"],
    [["A", "데이터 수집·라벨링", "평가셋 84개, PDF 30개, 도메인 프로파일"],
     ["B", "NLP 파이프라인", "4개 분류기, Hybrid 결합, 임베딩"],
     ["C", "평가·실험 설계", "7-way ablation, nested LOOCV, 부트스트랩 CI, 학습곡선"],
     ["D", "프론트엔드·시각화", "React 대시보드, Audit Panel, Mind-Map"]],
    M, 1.95, 12.033, 2.6, fs=15,
    col_w=[1.2, 3.4, 7.433])

sp, tfc = card(s, M, 4.95, 12.033, 1.0, fill=ZEBRA, line=HAIR)
add_shape(s, M, 5.08, 0.05, 0.74, BLUE)
tfc.margin_left = Inches(0.32)
para(tfc, [("협업 방식 — ", 15, True, NAVY),
           ("git 이력 관리 · 단일 출처 데이터 · 시드 고정 재현성 · 동료평가", 15, False, INK)],
     first=True)
para(tfc, [("※ A~D는 실제 팀원 이름으로 교체 (ROLES.md 참고)", 12, False, FAINT)], before=4)

tf = add_box(s, M, 6.25, 12.033, 0.5)
para(tf, [("감사합니다 — Q&A", 20, True, INK)], align=PP_ALIGN.CENTER, first=True)
footer(s, 14)
notes(s, "역할 분담입니다. 데이터·모델·평가·프론트엔드로 나눠 진행했고, git과 단일 출처 "
          "원칙으로 협업했습니다. 이상 발표를 마치겠습니다. 감사합니다.")

# ---- 저장 ----
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "발표_Career-Path-Navigator.pptx")
prs.save(out)
print("SAVED:", out)
print("slides:", len(prs.slides._sldIdLst))
