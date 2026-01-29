Plan: OCR PDF Converter

TL;DR: Build a local, privacy-first Node.js service that converts PDFs → images → OCR (Tesseract) → cleaned TXT, with an optional DOCX export via LibreOffice. Use Poppler (`pdftoppm`) for rasterization, `sharp` for preprocessing, and either native Tesseract or `tesseract.js` for recognition. This keeps accuracy high and processing local.

Steps
1. Create server and routes: implement upload endpoint in `src/index.ts` and `src/routes/convert.ts` using `express` and `multer`.
2. Add OCR orchestration: implement `PDF → images → preprocess → OCR per page → merge` in `src/ocr/processor.ts` and adapter `tesseractAdapter` in `src/ocr/tesseractAdapter.ts`.
3. Add helpers: add `src/utils/pdf.ts` (calls `pdftoppm`), `src/utils/image.ts` (deskew/despeckle via `sharp`/ImageMagick).
4. Add output conversion: add optional TXT→DOCX flow using headless LibreOffice, automated in `scripts/convert.bat` and invoked from `processor`.
5. Add project metadata & tooling: add `package.json`, `tsconfig.json`, README.md, and CI/test skeleton; include dependencies `express`, `multer`, `fs-extra`, `execa`, `sharp`, `tesseract.js` (and/or `node-tesseract-ocr`), `pdf-lib`/`node-poppler`.
6. Provide docs & safety: document Windows install steps for Tesseract/Poppler/LibreOffice in README.md and implement auto-cleanup of uploads/temp files.

Further Considerations
1. Output formats: Confirm preferred target — `TXT` (recommended) / `DOCX` / Google Docs (Drive API).
2. Tesseract choice: Option A — native Tesseract (faster, needs install). Option B — `tesseract.js` (pure-JS, easier installs but slower).
3. Scale/UX: Option A — single-process API for occasional use. Option B — add background queue/worker for large batches.

Pause for review: this is a draft — tell me preferences for output format, Tesseract native vs wasm, and whether you want a web UI or CLI only.
