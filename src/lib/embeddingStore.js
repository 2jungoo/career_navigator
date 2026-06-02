/**
 * SBERT 임베딩 저장소.
 * public/data/embeddings.json (precompute_embeddings.py 출력)을 lazy-fetch해 캐싱.
 *
 * 사용 예:
 *   import { getProfileVector, getEvalVector, cosine } from './embeddingStore.js';
 *   const v = await getProfileVector('engineering');  // Float32Array | null
 */

let _store = null; // null = 미로드, {} = 로드 완료 or 실패

async function ensureLoaded() {
  if (_store !== null) return;
  _store = {};
  try {
    let json;
    // Node.js 환경 (CLI 평가 스크립트)에서는 fs로 파일 직접 로드 (window 없음)
    if (typeof window === 'undefined') {
      const { readFileSync } = await import('fs');
      const { resolve, join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const filePath = resolve(join(__dirname, '../../public/data/embeddings.json'));
      json = JSON.parse(readFileSync(filePath, 'utf-8'));
    } else {
      const res = await fetch('/data/embeddings.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    }
    // Float32Array로 변환해 저장 (메모리 절약 + TypedArray 연산 속도)
    for (const [key, arr] of Object.entries(json.vectors ?? {})) {
      _store[key] = new Float32Array(arr);
    }
    _store.__dim = json.dim ?? 384;
    _store.__model = json.model ?? 'unknown';
  } catch (err) {
    console.warn('[embeddingStore] 로드 실패 — SBERT 경로 비활성화:', err.message);
    _store = {}; // 빈 객체로 두면 이후 getXxx 호출이 null 반환
  }
}

/** @returns {Promise<Float32Array | null>} */
export async function getProfileVector(domain) {
  await ensureLoaded();
  return _store[`profile.${domain}`] ?? null;
}

/** @returns {Promise<Float32Array | null>} */
export async function getEvalVector(id) {
  await ensureLoaded();
  return _store[`eval.${id}`] ?? null;
}

/** @returns {Promise<Float32Array | null>} */
export async function getPdfVector(safeId) {
  await ensureLoaded();
  return _store[`pdf.${safeId}`] ?? null;
}

/** 두 Float32Array 간 코사인 유사도 (정규화된 벡터는 단순 내적) */
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-9 ? 0 : dot / denom;
}

/** 로드된 임베딩의 모델명과 차원을 반환 (디버깅용) */
export async function getMetadata() {
  await ensureLoaded();
  return { model: _store.__model ?? null, dim: _store.__dim ?? null };
}
