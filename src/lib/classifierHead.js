/**
 * 학습된 분류 헤드 — frozen SBERT 임베딩 위의 Logistic Regression 레이어.
 *
 * train_classifier_head.py 가 생성한 public/data/classifier_head.json을 로드해
 * 384-d 벡터에 W·x + b → softmax를 적용, 도메인→확률 맵을 반환한다.
 *
 * 기존 코사인 분류기(sbertScorer.js / sbertLive.js)는 이 파일과 독립이며 변경되지 않는다.
 */

let _head = null; // null = 미로드

async function ensureHead() {
  if (_head !== null) return;
  _head = {};
  try {
    let json;
    if (typeof window === 'undefined') {
      const { readFileSync } = await import('fs');
      const { resolve, join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const filePath = resolve(join(__dirname, '../../public/data/classifier_head.json'));
      json = JSON.parse(readFileSync(filePath, 'utf-8'));
    } else {
      const res = await fetch('/data/classifier_head.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    }
    _head = {
      domains: json.domains,
      W: json.W.map((row) => new Float32Array(row)), // [16][384]
      b: new Float32Array(json.b),                   // [16]
      mean: json.mean ? new Float32Array(json.mean) : null,
      std:  json.std  ? new Float32Array(json.std)  : null,
      loocvAccuracy: json.loocv_accuracy ?? null,
      loocvMacroF1:  json.loocv_macroF1  ?? null,
    };
  } catch (err) {
    console.warn('[classifierHead] 로드 실패 — 헤드 비활성화:', err.message);
    _head = { failed: true };
  }
}

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  return exps.map((v) => v / sum);
}

/**
 * 384-d Float32Array를 입력받아 도메인→확률 맵을 반환한다.
 * 헤드 로드 실패 시 null 반환 → 호출부에서 코사인 폴백.
 *
 * @param {Float32Array} vec384
 * @returns {Promise<Record<string, number> | null>}
 */
export async function applyHead(vec384) {
  await ensureHead();
  if (!_head || _head.failed || !_head.W) return null;

  const { domains, W, b, mean, std } = _head;

  // 옵션 표준화 (학습 시 표준화를 했다면)
  let x = vec384;
  if (mean && std) {
    x = new Float32Array(vec384.length);
    for (let i = 0; i < vec384.length; i++) {
      x[i] = (vec384[i] - mean[i]) / (std[i] + 1e-8);
    }
  }

  // W·x + b
  const logits = W.map((row, i) => {
    let dot = b[i];
    for (let j = 0; j < row.length; j++) dot += row[j] * x[j];
    return dot;
  });

  const probs = softmax(logits);
  return Object.fromEntries(domains.map((domain, i) => [domain, probs[i]]));
}

/** 헤드 로드 성공 여부 확인 */
export async function isHeadReady() {
  await ensureHead();
  return _head !== null && !_head.failed;
}

/** LOOCV 성능 수치 반환 (UI 표시용) */
export async function getHeadMetrics() {
  await ensureHead();
  if (!_head || _head.failed) return null;
  return { accuracy: _head.loocvAccuracy, macroF1: _head.loocvMacroF1 };
}
