import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './api-router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Mount model_core API router
app.use('/api', apiRouter);

// Serve static frontend in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[ExamCraft AI Workbench] Node server is listening on http://localhost:${PORT}`);
});
