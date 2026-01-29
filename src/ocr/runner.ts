import path from 'path';
import { processPdf } from './processor2';

(async () => {
  const pdfFile = '1769386410524-Maybe_It_Happens_This_Way_Full_Scan.pdf';
  const pdfPath = path.join(process.cwd(), 'uploads', pdfFile);
  console.log('Processing:', pdfPath);
  try {
    const result = await processPdf(pdfPath, { lang: 'eng' });
    console.log('OCR complete. TXT path:', result.txtPath);
  } catch (err) {
    console.error('OCR failed:', err);
    process.exit(1);
  }
})();
