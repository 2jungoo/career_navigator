import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractPdfText(file) {
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: buffer }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text) {
        pages.push(text);
      }
    }

    const result = pages.join('\n\n');

    if (!result) {
      throw new Error('PDF 텍스트를 추출할 수 없습니다. 손상되었거나 이미지 기반 PDF일 수 있습니다.');
    }

    return result;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('PDF 텍스트를 추출할 수 없습니다. 손상되었거나 이미지 기반 PDF일 수 있습니다.');
  }
}
