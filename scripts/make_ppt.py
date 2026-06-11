# -*- coding: utf-8 -*-
"""
Career-Path Navigator 기말 발표 덱 생성기 — 미니멀 모던 테마.
PPT_OUTLINE.md (14장) 기반. 흰 배경 + 가는 남색 액센트 + 넓은 여백.
발표 스크립트는 각 슬라이드의 '발표자 노트'에 삽입.
실행: conda run -n Language python scripts/make_ppt.py
출력: 발표_Career-Path-Navigator.pptx (프로젝트 루트)
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# ---- 색상 (화이트 배경 전제) ----
INK    = RGBColor(0x0F, 0x17, 0x2A)   # 제목/본문 (짙은 남색)
NAVY   = RGBColor(0x1E, 0x3A, 0x8A)
BLUE   = RGBColor(0x25, 0x63, 0xEB)   # 액센트
AMBER  = RGBColor(0xB4, 0x53, 0x09)   # 강조 (정직성·★)
GREY   = RGBColor(0x57, 0x63, 0x74)   # 보조 본문
FAINT  = RGBColor(0x94, 0xA3, 0xB8)   # 푸터/마커
HAIR   = RGBColor(0xE2, 0xE8, 0xF0)   # 가는 선
ZEBRA  = RGBColor(0xF8, 0xFA, 0xFC)   # 옅은 줄무늬
CARD   = RGBColor(0xF1, 0xF5, 0xF9)   # 카드 배경
HLROW  = RGBColor(0xFE, 0xF3, 0xC7)   # 표 강조행
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "맑은 고딕"
TOTAL = 14

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
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    return tf


def add_shape(slide, x, y, w, h, fill, shape=MSO_SHAPE.RECTANGLE,
              line_color=None, line_w=0.75):
    sp = slide.shapes.add_shape(shape, x, y, w, h)
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


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def header(slide, kicker, title, star=False):
    tf = add_box(slide, Inches(0.7), Inches(0.42), Inches(11.5), Inches(0.4))
    r = tf.paragraphs[0].add_run(); style_run(r, 14, True, BLUE); r.text = kicker
    tf2 = add_box(slide, Inches(0.7), Inches(0.78), Inches(12.0), Inches(0.85))
    p = tf2.paragraphs[0]
    r = p.add_run(); style_run(r, 32, False, INK); r.text = title
    if star:
        rs = p.add_run(); style_run(rs, 22, True, AMBER); rs.text = "   ★"
    add_shape(slide, Inches(0.72), Inches(1.62), Inches(1.05), Pt(3.5), BLUE)


def footer(slide, page):
    tfL = add_box(slide, Inches(0.7), Inches(7.04), Inches(7), Inches(0.34))
    r = tfL.paragraphs[0].add_run()
    style_run(r, 9, False, FAINT); r.text = "Career-Path Navigator"
    tfR = add_box(slide, Inches(10.8), Inches(7.0), Inches(1.9), Inches(0.36))
    p = tfR.paragraphs[0]; p.alignment = PP_ALIGN.RIGHT
    r = p.add_run(); style_run(r, 12, True, GREY); r.text = f"{page:02d}"
    r2 = p.add_run(); style_run(r2, 12, False, FAINT); r2.text = f" / {TOTAL:02d}"


def bullets(slide, items, x=Inches(0.75), y=Inches(1.95),
            w=Inches(11.9), h=Inches(4.7), base=18, gap=11):
    """items: (level, text[, bold[, color]])"""
    tf = add_box(slide, x, y, w, h)
    first = True
    for it in items:
        lvl, txt = it[0], it[1]
        bold = it[2] if len(it) > 2 else False
        col = it[3] if len(it) > 3 else (INK if lvl == 0 else GREY)
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.space_after = Pt(gap if lvl == 0 else gap - 4)
        p.line_spacing = 1.06
        m = p.add_run()
        if lvl == 0:
            style_run(m, base, True, BLUE); m.text = "—  "
        else:
            style_run(m, base - 2, False, FAINT); m.text = "       ·  "
        r = p.add_run()
        style_run(r, base - (2 if lvl else 0), bold, col); r.text = txt
    return tf


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


def add_table(slide, headers, rows, x, y, w, h, hl_row=None, fs=13,
              col_w=None):
    nrows, ncols = len(rows) + 1, len(headers)
    tbl = slide.shapes.add_table(nrows, ncols, x, y, w, h).table
    clear_table_style(tbl)
    if col_w:
        for i, cw in enumerate(col_w):
            tbl.columns[i].width = cw
    # 헤더
    for c, htext in enumerate(headers):
        cell = tbl.cell(0, c)
        cell.fill.solid(); cell.fill.fore_color.rgb = WHITE
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_top = Pt(4); cell.margin_bottom = Pt(4)
        para = cell.text_frame.paragraphs[0]
        para.alignment = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER
        rn = para.add_run(); style_run(rn, fs, True, NAVY); rn.text = htext
        cell_bottom(cell, "1E3A8A", 2.0)
    # 본문
    for ri, row in enumerate(rows, start=1):
        is_hl = (hl_row is not None and ri == hl_row)
        for c, val in enumerate(row):
            cell = tbl.cell(ri, c)
            cell.fill.solid()
            cell.fill.fore_color.rgb = HLROW if is_hl else (WHITE if ri % 2 else ZEBRA)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_top = Pt(3); cell.margin_bottom = Pt(3)
            para = cell.text_frame.paragraphs[0]
            para.alignment = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER
            rn = para.add_run()
            style_run(rn, fs, is_hl, AMBER if is_hl else INK); rn.text = str(val)
            cell_bottom(cell, "E2E8F0", 0.75)
    return tbl


# ============================================================
# 슬라이드 1 — 표지
# ============================================================
s = prs.slides.add_slide(BLANK)
add_shape(s, 0, 0, Inches(0.22), SH, BLUE)
tf = add_box(s, Inches(1.0), Inches(2.0), Inches(11), Inches(0.4))
r = tf.paragraphs[0].add_run(); style_run(r, 16, True, BLUE)
r.text = "자연어처리 기말 프로젝트"
tf = add_box(s, Inches(0.95), Inches(2.45), Inches(11.6), Inches(1.5))
p = tf.paragraphs[0]
r = p.add_run(); style_run(r, 46, True, INK)
r.text = "Universal Career-Path Navigator"
add_shape(s, Inches(1.0), Inches(3.95), Inches(1.4), Pt(4), BLUE)
tf = add_box(s, Inches(1.0), Inches(4.2), Inches(11.4), Inches(1.0))
r = tf.paragraphs[0].add_run(); style_run(r, 19, False, GREY)
r.text = "자소서·CV 텍스트 기반 직무 도메인 추정 & 직무·연구실 추천 NLP 시스템"
tf = add_box(s, Inches(1.0), Inches(6.0), Inches(11.4), Inches(1.1))
for line in ["팀명 [팀명 입력]   ·   팀원 [4명 이름]",
             "과목 자연어처리   ·   발표일 2026-06-__"]:
    pp = tf.add_paragraph(); pp.space_after = Pt(4)
    rr = pp.add_run(); style_run(rr, 15, False, FAINT); rr.text = line
notes(s, "자소서를 올리면 어떤 직무에 맞는지 분석하고 직무와 연구실을 추천해 주는 "
          "NLP 시스템, Career-Path Navigator를 발표하겠습니다.")

# ============================================================
# 슬라이드 2 — 문제 정의
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "도입", "문제 정의")
bullets(s, [
    (0, "취업·진학생의 두 가지 고민", True),
    (1, "\"내가 어떤 직무·분야에 맞는 사람일까?\"  — 본인도 모름"),
    (1, "\"내 경험에 맞는 직무·연구실은 어디일까?\"  — 탐색 비용 큼"),
    (0, "해결 정의", True),
    (1, "자소서 텍스트를 NLP로 분석 → 적합 도메인 추정 + 근거 기반 추천"),
    (1, "막연한 질문을 '입력 텍스트 특성으로 정량 답하는 문제'로 재정의"),
], base=20)
footer(s, 2)
notes(s, "자소서를 쓸 때 가장 큰 고민은 '내가 어떤 직무에 맞는가'입니다. 이 막연한 질문을, "
          "입력된 텍스트의 특성을 분석해 정량적으로 답하는 문제로 정의했습니다.")

# ============================================================
# 슬라이드 3 — 16개 도메인
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "도입", "범용(General Purpose) 시스템")
tf = add_box(s, Inches(0.75), Inches(1.85), Inches(12), Inches(0.5))
r = tf.paragraphs[0].add_run(); style_run(r, 16, False, GREY)
r.text = "활용: 취업 준비 / 자소서 점검 / 연구실 탐색 / 직무 전환 의사결정"
domains = ["공학", "데이터", "기획", "연구", "관리", "행정", "경제·금융", "경영",
           "간호·보건", "자연과학", "인문사회", "예술·디자인",
           "제조·생산", "에너지·발전", "항공·우주", "미디어·콘텐츠"]
gx, gy = Inches(0.75), Inches(2.55)
cw, ch = Inches(2.92), Inches(0.82)
gapx, gapy = Inches(0.13), Inches(0.18)
for i, d in enumerate(domains):
    rr, cc = divmod(i, 4)
    x = gx + cc * (cw + gapx)
    y = gy + rr * (ch + gapy)
    box = add_shape(s, x, y, cw, ch, CARD, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
                    line_color=HAIR, line_w=0.75)
    tfc = box.text_frame; tfc.word_wrap = True
    tfc.vertical_anchor = MSO_ANCHOR.MIDDLE
    pc = tfc.paragraphs[0]; pc.alignment = PP_ALIGN.CENTER
    rc = pc.add_run(); style_run(rc, 16, True, INK); rc.text = d
tf = add_box(s, Inches(0.75), Inches(6.62), Inches(12), Inches(0.4))
rr = tf.paragraphs[0].add_run(); style_run(rr, 15, True, AMBER)
rr.text = "16개 직무 도메인 — 특정 개인이 아닌 입력 텍스트 특성으로 판단"
footer(s, 3)
notes(s, "취업·진학 준비생을 대상으로 16개 직무 도메인을 다룹니다. 특정 직군에 국한되지 않고 "
          "입력 텍스트 특성으로 판단하는 범용 시스템입니다.")

# ============================================================
# 슬라이드 4 — 파이프라인
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "도입", "시스템 전체 파이프라인")
steps = [("PDF / TXT / MD 업로드", 0), ("텍스트 추출 (pdf.js)", 0),
         ("한국어 문장분리 + 정규화 + 불용어", 0),
         ("4개 분류기  ▸ 키워드 / BoN / SBERT / 학습헤드", 2),
         ("Hybrid 결합  (키워드 45% + 의미 55%)", 1),
         ("도메인 분류 + 직무·연구실 추천", 0)]
y = Inches(1.95)
bw, bh = Inches(8.8), Inches(0.66)
cx = Inches(2.25)
for i, (st, kind) in enumerate(steps):
    if kind == 2:      # 분류기 (강조: 파랑)
        fill, lc, tc = BLUE, None, WHITE
    elif kind == 1:    # 하이브리드 (옅은 파랑)
        fill, lc, tc = RGBColor(0xDB, 0xEA, 0xFE), None, NAVY
    else:
        fill, lc, tc = WHITE, HAIR, INK
    box = add_shape(s, cx, y, bw, bh, fill, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
                    line_color=lc, line_w=1.0)
    tfc = box.text_frame; tfc.vertical_anchor = MSO_ANCHOR.MIDDLE
    pc = tfc.paragraphs[0]; pc.alignment = PP_ALIGN.CENTER
    rc = pc.add_run(); style_run(rc, 16, kind != 0, tc); rc.text = st
    y = y + bh + Inches(0.14)
    if i < len(steps) - 1:
        ar = add_box(s, cx, y - Inches(0.15), bw, Inches(0.16),
                     anchor=MSO_ANCHOR.MIDDLE)
        pa = ar.paragraphs[0]; pa.alignment = PP_ALIGN.CENTER
        ra = pa.add_run(); style_run(ra, 11, True, FAINT); ra.text = "▼"
footer(s, 4)
notes(s, "전체 흐름입니다. 문서를 올리면 텍스트를 추출·전처리하고, 네 가지 분류기를 거쳐 "
          "하이브리드로 결합한 뒤 도메인을 판정하고 추천합니다. 이제 분류기를 하나씩 보겠습니다.")

# ============================================================
# 슬라이드 5 — 분류 방법 ①②③ ★
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "방법론", "분류 방법 ①②③ — 점진 고도화", star=True)
add_table(s,
    ["방법", "원리", "합성 정확도", "한계"],
    [["① 키워드 (Baseline)", "600+ 도메인 사전 매칭", "86.9%", "단어 의미·맥락 모름"],
     ["② BoN 코사인", "자모 2~3-gram 빈도 벡터", "Hybrid 89.3%", "어휘 겹침만 봄"],
     ["③ SBERT 코사인", "MiniLM-L12 384-d 의미 임베딩", "78.6% (단독)", "한국어 특화 X"]],
    Inches(0.75), Inches(1.95), Inches(11.85), Inches(2.4), fs=14,
    col_w=[Inches(3.05), Inches(4.6), Inches(2.2), Inches(2.0)])
tf = add_box(s, Inches(0.75), Inches(4.85), Inches(12), Inches(1.6))
r = tf.paragraphs[0].add_run(); style_run(r, 21, True, AMBER)
r.text = "핵심 관찰: SBERT 단독(78.6%)이 키워드(86.9%)보다 낮다"
p2 = tf.add_paragraph(); p2.space_before = Pt(8)
r = p2.add_run(); style_run(r, 17, False, GREY)
r.text = "→ 키워드는 전문 용어를 정확히, SBERT는 맥락을 — 그래서 둘을 합친다 (다음 장)"
footer(s, 5)
notes(s, "키워드는 'Docker' 같은 전문 용어를 정확히 잡지만 맥락을 모릅니다. SBERT는 의미를 "
          "잡지만 다국어 범용 모델이라 한국어 전문 용어엔 약합니다. 흥미롭게도 SBERT 단독은 "
          "키워드보다 낮습니다. 그래서 둘을 합칩니다.")

# ============================================================
# 슬라이드 6 — Hybrid 결합 ★
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "방법론", "Hybrid 결합 + 가중치 근거", star=True)
box = add_shape(s, Inches(0.75), Inches(1.95), Inches(11.85), Inches(1.0),
                CARD, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
tfc = box.text_frame; tfc.vertical_anchor = MSO_ANCHOR.MIDDLE
pc = tfc.paragraphs[0]; pc.alignment = PP_ALIGN.CENTER
rc = pc.add_run(); style_run(rc, 21, True, NAVY)
rc.text = "최종 점수 = 키워드(정규화) × 0.45  +  SBERT(정규화) × 0.55"
bullets(s, [
    (0, "결과: SBERT Hybrid 90.5% — 각 단독(86.9% · 78.6%)보다 높음", True),
    (1, "두 방법이 서로의 약점을 보완 → 상호 보완 입증"),
    (0, "가중치 민감도: 0.3~0.9 구간에서 정확도 고원(plateau)", True),
    (1, "0.45는 임의값이 아니라 sweep 실험으로 검증된 안정 구간 내 값"),
], y=Inches(3.25), base=19)
footer(s, 6)
notes(s, "키워드 45%, 의미 55%로 합치면 90.5%로, 각 단독보다 높습니다. 서로의 약점을 보완하기 "
          "때문입니다. 가중치도 0.3~0.9 구간이 모두 비슷한 고원이라, 0.45가 안정적인 선택임을 "
          "민감도 분석으로 확인했습니다.")

# ============================================================
# 슬라이드 7 — 학습 헤드 + 알고리즘 비교 ★
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "방법론", "학습 헤드 + 알고리즘 비교", star=True)
bullets(s, [
    (0, "frozen SBERT 임베딩 위에 학습하는 분류 헤드 (지도학습 요소)", True),
    (0, "고도화 3종: 표준화 + 클래스가중(balanced) + 누수 없는 nested CV(C 선택)", True),
    (1, "nested LOOCV  42.6% → 76.5% → (평가셋 균형화) 79.8%"),
    (0, "알고리즘 비교 (동일 LOOCV): LogReg 79.8%  vs  MLP 67.9%", True, AMBER),
    (1, "클래스당 5개 소규모 → 선형이 비선형보다 우수 (MLP 과적합)"),
    (1, "배포는 LogReg 유지 (브라우저 선형 추론 W·x+b 와 호환)"),
], base=18)
footer(s, 7)
notes(s, "단순 코사인을 넘어, SBERT 위에 로지스틱 회귀 헤드를 학습시켰습니다. 표준화·클래스가중·"
          "누수 없는 교차검증으로 LOOCV를 79.8%까지 올렸습니다. 비선형 MLP도 같은 조건에서 "
          "실험했는데 67.9%로 오히려 낮았습니다. 데이터가 적을 때는 선형이 낫다는 걸 실험으로 "
          "확인했고, 배포는 LogReg로 갑니다.")

# ============================================================
# 슬라이드 8 — 데이터셋 카드
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "방법론", "데이터셋 카드")
bullets(s, [
    (0, "평가셋 84개 — 16개 도메인 각 5개 균형 + insufficient 4", True),
    (1, "synthetic 61 / lexical_gap 11(의미만 판단) / stress_test 8(도메인 혼재) / negative 4"),
    (0, "실제 자소서 PDF 30개 (평균 ~2,400자) — 홀드아웃용", True),
    (0, "단일 출처화: evaluationDataset.js → exportEvalDataset.mjs로 JSON 자동 생성", True),
    (1, "앱·Python 학습 간 불일치 방지"),
    (0, "전처리: 문장분리 / 정규화 / 불용어 28개 / 키워드 가중치"),
], base=18)
footer(s, 8)
notes(s, "평가셋은 16개 도메인을 각 5개씩 균형 있게 84개로 구성했습니다. 특히 키워드 없이 "
          "의미로만 판단해야 하는 문장과 도메인이 섞인 문장을 일부러 넣었습니다. 또 실제 자소서 "
          "PDF 30개를 별도 확보했습니다.")

# ============================================================
# 슬라이드 9 — 7-way Ablation ★
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "평가", "7-way Ablation (95% 부트스트랩 CI)", star=True)
add_table(s,
    ["방법", "Accuracy", "95% CI", "Macro F1", "Cov"],
    [["Keyword-only", "86.9%", "[79.8, 94.0]", "87.4%", "89.3%"],
     ["BoN Hybrid", "89.3%", "[82.1, 95.2]", "89.4%", "91.7%"],
     ["SBERT-only", "78.6%", "[69.0, 86.9]", "79.5%", "89.3%"],
     ["SBERT Hybrid  ★", "90.5%", "[83.3, 96.4]", "90.7%", "91.7%"],
     ["SBERT Hybrid + Threshold", "90.5%", "[83.3, 96.4]", "90.7%", "91.7%"],
     ["Learned Head (LOOCV)", "79.8%", "[70.2, 86.9]", "78.6%", "100%"],
     ["Learned Head Hybrid (참고)", "92.9%", "[86.9, 97.6]", "89.7%", "100%"]],
    Inches(0.75), Inches(1.9), Inches(11.85), Inches(4.2), hl_row=4, fs=13.5,
    col_w=[Inches(4.45), Inches(1.8), Inches(2.4), Inches(1.7), Inches(1.5)])
tf = add_box(s, Inches(0.75), Inches(6.35), Inches(12), Inches(0.5))
rr = tf.paragraphs[0].add_run(); style_run(rr, 14, True, GREY)
rr.text = "동일 조건 비교 · 부트스트랩 2,000회 · 서비스 기본값 = SBERT Hybrid (90.5%)"
footer(s, 9)
notes(s, "7가지 방법을 동일 조건에서 비교했습니다. 기본값인 SBERT Hybrid가 90.5%로 가장 "
          "안정적이고, 부트스트랩 2,000회로 95% 신뢰구간까지 함께 보고합니다.")

# ============================================================
# 슬라이드 10 — 정직성 ★★
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "평가 · 핵심 차별점", "정직성: 일반화 갭 & 음성 결과", star=True)
bullets(s, [
    (0, "합성 90.5% → 실데이터 홀드아웃 72.4% (실제 자소서 29개)", True, AMBER),
    (1, "실데이터에선 Macro F1 기준 SBERT Hybrid(86.4%)가 Keyword(79.0%)를 더 뚜렷이 앞섬"),
    (0, "\"97.1% → 90.5%는 성능 저하가 아니다\"", True),
    (1, "평가셋을 키우고 어렵게 만들어 과대평가를 바로잡은 정직한 수치"),
    (0, "실데이터 투입 실험 (음성 결과)", True),
    (1, "PDF를 학습에 추가하니 79.8% → 77.4% 하락 → \"데이터 무작정 확대는 답이 아니다\""),
], y=Inches(2.0), base=18)
footer(s, 10)
notes(s, "가장 강조하고 싶은 부분입니다. 합성 90.5%가 실제 자소서에선 72.4%로 떨어집니다. "
          "이 일반화 갭을 숨기지 않고 공개합니다. 또 실데이터를 학습에 더 넣어봤더니 오히려 성능이 "
          "떨어졌습니다. 데이터는 양이 아니라 질이라는 걸 실험으로 보여줍니다.")

# ============================================================
# 슬라이드 11 — 학습곡선
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "평가", "학습곡선 — 한계는 알고리즘이 아니라 데이터 양")
add_table(s,
    ["학습 샘플 수", "Accuracy", "Macro F1"],
    [["14", "41.7%", "0.322"], ["28", "66.7%", "0.622"],
     ["42", "71.4%", "0.660"], ["56", "76.2%", "0.732"]],
    Inches(0.75), Inches(2.05), Inches(5.9), Inches(2.5), fs=15,
    col_w=[Inches(2.2), Inches(1.9), Inches(1.8)])
bullets(s, [
    (0, "곡선이 상승 중 · 고원 미도달", True),
    (1, "헤드의 한계 = 알고리즘이 아니라 데이터 양"),
    (1, "질 좋은 데이터를 더 모으면 코사인(90.5%)에 근접 가능"),
    (1, "기준선: 코사인 90.5% · 랜덤 6.25%"),
], x=Inches(7.1), y=Inches(2.1), w=Inches(5.7), base=18)
footer(s, 11)
notes(s, "학습 데이터를 늘릴수록 헤드 성능이 계속 오르고 아직 고원에 도달하지 않았습니다. 즉 "
          "헤드의 한계는 알고리즘이 아니라 데이터 양임을 정량적으로 보여줍니다.")

# ============================================================
# 슬라이드 12 — 라이브 데모
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "마무리", "라이브 데모")
bullets(s, [
    (0, "자소서 PDF 업로드 → 도메인 분류 결과 + 레이더 차트", True),
    (0, "Audit Panel: 분류 근거 키워드·가중치", True),
    (0, "Mind-Map: 역량 → 직무·연구실 연결", True),
    (0, "(옵션) Document Inspector: 두 자소서 유사도 비교", False, GREY),
], y=Inches(2.0), base=20)
box = add_shape(s, Inches(0.75), Inches(5.4), Inches(11.85), Inches(1.05),
                HLROW, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
tfc = box.text_frame; tfc.vertical_anchor = MSO_ANCHOR.MIDDLE
pc = tfc.paragraphs[0]; pc.alignment = PP_ALIGN.CENTER
rc = pc.add_run(); style_run(rc, 16, True, AMBER)
rc.text = "💡 SBERT 첫 로딩 수 초 → 데모 영상 사전 녹화 권장"
footer(s, 12)
notes(s, "실제로 자소서를 올려보겠습니다. 도메인이 분류되고, 어떤 키워드가 근거였는지, "
          "그리고 어떤 직무·연구실이 추천되는지 한눈에 보입니다.")

# ============================================================
# 슬라이드 13 — 한계 & 향후
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "마무리", "한계 & 향후 방향")


def col_head(x, label, color):
    add_shape(s, x, Inches(2.0), Inches(0.5), Pt(4), color)
    tf = add_box(s, x, Inches(2.12), Inches(5.6), Inches(0.5))
    r = tf.paragraphs[0].add_run(); style_run(r, 19, True, INK); r.text = label


col_head(Inches(0.75), "한계", GREY)
bullets(s, [
    (0, "SBERT 모델 ~40MB 첫 로딩"),
    (0, "평가셋 규모 (84개)"),
    (0, "어휘 중의성 (논문·브랜드 등)"),
    (0, "합성 ↔ 실데이터 갭"),
], x=Inches(0.75), y=Inches(2.75), w=Inches(5.6), base=18)
col_head(Inches(6.95), "향후 방향", BLUE)
bullets(s, [
    (0, "한국어 특화 SBERT (bge-m3-ko)"),
    (0, "채용공고 크롤링·매칭"),
    (0, "평가셋 확대"),
    (0, "fine-tuned SBERT"),
], x=Inches(6.95), y=Inches(2.75), w=Inches(5.6), base=18)
footer(s, 13)
notes(s, "한계로는 모델 크기와 평가셋 규모가 있고, 향후 한국어 특화 모델 교체와 실제 채용공고 "
          "매칭으로 확장할 수 있습니다.")

# ============================================================
# 슬라이드 14 — 팀 역할분담
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "마무리", "팀 역할분담 & 협업")
add_table(s,
    ["팀원", "담당", "산출물"],
    [["A", "데이터 수집·라벨링", "평가셋 84개, PDF 30개, 도메인 프로파일"],
     ["B", "NLP 파이프라인", "4개 분류기, Hybrid, 임베딩"],
     ["C", "평가·실험", "ablation, LOOCV, CI, 학습곡선"],
     ["D", "프론트엔드·시각화", "React 대시보드, 차트, Mind-Map"]],
    Inches(0.75), Inches(2.0), Inches(11.85), Inches(2.7), fs=15,
    col_w=[Inches(1.2), Inches(3.65), Inches(7.0)])
tf = add_box(s, Inches(0.75), Inches(5.0), Inches(12), Inches(1.2))
r = tf.paragraphs[0].add_run(); style_run(r, 17, True, BLUE)
r.text = "협업: git 이력 · 단일 출처·재현 가능 워크플로우 · 동료평가"
p2 = tf.add_paragraph(); p2.space_before = Pt(6)
r = p2.add_run(); style_run(r, 15, False, FAINT)
r.text = "※ A~D를 실제 팀원 이름으로 교체하세요 (ROLES.md 참고)"
footer(s, 14)
notes(s, "역할 분담입니다. 데이터·모델·평가·프론트엔드로 나눠 진행했고, git과 단일 출처 "
          "원칙으로 협업했습니다. 이상 발표를 마치겠습니다. 감사합니다.")

# ---- 저장 ----
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "발표_Career-Path-Navigator.pptx")
prs.save(out)
print("SAVED:", out)
print("slides:", len(prs.slides._sldIdLst))
