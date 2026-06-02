import { useCallback, useState } from 'react';
import { FileText, GitCompare, Loader2, Upload, X } from 'lucide-react';
import { extractPdfText } from '../lib/pdfExtract';
import { compareDocuments } from '../lib/documentComparison';
import SimilarityPanel from './SimilarityPanel';

const ACCEPTED = ['.pdf', '.txt', '.md'];

async function readFileText(file) {
  if (file.type === 'application/pdf') return extractPdfText(file);
  return file.text();
}

function FileSlot({ label, doc, onFile, onClear }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const handle = useCallback(
    async (file) => {
      setError('');
      const lower = file.name.toLowerCase();
      if (!ACCEPTED.some((ext) => lower.endsWith(ext))) {
        setError('PDF, TXT, MD 파일만 지원합니다.');
        return;
      }
      try {
        const text = await readFileText(file);
        onFile({ name: file.name, text });
      } catch (err) {
        setError(err?.message ?? '파일을 읽을 수 없습니다.');
      }
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handle(file);
    },
    [handle]
  );

  if (doc) {
    return (
      <div className="flex flex-1 flex-col gap-1.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-800/60 p-3">
          <FileText size={16} className="shrink-0 text-blue-400" />
          <span className="flex-1 truncate text-sm text-slate-200" title={doc.name}>{doc.name}</span>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-full p-0.5 text-slate-500 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          'flex h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 text-center transition-all',
          dragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-slate-700 bg-slate-800/40 hover:border-blue-500/50 hover:bg-slate-800',
        ].join(' ')}
      >
        <input
          type="file"
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={(e) => { const f = e.target.files[0]; if (f) handle(f); }}
        />
        <Upload size={18} className="text-slate-500 mb-1" />
        <span className="text-xs text-slate-400">드롭 또는 클릭</span>
      </label>
      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}
    </div>
  );
}

export default function DocumentInspector() {
  const [docA, setDocA] = useState(null);
  const [docB, setDocB] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCompare = useCallback(async (a, b) => {
    setError('');
    if (a.text.trim().length < 50 || b.text.trim().length < 50) {
      setError('비교하기에 본문이 너무 짧습니다 (50자 이상 필요).');
      return;
    }
    setLoading(true);
    setComparison(null);
    try {
      const result = compareDocuments(a.text, b.text);
      setComparison(result);
    } catch (err) {
      setError(err?.message ?? '비교 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileA = useCallback((doc) => {
    setDocA(doc);
    setComparison(null);
    setError('');
  }, []);

  const handleFileB = useCallback((doc) => {
    setDocB(doc);
    setComparison(null);
    setError('');
  }, []);

  const handleClearA = useCallback(() => { setDocA(null); setComparison(null); setError(''); }, []);
  const handleClearB = useCallback(() => { setDocB(null); setComparison(null); setError(''); }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 업로드 헤더 */}
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FileSlot label="문서 A" doc={docA} onFile={handleFileA} onClear={handleClearA} />
          <div className="flex shrink-0 items-center justify-center pb-1 text-slate-600 sm:pb-2">
            <GitCompare size={16} />
          </div>
          <FileSlot label="문서 B" doc={docB} onFile={handleFileB} onClear={handleClearB} />
          <button
            type="button"
            disabled={!docA || !docB || loading}
            onClick={() => handleCompare(docA, docB)}
            className="shrink-0 self-end rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 sm:mb-0"
          >
            {loading ? '분석 중...' : '유사도 분석'}
          </button>
        </div>
      </div>

      {/* 결과 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              두 문서를 비교하는 중...
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full items-center justify-center">
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          </div>
        )}

        {!loading && !error && comparison && (
          <div className="mx-auto max-w-2xl">
            <SimilarityPanel
              comparison={comparison}
              nameA={docA?.name ?? '문서 A'}
              nameB={docB?.name ?? '문서 B'}
            />
          </div>
        )}

        {!loading && !error && !comparison && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-40">
            <GitCompare size={32} className="text-slate-500" />
            <p className="text-sm text-slate-500">
              두 자소서를 업로드하고 "유사도 분석" 버튼을 누르세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
