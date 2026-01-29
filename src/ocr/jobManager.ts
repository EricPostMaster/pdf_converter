import { processPdf } from './processor2';
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

export function createJob(pdfPath: string): JobRecord {
  const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const rec: JobRecord = { id, pdfPath, status: 'queued' };
  jobs.set(id, rec);
  // start in background
  runJob(rec).catch(err => {
    console.error('Background job failed:', err);
  });
  return rec;
}

export function getJob(id: string): JobRecord | undefined {
  return jobs.get(id);
}

async function runJob(rec: JobRecord) {
  rec.status = 'running';
  rec.startedAt = Date.now();
  try {
    const out = await processPdf(rec.pdfPath, { preprocess: true });
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
