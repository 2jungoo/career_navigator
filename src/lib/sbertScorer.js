/**
 * SBERT 기반 도메인 유사도 스코어러 (사전 계산 경로).
 *
 * precompute_embeddings.py가 생성한 public/data/embeddings.json에서
 * 평가셋/PDF 항목의 사전계산 임베딩을 가져와 16개 도메인 프로파일과의
 * 코사인 유사도를 계산한다.
 *
 * 라이브 업로드(사전계산 키 없음)는 지원하지 않으며 null을 반환한다.
 * 라이브 업로드 문서는 sbertLive.js(Transformers.js)가 처리하며, 이 파일은 평가셋 전용이다.
 */

import { getProfileVector, getEvalVector, getPdfVector, cosine } from './embeddingStore.js';
import { applyHead } from './classifierHead.js';

const DOMAINS = [
  'engineering', 'data', 'planning', 'research', 'management',
  'public_admin', 'economics', 'business', 'nursing_health',
  'natural_science', 'humanities', 'arts_design',
  'manufacturing', 'energy_plant', 'aerospace', 'media_content',
];

/**
 * 사전계산 임베딩 키로 SBERT 코사인 유사도 맵을 반환한다.
 *
 * @param {{ evalId?: string, pdfId?: string }} keys
 *   evalId: 'eng-1' 같은 평가셋 id (eval.<id> 키로 검색)
 *   pdfId : PDF 자소서의 safeId
 * @returns {Promise<Record<string, number> | null>}
 *   도메인 → 유사도 맵. 키가 없거나 임베딩 로드 실패 시 null 반환.
 */
/**
 * 사전계산 임베딩에 학습된 분류 헤드를 적용한다.
 * 기존 scoreSBERT(코사인)는 그대로 유지되며 이 함수는 별개의 추가 경로다.
 *
 * @param {{ evalId?: string, pdfId?: string }} keys
 * @returns {Promise<Record<string, number> | null>}
 */
export async function scoreHeadPrecomputed(keys = {}) {
  let docVec = null;
  if (keys.evalId) docVec = await getEvalVector(keys.evalId);
  else if (keys.pdfId) docVec = await getPdfVector(keys.pdfId);
  if (!docVec) return null;
  return await applyHead(docVec);
}

export async function scoreSBERT(keys = {}) {
  let docVec = null;

  if (keys.evalId) {
    docVec = await getEvalVector(keys.evalId);
  } else if (keys.pdfId) {
    docVec = await getPdfVector(keys.pdfId);
  }

  if (!docVec) return null; // 사전계산 없음 → 호출자에서 BoN 폴백

  const results = {};
  for (const domain of DOMAINS) {
    const profileVec = await getProfileVector(domain);
    results[domain] = profileVec ? cosine(docVec, profileVec) : 0;
  }
  return results;
}
