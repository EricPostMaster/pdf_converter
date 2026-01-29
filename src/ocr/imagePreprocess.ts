import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs-extra';
import path from 'path';
const execFileP = util.promisify(execFile);

export interface PreprocessOptions {
  dpi?: number;
  deskew?: boolean;
  contrastStretch?: boolean;
  // explicit contrast-stretch percentages, e.g. low and high like '1.5%x99.0%'
  contrastLowPercent?: number; // e.g. 1.5
  contrastHighPercent?: number; // e.g. 99.0
  adaptiveThreshold?: boolean;
  // explicit threshold percent, e.g. 80
  thresholdPercent?: number;
  invertIfNeeded?: boolean;
  normalize?: boolean;
}

export async function hasMagick(): Promise<boolean> {
  try {
    await execFileP('magick', ['-version']);
    return true;
  } catch (e) {
    return false;
  }
}

export async function preprocessImage(srcPath: string, dstPath: string, opts: PreprocessOptions = {}): Promise<void> {
  await fs.ensureDir(path.dirname(dstPath));
  const useMagick = await hasMagick();

  if (useMagick) {
    // Build ImageMagick args based on provided options so UI can control them
    const args: string[] = ['-define', 'magick:thread-limit=1', srcPath];

    // convert to grayscale
    args.push('-colorspace', 'Gray');

    if (opts.normalize !== false) {
      args.push('-normalize');
    }

    if (opts.contrastStretch) {
      const low = typeof opts.contrastLowPercent === 'number' ? opts.contrastLowPercent : 1.5;
      const high = typeof opts.contrastHighPercent === 'number' ? opts.contrastHighPercent : 99.0;
      args.push('-contrast-stretch', `${low}%x${high}%`);
    }

    if (typeof opts.thresholdPercent === 'number') {
      args.push('-threshold', `${opts.thresholdPercent}%`);
    } else if (opts.adaptiveThreshold) {
      // simple fallback threshold when adaptive selected but no explicit percent
      args.push('-threshold', '80%');
    }

    args.push(dstPath);

    console.log('[imagePreprocess] running magick with args:', args.join(' '));
    try {
      const { stdout, stderr } = await execFileP('magick', args);
      if (stdout) console.log('[imagePreprocess] magick stdout:', String(stdout).slice(0, 500));
      if (stderr) console.log('[imagePreprocess] magick stderr:', String(stderr).slice(0, 500));

      // Quick sanity checks: file size and image mean (avoid all-black/empty outputs)
      try {
        const stat = await fs.stat(dstPath);
        const sizeOk = stat.size > 20000; // arbitrary minimal size
        const meanRes = await execFileP('magick', ['identify', '-format', '%[mean]', dstPath]);
        const meanVal = parseFloat(String(meanRes.stdout || meanRes).trim()) || 0;
        if (!sizeOk || meanVal < 1e-6) {
          // Do not fall back — the exact ImageMagick command must be used.
          console.error('[imagePreprocess] magick result looks invalid (size:', stat.size, 'mean:', meanVal, '); aborting preprocessing as requested.');
          throw new Error(`ImageMagick produced invalid output (size=${stat.size} mean=${meanVal})`);
        } else {
          console.log('[imagePreprocess] magick succeeded, wrote:', dstPath, 'size:', stat.size, 'mean:', meanVal);
          return;
        }
      } catch (chkErr) {
        console.error('[imagePreprocess] could not validate magick output:', chkErr);
        throw chkErr;
      }
    } catch (err) {
      console.error('[imagePreprocess] magick failed:', err);
      // Do not fall back — surface the error so caller can decide next steps
      throw err;
    }
  } else {
    throw new Error('ImageMagick `magick` CLI not found in PATH; preprocessing requires ImageMagick');
  }
}

export default { preprocessImage, hasMagick };
