import { processPdf } from './processor2';
import { isTesseractAvailable } from './tesseractAdapter';
import path from 'path';
import fs from 'fs-extra';

type JobStatus = 'queued' | 'running' | 'done' | 'failed';

interface JobRecord {
  id: string;
  pdfPath: string;
  status: JobStatus;
  txtPath?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

const jobs = new Map<string, JobRecord>();

export function createJob(pdfPath: string, preprocessOptions?: any): JobRecord {
  const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const rec: JobRecord = { id, pdfPath, status: 'queued' };
  jobs.set(id, rec);
  // start in background
  runJob(rec, preprocessOptions).catch(err => {
    console.error('Background job failed:', err);
  });
  return rec;
}

export function getJob(id: string): JobRecord | undefined {
  return jobs.get(id);
}

async function runJob(rec: JobRecord, preprocessOptions?: any) {
  rec.status = 'running';
  rec.startedAt = Date.now();
  // fail early if tesseract not available
  try {
    const ok = await isTesseractAvailable();
    if (!ok) {
      rec.status = 'failed';
      rec.error = 'Tesseract not found on PATH; cannot run OCR';
      rec.finishedAt = Date.now();
      return;
    }
  } catch (e) {
    rec.status = 'failed';
    rec.error = 'Error checking tesseract availability: ' + String(e);
    rec.finishedAt = Date.now();
    return;
  }
  try {
    const out = await processPdf(rec.pdfPath, { preprocess: true, preprocessOptions });
    rec.txtPath = out.txtPath;
    rec.status = 'done';
    rec.finishedAt = Date.now();
  } catch (err: any) {
    rec.status = 'failed';
    rec.error = err && (err.message || String(err));
    rec.finishedAt = Date.now();
  }
}

export function listJobs(): JobRecord[] {
  return Array.from(jobs.values()).sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
}

export default { createJob, getJob, listJobs };
