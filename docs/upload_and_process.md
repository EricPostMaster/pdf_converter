Upload and process PDF — CLI quick reference

Assumptions
- Server is running at http://localhost:3000 and mounts the upload route at `/convert`.
- Upload field name: `pdf` (see `src/routes/convert.ts`).
- Uploaded files are saved to the `uploads/` directory and API returns JSON with `filename` and `path`.

Start the server

Use the project's dev script (if available):

```bash
npm run dev
```

Or run the built app (if you compile first):

```bash
npm run build
node dist/index.js
```

Upload a PDF (curl)

```bash
# Preferred on Windows: call the native curl executable to avoid PowerShell aliasing
curl.exe -v -X POST "http://localhost:3000/convert" -F "pdf=@/full/path/to/YourDocument.pdf"

# If you're in PowerShell and don't have curl.exe on PATH, either use the stop-parsing token
# to pass arguments through to the native curl, or use PowerShell's native cmdlet (examples below).
curl --% -v -X POST "http://localhost:3000/convert" -F "pdf=@C:\full\path\to\YourDocument.pdf"
```

Sample successful JSON response:

```json
{
  "uploaded": true,
  "filename": "1670000000000-MyDoc.pdf",
  "path": "uploads/1670000000000-MyDoc.pdf"
}
```

Upload a PDF (PowerShell)

```powershell
$resp = Invoke-RestMethod -Uri http://localhost:3000/convert -Method Post -Form @{ pdf = Get-Item 'C:\path\to\YourDocument.pdf' }
$resp | ConvertTo-Json
```

Rasterize PDF pages to PNG at 300 DPI (pdftoppm / Poppler)

```bash
pdftoppm -r 300 uploads/1670000000000-MyDoc.pdf work/job-pages/page -png
# produces work/job-pages/page-1.png, page-2.png, ...
```

Run a local OCR runner (TypeScript source)

If you have `ts-node` installed (dev environment):

```bash
npx ts-node src/ocr/runner.ts uploads/1670000000000-MyDoc.pdf
```

If you compiled to `dist/` JavaScript:

```bash
node dist/src/ocr/runner.js uploads/1670000000000-MyDoc.pdf
```

Quick Tesseract check on a single page image

```bash
tesseract work/job-pages/page-1.png stdout -l eng --psm 3 --oem 1 -c user_defined_dpi=300 > work/job-pages/page-1.txt
```

Notes and troubleshooting

- If the server uses a different port, update the URL accordingly (e.g., http://localhost:4000/convert).
- The upload route only saves files and returns the saved filename/path; you may need to run the OCR processor separately (see runner or add server-side wiring to process on upload).
- Ensure `pdftoppm` (Poppler) and `tesseract` are installed on the machine for rasterization and CLI OCR.
- On Windows, use `magick.exe` (ImageMagick) for preprocessing if implemented.
 - Ensure `pdftoppm` (Poppler), `tesseract`, and `magick` (ImageMagick) are installed on the machine for rasterization, preprocessing and CLI OCR.
 - On Windows you can install both tools via `winget` and add them to your user PATH:

```powershell
# install (if not already installed)
winget install --id tesseract-ocr.tesseract -e --accept-package-agreements --accept-source-agreements
winget install --id ImageMagick.ImageMagick.Q16 -e --accept-package-agreements --accept-source-agreements

# add to your USER PATH (one-time; PowerShell)
$userPath = [Environment]::GetEnvironmentVariable('Path','User')
if (-not $userPath.Contains('C:\Program Files\Tesseract-OCR')) {
  [Environment]::SetEnvironmentVariable('Path', $userPath + ';C:\Program Files\Tesseract-OCR;C:\Program Files\ImageMagick-7.1.2-Q16', 'User')
}

# reopen your shell (or log out/in) to pick up the new PATH; in the current session you can also do:
$env:PATH = $env:PATH + ';C:\Program Files\Tesseract-OCR;C:\Program Files\ImageMagick-7.1.2-Q16'
```

Example full flow (upload → rasterize → OCR)

```bash
# 1) Upload file
curl -X POST "http://localhost:3000/convert" -F "pdf=@./MyDoc.pdf"
# 2) Rasterize to 300 DPI
pdftoppm -r 300 uploads/<returned-filename> work/job-pages/page -png
# 3) (Optional) preprocess each page with ImageMagick (if available)
# The author found this preprocessing command produces the best OCR results:
magick work/job-pages/page-3.png -colorspace Gray -normalize -contrast-stretch 1.5%x99.0% -statistic Median 3x3 -threshold 80% work/job-pages/page-3-processed.png

# (Alternative) a gentler preprocessing pipeline used previously:
magick work/job-pages/page-1.png -colorspace Gray -deskew 40% -contrast-stretch 0.5%x0.5% -statistic Median 3x3 -threshold 50% work/job-pages/page-1-processed.png
# 4) OCR the processed page
tesseract work/job-pages/page-1-processed.png stdout -l eng --psm 3 --oem 1 -c user_defined_dpi=300 > work/job-pages/page-1.txt
```

If you'd like, I can add a small CLI `eval` runner that automates steps 2–4 and saves side-by-side previews and metrics for comparing preprocessing profiles.
