Plan: Improve OCR preprocessing and evaluation

TL;DR
Add 300 DPI rasterization, an ImageMagick-based preprocessing helper with a `sharp` fallback, wire preprocessing into the OCR pipeline, and build a small evaluation runner to compare settings (objective metrics + previews).

Objectives
- Improve recognition of light/low-contrast scanned pages.
- Keep tooling simple and effective: recommend ImageMagick (`magick`) on Windows; fallback to `sharp` if not available.
- Make preprocessing opt-in per job and add a reproducible evaluation harness to compare settings objectively.

High-level Steps
1. Rasterization: force `pdftoppm -r 300` when converting PDF pages to PNG. Expose `dpi` as a process option.

2. Preprocessing helper (`src/ocr/imagePreprocess.ts`):
   - Detect `magick` on PATH (Windows: `magick.exe`) and use ImageMagick CLI for best results.
   - Processing pipeline (order): grayscale → auto-deskew → detect/invert if needed → gamma correction/contrast-stretch or CLAHE → despeckle (median) → adaptive threshold (local/gaussian) → morphological opening for cleanup → write processed PNG.
   - Fallback: if `magick` not present, use `sharp` to perform grayscale, normalize, gamma, resize/upscale, median blur, and a simple adaptive-like threshold (approximation).
   - Expose options: `dpi`, `deskew`, `clahe`/`contrastStretch`, `adaptiveThreshold`, `invertIfNeeded`.

3. Hook preprocessing into pipeline:
   - After rasterizing pages in `src/ocr/processor.ts` / `src/ocr/processor2.ts`, call `preprocessImage(rawPagePath, processedPagePath, opts)` and pass the processed path to Tesseract.
   - Make preprocessing configurable per job (opt-in) and safe: keep raw PNGs for debugging and save processed images to `work/<job>/processed/`.

4. Tesseract tuning:
   - Update `src/ocr/tesseractAdapter.ts` to accept job-configurable `--psm` and `--oem` and pass `-c user_defined_dpi=300` (matching raster DPI).
   - Allow extra `-c` variables (e.g., `tessedit_char_whitelist`, `textord_min_linesize`) and `--tessdata-dir` when needed.

5. Evaluation harness (`src/ocr/eval.ts` / extend `src/ocr/runner.ts`):
   - Accept a set of preprocessing + Tesseract config profiles.
   - For each profile and each sample page: save `orig.png`, `processed.png`, `ocr.txt`, and `ocr.tsv` or `hocr` into `work/<job>/<profile>/`.
   - Compute metrics: if ground truth available, compute CER and WER; otherwise compute average per-word confidence from Tesseract TSV and simple dictionary-based heuristics (word match rate).
   - Produce a `report.json` ranking profiles by metric and include quick visual comparison files.
   - Optionally add a minimal preview Express route to serve the artifacts for side-by-side inspection.

6. Documentation and config:
   - Update README and `package.json` notes to recommend installing `ImageMagick` (Windows: `magick.exe`) and `poppler-utils` (for `pdftoppm`) and Tesseract.
   - Provide sample recommended profiles (e.g., `balance`, `highContrast`, `deskewOnly`) and example commands to run evaluations.

Quick ImageMagick command examples (per-page)
- Deskew, normalize, contrast stretch, despeckle, adaptive threshold:
  magick input.png -colorspace Gray -deskew 40% -auto-orient -contrast-stretch 0.5%x0.5% -gamma 0.9 -median 3x3 -adaptive-threshold 15x15+10% output.png

- CLAHE-style alternative (using fx or ``-evaluate``, approximate):
  magick input.png -colorspace Gray -clahe 256x256+128 -auto-level -sharpen 0x1 output.png

Tesseract CLI tuning examples
- tesseract processed.png stdout -l eng --psm 3 --oem 1 -c user_defined_dpi=300
- Try `--psm 1/3/4/6` per layout and pick best via evaluation harness.

Evaluation commands (examples)
- Rasterize with DPI 300:
```bash
pdftoppm -r 300 sample.pdf work/job-pages/page -png
```

- Run a single tesseract check:
```bash
tesseract work/job-pages/page-1.png stdout -l eng --psm 3 --oem 1 -c user_defined_dpi=300 > baseline.txt
```

Notes and tradeoffs
- ImageMagick is the simplest, most immediately effective tool for deskew, threshold, and contrast operations and is recommended for Windows (`magick.exe`).
- `sharp` is a lighter Node-native fallback but lacks deskew and CLAHE; use only if ImageMagick cannot be installed.
- OpenCV offers the best control (CLAHE, advanced denoising) but demands native bindings and higher complexity; postpone unless needed.

Next steps
- Implement `src/ocr/imagePreprocess.ts` (ImageMagick first, `sharp` fallback), wire into `src/ocr/processor.ts`, and add a small CLI eval runner. Save profiles and run comparisons on representative low-contrast pages.

Contact
- When you want me to proceed, I will implement the ImageMagick-based helper and wire it into `src/ocr/processor.ts`. If you prefer a UI preview route instead of CLI artifacts, note that and I'll include it.
