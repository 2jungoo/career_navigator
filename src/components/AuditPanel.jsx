import { FileSearch, ShieldCheck, Tag } from 'lucide-react';

function KeywordTags({ keywords }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Tag size={12} className="text-blue-400" />
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Keywords</span>
      </div>
      {keywords.length === 0 ? (
        <p className="text-xs text-slate-500">매칭된 키워드가 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((keyword, index) => (
            <span
              key={`${keyword}-${index}`}
              className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DomainEvidence({ evidence }) {
  if (!evidence?.length) {
    return (
      <p className="text-xs leading-5 text-slate-500">
        분류에 사용할 직무 키워드가 충분하지 않습니다. 자기소개서, CV, 포트폴리오에서 수행 업무와 기술명을 더 구체적으로 넣어보세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Classification evidence</span>
      <div className="flex flex-col gap-1.5">
        {evidence.map((item) => (
          <div key={item.keyword} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-slate-300" title={item.keyword}>{item.keyword}</span>
            <span className="shrink-0 rounded-full bg-slate-700/70 px-2 py-0.5 font-mono text-slate-300">
              {item.count}x · w{item.weight}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadedDocumentMeta({ meta }) {
  if (meta?.sourceType !== 'uploaded') {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4">
      <div className="flex items-center gap-2">
        <FileSearch size={14} className="text-slate-300" />
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Document</p>
          <p className="text-sm font-semibold text-white">{meta.fileName ?? meta.title}</p>
        </div>
      </div>
      {meta.uploadedAt && <p className="mt-2 text-xs text-slate-500">Uploaded at: {meta.uploadedAt}</p>}
    </div>
  );
}

export default function AuditPanel({ result }) {
  if (!result) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center opacity-40">
        <ShieldCheck size={32} className="text-slate-500" />
        <p className="text-sm text-slate-500">
          Upload a document to see the audit summary here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Primary domain</span>
        <div
          className="mt-2 rounded-xl px-3 py-2 text-center text-sm font-semibold"
          style={{
            background: `${result.domainColor}25`,
            color: result.domainColor,
            border: `1px solid ${result.domainColor}40`,
          }}
        >
          {result.domainLabel}
        </div>
        {!result.hasEnoughEvidence && (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            키워드 근거가 부족해 직무 추천을 보류했습니다.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
        <DomainEvidence evidence={result.domainEvidence} />
      </div>

      <UploadedDocumentMeta meta={result.documentMeta} />

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
        <KeywordTags keywords={result.keywords} />
      </div>
    </div>
  );
}
