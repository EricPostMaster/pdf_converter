# Fix Environment PATH and Package Stability Issues

## Root Cause Analysis

**The Core Problem: Unstable PATH Configuration**

Your symptoms indicate that:
1. Tools (Tesseract, ImageMagick, Node) are **installed** but not in your **persistent system PATH**
2. You're manually setting `$env:PATH` in each PowerShell session (temporary fix)
3. When processes spawn subprocesses (npm running install scripts, Node spawning ImageMagick), they don't inherit your temporary PATH modifications consistently
4. Windows child processes get a **clean environment** from the registry, not your PowerShell session state

**Evidence:**
- `npm install` can't find `node` even though you have a server running → npm's child process (running esbuild install script) isn't inheriting your session's PATH
- You have to "reinstall" Tesseract/ImageMagick repeatedly → you're actually just fixing PATH each time, not the installation
- The `-statistic Median` black-box bug appeared "suddenly" → likely ImageMagick auto-updated or a Windows Update changed library behavior

## Immediate Fixes

### 1. **Fix PATH Permanently** (do this first)

Run this in PowerShell **as Administrator**:

```powershell
# Get current user PATH
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')

# Add tools (only if not already present)
$toAdd = @(
    'C:\Program Files\Tesseract-OCR',
    'C:\Program Files\ImageMagick-7.1.2-Q16',
    'C:\Program Files\nodejs'  # or wherever Node is installed
)

foreach ($path in $toAdd) {
    if ($userPath -notlike "*$path*") {
        $userPath = "$userPath;$path"
        Write-Host "Adding to PATH: $path"
    }
}

# Save permanently
[Environment]::SetEnvironmentVariable('Path', $userPath, 'User')

Write-Host "PATH updated. Close and reopen PowerShell to apply."
```

**Then close all PowerShell windows and reopen** — this ensures new sessions inherit the updated PATH.

### 2. **Verify Node Installation**

```powershell
# Check where Node is installed
Get-Command node | Select-Object -ExpandProperty Source
Get-Command npm | Select-Object -ExpandProperty Source

# If these fail, Node isn't in PATH; find it:
Get-ChildItem "C:\Program Files\nodejs\node.exe" -ErrorAction SilentlyContinue
Get-ChildItem "$env:APPDATA\npm\node.exe" -ErrorAction SilentlyContinue
```

Add the correct Node path to the PATH fix above.

### 3. **Fix ImageMagick Threading Bug** (already done in code)

The `-statistic Median` multithreading bug is a **known ImageMagick 7.1.2-13 issue**, not your environment. We already removed it from `src/ocr/imagePreprocess.ts` (keeping `-normalize -contrast-stretch -threshold`). This should work once PATH is fixed.

### 4. **Install `tsx` After PATH Fix**

Once PATH is permanent and you've reopened PowerShell:

```powershell
npm install --save-dev tsx
npx tsx src/ocr/cli.ts --keep-temp
```

## Long-Term Solutions

### Option A: Use a Package Manager (Recommended)

Install [Scoop](https://scoop.sh/) or [Chocolatey](https://chocolatey.org/) and manage tools through it:

```powershell
# Install Scoop
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Install tools via Scoop (handles PATH automatically)
scoop install nodejs tesseract imagemagick
```

### Option B: Use Docker (Isolation)

Create a `Dockerfile` with fixed versions of all dependencies:

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache tesseract-ocr imagemagick poppler-utils
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

This isolates everything and prevents "it worked yesterday" issues.

### Option C: Use WSL2 (Linux Environment)

Run the entire project in WSL2 Ubuntu where package management is more stable:

```bash
wsl --install
# Then inside WSL:
sudo apt update && sudo apt install -y tesseract-ocr imagemagick poppler-utils nodejs npm
```

## Why This Keeps Happening

**Windows Environment Quirks:**
- User PATH changes require shell restart to take effect
- Child processes inherit environment from **registry**, not parent process temp vars
- Installing tools via installers often fails to update PATH correctly
- Windows Updates can reset or modify PATH entries

**Your Current Workflow (Problematic):**
```powershell
$env:PATH = ... + ';C:\Program Files\Tesseract-OCR;...'  # Temporary, lost when shell closes
npx tsx ...  # Spawns child → doesn't inherit temp PATH → fails
```

**Fixed Workflow:**
```powershell
# PATH set permanently via [Environment]::SetEnvironmentVariable
# Tools always available in any shell/subprocess
npx tsx ...  # Just works
```

## Action Plan

1. **Right now**: Run the PowerShell PATH fix above (as Admin), close/reopen shell
2. **Verify**: `node -v`, `tesseract --version`, `magick -version` all work in a **fresh** PowerShell window
3. **Install tsx**: `npm install --save-dev tsx`
4. **Run CLI**: `npx tsx src/ocr/cli.ts --keep-temp`
5. **Consider**: Moving to Scoop/Docker/WSL2 for long-term stability

## Next Steps for Verification

After fixing PATH permanently:

1. Test preprocessing with updated command (no `-statistic Median`):
   ```powershell
   magick "work/1769568277637-3635-pages/page-3.png" -colorspace Gray -normalize -contrast-stretch 1.5%x99.0% -threshold 80% "test-output.png"
   magick "test-output.png" -format "%[pixel:p{10,10}]\n%[pixel:p{1275,10}]\n%[pixel:p{2540,10}]\n" info:
   ```

2. Run the full OCR pipeline:
   ```powershell
   npx tsx src/ocr/cli.ts --keep-temp
   ```

3. Inspect processed images in `work/<jobId>-pages/proc-page-*.png` to confirm no black boxes

4. Check OCR output quality in `output/*.txt`
