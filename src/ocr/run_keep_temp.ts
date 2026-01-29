import path from 'path';
import { processPdf } from './processor2';

(async () => {
  const pdfFile = '1769396368793-sample_maybe_it_happens_this_way.pdf';
  const pdfPath = path.join(process.cwd(), 'uploads', pdfFile);
  console.log('Processing with keepTemp:', pdfPath);
  try {
    const result = await processPdf(pdfPath, { lang: 'eng', keepTemp: true });
    console.log('OCR complete. TXT path:', result.txtPath);
  } catch (err) {
    console.error('OCR failed:', err);
    process.exit(1);
  }
})();
