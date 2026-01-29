Got it — OCR is **required**, and this is a *perfect* use case for it 👍
A typewritten novel is actually *ideal* for OCR compared to handwriting.

---

# Recommended Stack (High Accuracy, Low Headache)

### ✅ **Tesseract OCR + LibreOffice**

This keeps everything:

* Free
* Local
* Private (important for a family manuscript)
* Good quality for typewritten text

Pipeline:

```
Scanned PDF
  ↓
PDF → images (one per page)
  ↓
OCR each image (Tesseract)
  ↓
Reassemble into DOCX
```

---

## Important Reality Check (quick but honest)

No OCR will be perfect. Expect:

* 95–99% accuracy on clean typewritten pages
* Some manual proofreading afterward (which is unavoidable with *any* OCR)

But this will save **dozens of hours** vs retyping.

---

# Step-by-Step: OCR Web App (Node.js)

## 1️⃣ Install system dependencies

### Install Tesseract

**Mac**

```bash
brew install tesseract
```

**Ubuntu**

```bash
sudo apt install tesseract-ocr
```

Verify:

```bash
tesseract --version
```

---

### Install PDF → image tool

We’ll use `pdftoppm` (from Poppler).

**Mac**

```bash
brew install poppler
```

**Ubuntu**

```bash
sudo apt install poppler-utils
```

---

## 2️⃣ Install Node dependencies

```bash
npm install express multer tesseract.js child_process fs-extra
```

We’ll use:

* `pdftoppm` → split PDF into images
* `tesseract.js` → OCR
* `LibreOffice` → DOCX output (optional but recommended)

---

## 3️⃣ OCR Server (core logic)

### `server.js` (OCR version)

```js
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const Tesseract = require("tesseract.js");

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/convert", upload.single("pdf"), async (req, res) => {
  const pdfPath = req.file.path;
  const imgDir = `images/${req.file.filename}`;
  const outputTxt = `output/${req.file.filename}.txt`;

  await fs.ensureDir(imgDir);
  await fs.ensureDir("output");

  // 1. Convert PDF → images
  await new Promise((resolve, reject) => {
    exec(
      `pdftoppm ${pdfPath} ${imgDir}/page -png`,
      (err) => (err ? reject(err) : resolve())
    );
  });

  // 2. OCR each page
  const files = (await fs.readdir(imgDir)).sort();
  let fullText = "";

  for (const file of files) {
    const imgPath = path.join(imgDir, file);
    const result = await Tesseract.recognize(imgPath, "eng", {
      tessedit_pageseg_mode: 1
    });
    fullText += result.data.text + "\n\n";
  }

  await fs.writeFile(outputTxt, fullText);

  res.download(outputTxt, "novel.txt", async () => {
    await fs.remove(pdfPath);
    await fs.remove(imgDir);
    await fs.remove(outputTxt);
  });
});

app.listen(3000, () =>
  console.log("OCR server running on http://localhost:3000")
);
```

This version outputs **clean text** first — which is *exactly what you want* for a novel.

---

## 4️⃣ Why TXT first (very important)

For books/manuscripts:

**PDF → DOCX directly via OCR often produces messy formatting**

Best practice:

1. OCR → **plain text**
2. Light cleanup (quotes, paragraph breaks)
3. Then convert to DOCX / Google Docs

This gives:

* Better paragraph flow
* Easier proofreading
* Better long-term editing

---

## 5️⃣ Converting to Word or Google Docs

### TXT → DOCX (LibreOffice)

```bash
soffice --headless --convert-to docx novel.txt
```

### Upload to Google Docs

* Upload DOCX
* Right-click → *Open with → Google Docs*
* Or automate via Drive API later

---

# OCR Quality Tips (Huge Gains)

### 🔧 Before OCR (if you can)

If the scan quality is poor, OCR accuracy drops fast.

**Best settings:**

* 300 DPI grayscale
* Straight pages (no skew)
* High contrast (white paper, dark text)

If needed:

```bash
magick input.png -despeckle -contrast-stretch 0.5% cleaned.png
```

---

### 🧠 Tesseract tuning (optional but powerful)

For typewritten novels:

```js
Tesseract.recognize(img, "eng", {
  tessedit_char_whitelist:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:'\"()-— \n",
});
```

This reduces weird OCR artifacts.
