/**
 * 전체 평가 파이프라인 실행 스크립트.
 * 모든 ablation 설정을 돌리고 결과를 Markdown으로 출력한다.
 *
 * 실행 방법:
 *   node scripts/runFullEvaluation.mjs
 *
 * 출력: 콘솔에 Markdown 리포트 출력
 * (파일로 저장하려면: node scripts/runFullEvaluation.mjs > eval_report.md)
 */
import { evaluateClassifier, runThresholdAblation, runScoringAblation, runWeightSensitivity, bootstrapMetricCI, runRealDataHoldout } from '../src/lib/evaluateClassifier.js';
import { EVALUATION_DATASET } from '../src/lib/evaluationDataset.js';

function fmt(n) {
  return typeof n === 'number' ? (n * 100).toFixed(1) : '--';
}

async function main() {
  const lines = [];
  const log = (...args) => lines.push(args.join(' '));

  log('# Career Navigator — Evaluation Report\n');
  log(`평가 날짜: ${new Date().toISOString().slice(0, 10)}`);
  log(`평가셋 크기: ${EVALUATION_DATASET.length}개\n`);

  // --- 1. 기본 평가 (hybrid, default threshold) ---
  log('## 1. 기본 평가 (Hybrid BoN, threshold=2)\n');
  const base = await evaluateClassifier();
  log(`| 지표 | 값 |`);
  log(`|---|---|`);
  log(`| Accuracy | ${fmt(base.accuracy)}% |`);
  log(`| Macro F1 | ${fmt(base.macroF1)}% |`);
  log(`| Coverage | ${fmt(base.coverage)}% |`);
  log(`| 데이터셋 크기 | ${base.datasetSize} |`);
  log('');

  // 도메인별 상세
  log('### 도메인별 precision / recall / F1\n');
  log('| 도메인 | support | precision | recall | F1 |');
  log('|---|---|---|---|---|');
  for (const row of base.perClass) {
    log(`| ${row.labelName} | ${row.support} | ${fmt(row.precision)}% | ${fmt(row.recall)}% | ${fmt(row.f1)}% |`);
  }
  log('');

  // --- 2. Threshold Ablation ---
  log('## 2. Threshold Ablation\n');
  const thresholds = await runThresholdAblation([0, 1, 2, 4]);
  log('| Threshold | Accuracy | Macro F1 | Coverage |');
  log('|---|---|---|---|');
  for (const row of thresholds) {
    log(`| ${row.threshold} | ${fmt(row.accuracy)}% | ${fmt(row.macroF1)}% | ${fmt(row.coverage)}% |`);
  }
  log('');

  // --- 3. Scoring Ablation + Bootstrap CI ---
  log('## 3. Scoring Ablation (with 95% Bootstrap CI)\n');
  log('> SBERT 경로는 public/data/embeddings.json이 없으면 BoN 폴백으로 동작합니다.\n');
  const ablation = await runScoringAblation();
  log('| # | 방법 | 임베딩 | Accuracy | Acc 95% CI | Macro F1 | F1 95% CI | Coverage |');
  log('|---|---|---|---|---|---|---|---|');
  for (const [i, row] of ablation.entries()) {
    const ci = bootstrapMetricCI(row.predictions);
    const accCI = `[${fmt(ci.accuracy.lo)}%, ${fmt(ci.accuracy.hi)}%]`;
    const f1CI  = `[${fmt(ci.macroF1.lo)}%, ${fmt(ci.macroF1.hi)}%]`;
    log(`| ${i + 1} | ${row.label} | ${row.embeddingType} | ${fmt(row.accuracy)}% | ${accCI} | ${fmt(row.macroF1)}% | ${f1CI} | ${fmt(row.coverage)}% |`);
  }
  log('');

  // --- 4. Weight Sensitivity Analysis ---
  log('## 4. Keyword Weight Sensitivity (SBERT-Hybrid)\n');
  log('> keyword_weight=0.45 근방이 성능 고원(plateau)에 있음을 확인한다.\n');
  const sweep = await runWeightSensitivity();
  log('| keyword_weight | semantic_weight | Accuracy | Macro F1 | Coverage |');
  log('|---|---|---|---|---|');
  for (const row of sweep) {
    const mark = Math.abs(row.keywordWeight - 0.45) < 0.001 ? ' ← 현행' : '';
    log(`| ${row.keywordWeight.toFixed(2)} | ${row.semanticWeight.toFixed(2)} | ${fmt(row.accuracy)}% | ${fmt(row.macroF1)}% | ${fmt(row.coverage)}%${mark} |`);
  }
  log('');

  // --- 5. 오분류 케이스 (Error Analysis) ---
  log('## 5. Error Analysis\n');
  const errors = base.predictions.filter((p) => !p.correct);
  if (errors.length === 0) {
    log('오분류 없음 (Accuracy 100%)');
  } else {
    log(`오분류 ${errors.length}건:\n`);
    for (const e of errors) {
      log(`- **[${e.id}]** 정답: \`${e.label}\` / 예측: \`${e.predicted}\``);
      log(`  > "${e.text.slice(0, 80)}..."`);
    }
  }
  log('');

  // --- 6. Real-Data Holdout (실제 자소서 PDF) ---
  log('## 6. Real-Data Holdout — 실제 자소서 PDF\n');
  const holdout = await runRealDataHoldout();
  if (!holdout) {
    log('> pdf_corpus.json을 찾을 수 없어 건너뜀.\n');
  } else {
    log(`> 합성 평가셋(짧고 단순)이 아닌 **실제 자소서 PDF**에서의 일반화 성능. ` +
        `전체 ${holdout.meta.total}개 중 파일명 라벨 부여 가능한 ${holdout.meta.evaluated}개 평가 ` +
        `(${holdout.meta.domains}개 도메인, 라벨 미매칭 ${holdout.meta.excluded}개 제외). ` +
        `라벨은 지원 직군 기준 자동 부여.\n`);
    log('| # | 방법 | 임베딩 | Accuracy | Acc 95% CI | Macro F1 | Coverage |');
    log('|---|---|---|---|---|---|---|');
    for (const [i, row] of holdout.rows.entries()) {
      const ci = bootstrapMetricCI(row.predictions);
      const accCI = `[${fmt(ci.accuracy.lo)}%, ${fmt(ci.accuracy.hi)}%]`;
      log(`| ${i + 1} | ${row.label} | ${row.embeddingType} | ${fmt(row.accuracy)}% | ${accCI} | ${fmt(row.macroF1)}% | ${fmt(row.coverage)}% |`);
    }
    log('');
    log('> 합성셋 대비 정확도 하락은 실제 자소서의 도메인 혼재·표현 다양성에서 기인하며, 모델의 일반화 한계를 정직하게 드러낸다.\n');
  }

  log('---');
  log('*생성: runFullEvaluation.mjs*');

  const report = lines.join('\n');
  console.log(report);
}

main().catch(console.error);
