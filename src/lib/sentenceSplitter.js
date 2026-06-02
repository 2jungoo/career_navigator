/**
 * 한국어 종결어미를 고려한 문장 분리기.
 * 각 문장의 원본 텍스트 내 offset(charStart, charEnd)을 함께 반환한다.
 */

// 문장 경계 패턴:
// 1. .!?。 뒤에 공백
// 2. 다/요/죠 뒤에 마침표(선택) + 공백/줄바꿈
// 3. 두 개 이상 줄바꿈
const BOUNDARY = /(?<=[.!?。])\s+|(?<=[다요죠]\.?)\s+(?=[가-힣A-Za-z])|\n{2,}/g;

/**
 * @param {string} text
 * @returns {{ id: number, text: string, charStart: number, charEnd: number }[]}
 */
export function splitKoreanSentences(text) {
  const result = [];
  let id = 0;
  let lastIndex = 0;

  for (const match of text.matchAll(BOUNDARY)) {
    const raw = text.slice(lastIndex, match.index);
    const trimmed = raw.trim();
    if (trimmed.length > 5) {
      const offset = raw.indexOf(trimmed);
      result.push({
        id: id++,
        text: trimmed,
        charStart: lastIndex + offset,
        charEnd: lastIndex + offset + trimmed.length,
      });
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining.length > 5) {
    const raw = text.slice(lastIndex);
    const offset = raw.indexOf(remaining);
    result.push({
      id: id++,
      text: remaining,
      charStart: lastIndex + offset,
      charEnd: lastIndex + offset + remaining.length,
    });
  }

  return result;
}
