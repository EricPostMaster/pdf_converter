import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'child_process';
import util from 'util';
const execFileP = util.promisify(execFile);
import tesseractAdapter from './tesseractAdapter';
import imagePreprocess, { PreprocessOptions } from './imagePreprocess';

export interface ProcessOptions {
  lang?: string;
  tmpRoot?: string;
  dpi?: number;
  preprocess?: boolean;
  preprocessOptions?: PreprocessOptions;
}

export async function processPdf(pdfPath: string, opts: ProcessOptions = {}): Promise<{ txtPath: string }>{
  const lang = opts.lang || 'eng';
  const tmpRoot = opts.tmpRoot || path.join(process.cwd(), 'work');
  const dpi = opts.dpi || 300;
  const doPreprocess = opts.preprocess !== false;

  await fs.ensureDir(tmpRoot);
  const jobId = `${Date.now()}-${Math.floor(Math.random()*10000)}`;
  const imgDir = path.join(tmpRoot, `${jobId}-pages`);
  await fs.ensureDir(imgDir);

  // 1) Rasterize PDF -> PNG pages using pdftoppm (poppler) at requested DPI
  await execFileP('pdftoppm', ['-r', String(dpi), pdfPath, path.join(imgDir, 'page'), '-png']);

  // 2) Read generated images
  const files = (await fs.readdir(imgDir)).filter(f => f.toLowerCase().endsWith('.png')).sort();
  let fullText = '';

  for (const file of files) {
    const imgPath = path.join(imgDir, file);

    // 3) Optional preprocessing via ImageMagick (with sharp fallback)
    let toOcrPath = imgPath;
    if (doPreprocess) {
      const processed = path.join(imgDir, `proc-${file}`);
      try {
        await imagePreprocess.preprocessImage(imgPath, processed, opts.preprocessOptions || { dpi, deskew: true, adaptiveThreshold: true });
        toOcrPath = processed;
      } catch (e) {
        toOcrPath = imgPath;
      }
    }

    // 4) OCR the (possibly preprocessed) image
    const pageText = await tesseractAdapter.recognizeImage(toOcrPath, lang, { psm: 3, oem: 1, configVars: { user_defined_dpi: String(dpi) } });
    fullText += pageText + '\n\n';

    // cleanup processed image if created
    if (toOcrPath !== imgPath) {
      await fs.remove(toOcrPath).catch(() => {});
    }
  }

  // 5) Write output text
  const outputDir = path.join(process.cwd(), 'output');
  await fs.ensureDir(outputDir);
  const safeName = `${path.basename(pdfPath)}.txt`;
  const txtPath = path.join(outputDir, safeName);
  await fs.writeFile(txtPath, fullText, 'utf8');

  // 6) Cleanup images directory
  await fs.remove(imgDir).catch(() => {});

  return { txtPath };
}

export default { processPdf };
