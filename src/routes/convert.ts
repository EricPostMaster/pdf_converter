import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import jobManager from '../ocr/jobManager';

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

// POST /convert -> upload PDF and create background job
router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field: pdf)' });

  const pdfPath = req.file.path;
  const job = jobManager.createJob(pdfPath);

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
