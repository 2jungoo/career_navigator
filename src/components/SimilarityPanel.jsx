import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

function OverallScore({ similarity, nameA, nameB }) {
  const pct = Math.round(similarity * 100);
  const color = pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#10b981';
  const label =
    pct > 70
      ? '두 문서의 내용이 매우 유사합니다'
      : pct > 40
        ? '일부 공통 주제·어휘가 발견됩니다'
        : '두 문서는 상당히 다른 내용입니다';

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        전체 문서 유사도
      </p>
      <div className="flex flex-col items-center gap-3">
        <span className="text-5xl font-bold" style={{ color }}>{pct}%</span>
        <p className="text-xs text-slate-400">{label}</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, #3b82f6, ${color})` }}
          />
        </div>
        <div className="flex w-full justify-between text-[11px] text-slate-500">
          <span className="truncate max-w-[45%]">{nameA}</span>
          <span className="truncate max-w-[45%] text-right">{nameB}</span>
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] text-slate-600">
        BoN (Bag-of-N-grams) cosine similarity
      </p>
    </div>
  );
}

function CommonKeywords({ ngrams }) {
  if (!ngrams.length) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">공통 키워드</p>
        <p className="text-xs text-slate-500">공통 어휘가 충분하지 않습니다.</p>
      </div>
    );
  }

  const maxScore = ngrams[0]?.score ?? 1;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        공통 키워드 / n-gram
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ngrams.map(({ token, score }) => {
          const intensity = score / maxScore;
          const opacity = 0.2 + intensity * 0.8;
          return (
            <span
              key={token}
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                background: `rgba(59,130,246,${opacity * 0.35})`,
                color: `rgba(147,197,253,${0.6 + intensity * 0.4})`,
                border: `1px solid rgba(59,130,246,${opacity * 0.5})`,
                fontSize: `${10 + intensity * 4}px`,
              }}
            >
              {token}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-600">
        두 문서 BoN 가중치 곱 기준 상위 {ngrams.length}개
      </p>
    </div>
  );
}

function SentenceMatching({ matches, nameA, nameB }) {
  if (!matches.length) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">문장 단위 매칭</p>
        <p className="text-xs text-slate-500">
          유사도 25% 이상인 문장 쌍이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        문장 단위 매칭
        <span className="ml-2 normal-case tracking-normal font-normal text-slate-500">
          · cosine ≥ 0.25 기준 {matches.length}쌍
        </span>
      </p>
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
        {matches.map((m, i) => {
          const pct = Math.round(m.similarity * 100);
          const color = pct > 70 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#3b82f6';
          return (
            <div key={`${i}-${m.textA.slice(0, 12)}`} className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">pair #{i + 1}</span>
                <span className="font-mono text-xs font-bold" style={{ color }}>{pct}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-0.5 text-[9px] uppercase text-slate-600">{nameA}</p>
                  <p className="line-clamp-3 text-[11px] leading-relaxed text-slate-300">{m.textA}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-[9px] uppercase text-slate-600">{nameB}</p>
                  <p className="line-clamp-3 text-[11px] leading-relaxed text-slate-300">{m.textB}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SHORTENED_LABELS = {
  'Software Engineering': 'Engineering',
  'Data Science': 'Data',
  'Product / Planning': 'Planning',
  'Research': 'Research',
  'Management': 'Management',
  'Public Admin': 'Public',
  'Economics / Finance': 'Finance',
  'Business / Marketing': 'Business',
  'Nursing / Health': 'Health',
  'Natural Science': 'Science',
  'Humanities': 'Humanities',
  'Arts / Design': 'Arts',
  'Manufacturing / Production': 'Manufact.',
  'Energy / Power Plant': 'Energy',
  'Aerospace / Satellite': 'Aerospace',
  'Media / Content': 'Media',
};

function DomainBars({ data, nameA, nameB }) {
  const topDomains = data.slice(0, 8);

  const chartData = topDomains.map((d) => ({
    name: SHORTENED_LABELS[d.label] ?? d.label,
    A: d.scoreA,
    B: d.scoreB,
  }));

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        도메인 분포 비교
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Bar dataKey="A" name={nameA} fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="B" name={nameB} fill="#a855f7" radius={[3, 3, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[10px] text-slate-600">
        Hybrid score (keyword 45% + BoN cosine 55%) 기준 상위 8개 도메인
      </p>
    </div>
  );
}

export default function SimilarityPanel({ comparison, nameA, nameB }) {
  const { overallSimilarity, commonNgrams, sentenceMatches, domainComparison } = comparison;

  return (
    <div className="flex flex-col gap-4">
      <OverallScore similarity={overallSimilarity} nameA={nameA} nameB={nameB} />
      <CommonKeywords ngrams={commonNgrams} />
      <SentenceMatching matches={sentenceMatches} nameA={nameA} nameB={nameB} />
      <DomainBars data={domainComparison} nameA={nameA} nameB={nameB} />
    </div>
  );
}
