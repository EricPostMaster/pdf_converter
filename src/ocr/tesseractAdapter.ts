import util from 'util';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
const execFileP = util.promisify(execFile);

function resolveTesseractCmd(): string {
  // 1) explicit env override
  const envPath = process.env.TESSERACT_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  // 2) look for common locations inside workspace (useful when user added a local build)
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'tesseract-5.5.2', 'tesseract.exe'),
    path.join(cwd, 'tesseract-5.5.2', 'bin', 'tesseract.exe'),
    path.join(cwd, 'tesseract-5.5.2', 'src', 'tesseract.exe'),
    path.join(cwd, 'tesseract.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // 3) fallback to system `tesseract` on PATH
  return 'tesseract';
}

export interface TesseractOptions {
  psm?: number;
  oem?: number;
  configVars?: Record<string, string>;
}

export async function recognizeImage(imagePath: string, lang = 'eng', opts: TesseractOptions = {}): Promise<string> {
  const cmd = resolveTesseractCmd();
  const args: string[] = [imagePath, 'stdout', '-l', lang];
  if (opts.psm !== undefined) {
    args.push('--psm', String(opts.psm));
  }
  if (opts.oem !== undefined) {
    args.push('--oem', String(opts.oem));
  }
  if (opts.configVars) {
    for (const [k, v] of Object.entries(opts.configVars)) {
      args.push('-c', `${k}=${v}`);
    }
  }

  try {
    const { stdout } = await execFileP(cmd, args);
    return String(stdout || '');
  } catch (err: any) {
    const stderr = err.stderr || err.message || String(err);
    throw new Error(`Tesseract CLI failed (cmd=${cmd} args=${args.join(' ')}): ${stderr}`);
  }
}

export default { recognizeImage };

export async function isTesseractAvailable(): Promise<boolean> {
  const cmd = resolveTesseractCmd();
  try {
    await execFileP(cmd, ['--version']);
    return true;
  } catch (e) {
    return false;
  }
}
