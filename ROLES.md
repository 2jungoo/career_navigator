# 팀 운영 및 협업

> 평가기준 "팀 운영 및 협업" 대응 문서. 아래 **[대괄호]** 부분을 실제 팀 정보로 채워 발표 자료에 포함하세요.
> (개인 프로젝트라면 "단독 수행"으로 명시하고 동료평가 표는 생략하면 됩니다.)

## 역할 분담표

| 팀원 | 담당 영역 | 주요 산출물 |
|---|---|---|
| **[팀원 A]** | 데이터 수집·라벨링 | 평가셋 84개 작성, 실제 자소서 PDF 30개 수집·라벨링, 도메인 프로파일 큐레이션 |
| **[팀원 B]** | NLP 파이프라인·모델 | 키워드/BoN/SBERT/학습헤드 구현, 하이브리드 가중치 설계, 임베딩 사전계산 |
| **[팀원 C]** | 평가·실험 설계 | 7-way ablation, nested LOOCV, 부트스트랩 CI, 실데이터 홀드아웃, 학습곡선 |
| **[팀원 D]** | 프론트엔드·시각화 | React 대시보드, Mind-Map, Recharts 차트, EvaluationPanel UI |

> 실제 분담이 위와 다르면 표를 수정하세요. 한 명이 여러 영역을 맡았다면 "팀원" 칸에 같은 이름을 여러 번 적으면 됩니다.

## 협업 방식

- **버전 관리**: git으로 작업 단위별 커밋 (협업 히스토리는 `git log`로 확인).
- **단일 출처 원칙**: 평가셋은 `src/lib/evaluationDataset.js` 한 곳에서만 관리하고
  `node scripts/exportEvalDataset.mjs`로 JSON을 자동 생성 → 데이터 불일치 방지.
- **재현성**: 모든 성능 수치는 스크립트 재실행으로 재현 가능 (아래 실행 순서 참조).

```bash
node scripts/exportEvalDataset.mjs          # 평가셋 JS → JSON 동기화
python scripts/precompute_embeddings.py     # SBERT 임베딩 사전계산
python scripts/train_classifier_head.py     # 학습 헤드 (LogReg/MLP 비교 + 실데이터 투입)
node scripts/runFullEvaluation.mjs          # 전체 평가 리포트
```

## 동료 평가 (Peer Evaluation)

> 각 팀원이 다른 팀원에 대해 강점/기여를 2~3줄로 작성합니다. (실제 평가로 교체)

| 평가자 → 대상 | 기여 및 강점 | 개선 제안 |
|---|---|---|
| **[A → B]** | [예: 모델 파이프라인 설계를 주도하고 ablation 구조를 명확히 잡음] | [예: 문서화 보강] |
| **[B → C]** | [기여 내용] | [개선점] |
| **[C → D]** | [기여 내용] | [개선점] |
| **[D → A]** | [기여 내용] | [개선점] |
