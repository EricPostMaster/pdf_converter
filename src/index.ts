import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import convertRouter from './routes/convert';

const app = express();
const uploadsDir = path.join(process.cwd(), 'uploads');

fs.ensureDirSync(uploadsDir);

app.use(express.json());
app.use('/convert', convertRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
