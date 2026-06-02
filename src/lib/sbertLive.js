/**
 * 브라우저 사이드 실시간 SBERT 추론 (Transformers.js).
 *
 * 모델: Xenova/paraphrase-multilingual-MiniLM-L12-v2
 *   - paraphrase-multilingual-MiniLM-L12-v2의 ONNX 양자화 포트 (~40MB).
 *   - mean pooling + L2 normalize → 384-d 벡터.
 *   - scripts/precompute_embeddings.py와 동일 모델·설정 → 코사인 비교 호환.
 *
 * 사용 흐름:
 *   1. 첫 호출 시 HF CDN에서 모델 가중치 다운로드 (이후 브라우저 캐시).
 *   2. scoreLiveSBERT(text) → 도메인→유사도 맵.
 *   3. 실패 시 null 반환 → 호출부(App.jsx)에서 BoN 폴백.
 */

import { pipeline } from '@huggingface/transformers';
import { getProfileVector, cosine } from './embeddingStore.js';
import { applyHead } from './classifierHead.js';

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

// 사전계산 스크립트와 동일한 도메인 순서
const DOMAINS = [
  'engineering', 'data', 'planning', 'research', 'management',
  'public_admin', 'economics', 'business', 'nursing_health',
  'natural_science', 'humanities', 'arts_design',
  'manufacturing', 'energy_plant', 'aerospace', 'media_content',
];

// 사전계산 스크립트(precompute_embeddings.py:99)와 동일한 최대 길이
const MAX_CHARS = 1500;

let _pipelinePromise = null;

function getPipeline(progressCallback) {
  if (_pipelinePromise) return _pipelinePromise;
  _pipelinePromise = pipeline('feature-extraction', MODEL_ID, {
    dtype: 'q8',       // 8-bit 양자화 (~40MB)
    progress_callback: progressCallback ?? null,
  }).catch((err) => {
    _pipelinePromise = null; // 다음 호출에서 재시도 가능
    throw err;
  });
  return _pipelinePromise;
}

/**
 * 텍스트를 384-d Float32Array로 임베딩한다 (mean pool + L2 normalize).
 * @param {string} text
 * @param {Function} [progressCallback]
 * @returns {Promise<Float32Array>}
 */
export async function embedText(text, progressCallback) {
  const pipe = await getPipeline(progressCallback);
  const truncated = (text ?? '').slice(0, MAX_CHARS);

  // pooling: 'mean', normalize: true → precompute_embeddings.py의
  // normalize_embeddings=True (default mean pool) 와 동일
  const output = await pipe(truncated, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data);
}

/**
 * 업로드된 텍스트를 실시간 SBERT로 인코딩하고
 * 16개 도메인 프로파일 벡터와의 코사인 유사도를 반환한다.
 *
 * @param {string} text
 * @param {Function} [progressCallback] - 모델 로딩 진행률 콜백
 * @returns {Promise<Record<string, number> | null>}
 *   도메인→유사도 맵. 실패 시 null (BoN 폴백 신호).
 */
export async function scoreLiveSBERT(text, progressCallback) {
  try {
    const docVec = await embedText(text, progressCallback);
    const scores = {};
    for (const domain of DOMAINS) {
      const profileVec = await getProfileVector(domain);
      scores[domain] = profileVec ? cosine(docVec, profileVec) : 0;
    }
    return scores;
  } catch (err) {
    console.warn('[sbertLive] 실시간 SBERT 실패 — BoN 폴백:', err.message);
    return null;
  }
}

/** 모델 로딩 상태 확인용 */
export function isSbertLiveReady() {
  return _pipelinePromise !== null;
}

/**
 * 라이브 SBERT 임베딩에 학습된 분류 헤드를 적용한다.
 * 기존 scoreLiveSBERT(코사인)는 그대로 유지되며 이 함수는 별개의 추가 경로다.
 *
 * @param {string} text
 * @param {Function} [progressCallback]
 * @returns {Promise<Record<string, number> | null>}
 *   도메인→확률 맵. 실패 시 null (코사인 폴백 신호).
 */
export async function scoreLiveHead(text, progressCallback) {
  try {
    const docVec = await embedText(text, progressCallback);
    return await applyHead(docVec);
  } catch (err) {
    console.warn('[sbertLive] 라이브 헤드 실패 — 코사인 폴백:', err.message);
    return null;
  }
}
