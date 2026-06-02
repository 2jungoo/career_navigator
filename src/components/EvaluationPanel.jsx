import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { GitCompare, Loader2, Network, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { runScoringAblation, bootstrapMetricCI, runRealDataHoldout } from '../lib/evaluateClassifier';

function percent(v) {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—';
}

function ciText(c) {
  return c ? `${Math.round(c.lo * 100)}–${Math.round(c.hi * 100)}` : '—';
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-5 text-center">
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function Pipeline() {
  const steps = [
    {
      phase: '입력',
      nodes: [{ name: 'PDF / TXT / MD', sub: 'pdfjs-dist' }],
    },
    {
      phase: '전처리',
      nodes: [{ name: '문장 분리', sub: '종결어미 정규식' }, { name: '불용어 정규화' }],
    },
    {
      phase: '분류',
      nodes: [
        { name: 'Keyword', tag: 'n/a', tagClass: 'bg-slate-700 text-slate-400' },
        { name: 'BoN Cosine', tag: 'BoN', tagClass: 'bg-sky-500/20 text-sky-300' },
        { name: 'SBERT Cosine', tag: 'SBERT', tagClass: 'bg-purple-500/20 text-purple-300' },
      ],
    },
    {
      phase: '출력',
      nodes: [{ name: '도메인 분류 (16개)' }, { name: 'JOB / LAB 추천' }],
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Network size={14} className="text-sky-400" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Pipeline</h2>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-2">
        {steps.map((step, si) => (
          <div key={step.phase} className="flex flex-col items-center md:flex-1">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.15em] text-slate-500">{step.phase}</p>
            <div className="w-full space-y-1.5 rounded-xl border border-slate-700/40 bg-slate-900/60 p-2.5">
              {step.nodes.map((node) => (
                <div key={node.name} className="flex items-center gap-1.5">
                  {node.tag && (
                    <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-mono ${node.tagClass}`}>
                      {node.tag}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-300">{node.name}</span>
                  {node.sub && <span className="text-[10px] text-slate-600">· {node.sub}</span>}
                </div>
              ))}
            </div>
            {si < steps.length - 1 && (
              <div className="my-1 hidden text-[11px] text-slate-600 md:block">→</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AblationTable({ rows }) {
  if (!rows.length) return null;
  const bestAcc = Math.max(...rows.map((r) => r.accuracy));

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <GitCompare size={14} className="text-sky-400" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Scoring Ablation
        </h2>
        <span className="font-mono text-[11px] text-slate-500">{rows.length}-way</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700/70 text-slate-500">
              <th className="pb-2.5 pr-4 font-medium">방식</th>
              <th className="pb-2.5 pr-4 font-medium">임베딩</th>
              <th className="pb-2.5 pr-3 font-medium">Accuracy</th>
              <th className="pb-2.5 pr-3 font-medium">95% CI</th>
              <th className="pb-2.5 pr-3 font-medium">Macro F1</th>
              <th className="pb-2.5 pr-3 font-medium">Coverage</th>
              <th className="pb-2.5 font-medium">오분류</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isBest = row.accuracy === bestAcc;
              const missed = row.predictions?.filter((p) => !p.correct).length ?? '?';
              return (
                <tr
                  key={row.id}
                  className={`border-b border-slate-800/60 ${isBest ? 'bg-sky-500/5' : ''}`}
                >
                  <td className="py-2.5 pr-4">
                    <span className={`font-medium ${isBest ? 'text-sky-200' : 'text-slate-200'}`}>
                      {row.label}
                    </span>
                    {isBest && (
                      <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-mono text-sky-300">
                        best
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                        row.embeddingType === 'SBERT'
                          ? 'bg-purple-500/20 text-purple-300'
                          : row.embeddingType === 'BoN'
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {row.embeddingType}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 pr-3 font-mono ${
                      isBest ? 'font-bold text-white' : 'text-slate-300'
                    }`}
                  >
                    {percent(row.accuracy)}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-500">
                    {ciText(row.ci?.accuracy)}
                  </td>
                  <td className={`py-2.5 pr-3 font-mono ${isBest ? 'text-white' : 'text-slate-300'}`}>
                    {percent(row.macroF1)}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-slate-400">{percent(row.coverage)}</td>
                  <td className="py-2.5 font-mono text-slate-400">{missed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        * SBERT 경로는{' '}
        <code className="rounded bg-slate-700/60 px-1 text-slate-300">public/data/embeddings.json</code>{' '}
        사전계산 결과 기준. 없으면 BoN으로 동작. 95% CI는 부트스트랩 복원추출 2,000회.
      </p>
    </section>
  );
}

function HoldoutTable({ data }) {
  if (!data?.rows?.length) return null;
  const bestF1 = Math.max(...data.rows.map((r) => r.macroF1));

  return (
    <section className="rounded-2xl border border-amber-700/40 bg-amber-950/10 p-5">
      <div className="mb-1 flex items-center gap-2">
        <GitCompare size={14} className="text-amber-400" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
          Real-Data Holdout
        </h2>
        <span className="font-mono text-[11px] text-slate-500">실제 자소서 PDF</span>
      </div>
      <p className="mb-4 text-[11px] leading-5 text-slate-400">
        합성 평가셋(짧고 단순)이 아닌 <strong className="text-slate-300">실제 자소서 PDF</strong> 일반화 성능.
        전체 {data.meta.total}개 중 라벨 부여 가능한 {data.meta.evaluated}개 평가
        ({data.meta.domains}개 도메인, 미매칭 {data.meta.excluded}개 제외). 라벨은 지원 직군 기준 자동 부여.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700/70 text-slate-500">
              <th className="pb-2.5 pr-4 font-medium">방식</th>
              <th className="pb-2.5 pr-4 font-medium">임베딩</th>
              <th className="pb-2.5 pr-3 font-medium">Accuracy</th>
              <th className="pb-2.5 pr-3 font-medium">95% CI</th>
              <th className="pb-2.5 font-medium">Macro F1</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const isBest = row.macroF1 === bestF1;
              return (
                <tr key={row.id} className={`border-b border-slate-800/60 ${isBest ? 'bg-amber-500/5' : ''}`}>
                  <td className="py-2.5 pr-4">
                    <span className={`font-medium ${isBest ? 'text-amber-200' : 'text-slate-200'}`}>
                      {row.label}
                    </span>
                    {isBest && (
                      <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                        best F1
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                        row.embeddingType === 'SBERT'
                          ? 'bg-purple-500/20 text-purple-300'
                          : row.embeddingType === 'BoN'
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {row.embeddingType}
                    </span>
                  </td>
                  <td className={`py-2.5 pr-3 font-mono ${isBest ? 'font-bold text-white' : 'text-slate-300'}`}>
                    {percent(row.accuracy)}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-500">
                    {ciText(row.ci?.accuracy)}
                  </td>
                  <td className={`py-2.5 font-mono ${isBest ? 'text-white' : 'text-slate-300'}`}>
                    {percent(row.macroF1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        * 합성셋(97%) → 실데이터 하락은 실제 자소서의 도메인 혼재·표현 다양성에서 기인. 일반화 한계를 정직하게 드러낸다.
      </p>
    </section>
  );
}

function LearningCurveChart({ curve, headRow }) {
  if (!curve?.trainSizes?.length) return null;

  const data = curve.trainSizes.map((n, i) => ({
    n,
    acc: Math.round(curve.accMean[i] * 1000) / 10,
    f1: Math.round(curve.f1Mean[i] * 1000) / 10,
  }));
  const cosine = Math.round(curve.cosineRef * 1000) / 10;
  const random = Math.round(curve.randomRef * 1000) / 10;
  const maxN = curve.trainSizes[curve.trainSizes.length - 1];

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp size={14} className="text-emerald-400" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Learning Curve
        </h2>
        <span className="font-mono text-[11px] text-slate-500">학습 헤드 · 데이터 크기별 성능</span>
      </div>
      <p className="mb-4 text-[11px] leading-5 text-slate-400">
        SBERT 위 LogReg 헤드(표준화 + class_weight=balanced + 누수 없는 nested CV)의 학습 데이터 크기별 성능.
        곡선이 n={curve.trainSizes[0]}→{maxN}에서 계속 상승하며 <strong className="text-slate-300">고원에 도달하지 않음</strong> →
        성능 한계는 알고리즘이 아니라 데이터 양 때문임을 시사.
        {headRow && (
          <> 전체 데이터 nested LOOCV = <strong className="text-slate-300">{percent(headRow.accuracy)}</strong>.</>
        )}
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="n"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: '학습 샘플 수', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }}
              formatter={(v, name) => [`${v}%`, name]}
              labelFormatter={(l) => `n = ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={cosine} stroke="#a855f7" strokeDasharray="5 4"
              label={{ value: `코사인 Hybrid ${cosine}%`, fill: '#c084fc', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={random} stroke="#475569" strokeDasharray="2 4"
              label={{ value: `랜덤 ${random}%`, fill: '#64748b', fontSize: 10, position: 'insideBottomRight' }} />
            <Line type="monotone" dataKey="acc" name="Accuracy" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="f1" name="Macro F1" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        * cv={curve.cv_folds} 교차검증(fold당 train 최대 ~{maxN}개), C 고정({curve.fixed_C}).
        {' '}헤드는 비교·연구용이며 서비스 기본값은 코사인 Hybrid({cosine}%)이다.
      </p>
    </section>
  );
}

function ErrorAnalysis({ report }) {
  const mistakes = report.predictions.filter((r) => !r.correct);

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Error Analysis</h2>
        <span className={`font-mono text-xs ${mistakes.length ? 'text-rose-400' : 'text-emerald-400'}`}>
          {mistakes.length}건
        </span>
      </div>
      {mistakes.length === 0 ? (
        <p className="text-sm text-slate-500">오분류 없음</p>
      ) : (
        <div className="flex flex-col gap-2">
          {mistakes.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-mono text-slate-500">{row.id}</span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                  정답 {row.label}
                </span>
                <span className="text-slate-600">→</span>
                <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-300">
                  예측 {row.predicted}
                </span>
              </div>
              <p className="line-clamp-2 text-xs leading-5 text-slate-400">{row.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PerClassTable({ rows }) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
        Per-Class Performance
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700/70 text-slate-500">
              <th className="pb-2.5 pr-4 font-medium">도메인</th>
              <th className="pb-2.5 pr-3 font-medium">정답/전체</th>
              <th className="pb-2.5 pr-3 font-medium">Precision</th>
              <th className="pb-2.5 pr-3 font-medium">Recall</th>
              <th className="pb-2.5 font-medium">F1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const correct = row.support > 0
                ? Math.min(Math.round(row.recall * row.support), row.support)
                : null;
              return (
              <tr key={row.label} className="border-b border-slate-800/60">
                <td className="py-2 pr-4 font-medium text-slate-200">{row.labelName}</td>
                <td className="py-2 pr-3 font-mono">
                  {correct === null ? (
                    <span className="text-slate-600">—</span>
                  ) : (
                    <>
                      <span className={correct === row.support ? 'text-emerald-400' : 'text-amber-400'}>
                        {correct}
                      </span>
                      <span className="text-slate-600"> / {row.support}</span>
                    </>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono text-slate-300">{percent(row.precision)}</td>
                <td className="py-2 pr-3 font-mono text-slate-300">{percent(row.recall)}</td>
                <td
                  className={`py-2 font-mono font-semibold ${
                    row.f1 < 0.8
                      ? 'text-rose-400'
                      : row.f1 < 0.95
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {percent(row.f1)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConfusionMatrix({ report }) {
  const labels = report.confusionLabels;
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
        Confusion Matrix
        <span className="ml-2 font-normal normal-case text-slate-500">(행 = 정답, 열 = 예측)</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-center text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-slate-900/95 px-2 py-2 text-left font-mono font-normal text-slate-600">
                actual \ pred
              </th>
              {labels.map((l) => (
                <th key={l.label} className="px-2 py-2 font-mono font-normal text-slate-500" title={l.labelName}>
                  {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((actual) => (
              <tr key={actual.label} className="border-t border-slate-800/50">
                <th className="sticky left-0 bg-slate-900/95 px-2 py-2 text-left font-mono font-normal text-slate-400">
                  {actual.label}
                </th>
                {labels.map((pred) => {
                  const v = report.confusionMatrix[actual.label]?.[pred.label] ?? 0;
                  const isHit = actual.label === pred.label && v > 0;
                  const isMiss = actual.label !== pred.label && v > 0;
                  return (
                    <td
                      key={pred.label}
                      className={[
                        'px-2 py-2 font-mono',
                        isHit ? 'bg-emerald-500/15 text-emerald-300' : '',
                        isMiss ? 'bg-rose-500/20 text-rose-300' : 'text-slate-700',
                      ].join(' ')}
                    >
                      {v || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function EvaluationPanel() {
  const [report, setReport] = useState(null);
  const [comparisonRows, setComparisonRows] = useState([]);
  const [holdout, setHoldout] = useState(null);
  const [curve, setCurve] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    // runScoringAblation이 sbert-hybrid를 포함한 모든 설정을 평가하므로
    // 별도 evaluateClassifier 호출 없이 ablation 결과에서 추출한다 (중복 제거).
    runScoringAblation().then((rows) => {
      if (!alive) return;
      // 각 행에 부트스트랩 95% CI 부착
      const withCI = rows.map((r) => ({ ...r, ci: bootstrapMetricCI(r.predictions) }));
      const sbertHybrid = withCI.find((r) => r.id === 'sbert-hybrid') ?? withCI[withCI.length - 1];
      setReport(sbertHybrid);
      setComparisonRows(withCI);
    }).catch((err) => {
      if (!alive) return;
      console.error('[EvaluationPanel] load failed', err);
      setLoadError(true);
    });

    // 실데이터 홀드아웃 (실제 자소서 PDF) — 비동기 로드, 실패해도 메인 평가에는 영향 없음
    runRealDataHoldout().then((data) => {
      if (!alive || !data) return;
      setHoldout({ ...data, rows: data.rows.map((r) => ({ ...r, ci: bootstrapMetricCI(r.predictions) })) });
    }).catch((err) => {
      console.warn('[EvaluationPanel] holdout load failed', err);
    });

    // 학습곡선 (train_classifier_head.py 산출) — 비동기 로드
    fetch('/data/learning_curve.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (alive && data) setCurve(data); })
      .catch((err) => console.warn('[EvaluationPanel] learning curve load failed', err));

    return () => {
      alive = false;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-rose-400">
          <AlertTriangle size={15} />
          평가 데이터를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={15} className="animate-spin" />
          평가 중...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        {/* 헤더 + 메트릭 */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <h1 className="text-base font-semibold text-white">Classifier Evaluation</h1>
            <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 font-mono text-xs text-purple-300">
              SBERT Hybrid
            </span>
            <span className="text-xs text-slate-500">{report.datasetSize}개 평가셋</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Accuracy" value={percent(report.accuracy)} />
            <MetricCard label="Macro F1" value={percent(report.macroF1)} />
            <MetricCard label="Coverage" value={percent(report.coverage)} sub="근거 있는 예측 비율" />
          </div>
        </div>

        <Pipeline />

        <AblationTable rows={comparisonRows} />

        {holdout && <HoldoutTable data={holdout} />}

        {curve && (
          <LearningCurveChart
            curve={curve}
            headRow={comparisonRows.find((r) => r.id === 'head-only')}
          />
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <ErrorAnalysis report={report} />
          <PerClassTable rows={report.perClass} />
        </div>

        <ConfusionMatrix report={report} />
      </div>
    </div>
  );
}
