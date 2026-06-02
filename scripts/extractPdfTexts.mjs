/**
 * PDF 텍스트 추출 스크립트.
 * 자소서/ 폴더의 PDF 12개를 파싱해 public/data/pdf_corpus.json으로 저장.
 * 실행: node scripts/extractPdfTexts.mjs
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const labelRules = [
  // 대학원 (직무보다 먼저 매칭)
  [/간호대학원|간호직/, 'nursing_health'],
  [/경영대학원/, 'business'],
  [/정치학과|교육대학원|영어영문학과/, 'humanities'],
  [/행정대학원|문체부/, 'public_admin'],
  [/자연과학대학원|화학융합/, 'natural_science'],
  // 신규: 항공·우주
  [/대한항공.*항공기술|항공기술.*대한항공|KTsat|위성운영/, 'aerospace'],
  // 신규: 에너지·발전
  [/한전KPS|한국전력공사.*화학엔지니어|전기·전자엔지니어.*한전/, 'energy_plant'],
  // 신규: 제조·생산
  [/HD현대.*생산직무|생산직무.*HD현대/, 'manufacturing'],
  [/SK하이닉스.*품질관리|품질관리.*SK하이닉스/, 'manufacturing'],
  [/삼성디스플레이.*연구개발|연구개발.*삼성디스플레이/, 'manufacturing'],
  [/LG전자.*생산기술원|생산기술원.*LG전자/, 'manufacturing'],
  // 신규: 미디어·콘텐츠
  [/중앙일보/, 'media_content'],
  // IT / 소프트웨어
  [/IBK|SDS|마이다스아이티|전력거래소|웹개발|앱개발|효성티엔에스/, 'engineering'],
  [/삼성전자|현대자동차|LG전자/, 'engineering'],
  [/IT 보안|IT 컨설팅|IT/, 'engineering'],
  // 경영 / 비즈니스
  [/한화에스테이트|경영·비즈니스|인사담당자|대웅제약/, 'business'],
  // 의료
  [/중앙대학병원/, 'nursing_health'],
];

function expectedLabel(name) {
  return labelRules.find(([regex]) => regex.test(name))?.[1] ?? 'insufficient';
}

function safeId(name) {
  return name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
}

async function extractPdfText(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  const pdf = await getDocument({ data, disableWorker: true }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }

  return pages.join('\n').replace(/\s+/g, ' ').trim();
}

const resumeDir = fs
  .readdirSync(rootDir, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.includes('소서'))?.name;

if (!resumeDir) {
  throw new Error('자소서/ 폴더를 찾을 수 없습니다.');
}

const results = [];
const pdfFiles = fs.readdirSync(path.join(rootDir, resumeDir))
  .filter((file) => file.endsWith('.pdf'))
  .sort();

console.log(`PDF ${pdfFiles.length}개 추출 중...`);

for (const name of pdfFiles) {
  const text = await extractPdfText(path.join(rootDir, resumeDir, name));
  const label = expectedLabel(name);
  const id = safeId(name);

  results.push({ id, name, label, text, chars: text.length });
  console.log(`  [OK] ${name} → ${label} (${text.length}자)`);
}

const outPath = path.join(rootDir, 'public', 'data', 'pdf_corpus.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
console.log(`\n저장 완료: ${outPath} (${results.length}건)`);
