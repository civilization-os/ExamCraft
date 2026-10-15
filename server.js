import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API: Health check & engine status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'ExamCraft AI Core v2.4-pro',
    timestamp: new Date().toISOString()
  });
});

// API: Mock OCR Parse paper
app.post('/api/parse-paper', (req, res) => {
  const { fileName } = req.body;
  res.json({
    success: true,
    fileName: fileName || '2024届全国高等数学期末考试统考卷A.pdf',
    accuracy: '99.8%',
    matchedQuestions: 23,
    typeBreakdown: {
      choices: 8,
      blanks: 5,
      solutions: 4
    }
  });
});

// Serve static frontend in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[ExamCraft AI Workbench] Node server is listening on http://localhost:${PORT}`);
});
