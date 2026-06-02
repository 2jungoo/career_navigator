import { useState, useCallback, useRef } from 'react';
import { Compass } from 'lucide-react';
import UploadZone from './components/UploadZone';
import AuditPanel from './components/AuditPanel';
import SkillRadar from './components/SkillRadar';
import CareerMindMap from './components/CareerMindMap';
import DetailPanel from './components/DetailPanel';
import Tabs from './components/Tabs';
import DocumentInspector from './components/DocumentInspector';
import EvaluationPanel from './components/EvaluationPanel';
import { analyzeDocument } from './lib/nlpSimulator';
import { scoreLiveSBERT, scoreLiveHead } from './lib/sbertLive';
import './index.css';

const MAIN_TABS = [
  { id: 'mindmap', label: 'Career Mind-Map' },
  { id: 'inspector', label: 'Document Inspector' },
  { id: 'evaluation', label: 'Classifier Test' },
];

export default function App() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [sbertStatus, setSbertStatus] = useState('idle'); // 'idle'|'loading'|'ready'|'fallback'|'head'
  const [classifierMode, setClassifierMode] = useState('cosine'); // 'cosine'|'head'
  const [lastDocumentInput, setLastDocumentInput] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeTab, setActiveTab] = useState('mindmap');
  const analyzeGenRef = useRef(0);

  async function handleAnalyze(documentInput, overrideMode) {
    const mode = overrideMode ?? classifierMode;
    const myGen = ++analyzeGenRef.current;
    setLastDocumentInput(documentInput);
    setIsLoading(true);
    setResult(null);
    setSelectedNode(null);
    setActiveTab('mindmap');

    try {
      setSbertStatus('loading');
      let analyzeOptions = {};

      if (mode === 'head') {
        // 학습 헤드 경로 — 기존 코사인 경로와 완전히 분리
        setLoadingMsg('SBERT 모델 로딩 + 학습 헤드 적용 중…');
        const headScores = await scoreLiveHead(documentInput.text ?? documentInput, (progress) => {
          if (progress?.status === 'progress' && progress.file) {
            const pct = progress.progress != null ? ` ${Math.round(progress.progress)}%` : '';
            setLoadingMsg(`SBERT 로딩: ${progress.file}${pct}`);
          }
        });
        if (myGen !== analyzeGenRef.current) return;
        if (headScores) {
          setSbertStatus('head');
          analyzeOptions = { sbertScores: headScores, scoringMode: 'head-hybrid' };
        } else {
          // 헤드 로드 실패 → 기존 코사인으로 자동 폴백
          const fallbackScores = await scoreLiveSBERT(documentInput.text ?? documentInput);
          if (myGen !== analyzeGenRef.current) return;
          setSbertStatus(fallbackScores ? 'ready' : 'fallback');
          analyzeOptions = { sbertScores: fallbackScores };
        }
      } else {
        // 기존 코사인 경로 — 변경 없음
        setLoadingMsg('SBERT 모델 로딩 중…');
        const sbertScores = await scoreLiveSBERT((documentInput.text ?? documentInput), (progress) => {
          if (progress?.status === 'progress' && progress.file) {
            const pct = progress.progress != null ? ` ${Math.round(progress.progress)}%` : '';
            setLoadingMsg(`SBERT 로딩: ${progress.file}${pct}`);
          }
        });
        if (myGen !== analyzeGenRef.current) return;
        setSbertStatus(sbertScores ? 'ready' : 'fallback');
        analyzeOptions = { sbertScores };
      }

      setLoadingMsg('분석 중…');
      const analysisResult = await analyzeDocument(documentInput, analyzeOptions);
      if (myGen !== analyzeGenRef.current) return; // 더 새로운 분석이 시작됨 → 폐기
      setResult(analysisResult);
    } catch (error) {
      if (myGen !== analyzeGenRef.current) return;
      console.error('[analyze] failed', error);
      throw error;
    } finally {
      if (myGen === analyzeGenRef.current) {
        setIsLoading(false);
        setLoadingMsg('');
      }
    }
  }

  function handleClassifierModeChange(mode) {
    setClassifierMode(mode);
    if (lastDocumentInput) {
      handleAnalyze(lastDocumentInput, mode);
    }
  }

  function handleTabChange(tabId) {
    setActiveTab(tabId);
  }

  const handleSelectNode = useCallback((node) => {
    setSelectedNode((previous) => (previous?.id === node.id ? null : node));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0f1e] text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/40">
            <Compass size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none text-white md:text-base">Career Navigator</h1>
            <p className="mt-1 text-xs text-slate-400">
              Resume analysis, career fit mapping, and lab recommendations
            </p>
          </div>
        </div>

        {result && (
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: `${result.domainColor}20`,
              color: result.domainColor,
              border: `1px solid ${result.domainColor}40`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {result.domainLabel}
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col overflow-hidden xl:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-900/50 xl:h-[calc(100vh-109px)] xl:w-[22rem] xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-800 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-400">Document</p>
            <UploadZone onAnalyze={handleAnalyze} isLoading={isLoading} />
            {isLoading && loadingMsg && (
              <p className="mt-2 text-xs text-blue-400 animate-pulse">{loadingMsg}</p>
            )}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
              <span className="text-xs text-slate-400">분류기</span>
              <div className="flex items-center gap-0.5 rounded-full bg-slate-700/60 p-0.5">
                <button
                  onClick={() => handleClassifierModeChange('cosine')}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                    classifierMode === 'cosine'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  코사인
                </button>
                <button
                  onClick={() => handleClassifierModeChange('head')}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                    classifierMode === 'head'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  학습헤드
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-800 p-4 xl:border-b-0">
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-400">Audit</p>
            <AuditPanel result={result} />
          </div>

          {result && (
            <div className="p-4">
              <SkillRadar data={result.radarData} />
            </div>
          )}
        </aside>

        <main className="relative flex min-h-[36rem] flex-1 flex-col overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 40% 20%, rgba(59,130,246,0.12), transparent 28%), radial-gradient(circle at 78% 78%, rgba(168,85,247,0.1), transparent 24%)',
            }}
          />

          {/* 탭 헤더 */}
          <div className="relative flex items-center border-b border-slate-800 bg-slate-900/60 px-4 py-2 backdrop-blur">
            <Tabs tabs={MAIN_TABS} activeTab={activeTab} onTabChange={handleTabChange} />
          </div>

          {/* 탭 콘텐츠 */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {activeTab === 'mindmap' ? (
              <>
                <div className="grid h-full min-h-[32rem] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem]">
                  <section className="relative min-h-[32rem] overflow-hidden">
                    <CareerMindMap
                      result={result}
                      selectedNode={selectedNode}
                      onSelectNode={handleSelectNode}
                    />
                  </section>

                  <section className="hidden h-full border-l border-slate-800 bg-slate-950/60 xl:block">
                    <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
                  </section>
                </div>

                {selectedNode && (
                  <div className="absolute inset-x-3 bottom-3 top-4 z-20 rounded-2xl border border-slate-800 bg-slate-950/96 shadow-2xl shadow-black/40 xl:hidden">
                    <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
                  </div>
                )}
              </>
            ) : activeTab === 'inspector' ? (
              <DocumentInspector />
            ) : (
              <EvaluationPanel />
            )}
          </div>
        </main>
      </div>

      <footer className="flex flex-col gap-1 border-t border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
        <span className="flex items-center gap-2">
          NLP Final Project 2026
          {sbertStatus === 'ready' && (
            <span className="rounded-full bg-blue-900/60 px-2 py-0.5 text-blue-300 border border-blue-700/50">
              SBERT Live
            </span>
          )}
          {sbertStatus === 'fallback' && (
            <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-amber-300 border border-amber-700/50">
              BoN Fallback
            </span>
          )}
          {sbertStatus === 'loading' && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400 animate-pulse">
              SBERT Loading…
            </span>
          )}
          {sbertStatus === 'head' && (
            <span className="rounded-full bg-purple-900/60 px-2 py-0.5 text-purple-300 border border-purple-700/50">
              Learned Head
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {result ? (
            <>
              <span className="text-emerald-400">Analysis complete</span>
              {result.hasEnoughEvidence ? (
                <span>
                  {result.jobRecommendations.length} roles and {result.labRecommendations.length}{' '}
                  lab recommendations
                </span>
              ) : (
                <span>Not enough career evidence for recommendations</span>
              )}
            </>
          ) : (
            <span>Upload a document to begin analysis.</span>
          )}
        </span>
      </footer>
    </div>
  );
}
