# 🚀 Universal Career-Path Navigator

## 📌 프로젝트 개요
사용자가 자신의 자소서나 CV(PDF)를 업로드하면, NLP 엔진이 이를 분석하여 **최적의 진로 경로(직무/대학원 랩실)**를 시각화하여 추천하는 범용 대시보드입니다.

## 🎯 핵심 가치 (General Purpose)
1. **범용성**: 특정 개인에 국한되지 않고, 입력된 텍스트의 특성을 파악하여 모든 직군에 대응.
2. **라이브 SBERT 추론**: Transformers.js로 브라우저에서 실시간 384-d 임베딩 → 도메인 코사인 유사도.
3. **통합 추천**: 유사도 분석을 통해 취업(Industry)과 진학(Lab) 경로를 동시에 제안.

## 🛠️ 주요 기능
- **Audit Panel**: 도메인 판정 근거(키워드 빈도·가중치), 역량 키워드 자동 추출.
- **Career Mind-Map**: 사용자 역량을 중심으로 직무와 랩실로 뻗어 나가는 Reactflow 시각화.
- **Classifier Test**: 7-way ablation (Keyword / BoN / SBERT / Hybrid / Threshold / Learned-Head nested-LOOCV / Head-Hybrid) + 실데이터 홀드아웃(실제 자소서 PDF) + **학습곡선(데이터 크기별 성능)**, per-class P/R/F1, confusion matrix, 95% Bootstrap CI.

## 💻 기술 스택
- **Frontend**: React (Vite), Tailwind CSS, Lucide-react
- **Visualization**: Reactflow, Recharts
- **NLP**: Keyword scoring, Bag-of-N-grams cosine, SBERT (사전계산 + Transformers.js 라이브)