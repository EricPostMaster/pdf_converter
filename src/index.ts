import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import convertRouter from './routes/convert';

const app = express();
const uploadsDir = path.join(process.cwd(), 'uploads');

fs.ensureDirSync(uploadsDir);

app.use(express.json());
// Serve static UI from / (public folder)
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/convert', convertRouter);
// serve generated outputs for download
app.use('/output', express.static(path.join(process.cwd(), 'output')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
