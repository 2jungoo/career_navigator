import { analyzeDocument } from './nlpSimulator.js';
import { scoreSBERT, scoreHeadPrecomputed } from './sbertScorer.js';
import { EVALUATION_DATASET } from './evaluationDataset.js';


const DOMAIN_LABELS = {
  engineering: 'Software Engineering',
  data: 'Data Science / Analytics',
  planning: 'Product / Planning',
  research: 'Research / Academia',
  management: 'Project Management',
  public_admin: 'Public Administration',
  economics: 'Economics / Finance',
  business: 'Business / Marketing',
  nursing_health: 'Nursing / Public Health',
  natural_science: 'Natural Science / Math',
  humanities: 'Humanities / Social Science',
  arts_design: 'Arts / Design',
  manufacturing: 'Manufacturing / Production',
  energy_plant: 'Energy / Power Plant',
  aerospace: 'Aerospace / Satellite',
  media_content: 'Media / Content',
  insufficient: 'Insufficient evidence',
};

function makeEmptyStats() {
  return {
    tp: 0,
    fp: 0,
    fn: 0,
    support: 0,
    precision: 0,
    recall: 0,
    f1: 0,
  };
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export async function evaluateClassifier(dataset = EVALUATION_DATASET, options = {}) {
  const predictions = [];
  const embeddingMode = options.embeddingMode ?? 'hybrid'; // 'keyword' | 'hybrid' | 'sbert' | 'sbert-hybrid'
  const keyMode = options.keyMode ?? 'eval'; // 'eval' → eval.<id> / 'pdf' → pdf.<id> 임베딩 키 사용

  for (const item of dataset) {
    // SBERT 경로: 사전계산 임베딩으로 도메인 점수 보정 (평가셋은 evalId, 실 PDF는 pdfId 키)
    const embKey = keyMode === 'pdf' ? { pdfId: item.id } : { evalId: item.id };
    let sbertOverride = null;
    if ((embeddingMode === 'sbert' || embeddingMode === 'sbert-hybrid' || embeddingMode === 'sbert-hybrid-threshold') && item.id) {
      const sbertScores = await scoreSBERT(embKey);
      if (sbertScores) sbertOverride = sbertScores;
    } else if ((embeddingMode === 'head-only' || embeddingMode === 'head-hybrid') && item.id) {
      const headScores = await scoreHeadPrecomputed(embKey);
      if (headScores) sbertOverride = headScores;
    }

    const analyzeOptions = {
      skipDelay: true,
      evidenceThreshold: options.evidenceThreshold,
      keywordWeight: options.keywordWeight,
      scoringMode: embeddingMode === 'keyword'     ? 'keyword'
        : embeddingMode === 'sbert'       ? 'sbert-only'
        : embeddingMode === 'head-only'   ? 'head-only'
        : embeddingMode === 'head-hybrid' ? 'head-hybrid'
        : 'hybrid',
      sbertScores: sbertOverride,
    };

    const result = await analyzeDocument(
      {
        text: item.text,
        meta: { sourceType: 'evaluation', title: item.id },
      },
      analyzeOptions
    );

    predictions.push({
      ...item,
      predicted: result.primaryDomain,
      correct: result.primaryDomain === item.label,
      evidence: result.domainEvidence,
      topKeywords: result.keywords.slice(0, 5),
      topScores: Object.entries(result.normalizedScores ?? {})
        .sort(([, left], [, right]) => right - left)
        .slice(0, 3)
        .map(([domain, score]) => ({
          domain,
          labelName: DOMAIN_LABELS[domain] ?? domain,
          score,
        })),
      sbertAvailable: sbertOverride !== null,
    });
  }

  const labels = Array.from(new Set(dataset.map((item) => item.label)));
  const predictedLabels = Array.from(new Set(predictions.map((item) => item.predicted)));
  const matrixLabels = Array.from(new Set([...labels, ...predictedLabels]));
  const perClass = Object.fromEntries(labels.map((label) => [label, makeEmptyStats()]));
  const confusionMatrix = Object.fromEntries(
    matrixLabels.map((actual) => [
      actual,
      Object.fromEntries(matrixLabels.map((predicted) => [predicted, 0])),
    ])
  );

  predictions.forEach((row) => {
    confusionMatrix[row.label][row.predicted] += 1;
    perClass[row.label].support += 1;
    if (row.correct) {
      perClass[row.label].tp += 1;
      return;
    }

    perClass[row.label].fn += 1;
    if (!perClass[row.predicted]) {
      perClass[row.predicted] = makeEmptyStats();
    }
    perClass[row.predicted].fp += 1;
  });

  Object.values(perClass).forEach((stats) => {
    stats.precision = stats.tp + stats.fp === 0 ? 0 : stats.tp / (stats.tp + stats.fp);
    stats.recall = stats.tp + stats.fn === 0 ? 0 : stats.tp / (stats.tp + stats.fn);
    stats.f1 =
      stats.precision + stats.recall === 0
        ? 0
        : (2 * stats.precision * stats.recall) / (stats.precision + stats.recall);
  });

  const correctCount = predictions.filter((row) => row.correct).length;
  const coveredCount = predictions.filter((row) => row.predicted !== 'insufficient').length;
  const macroF1 =
    labels.reduce((sum, label) => sum + perClass[label].f1, 0) / (labels.length || 1);

  return {
    datasetSize: dataset.length,
    sourceCounts: dataset.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    }, {}),
    accuracy: round(correctCount / (dataset.length || 1)),
    macroF1: round(macroF1),
    coverage: round(coveredCount / (dataset.length || 1)),
    confusionLabels: matrixLabels.map((label) => ({
      label,
      labelName: DOMAIN_LABELS[label] ?? label,
    })),
    confusionMatrix,
    perClass: Object.entries(perClass).map(([label, stats]) => ({
      label,
      labelName: DOMAIN_LABELS[label] ?? label,
      support: stats.support,
      precision: round(stats.precision),
      recall: round(stats.recall),
      f1: round(stats.f1),
    })),
    predictions,
  };
}

export async function runThresholdAblation(thresholds = [0, 2, 5]) {
  const rows = [];

  for (const threshold of thresholds) {
    const report = await evaluateClassifier(EVALUATION_DATASET, { evidenceThreshold: threshold });
    rows.push({
      threshold,
      accuracy: report.accuracy,
      macroF1: report.macroF1,
      coverage: report.coverage,
    });
  }

  return rows;
}

/**
 * keyword weight를 0→1 사이로 스윕하며 accuracy/macroF1/coverage 곡선을 반환.
 * 0.45 선택이 성능 고원(plateau) 구간에 있음을 실험으로 정당화한다.
 * @param {number[]} weights
 * @param {{ embeddingMode?: string }} options
 */
export async function runWeightSensitivity(
  weights = [0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  { embeddingMode = 'sbert-hybrid' } = {}
) {
  const rows = [];
  for (const w of weights) {
    const report = await evaluateClassifier(EVALUATION_DATASET, { embeddingMode, keywordWeight: w });
    rows.push({
      keywordWeight: w,
      semanticWeight: Math.round((1 - w) * 100) / 100,
      accuracy: report.accuracy,
      macroF1: report.macroF1,
      coverage: report.coverage,
    });
  }
  return rows;
}

async function loadOofPredictions() {
  try {
    if (typeof window === 'undefined') {
      const { readFileSync } = await import('fs');
      const { resolve, join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const p = resolve(join(__dirname, '../../public/data/head_oof_predictions.json'));
      return JSON.parse(readFileSync(p, 'utf-8'));
    } else {
      const res = await fetch('/data/head_oof_predictions.json');
      if (!res.ok) return null;
      return await res.json();
    }
  } catch { return null; }
}

function buildHeadAblationRow(id, label, embeddingType, description, oofPreds, dataset) {
  const predictions = oofPreds.map((p) => ({
    ...p,
    evidence: [],
    topKeywords: [],
    topScores: [],
    sbertAvailable: true,
  }));

  const labels = Array.from(new Set(dataset.map((item) => item.label)));
  const predictedLabels = Array.from(new Set(predictions.map((item) => item.predicted)));
  const matrixLabels = Array.from(new Set([...labels, ...predictedLabels]));
  const perClass = Object.fromEntries(labels.map((l) => [l, makeEmptyStats()]));
  const confusionMatrix = Object.fromEntries(
    matrixLabels.map((actual) => [
      actual,
      Object.fromEntries(matrixLabels.map((pred) => [pred, 0])),
    ])
  );

  predictions.forEach((row) => {
    if (confusionMatrix[row.label]) confusionMatrix[row.label][row.predicted] += 1;
    if (!perClass[row.label]) perClass[row.label] = makeEmptyStats();
    perClass[row.label].support += 1;
    if (row.correct) { perClass[row.label].tp += 1; return; }
    perClass[row.label].fn += 1;
    if (!perClass[row.predicted]) perClass[row.predicted] = makeEmptyStats();
    perClass[row.predicted].fp += 1;
  });

  Object.values(perClass).forEach((stats) => {
    stats.precision = stats.tp + stats.fp === 0 ? 0 : stats.tp / (stats.tp + stats.fp);
    stats.recall    = stats.tp + stats.fn === 0 ? 0 : stats.tp / (stats.tp + stats.fn);
    stats.f1 = stats.precision + stats.recall === 0 ? 0
      : (2 * stats.precision * stats.recall) / (stats.precision + stats.recall);
  });

  const correctCount = predictions.filter((p) => p.correct).length;
  const macroF1 = labels.reduce((s, l) => s + (perClass[l]?.f1 ?? 0), 0) / (labels.length || 1);

  return {
    id,
    label,
    embeddingType,
    description,
    datasetSize: predictions.length,
    sourceCounts: dataset.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    }, {}),
    accuracy: round(correctCount / (predictions.length || 1)),
    macroF1: round(macroF1),
    coverage: 1,
    confusionLabels: matrixLabels.map((l) => ({ label: l, labelName: DOMAIN_LABELS[l] ?? l })),
    confusionMatrix,
    perClass: Object.entries(perClass).map(([l, stats]) => ({
      label: l,
      labelName: DOMAIN_LABELS[l] ?? l,
      support: stats.support,
      precision: round(stats.precision),
      recall: round(stats.recall),
      f1: round(stats.f1),
    })),
    predictions,
  };
}

export async function runScoringAblation() {
  const CONFIGS = [
    {
      id: 'keyword',
      label: 'Keyword-only',
      embeddingType: 'n/a',
      description: '도메인 키워드 매칭 점수만 사용 (600+ 사전 단어)',
      options: { embeddingMode: 'keyword' },
    },
    {
      id: 'bon-hybrid',
      label: 'BoN Hybrid (baseline)',
      embeddingType: 'BoN',
      description: '키워드 45% + Bag-of-N-grams 코사인 55% 결합 (현행)',
      options: { embeddingMode: 'hybrid' },
    },
    {
      id: 'sbert',
      label: 'SBERT-only',
      embeddingType: 'SBERT',
      description: 'SBERT(MiniLM-L12) 코사인만 사용 — 사전계산 필요',
      options: { embeddingMode: 'sbert' },
    },
    {
      id: 'sbert-hybrid',
      label: 'SBERT Hybrid',
      embeddingType: 'SBERT',
      description: '키워드 45% + SBERT 코사인 55% — 사전계산 필요',
      options: { embeddingMode: 'sbert-hybrid' },
    },
    {
      id: 'sbert-hybrid-threshold',
      label: 'SBERT Hybrid + Threshold',
      embeddingType: 'SBERT',
      description: 'SBERT Hybrid + evidence threshold ≥ 2 (과감한 기각)',
      options: { embeddingMode: 'sbert-hybrid', evidenceThreshold: 2 },
    },
  ];

  const results = [];
  for (const config of CONFIGS) {
    const report = await evaluateClassifier(EVALUATION_DATASET, config.options);
    results.push({
      id: config.id,
      label: config.label,
      embeddingType: config.embeddingType,
      description: config.description,
      ...report,
    });
  }

  // learned-head 행: LOOCV OOF 예측 기반 (leakage 없음)
  const oofJson = await loadOofPredictions();
  if (oofJson?.predictions) {
    results.push(buildHeadAblationRow(
      'head-only',
      'SBERT + Learned Head (LOOCV)',
      'Learned Head',
      'frozen SBERT 위 LogReg 헤드 — LOOCV out-of-fold 예측 (leakage 없음)',
      oofJson.predictions,
      EVALUATION_DATASET,
    ));

    // head-hybrid: full-fit 헤드 기반 (평가셋 사용 → 낙관적 수치, 참고용)
    const headHybridReport = await evaluateClassifier(EVALUATION_DATASET, {
      embeddingMode: 'head-hybrid',
    });
    results.push({
      id: 'head-hybrid',
      label: 'Learned Head Hybrid (참고)',
      embeddingType: 'Learned Head',
      description: '키워드 45% + 학습 헤드 55% — 전체-fit 헤드 사용 (낙관적, 참고용)',
      ...headHybridReport,
    });
  }

  return results;
}

/**
 * public/data/pdf_corpus.json (실제 자소서 PDF 추출 텍스트 + 파일명 기반 라벨)을 로드한다.
 * Node(CLI)에서는 fs, 브라우저에서는 fetch를 사용한다.
 * @returns {Promise<Array<{id,name,label,text,chars}> | null>}
 */
async function loadPdfCorpus() {
  try {
    if (typeof window === 'undefined') {
      const { readFileSync } = await import('fs');
      const { resolve, join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const p = resolve(join(__dirname, '../../public/data/pdf_corpus.json'));
      return JSON.parse(readFileSync(p, 'utf-8'));
    } else {
      const res = await fetch('/data/pdf_corpus.json');
      if (!res.ok) return null;
      return await res.json();
    }
  } catch { return null; }
}

/**
 * 실제 자소서 PDF 홀드아웃 평가.
 * 합성 평가셋(짧고 단순) 대비, 실제 자소서(평균 2,400자, 다중 페이지)에서의 일반화 성능을 측정한다.
 * 라벨은 파일명 규칙으로 자동 부여(지원 직군 기준)되며, 매칭 실패(insufficient)는 정답 라벨이 없어 평가에서 제외한다.
 *
 * @returns {Promise<{ meta: object, rows: Array<object> } | null>}
 *   rows: [Keyword-only, BoN Hybrid, SBERT Hybrid] 각 방법의 평가 리포트
 */
export async function runRealDataHoldout() {
  const corpus = await loadPdfCorpus();
  if (!corpus || corpus.length === 0) return null;

  const labeled = corpus.filter((c) => c.label && c.label !== 'insufficient');
  const dataset = labeled.map((c) => ({
    id: c.id,
    text: c.text,
    label: c.label,
    source: 'real_pdf',
  }));

  const CONFIGS = [
    { id: 'keyword', label: 'Keyword-only', embeddingType: 'n/a', options: { embeddingMode: 'keyword' } },
    { id: 'bon-hybrid', label: 'BoN Hybrid', embeddingType: 'BoN', options: { embeddingMode: 'hybrid' } },
    { id: 'sbert-hybrid', label: 'SBERT Hybrid', embeddingType: 'SBERT', options: { embeddingMode: 'sbert-hybrid', keyMode: 'pdf' } },
  ];

  const rows = [];
  for (const config of CONFIGS) {
    const report = await evaluateClassifier(dataset, config.options);
    rows.push({ id: config.id, label: config.label, embeddingType: config.embeddingType, ...report });
  }

  return {
    meta: {
      total: corpus.length,
      evaluated: labeled.length,
      excluded: corpus.length - labeled.length, // 라벨 매칭 실패(정답 없음)
      domains: Array.from(new Set(labeled.map((c) => c.label))).length,
    },
    rows,
  };
}

/** 시드 고정 PRNG (mulberry32) — 부트스트랩 CI 재현성 확보용 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 부트스트랩 복원추출로 accuracy와 macroF1의 95% 신뢰구간을 추정한다.
 * 분류기는 학습이 없는 결정적 추론이므로 k-fold CV 대신 부트스트랩 CI가 적합.
 *
 * @param {Array<{correct: boolean, label: string, predicted: string}>} predictions
 * @param {{ iterations?: number, alpha?: number, seed?: number }} options
 * @returns {{ accuracy: {mean,lo,hi}, macroF1: {mean,lo,hi} }}
 */
export function bootstrapMetricCI(predictions, { iterations = 2000, alpha = 0.05, seed = 42 } = {}) {
  const n = predictions.length;
  const accSamples = [];
  const f1Samples = [];
  const rand = mulberry32(seed);
  // 라벨셋은 전체 predictions 기준으로 고정 — 샘플마다 변하면 macro 평균 분모가 흔들림
  const allLabels = [...new Set(predictions.flatMap((p) => [p.label, p.predicted]))];

  for (let i = 0; i < iterations; i++) {
    // 복원추출
    const sample = Array.from({ length: n }, () => predictions[Math.floor(rand() * n)]);

    const correctCount = sample.filter((p) => p.correct).length;
    accSamples.push(correctCount / n);

    // per-class F1 for macro (샘플에 전혀 등장하지 않은 클래스는 평균에서 제외)
    const classF1s = allLabels
      .map((label) => {
        const tp = sample.filter((p) => p.label === label && p.predicted === label).length;
        const fp = sample.filter((p) => p.label !== label && p.predicted === label).length;
        const fn = sample.filter((p) => p.label === label && p.predicted !== label).length;
        if (tp + fp + fn === 0) return null;
        const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
        const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
        return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
      })
      .filter((v) => v !== null);
    f1Samples.push(classF1s.reduce((s, v) => s + v, 0) / (classF1s.length || 1));
  }

  const ci = (samples) => {
    samples.sort((a, b) => a - b);
    const lo = samples[Math.floor((alpha / 2) * iterations)];
    const hi = samples[Math.floor((1 - alpha / 2) * iterations)];
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    return { mean: round(mean), lo: round(lo), hi: round(hi) };
  };

  return { accuracy: ci(accSamples), macroF1: ci(f1Samples) };
}
