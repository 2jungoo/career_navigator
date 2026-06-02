import { useCallback, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { extractPdfText } from '../lib/pdfExtract';

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md'];

export default function UploadZone({ onAnalyze, isLoading }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const extractText = useCallback(async (file) => {
    if (file.type === 'application/pdf') {
      return extractPdfText(file);
    }

    return file.text();
  }, []);

  const handleFile = useCallback(
    async (file) => {
      setErrorMessage('');
      const lower = file.name.toLowerCase();
      const ok = ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));

      if (!ok) {
        setErrorMessage('지원하지 않는 파일 형식입니다. PDF, TXT, MD만 업로드 가능합니다.');
        setFileName('');
        return;
      }

      try {
        setFileName(file.name);
        const text = await extractText(file);

        await onAnalyze({
          text,
          meta: {
            sourceType: 'uploaded',
            title: file.name,
            fileName: file.name,
            uploadedAt: new Date().toLocaleString('ko-KR'),
          },
        });
      } catch (error) {
        setErrorMessage(error?.message || '분석에 실패했습니다.');
        setFileName('');
      }
    },
    [extractText, onAnalyze]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const onInputChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="w-full">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'relative flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 text-center transition-all duration-200',
          dragOver
            ? 'scale-[1.01] border-blue-400 bg-blue-500/10'
            : 'border-slate-700 bg-slate-800/50 hover:border-blue-500/60 hover:bg-slate-800',
        ].join(' ')}
      >
        <input
          type="file"
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={onInputChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-blue-400" />
            <span className="text-sm text-slate-300">Analyzing document...</span>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-2">
            <FileText size={28} className="text-blue-400" />
            <span className="break-all text-sm font-medium text-slate-200">{fileName}</span>
            <span className="text-xs text-slate-500">Choose another file to replace the current analysis.</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} className="text-slate-500" />
            <span className="text-sm text-slate-300">Drop a CV, portfolio, or statement here.</span>
            <span className="text-xs text-slate-500">Supported formats: PDF, TXT, MD</span>
          </div>
        )}
      </label>

      {errorMessage && (
        <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
