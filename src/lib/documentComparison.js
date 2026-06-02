import { splitKoreanSentences } from './sentenceSplitter.js';
import {
  buildBagOfNgrams,
  cosineSimilarity,
  scoreText,
  scoreSemanticSimilarity,
  buildHybridScores,
  JOB_CATEGORIES,
} from './nlpSimulator.js';

const TOP_NGRAMS = 15;
const SENTENCE_MATCH_THRESHOLD = 0.25;

/**
 * 두 문서의 공통 n-gram top-N을 반환한다.
 * 공통 교집합 키를 weightA × weightB 기준으로 정렬.
 */
function extractCommonNgrams(vecA, vecB) {
  const seen = new Map();
  vecA.forEach((weightA, key) => {
    const weightB = vecB.get(key);
    if (weightB) {
      const token = key.replace(/^(tok|ng):/, '');
      const score = weightA * weightB;
      if (!seen.has(token) || seen.get(token).score < score) {
        seen.set(token, { token, score });
      }
    }
  });
  return [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_NGRAMS);
}

/**
 * 문서 A의 각 문장에 대해 문서 B에서 가장 유사한 문장을 찾는다.
 * cosine ≥ SENTENCE_MATCH_THRESHOLD인 것만 포함.
 */
function matchSentences(sentencesA, sentencesB) {
  const boNsB = sentencesB.map((s) => buildBagOfNgrams(s.text));

  return sentencesA
    .map((sentA) => {
      const vecA = buildBagOfNgrams(sentA.text);
      let bestSim = 0;
      let bestIdx = -1;
      boNsB.forEach((vecB, i) => {
        const sim = cosineSimilarity(vecA, vecB);
        if (sim > bestSim) {
          bestSim = sim;
          bestIdx = i;
        }
      });

      if (bestSim < SENTENCE_MATCH_THRESHOLD) return null;
      return {
        textA: sentA.text,
        textB: sentencesB[bestIdx].text,
        similarity: Math.round(bestSim * 100) / 100,
      };
    })
    .filter(Boolean);
}

/**
 * 두 문서의 12개 도메인 점수를 비교한다.
 * hybrid score (keyword 45% + BoN cosine 55%) 기준.
 */
function buildDomainComparison(textA, textB) {
  const kwA = scoreText(textA);
  const kwB = scoreText(textB);
  const semA = scoreSemanticSimilarity(textA);
  const semB = scoreSemanticSimilarity(textB);
  const hybA = buildHybridScores(kwA, semA);
  const hybB = buildHybridScores(kwB, semB);

  return Object.keys(hybA)
    .filter((domain) => domain !== 'insufficient')
    .map((domain) => ({
      domain,
      label: JOB_CATEGORIES[domain]?.label ?? domain,
      color: JOB_CATEGORIES[domain]?.color ?? '#3b82f6',
      scoreA: hybA[domain] ?? 0,
      scoreB: hybB[domain] ?? 0,
    }))
    .sort((a, b) => Math.max(b.scoreA, b.scoreB) - Math.max(a.scoreA, a.scoreB));
}

/**
 * 두 문서를 BoN cosine 기반으로 비교한다.
 * @param {string} textA
 * @param {string} textB
 * @returns {{ overallSimilarity, commonNgrams, sentenceMatches, domainComparison }}
 */
export function compareDocuments(textA, textB) {
  const vecA = buildBagOfNgrams(textA);
  const vecB = buildBagOfNgrams(textB);

  const overallSimilarity = Math.round(cosineSimilarity(vecA, vecB) * 100) / 100;
  const commonNgrams = extractCommonNgrams(vecA, vecB);

  const sentencesA = splitKoreanSentences(textA);
  const sentencesB = splitKoreanSentences(textB);
  const sentenceMatches = matchSentences(sentencesA, sentencesB);

  const domainComparison = buildDomainComparison(textA, textB);

  return { overallSimilarity, commonNgrams, sentenceMatches, domainComparison };
}
