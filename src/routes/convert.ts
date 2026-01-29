import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import jobManager from '../ocr/jobManager';
import { execFile } from 'child_process';
import util from 'util';
import imagePreprocess from '../ocr/imagePreprocess';
const execFileP = util.promisify(execFile);

const router = express.Router();

const uploadsDir = path.join(process.cwd(), 'uploads');
fs.ensureDirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

// POST /convert/preview -> upload PDF and return base64 previews of first pages
router.post('/preview', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field: pdf)' });

  const pdfPath = req.file.path;
  const pages = Math.min(3, Number(req.body.pages) || 1);
  const dpi = Number(req.body.dpi) || 150;

  const preprocessOptions: any = {
    dpi,
    contrastStretch: req.body.contrastStretch === 'true' || req.body.contrastStretch === '1',
    contrastLowPercent: req.body.contrastLowPercent ? Number(req.body.contrastLowPercent) : undefined,
    contrastHighPercent: req.body.contrastHighPercent ? Number(req.body.contrastHighPercent) : undefined,
    thresholdPercent: req.body.thresholdPercent ? Number(req.body.thresholdPercent) : undefined,
    normalize: req.body.normalize === 'true' || req.body.normalize === '1'
  };

  const tmpRoot = path.join(process.cwd(), 'work');
  await fs.ensureDir(tmpRoot);
  const jobId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const imgDir = path.join(tmpRoot, `${jobId}-preview-pages`);
  await fs.ensureDir(imgDir);

  try {
    const magickOk = await imagePreprocess.hasMagick();
    // Rasterize only first `pages` pages
    const args = ['-r', String(dpi), '-f', '1', '-l', String(pages), pdfPath, path.join(imgDir, 'page'), '-png'];
    await execFileP('pdftoppm', args as any);

    const files = (await fs.readdir(imgDir)).filter((f: string) => f.toLowerCase().endsWith('.png'));
    files.sort();

    const previews: Array<any> = [];
    for (let i = 0; i < files.length && i < pages; i++) {
      const name = files[i];
      const imgPath = path.join(imgDir, name);
      const procPath = path.join(imgDir, `proc-${name}`);
      let usedPreprocess = false;
      if (magickOk) {
        try {
          await imagePreprocess.preprocessImage(imgPath, procPath, preprocessOptions);
          usedPreprocess = true;
        } catch (e) {
          console.error('preview preprocess failed:', e);
          usedPreprocess = false;
        }
      }

      const finalPath = (usedPreprocess && (await fs.pathExists(procPath))) ? procPath : imgPath;
      const buf = await fs.readFile(finalPath);
      previews.push({ page: i + 1, pngBase64: `data:image/png;base64,${buf.toString('base64')}`, preprocessed: usedPreprocess });
    }
    res.status(200).json({ previews, magickAvailable: magickOk });
  } catch (err) {
    console.error('preview failed:', err);
    res.status(500).json({ error: 'Preview generation failed', details: String(err) });
  } finally {
    // cleanup
    await fs.remove(imgDir).catch(() => {});
    // remove uploaded pdf (we only needed it for preview)
    await fs.remove(pdfPath).catch(() => {});
  }
});

// POST /convert -> upload PDF and create background job
router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field: pdf)' });

  const pdfPath = req.file.path;
  const preprocessOptions: any = {
    contrastStretch: req.body.contrastStretch === 'true' || req.body.contrastStretch === '1',
    contrastLowPercent: req.body.contrastLowPercent ? Number(req.body.contrastLowPercent) : undefined,
    contrastHighPercent: req.body.contrastHighPercent ? Number(req.body.contrastHighPercent) : undefined,
    thresholdPercent: req.body.thresholdPercent ? Number(req.body.thresholdPercent) : undefined,
    normalize: req.body.normalize === 'true' || req.body.normalize === '1',
    dpi: req.body.dpi ? Number(req.body.dpi) : undefined
  };

  const job = jobManager.createJob(pdfPath, preprocessOptions);

  res.status(202).json({
    uploaded: true,
    jobId: job.id,
    statusUrl: `/convert/${job.id}`
  });
});

// GET /convert/:jobId -> job status and result
router.get('/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  const job = jobManager.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.status(200).json({
    id: job.id,
    status: job.status,
    txtPath: job.txtPath ? path.relative(process.cwd(), job.txtPath) : undefined,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt
  });
});

export default router;
