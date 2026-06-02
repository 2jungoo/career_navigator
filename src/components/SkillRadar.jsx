import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs">
      <p className="font-semibold text-blue-300">{payload[0].payload.subject}</p>
      <p className="text-slate-300">{payload[0].value}점</p>
    </div>
  );
}

export default function SkillRadar({ data }) {
  if (!data) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
      <span className="text-xs uppercase tracking-wider text-slate-400">역량 분포 레이더</span>
      <div className="mt-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickCount={4}
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="역량"
              dataKey="A"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
