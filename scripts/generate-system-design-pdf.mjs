import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const docsDir = path.resolve(__dirname, '../docs');
const inputHtml = path.join(docsDir, 'System_Design_Document.html');
const outputPdf = path.join(docsDir, 'System_Design_Document.pdf');

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
    top: '10mm',
    right: '10mm',
    bottom: '10mm',
    left: '10mm',
  },
});

await browser.close();
console.log(`Generated: ${outputPdf}`);
