import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const docsDir = path.resolve(__dirname, '../docs');
const inputHtml = path.join(docsDir, 'Chapter_5_6_Report.html');
const outputPdf = path.join(docsDir, 'Chapter_5_6_Report.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`file:///${inputHtml.replace(/\\/g, '/')}`, {
  waitUntil: 'networkidle',
});

await page.pdf({
  path: outputPdf,
  format: 'A4',
  printBackground: true,
  margin: {
    top: '12mm',
    right: '12mm',
    bottom: '12mm',
    left: '12mm',
  },
});

await browser.close();
console.log(`Generated: ${outputPdf}`);
