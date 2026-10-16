import React, { useState } from 'react';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import ExamGeneratorView from './views/ExamGeneratorView';
import PaperLibraryView from './views/PaperLibraryView';
import ExamRoomView from './views/ExamRoomView';
import ExamResultReportView from './views/ExamResultReportView';
import MistakeNotebookView from './views/MistakeNotebookView';
import SettingsView from './views/SettingsView';
import { INITIAL_PAPERS, MOCK_EXAM_QUESTIONS } from './data/mockData';

// Helper to automatically purge legacy hardcoded mock items from user's localStorage
function purgeLegacyMockData() {
  const legacyPaperIds = new Set(['paper-math-2024a', 'paper-ode-04', 'paper-math-kaoyan-2023', 'paper-linalg-matrix']);
  const legacySubIds = new Set(['sub-2024a-v1', 'sub-2024a-v2']);
  const legacyMistakeIds = new Set(['m-1', 'm-2', 'm-3']);

  try {
    const rawPapers = localStorage.getItem('examcraft_papers');
    if (rawPapers) {
      const parsed = JSON.parse(rawPapers);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((p) => !legacyPaperIds.has(p.id));
        localStorage.setItem('examcraft_papers', JSON.stringify(cleaned));
      }
    }
  } catch {}

  try {
    const rawSubs = localStorage.getItem('examcraft_submissions');
    if (rawSubs) {
      const parsed = JSON.parse(rawSubs);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((s) => !legacySubIds.has(s.id) && !legacyPaperIds.has(s.paperId));
        localStorage.setItem('examcraft_submissions', JSON.stringify(cleaned));
      }
    }
  } catch {}

  try {
    const rawNotebook = localStorage.getItem('examcraft_notebook_data');
    if (rawNotebook) {
      const parsed = JSON.parse(rawNotebook);
      if (parsed && Array.isArray(parsed.items)) {
        parsed.items = parsed.items.filter((i) => !legacyMistakeIds.has(i.id));
        localStorage.setItem('examcraft_notebook_data', JSON.stringify(parsed));
      }
    }
  } catch {}
}

purgeLegacyMockData();

export default function App() {
  const [currentPath, setCurrentPath] = useState('exam-generator');
  const [papers, setPapers] = useState(() => {
    try {
      const raw = localStorage.getItem('examcraft_papers');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PAPERS;
  });
  const [activePaper, setActivePaper] = useState(() => papers[0] || null);
  const [questions, setQuestions] = useState(() => (activePaper?.questions || MOCK_EXAM_QUESTIONS));
  const [activeSubmission, setActiveSubmission] = useState(null);

  const handleStartExam = (paper) => {
    if (!paper) {
      setCurrentPath('exam-generator');
      return;
    }
    setActivePaper(paper);
    setPapers((prev) => {
      if (!prev.some((p) => p.id === paper.id)) {
        const next = [paper, ...prev];
        try {
          localStorage.setItem('examcraft_papers', JSON.stringify(next));
        } catch {}
        return next;
      }
      return prev;
    });
    setQuestions(paper.questions && paper.questions.length > 0 ? paper.questions : []);
    setCurrentPath('exam-room');
  };

  const handleSubmitExam = (submission) => {
    setActiveSubmission(submission);
    setCurrentPath('exam-result');
  };

  const handleViewSubmission = (submission) => {
    setActiveSubmission(submission);
    // Also sync activePaper if found
    const matchPaper = papers.find(p => p.id === submission.paperId || p.title === submission.paperTitle);
    if (matchPaper) setActivePaper(matchPaper);
    setCurrentPath('exam-result');
  };

  const handleStartExamWithMistakes = (collectionTitle) => {
    const mistakePaper = {
      id: 'mistake-exam-' + Date.now(),
      title: `《${collectionTitle} · 错题专项靶向重练卷》`,
      source: '错题本变式组卷',
      sourceType: 'custom',
      date: '刚刚',
      questionCount: 16,
      totalScore: 100,
      duration: 90,
      difficulty: 5,
      tags: ['#错题攻关', '#重点复练', '#AI步骤自核'],
      status: '未作答 (全新排版完毕)'
    };
    setActivePaper(mistakePaper);
    setQuestions(MOCK_EXAM_QUESTIONS);
    setCurrentPath('exam-room');
  };

  const isFullScreenMode = currentPath === 'exam-room' || currentPath === 'exam-result';

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans selection:bg-primary-fixed selection:text-primary">
      {/* Top Header - hidden during full focus exam room or result review mode */}
      {!isFullScreenMode && (
        <Header
          currentPath={currentPath}
          setCurrentPath={setCurrentPath}
          onOpenExam={() => handleStartExam(papers[0])}
        />
      )}

      {/* Main Container */}
      <main className={`flex-1 flex flex-col ${!isFullScreenMode ? 'pt-14' : ''}`}>
        {currentPath === 'dashboard' && (
          <DashboardView
            papers={papers}
            onNavigate={setCurrentPath}
            onStartExam={handleStartExam}
          />
        )}

        {currentPath === 'exam-generator' && (
          <ExamGeneratorView
            papers={papers}
            onStartExam={handleStartExam}
            onNavigate={setCurrentPath}
          />
        )}

        {currentPath === 'paper-library' && (
          <PaperLibraryView
            papers={papers}
            onStartExam={handleStartExam}
            onNavigate={setCurrentPath}
            onViewSubmission={handleViewSubmission}
          />
        )}

        {currentPath === 'question-bank' && (
          <MistakeNotebookView
            onStartExamWithMistakes={handleStartExamWithMistakes}
          />
        )}

        {currentPath === 'settings' && (
          <SettingsView />
        )}

        {currentPath === 'exam-room' && (
          <ExamRoomView
            activePaper={activePaper}
            questions={questions}
            onExit={() => setCurrentPath('exam-generator')}
            onOpenMistakes={() => setCurrentPath('question-bank')}
            onSubmitExam={handleSubmitExam}
          />
        )}

        {currentPath === 'exam-result' && (
          <ExamResultReportView
            submission={activeSubmission}
            onBackToLibrary={() => setCurrentPath('paper-library')}
            onRetakeExam={() => {
              if (activePaper) handleStartExam(activePaper);
              else setCurrentPath('paper-library');
            }}
            onOpenNotebook={() => setCurrentPath('question-bank')}
          />
        )}
      </main>
    </div>
  );
}

