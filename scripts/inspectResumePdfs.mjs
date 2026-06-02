import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';
import { analyzeDocument } from '../src/lib/nlpSimulator.js';

const labelRules = [
  [/IBK|SDS|삼성전자|현대자동차|LG전자/, 'engineering'],
  [/경영대학원/, 'business'],
  [/정치학과|교육대학원|영어영문학과/, 'humanities'],
  [/행정대학원/, 'public_admin'],
  [/자연과학대학원/, 'natural_science'],
  [/간호대학원/, 'nursing_health'],
];

function expectedLabel(name) {
  return labelRules.find(([regex]) => regex.test(name))?.[1] ?? 'insufficient';
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
  .readdirSync('.', { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.includes('소서'))?.name;

if (!resumeDir) {
  throw new Error('Cannot find resume PDF folder.');
}

const rows = [];
for (const name of fs.readdirSync(resumeDir).filter((file) => file.endsWith('.pdf')).sort()) {
  const text = await extractPdfText(path.join(resumeDir, name));
  const result = await analyzeDocument(text, { skipDelay: true });
  const label = expectedLabel(name);

  rows.push({
    name,
    label,
    predicted: result.primaryDomain,
    correct: label === result.primaryDomain,
    chars: text.length,
    evidence: result.domainEvidence.slice(0, 5),
    keywords: result.keywords.slice(0, 8),
  });
}

console.log(JSON.stringify(rows, null, 2));
