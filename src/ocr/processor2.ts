import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'child_process';
import util from 'util';
const execFileP = util.promisify(execFile);
import tesseractAdapter from './tesseractAdapter';
import imagePreprocess, { PreprocessOptions } from './imagePreprocess';
import pLimit from 'p-limit';

export interface ProcessOptions {
  lang?: string;
  tmpRoot?: string;
  dpi?: number;
  preprocess?: boolean;
  preprocessOptions?: PreprocessOptions;
  concurrency?: number;
  writePerPage?: boolean;
  keepTemp?: boolean;
}

export async function processPdf(pdfPath: string, opts: ProcessOptions = {}): Promise<{ txtPath: string }> {
  const lang = opts.lang || 'eng';
  const tmpRoot = opts.tmpRoot || path.join(process.cwd(), 'work');

  await fs.ensureDir(tmpRoot);
  const jobId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const imgDir = path.join(tmpRoot, `${jobId}-pages`);
  await fs.ensureDir(imgDir);

  // 1) Rasterize PDF -> PNG pages using pdftoppm (poppler)
  const dpi = opts.dpi || 300;
  await execFileP('pdftoppm', ['-r', String(dpi), pdfPath, path.join(imgDir, 'page'), '-png']);

  // 2) Read generated images and sort by numeric page index
  const files = (await fs.readdir(imgDir)).filter((f: string) => f.toLowerCase().endsWith('.png'));
  function extractIndex(filename: string): number {
    const m = filename.match(/(\d+)(?=\.png$)/i);
    if (m) return parseInt(m[1], 10);
    return Number.POSITIVE_INFINITY;
  }
  const pageFiles = files.map(f => ({ name: f, idx: extractIndex(f) })).sort((a, b) => a.idx - b.idx || a.name.localeCompare(b.name));

  // concurrency limiter
  const concurrency = opts.concurrency && opts.concurrency > 0 ? opts.concurrency : 2;
  const limit = pLimit(concurrency);

  const outputDir = path.join(process.cwd(), 'output');
  await fs.ensureDir(outputDir);

  const baseName = path.basename(pdfPath, path.extname(pdfPath));

  async function processSinglePage(fileName: string, index: number): Promise<{ index: number; text: string }> {
    const imgPath = path.join(imgDir, fileName);
    let toOcrPath = imgPath;
    const processedPath = path.join(imgDir, `proc-${fileName}`);
    try {
      if (opts.preprocess !== false) {
        try {
          await imagePreprocess.preprocessImage(imgPath, processedPath, opts.preprocessOptions || { dpi, deskew: true, adaptiveThreshold: true });
          toOcrPath = processedPath;
        } catch (e) {
          toOcrPath = imgPath;
        }
      }

      const pageText = await tesseractAdapter.recognizeImage(toOcrPath, lang, { psm: 3, oem: 1, configVars: { user_defined_dpi: String(dpi) } });

      if (opts.writePerPage) {
        const perPagePath = path.join(outputDir, `${baseName}-page-${index + 1}.txt`);
        await fs.writeFile(perPagePath, pageText, 'utf8').catch(() => {});
      }

      return { index, text: pageText };
    } catch (err) {
      // Log and return empty text for this page
      console.error(`OCR failed for ${imgPath}:`, err);
      return { index, text: `` };
    } finally {
      // cleanup processed image if it was created (skip when keepTemp is true)
      if (toOcrPath !== imgPath && !opts.keepTemp) {
        await fs.remove(toOcrPath).catch(() => {});
      }
    }
  }

  // schedule tasks with concurrency limit
  const tasks = pageFiles.map((p, i) => limit(() => processSinglePage(p.name, i)));
  const results = await Promise.all(tasks);

  // order results by original index and concatenate
  results.sort((a, b) => a.index - b.index);
  const fullText = results.map(r => r.text).join('\n\n');

  // 5) Write output text
  const safeName = `${baseName}.txt`;
  const txtPath = path.join(outputDir, safeName);
  await fs.writeFile(txtPath, fullText, 'utf8');

  // 6) Cleanup images directory (skip when keepTemp is true)
  if (!opts.keepTemp) {
    await fs.remove(imgDir).catch(() => {});
  }

  return { txtPath };
}

export default { processPdf };
