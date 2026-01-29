#!/usr/bin/env node
import path from 'path';
import { processPdf } from './processor2';

function usage() {
  console.log('Usage: ts-node src/ocr/cli.ts [--keep-temp] [--pdf <path>]');
  console.log('  --keep-temp     Preserve work/<jobId>-pages directory');
  console.log('  --pdf <path>    Path to PDF to process (defaults to sample in uploads)');
}

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  usage();
  process.exit(0);
}

const keepTemp = argv.includes('--keep-temp') || argv.includes('--keepTemp');
let pdfPath: string | undefined;
const pdfIdx = argv.findIndex(a => a === '--pdf' || a === '-p');
if (pdfIdx !== -1 && argv[pdfIdx + 1]) {
  pdfPath = path.resolve(process.cwd(), argv[pdfIdx + 1]);
} else {
  const positional = argv.find(a => !a.startsWith('-'));
  pdfPath = positional ? path.resolve(process.cwd(), positional) : path.join(process.cwd(), 'uploads', '1769386410524-Maybe_It_Happens_This_Way_Full_Scan.pdf');
}

console.log('CLI: processing', pdfPath, 'keepTemp=', keepTemp);
(async () => {
  try {
    const result = await processPdf(pdfPath as string, { lang: 'eng', keepTemp });
    console.log('Done. Output:', result.txtPath);
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
})();
