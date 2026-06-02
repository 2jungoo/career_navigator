import {
  AlertCircle,
  Beaker,
  BookOpen,
  Briefcase,
  ExternalLink,
  Sparkles,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react';

function SkillBadge({ skill, type }) {
  return (
    <span
      className={[
        'rounded-full border px-2 py-0.5 text-xs',
        type === 'have'
          ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
          : 'border-rose-500/30 bg-rose-500/15 text-rose-300',
      ].join(' ')}
    >
      {skill}
    </span>
  );
}

function SummarySection({ icon, title, items, accent }) {
  if (!items?.length) {
    return null;
  }

  const SectionIcon = icon;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <SectionIcon size={14} className={accent} />
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
            <span className={['mt-1 h-1.5 w-1.5 rounded-full', accent.replace('text-', 'bg-')].join(' ')} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchEvidence({ tokens }) {
  if (!tokens?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Matched terms</p>
      <div className="flex flex-wrap gap-2">
        {tokens.map((token) => (
          <span
            key={token}
            className="rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300"
          >
            {token}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DetailPanel({ node, onClose }) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-2">
          <p className="text-sm font-medium text-slate-300">Nothing selected</p>
          <p className="text-sm leading-6 text-slate-500">
            Select a role or lab node to inspect fit score, strengths, and gaps.
          </p>
        </div>
      </div>
    );
  }

  const isJob = node.type === 'job';

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-start justify-between border-b border-slate-800 p-4"
        style={{
          background: isJob ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)',
        }}
      >
        <div className="flex items-center gap-3">
          {isJob ? (
            <Briefcase size={18} className="mt-0.5 shrink-0 text-blue-400" />
          ) : (
            <Beaker size={18} className="mt-0.5 shrink-0 text-purple-400" />
          )}
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-400">
              {isJob ? 'Career path' : 'Lab recommendation'}
            </p>
            <h3 className="text-sm font-semibold leading-6 text-white">{node.label}</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-slate-400">
              <TrendingUp size={12} />
              Fit score
            </span>
            <span className="text-2xl font-bold" style={{ color: isJob ? '#60a5fa' : '#a78bfa' }}>
              {node.score}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full"
              style={{
                width: `${node.score}%`,
                background: isJob
                  ? 'linear-gradient(90deg, #1d4ed8, #3b82f6)'
                  : 'linear-gradient(90deg, #6d28d9, #8b5cf6)',
              }}
            />
          </div>
        </div>

        {isJob ? (
          <>
            <MatchEvidence tokens={node.matchedTokens} />

            <SummarySection
              icon={BookOpen}
              title="Role summary"
              items={node.summary}
              accent="text-blue-400"
            />

            <SummarySection
              icon={Sparkles}
              title="Current focus"
              items={node.currentFocus}
              accent="text-cyan-400"
            />

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Strengths</p>
              <div className="flex flex-wrap gap-2">
                {node.skills?.map((skill) => (
                  <SkillBadge key={skill} skill={skill} type="have" />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-400" />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Gaps to close</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {node.gap?.map((skill) => (
                  <SkillBadge key={skill} skill={skill} type="gap" />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <MatchEvidence tokens={node.matchedTokens} />

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Research field</p>
              <p className="text-sm leading-6 text-slate-200">{node.field}</p>
            </div>

            <SummarySection
              icon={UserRound}
              title="Faculty"
              items={[
                node.professor ? `Professor: ${node.professor}` : null,
                node.professorMajor ? `Focus: ${node.professorMajor}` : null,
              ].filter(Boolean)}
              accent="text-purple-400"
            />

            <SummarySection
              icon={Sparkles}
              title="Current research"
              items={node.currentResearch}
              accent="text-fuchsia-400"
            />

            <SummarySection
              icon={BookOpen}
              title="Application tips"
              items={node.applicationTips}
              accent="text-indigo-400"
            />
          </>
        )}
      </div>

      <div className="border-t border-slate-800 p-4">
        {node.url ? (
          <a
            href={node.url}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-medium transition-colors"
            style={{
              background: isJob ? 'rgba(29,78,216,0.14)' : 'rgba(109,40,217,0.14)',
              color: isJob ? '#93c5fd' : '#c4b5fd',
              border: `1px solid ${isJob ? 'rgba(59,130,246,0.25)' : 'rgba(139,92,246,0.25)'}`,
            }}
          >
            <ExternalLink size={13} />
            {isJob ? 'Open hiring page' : 'Open lab page'}
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center rounded-xl border border-slate-800 py-3 text-xs text-slate-500"
          >
            No external link available
          </button>
        )}
      </div>
    </div>
  );
}
