/**
 * evaluationDataset.js(단일 출처) → evaluation_dataset.json 동기화 스크립트.
 *
 * 평가셋은 src/lib/evaluationDataset.js 한 곳에서만 관리한다.
 * JS는 앱(브라우저)이 직접 import하고, JSON은 Python(precompute_embeddings.py,
 * train_classifier_head.py)이 읽는다. 두 파일이 어긋나면 앱과 학습이 다른
 * 데이터를 보게 되므로, 이 스크립트로 JS → JSON을 자동 생성한다.
 *
 * 실행: node scripts/exportEvalDataset.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EVALUATION_DATASET } from '../src/lib/evaluationDataset.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'src', 'data', 'evaluation_dataset.json');

// id/label/source/text 순서 고정 (기존 JSON 포맷과 동일)
const rows = EVALUATION_DATASET.map(({ id, label, source, text }) => ({
  id,
  label,
  source,
  text,
}));

writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n', 'utf-8');

const byLabel = {};
for (const r of rows) byLabel[r.label] = (byLabel[r.label] || 0) + 1;
console.log(`evaluation_dataset.json 생성: ${rows.length}개`);
console.log('도메인별 분포:');
for (const [k, v] of Object.entries(byLabel).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(2)}  ${k}`);
}
