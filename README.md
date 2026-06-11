# Career Navigator

자연어처리 기반 직무 분석 기말 프로젝트.  
자기소개서, CV, 포트폴리오 소개글 같은 비정형 텍스트를 입력받아 직무 적합 도메인을 추정하고, 관련 직무와 연구실을 추천하는 프런트엔드 데모입니다.

## 프로젝트 주제

- 직무 관련 비정형 텍스트 분석
- 키워드/BoN/SBERT/학습헤드 네 파이프라인 비교 Ablation
- 분류 근거 키워드와 추천 근거 설명
- 내장 라벨링 검증셋 기반 분류 성능 평가
- 두 자소서 BoN cosine 유사도 비교

## NLP 파이프라인 구조

```
PDF / TXT / MD 입력
       │
       ▼
  [텍스트 추출]
  pdfjs-dist
       │
       ├──────────────────────┬─────────────────────────┬──────────────────────┐
       ▼                      ▼                         ▼                      ▼
[키워드 분류기]        [BoN 코사인]              [SBERT 코사인]        [학습 헤드]
600+ 도메인 사전      Bag-of-N-grams            paraphrase-multilingual  frozen SBERT +
키워드 매칭 점수      가중 빈도 벡터             MiniLM-L12-v2 (384-d)  LogReg 헤드
(Baseline)           (Baseline 시맨틱 축)       사전 계산된 임베딩      (nested LOOCV 79.8%)
       │                      │                         │                      │
       └──────────────────────┴─────────────────────────┴──────────────────────┘
                              │
                    [Hybrid 점수 결합]
                    keyword 45% + semantic 55%
                              │
                    [도메인 분류 + 추천]
                    16개 도메인, JOB/LAB 추천
```

## 전처리 파이프라인

브라우저 경량성을 우선해 형태소 분석기(KoNLPy 등) 대신 **정규식 기반 경량 전처리**를 설계했다.

| 단계 | 처리 | 위치 |
|---|---|---|
| 문장 분리 | 한국어 종결어미(다/요/죠) + 구두점(.!?。) + 이중 줄바꿈 정규식, 최소 5자 필터, 원본 char offset 보존 | `sentenceSplitter.js` |
| 정규화 | 대소문자 통일(`toLowerCase`), 공백 압축 | `nlpSimulator.js` |
| 키워드 매칭 | 정규식 이스케이프 후 부분 문자열 카운트 — "구현/구현하고/구현했" 같은 활용형 일부 포착 | `nlpSimulator.js:countKeywordMatches` |
| BoN 벡터화 | 한글 자모 단위 2~3-gram 분해 + 가중(2-gram 0.25 / 3-gram 0.35) | `nlpSimulator.js` |
| 불용어 제거 | 추천 키워드 추출 시 28개 stopword 토큰 필터(연구·개발·경험 등 범용어) | `nlpSimulator.js:STOPWORD_TOKENS` |
| SBERT 입력 | 최대 1,500자 절단 (사전계산 `precompute_embeddings.py`와 라이브 `sbertLive.js` 동일 설정 → 코사인 호환) | `sbertLive.js` |

> **한계**: 형태소 분석을 쓰지 않아 어간 추출·품사 태깅이 없다. BoN의 자모 n-gram이 이를 부분적으로 보완하지만, 한국어 특화 전처리는 향후 확장 과제다.

## 사용 모델 (Model Card)

### 1. paraphrase-multilingual-MiniLM-L12-v2
| 항목 | 내용 |
|---|---|
| 출처 | sentence-transformers / HuggingFace |
| 라이선스 | Apache 2.0 |
| 차원 | 384 |
| 언어 | 50개 언어 (한국어 포함) |
| 용도 | 도메인 프로파일 + 평가셋 + PDF 임베딩 (사전 계산) / 브라우저 실시간 추론 (Transformers.js) |
| 실행 위치 | scripts/precompute_embeddings.py (로컬 1회) + 브라우저 ONNX q8 (~40MB) |
| 한계 | 한국어 특화 미세조정 없음. Korean SBERT/bge-m3-ko 대비 정밀도 낮을 수 있음 |

### 2. Learned Head (학습 분류 헤드)
| 항목 | 내용 |
|---|---|
| 구조 | Logistic Regression (W[16×384], b[16]) — linear probing |
| 학습 방식 | frozen SBERT 임베딩 위 헤드만 학습 (fine-tuning 아님) |
| 고도화 | **표준화(StandardScaler)** + **클래스 가중(balanced)** + **누수 없는 nested CV로 C 선택** (외부 LOOCV, 내부 LogisticRegressionCV) |
| 훈련 데이터 | 평가셋 84개 (eval.* 사전계산 벡터, 16개 도메인 균형 5개씩) |
| 평가 방법 | **nested LOOCV** — C를 외부 fold와 독립적으로 선택해 누수 없이 평가 |
| LOOCV Accuracy | **79.8%** (평가셋 균형화로 76.5% → +3.3%p) |
| LOOCV Macro-F1 | **0.786** |
| 알고리즘 비교 | 동일 LOOCV에서 **MLP(은닉층 128) 67.9% < LogReg 79.8%** → 소규모 데이터엔 선형 헤드가 우수함을 입증 |
| 실데이터 투입 실험 | 실제 자소서 PDF를 학습 corpus에 추가 시 평가셋 정확도 79.8%→77.4%로 하락(PDF 항목 33%). 합성↔실 분포 차이로 자동 eval-only 배포 (정직한 음성 결과) |
| 배포 형태 | public/data/classifier_head.json (mean/std + W·x+b → softmax, 브라우저에서 표준화 후 행렬곱 추론) |
| 한계 | 클래스당 5개 샘플의 데이터 희소성. 코사인 Hybrid(90.5%) 대비 낮으나, **학습곡선이 아직 상승 중(고원 미도달)** → 데이터 확대 시 추가 향상 여지를 실험으로 입증 |

## 데이터셋 카드

### 평가 데이터셋
| 항목 | 내용 |
|---|---|
| 총 크기 | 84개 (16개 직무 도메인 각 5개 + insufficient 4개로 균형) |
| source 분포 | synthetic_resume 61개, lexical_gap 11개, stress_test 8개, negative_control 4개 |
| 라벨 정책 | 16개 직무 도메인 + insufficient. 합성 자소서 템플릿 기반으로 라벨 명확화 |
| 난도 설계 | PDF 홀드아웃이 못 커버하는 6개 도메인엔 의미로만 판단하는 lexical_gap·도메인 혼재 stress_test를 우선 배치 → 평가 난도와 커버리지를 함께 높임 |
| 알려진 편향 | 합성 문장은 짧고 단순; 실제 자소서는 더 복잡하고 도메인 혼합 가능 |
| 일반화 한계 | 소규모 수업 시연용 데이터. 실제 일반화 성능을 대표하지 않음 |
| 단일 출처 | `src/lib/evaluationDataset.js`에서만 관리, `node scripts/exportEvalDataset.mjs`로 JSON 자동 생성(불일치 방지) |

### 실제 자소서 PDF
| 항목 | 내용 |
|---|---|
| 크기 | 30개 PDF |
| 구성 | 실제 자소서 PDF (기업/대학원 다수 포함) |
| 라벨 | 파일명 정규식 기반 자동 라벨링 |
| 용도 | Smoke test + PDF holdout 평가 |

### 직무/연구실 데이터
| 항목 | 내용 |
|---|---|
| 직무 항목 | 16개 도메인, 도메인당 3~5개 (총 약 60개) |
| 연구실 항목 | 16개 도메인, 도메인당 2~3개 (총 약 38개) |
| 출처 | 실제 채용 페이지·연구실 홈페이지 수동 큐레이션 |

## 현재 구현된 기능

### 1. 문서 업로드 분석
- `PDF`, `TXT`, `MD` 파일 업로드 지원
- PDF는 `pdfjs-dist`로 실제 텍스트 추출
- 분류기 토글: **코사인** (SBERT 코사인 Hybrid, 기본값) ↔ **학습헤드** (LogReg Head Hybrid)
- 분석 결과:
  - 주요 직무 도메인 분류
  - 키워드 추출 및 분류 근거
  - 레이더 차트 기반 역량 분포
  - 추천 직무 / 추천 연구실

### 2. 설명 가능한 추천
- 도메인 분류에 기여한 키워드, 출현 횟수, 가중치 표시
- 추천 직무/연구실 상세 패널에서 문서와 매칭된 용어 표시
- 근거 부족 문서는 `Insufficient evidence`로 처리 (무리한 추천 방지)

### 3. 자소서 유사도 비교 (Document Inspector 탭)
- 두 자소서 PDF/TXT/MD 업로드 후 BoN cosine 기반 유사도 비교
- 전체 문서 유사도 게이지 / 공통 n-gram 태그 클라우드 / 문장 단위 매칭 / 도메인 분포 비교

### 4. 평가 리포트 (Classifier Test 탭)
- **7-way ablation**: Keyword / BoN-Hybrid / SBERT-only / SBERT-Hybrid / SBERT-Hybrid+Threshold / **SBERT+Learned Head (LOOCV)** / **Learned Head Hybrid (참고)**
- 각 방법의 Accuracy / Macro F1 / Coverage 비교 (+ 95% Bootstrap CI 컬럼)
- **실데이터 홀드아웃 표**: 실제 자소서 PDF 29개 기준 일반화 성능 (합성↔실 비교)
- 도메인별 precision / recall / F1 (정답/전체 분수 표시)
- Confusion Matrix
- Error Analysis (오분류 케이스 + 언어학적 원인 해석)
- Architecture Diagram

## 분류 성능 요약

### 합성 평가셋 (84개) — Scoring Ablation (95% Bootstrap CI)

| 방법 | Accuracy | Acc 95% CI | Macro F1 | Coverage | 비고 |
|---|---|---|---|---|---|
| Keyword-only | 86.9% | [79.8, 94.0] | 87.4% | 89.3% | Baseline |
| BoN Hybrid | 89.3% | [82.1, 95.2] | 89.4% | 91.7% | 현행 폴백 |
| SBERT-only | 78.6% | [69.0, 86.9] | 79.5% | 89.3% | 사전계산 필요 |
| **SBERT Hybrid** | **90.5%** | **[83.3, 96.4]** | **90.7%** | **91.7%** | 코사인 기본값 |
| SBERT Hybrid + Threshold | 90.5% | [83.3, 96.4] | 90.7% | 91.7% | — |
| **SBERT + Learned Head (nested LOOCV)** | **79.8%** | [70.2, 86.9] | **0.786** | 100% | leakage 없는 정직한 수치 |
| Learned Head Hybrid (참고) | 92.9% | [86.9, 97.6] | 89.7% | 100% | full-fit 낙관적 수치 |

> **평가셋을 68개→84개로 키우며 의미로만 판단하는 lexical_gap·도메인 혼재 stress_test를 대거 추가**했다. 그 결과 SBERT Hybrid가 97.1%→90.5%로 내려갔는데, 이는 성능 하락이 아니라 **기존 97.1%가 쉬운 합성셋의 과대평가였음**을 뜻한다 — 더 어렵고 균형 잡힌 평가셋에서의 정직한 수치다. 반대로 학습 헤드는 데이터 균형화 덕에 76.5%→**79.8%**로 올랐다. 코사인 Hybrid보다는 여전히 낮지만 [학습곡선](#학습-헤드-상세)이 상승 중(고원 미도달)이며, 기본값은 항상 코사인 Hybrid이므로 서비스 성능에 영향 없음.

### 실데이터 홀드아웃 (실제 자소서 PDF 29개 / 10개 도메인)

| 방법 | Accuracy | Acc 95% CI | Macro F1 |
|---|---|---|---|
| Keyword-only | 69.0% | [51.7, 86.2] | 79.0% |
| BoN Hybrid | 72.4% | [55.2, 86.2] | 85.6% |
| **SBERT Hybrid** | **72.4%** | **[55.2, 86.2]** | **86.4%** |

> 합성셋 90.5% → 실데이터 72.4%. 실제 자소서의 도메인 혼재·표현 다양성에 따른 일반화 갭을 정직하게 공개한다. 단 실데이터에서는 Macro F1 기준 SBERT Hybrid(86.4%)가 Keyword(79.0%)를 더 뚜렷이 앞서, 의미 임베딩의 가치가 합성셋보다 분명해진다. (수치 재현: `node scripts/runFullEvaluation.mjs`)

## 평가 기준 대응

| 평가 기준 | 프로젝트 대응 |
|---|---|
| 문제 정의 및 주제 적합성 | 비정형 진로 텍스트에서 직무 도메인과 추천 경로를 찾는 문제로 정의 |
| 산업/사회적 맥락 | 취업 준비, 자기소개서 점검, 연구실 탐색, 직무 전환 의사결정 |
| 도전성 | 키워드 Baseline → BoN Cosine → SBERT → **학습 헤드(표준화·클래스가중·nested CV)** + **LogReg vs MLP 알고리즘 비교** + **실데이터 투입 실험** + **학습곡선**으로 단계적 고도화. 7-way ablation + 실데이터 홀드아웃. 누수 없는 평가로 정직성 확보 |
| 데이터 선정 및 처리 | 84개 라벨링 합성 평가셋(16도메인 균형) + **실제 자소서 PDF 29개 정량 홀드아웃**(합성↔실데이터 일반화 갭 측정) + 도메인 프로파일 사전계산. 단일 출처 동기화. 전처리: 문장 분리/정규화/불용어/키워드 가중치 |
| 구현 및 기술적 완성도 | 4개 NLP 파이프라인, 7-way ablation + 실데이터 홀드아웃, LOOCV 학습 헤드, F1/Accuracy/Coverage + 부트스트랩 95% CI, BoN cosine 문서 유사도 비교, 브라우저 실시간 SBERT 추론 |
| 팀 운영 및 협업 | 역할 분담표와 동료 평가 결과를 발표 자료에 포함 필요 |

## 프로젝트 구조

```text
scripts/
  requirements.txt               ← Python 의존성
  precompute_embeddings.py       ← SBERT 임베딩 사전 계산
  train_classifier_head.py       ← 학습 헤드 훈련 (LogReg/MLP 비교 + 실데이터 투입 + LOOCV + 전체 fit)
  extractPdfTexts.mjs            ← PDF → public/data/pdf_corpus.json
  runFullEvaluation.mjs          ← 전체 평가 Markdown 리포트 (ablation + CI + weight sweep)
  inspectResumePdfs.mjs          ← 자소서 smoke test
src/
  App.jsx                        ← 분류기 토글(코사인↔헤드), race condition 방지
  components/
    AuditPanel.jsx               ← 분류 근거 + 키워드 패널
    CareerMindMap.jsx
    DetailPanel.jsx
    DocumentInspector.jsx        ← 두 자소서 유사도 비교 (듀얼 업로드)
    EvaluationPanel.jsx          ← 7-way ablation + Architecture Diagram
    SimilarityPanel.jsx          ← 유사도 결과 표시 (게이지/키워드/문장/도메인)
    SkillRadar.jsx
    UploadZone.jsx
  lib/
    classifierHead.js            ← LogReg 헤드 lazy-fetch + W·x+b → softmax 추론
    documentComparison.js        ← BoN cosine 기반 두 문서 비교 엔진
    embeddingStore.js            ← embeddings.json lazy-fetch 캐시
    evaluateClassifier.js        ← 7-way ablation + 가중치 민감도 + 부트스트랩 CI
    evaluationDataset.js         ← 84개 라벨링 평가셋 (단일 출처)
    nlpSimulator.js              ← 분류/추천 파이프라인 (head-only / head-hybrid 포함)
    pdfExtract.js                ← pdfjs-dist PDF 텍스트 추출
    sbertLive.js                 ← Transformers.js 브라우저 사이드 실시간 SBERT 추론 + 학습헤드
    sbertScorer.js               ← 사전계산 SBERT 코사인 + 학습헤드 (평가셋/PDF)
    sentenceSplitter.js          ← 한국어 문장 분리 정규식
  data/
    domain_profiles.json         ← 16개 도메인 프로파일 텍스트 (Python 입력)
    evaluation_dataset.json      ← 평가셋 JSON (Python 입력)
public/
  data/
    embeddings.json              ← SBERT 사전계산 결과 (스크립트 출력)
    classifier_head.json         ← 학습 헤드 가중치 W[16×384], b[16] (스크립트 출력)
    head_oof_predictions.json    ← LOOCV out-of-fold 예측 (ablation 정직한 수치용)
    pdf_corpus.json              ← PDF 텍스트 추출 결과 (스크립트 출력)
자소서/
  *.pdf                          ← 실제 자소서 PDF 30개
```

## 실행 방법

```bash
# 1. 의존성 설치
npm install
pip install -r scripts/requirements.txt

# 2. 데이터 사전 계산 (최초 1회)
node scripts/extractPdfTexts.mjs
python scripts/precompute_embeddings.py

# 3. 학습 헤드 훈련 (선택 — classifier_head.json 재생성)
python scripts/train_classifier_head.py
# → LOOCV Accuracy/Macro-F1 콘솔 출력
# → public/data/classifier_head.json + head_oof_predictions.json 생성

# 4. 앱 실행
npm run dev

# 5. 전체 평가 실행 (선택)
node scripts/runFullEvaluation.mjs
```

## 학습 헤드 상세

### 학습 방식 (고도화된 linear probing)
frozen SBERT(MiniLM-L12, 384-d) 임베딩 위에 Logistic Regression 헤드를 학습합니다. 소규모·불균형 데이터에 맞춰 세 가지 ML 기법을 적용했습니다.

```
텍스트 → SBERT (frozen) → 384-d → [표준화 (x-mean)/std] → W[16×384]·x + b[16] → softmax → 도메인 확률
```

1. **표준화(StandardScaler)**: 차원별 평균/표준편차로 정규화 → `classifier_head.json`의 `mean`/`std`에 저장, 브라우저 추론에서 동일 적용.
2. **클래스 가중(class_weight='balanced')**: 17클래스(16도메인 + insufficient) 불균형 보정.
3. **누수 없는 C 선택**: 정규화 강도 C를 외부 fold와 독립적으로 고르기 위해 **nested CV** 사용(외부 LOOCV, 내부 `LogisticRegressionCV`).

→ 이 고도화로 nested LOOCV가 **42.6% → 76.5%**(Macro-F1 0.349 → 0.745)로 향상했고, 이어 **평가셋 균형화(68→84개)로 79.8%**(Macro-F1 0.786)까지 올랐습니다.

### 알고리즘 비교 (LogReg vs MLP)
같은 nested LOOCV 프로토콜로 비선형 헤드도 실험했습니다.

- **MLP(은닉층 128, L2 강정규화) 67.9%** vs **LogReg 79.8%** → 클래스당 5개의 소규모 데이터에서는 **선형 헤드가 비선형보다 우수**합니다(MLP 과적합 + class_weight 미지원).
- 결론: 배포 헤드는 LogReg 유지. 이는 브라우저 선형 추론(W·x+b)과의 호환이기도 합니다. (`public/data/head_comparison.json`)

### 실데이터 투입 실험 (정직한 음성 결과)
실제 자소서 PDF 임베딩을 학습 corpus에 추가하면 성능이 오를지 측정했습니다.

- 결과: 평가셋 정확도 79.8% → **77.4%로 하락**(추가된 PDF 항목 자체 정확도 33%). 합성↔실 자소서의 분포·길이 차이 때문입니다.
- 스크립트가 이를 감지해 **자동으로 eval-only 배포를 선택**합니다(평가셋 정확도가 오를 때만 PDF 포함). 데이터를 무작정 늘리는 것이 답이 아님을 실험으로 보여주는 사례입니다.

### 학습곡선 (Learning Curve) 실험
"왜 헤드가 코사인보다 낮은가?"를 데이터 크기 실험으로 정량 입증합니다.

- 학습 데이터를 n=14 → 56으로 늘리며 cv=3 성능 측정 → `public/data/learning_curve.json`.
- 결과: Accuracy 41.7% → 76.2%로 **상승하며 고원에 도달하지 않음**. 즉 헤드의 낮은 성능은 알고리즘 한계가 아니라 **데이터 희소성** 때문이며, 데이터 확대 시 추가 향상 여지가 있음을 시사합니다(단, 위 실데이터 실험처럼 *질 낮은* 데이터 확대는 역효과).
- Classifier Test 탭에 코사인(90.5%)·랜덤(6.25%) 기준선과 함께 차트로 렌더.

### 브라우저 추론
```
fetch('/data/classifier_head.json')   // mean/std/W/b 로드 (최초 1회)
→ (vec384 - mean) / std               // 표준화 (학습과 동일)
→ W · x + b                           // 행렬곱 (JS Float32Array)
→ softmax                             // 도메인 확률 맵
→ analyzeDocument({ sbertScores: headProbs, scoringMode: 'head-hybrid' })
```

### 토글 동작
- 기본값: **코사인** (SBERT cosine Hybrid) — 합성셋 90.5% 성능
- 토글 시: **학습헤드** (LogReg Head Hybrid) — footer에 보라색 "Learned Head" 배지 표시
- 헤드 로드 실패 시 자동으로 코사인 폴백
- 재분석 중 이전 분석이 완료되어 결과를 덮어쓰는 race condition 방지 (generation counter)

## 한계

- **SBERT 모델 크기**: 브라우저 첫 실행 시 모델 가중치 (~40MB 양자화) 다운로드 필요. 이후 캐시.
- **평가셋 규모**: 84개는 수업 시연용. 실제 일반화 성능은 별도 검증 필요 (부트스트랩 95% CI 첨부).
- **학습 헤드 성능**: 클래스당 5개 샘플의 데이터 희소성 제약. 균형화 후 nested LOOCV 79.8%로 코사인 Hybrid(90.5%)에 근접했으나 아직 미달 — 학습곡선이 상승 중임을 근거로 (질 좋은) 데이터 확대가 정공법임을 제시.

## 다음 확장 방향

- 한국어 튜닝 SBERT (Korean SBERT, bge-m3-ko) 교체
- 실제 채용공고 크롤링 및 벡터 검색
- 자소서-채용공고 정량 매칭 점수 고도화
- 평가셋 규모 확대 + Cross-validation
- 학습 헤드를 fine-tuned SBERT로 교체 (MLP는 이미 비교했으나 소규모 데이터에서 LogReg 우위 확인)
