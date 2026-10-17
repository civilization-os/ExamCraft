import React, { useCallback, useEffect, useState } from 'react';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import ExamGeneratorView from './views/ExamGeneratorView';
import PaperLibraryView from './views/PaperLibraryView';
import ExamRoomView from './views/ExamRoomView';
import ExamResultReportView from './views/ExamResultReportView';
import MistakeNotebookView from './views/MistakeNotebookView';
import SettingsView from './views/SettingsView';
import { deduplicateQuestions } from './utils/questionTypes';
import { inferPaperSubject } from './utils/paperSubject';

const APP_PATHS = new Set(['dashboard', 'exam-generator', 'paper-library', 'question-bank', 'settings', 'exam-room', 'exam-result']);

function getPathFromLocation() {
  const hashPath = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return APP_PATHS.has(hashPath) ? hashPath : 'exam-generator';
}

function readStoredObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

// Helper to automatically purge legacy hardcoded mock items from user's localStorage
function purgeLegacyMockData() {
  const legacyPaperIds = new Set([
    'paper-math-2024a',
    'paper-ode-04',
    'paper-math-kaoyan-2023',
    'paper-linalg-matrix',
    'sample-math-2024a',
    'sample-kaoyan-2026',
    'sample-english-2026'
  ]);
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
  const [currentPath, setCurrentPathState] = useState(getPathFromLocation);
  const [papers, setPapers] = useState(() => {
    try {
      const raw = localStorage.getItem('examcraft_papers');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((p) => {
            const clean = Array.isArray(p.questions) ? deduplicateQuestions(p.questions, p.title) : [];
            return {
              ...p,
              subject: p.subject || inferPaperSubject(p),
              questions: clean,
              questionCount: clean.length
            };
          });
        }
      }
    } catch {}
    return [];
  });
  const [activePaper, setActivePaper] = useState(() => {
    const stored = readStoredObject('examcraft_active_paper');
    if (!stored) return null;
    const clean = Array.isArray(stored.questions) ? deduplicateQuestions(stored.questions, stored.title) : [];
    return {
      ...stored,
      subject: stored.subject || inferPaperSubject(stored),
      questions: clean,
      questionCount: clean.length
    };
  });
  const [questions, setQuestions] = useState(() => (activePaper?.questions || []));
  const [activeSubmission, setActiveSubmission] = useState(() => readStoredObject('examcraft_active_submission'));

  const setCurrentPath = useCallback((path) => {
    const nextPath = APP_PATHS.has(path) ? path : 'exam-generator';
    const nextHash = `#/${nextPath}`;
    if (window.location.hash !== nextHash) window.history.pushState({ path: nextPath }, '', nextHash);
    setCurrentPathState(nextPath);
  }, []);

  useEffect(() => {
    const syncPath = () => setCurrentPathState(getPathFromLocation());
    window.addEventListener('popstate', syncPath);
    window.addEventListener('hashchange', syncPath);
    const locationPath = getPathFromLocation();
    if (window.location.hash !== `#/${locationPath}`) {
      window.history.replaceState({ path: locationPath }, '', `#/${locationPath}`);
    }
    return () => {
      window.removeEventListener('popstate', syncPath);
      window.removeEventListener('hashchange', syncPath);
    };
  }, []);

  useEffect(() => {
    if (currentPath === 'exam-room' && (!activePaper || !Array.isArray(activePaper.questions))) {
      setCurrentPath('paper-library');
    }
    if (currentPath === 'exam-result' && !activeSubmission) {
      setCurrentPath('paper-library');
    }
  }, [currentPath, activePaper, activeSubmission, setCurrentPath]);

  useEffect(() => {
    try {
      if (activePaper) localStorage.setItem('examcraft_active_paper', JSON.stringify(activePaper));
      else localStorage.removeItem('examcraft_active_paper');
    } catch {}
  }, [activePaper]);

  useEffect(() => {
    try {
      if (activeSubmission) localStorage.setItem('examcraft_active_submission', JSON.stringify(activeSubmission));
      else localStorage.removeItem('examcraft_active_submission');
    } catch {}
  }, [activeSubmission]);

  const handleSavePaper = (paper, navigateToLibrary = false) => {
    if (!paper) return;
    const cleanQuestions = Array.isArray(paper.questions)
      ? deduplicateQuestions(paper.questions, paper.title)
      : [];
    const normalizedPaper = {
      ...paper,
      subject: paper.subject || inferPaperSubject(paper),
      questions: cleanQuestions,
      questionCount: cleanQuestions.length
    };
    setPapers((prev) => {
      const existsIndex = prev.findIndex((p) => p.id === normalizedPaper.id);
      let next;
      if (existsIndex >= 0) {
        next = [...prev];
        next[existsIndex] = normalizedPaper;
      } else {
        next = [normalizedPaper, ...prev];
      }
      try {
        localStorage.setItem('examcraft_papers', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (navigateToLibrary) {
      setCurrentPath('paper-library');
    }
  };

  const handleDeletePaper = (paper) => {
    if (!paper?.id) return;
    const nextPapers = papers.filter((item) => item.id !== paper.id);
    setPapers(nextPapers);
    try {
      localStorage.setItem('examcraft_papers', JSON.stringify(nextPapers));
      localStorage.removeItem(`examcraft_answers_${paper.id}`);
      localStorage.removeItem(`examcraft_question_marks_${paper.id}`);
      (paper.questions || []).forEach((question, index) => {
        const key = question?.id || `q_${question?.num || index}`;
        const textKey = `examcraft_scratchpad_${paper.id}_${key}`;
        const canvasKey = `examcraft_scratchpad_canvas_${paper.id}_${key}`;
        [textKey, canvasKey, `${canvasKey}_elements`, `${canvasKey}_recovery`].forEach((storageKey) => {
          localStorage.removeItem(storageKey);
        });
      });
    } catch {}

    const isLinkedSubmission = (submission) =>
      submission.paperId === paper.id || (!submission.paperId && submission.paperTitle === paper.title);
    try {
      const rawSubmissions = localStorage.getItem('examcraft_submissions');
      if (rawSubmissions) {
        const savedSubmissions = JSON.parse(rawSubmissions);
        if (Array.isArray(savedSubmissions)) {
          localStorage.setItem('examcraft_submissions', JSON.stringify(savedSubmissions.filter((item) => !isLinkedSubmission(item))));
        }
      }
    } catch {}

    if (activePaper?.id === paper.id) {
      setActivePaper(null);
      setQuestions([]);
      try { localStorage.removeItem(`examcraft_active_paper`); } catch {}
    }
    if (activeSubmission && isLinkedSubmission(activeSubmission)) setActiveSubmission(null);
  };

  const handleStartExam = (paper) => {
    if (!paper) {
      setCurrentPath('exam-generator');
      return;
    }
    const cleanQuestions = Array.isArray(paper.questions)
      ? deduplicateQuestions(paper.questions, paper.title)
      : [];
    const updatedPaper = {
      ...paper,
      questions: cleanQuestions,
      questionCount: cleanQuestions.length,
      status: paper.status === '已封卷' ? '已封卷' : '考试中'
    };
    setActivePaper(updatedPaper);
    handleSavePaper(updatedPaper, false);
    setQuestions(cleanQuestions);
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

  const handleUpdateSubmission = (updatedSubmission) => {
    setActiveSubmission(updatedSubmission);
    try {
      const raw = localStorage.getItem('examcraft_submissions');
      const submissions = raw ? JSON.parse(raw) : [];
      localStorage.setItem('examcraft_submissions', JSON.stringify(
        submissions.map((item) => item.id === updatedSubmission.id ? updatedSubmission : item)
      ));
    } catch (error) {
      console.warn('Could not update saved submission:', error);
    }
  };

  const handleStartExamWithMistakes = (collectionTitle, sourceItems = []) => {
    const examQuestions = sourceItems.map((item, index) => ({
      id: `review-${item.id || Date.now()}-${index}`,
      num: index + 1,
      type: item.type || '解答题',
      score: Number(item.score) || 5,
      prompt: item.fullPrompt || item.title || `复练题 ${index + 1}`,
      mathExpression: item.formula || '',
      options: Array.isArray(item.options) ? item.options : [],
      standardAnswer: item.standardAnswer || '',
      analysis: item.analysis || item.aiInsight || ''
    }));
    if (!examQuestions.length) return;
    const totalScore = examQuestions.reduce((sum, q) => sum + q.score, 0);
    const mistakePaper = {
      id: 'mistake-exam-' + Date.now(),
      title: `《${collectionTitle} · 错题专项靶向重练卷》`,
      source: '错题本复练',
      sourceType: 'custom',
      date: '刚刚',
      questionCount: examQuestions.length,
      totalScore,
      duration: Math.max(10, examQuestions.length * 5),
      difficulty: 5,
      tags: ['#错题复练', '#标准答案核对'],
      status: '未作答'
    };
    setActivePaper(mistakePaper);
    setQuestions(examQuestions);
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
      <main className={`flex-1 flex flex-col ${!isFullScreenMode ? 'pt-14 pb-16 md:pb-0' : ''}`}>
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
            onSavePaper={handleSavePaper}
            onNavigate={setCurrentPath}
          />
        )}

        {currentPath === 'paper-library' && (
          <PaperLibraryView
            papers={papers}
            onSavePaper={handleSavePaper}
            onStartExam={handleStartExam}
            onDeletePaper={handleDeletePaper}
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
            onExit={() => setCurrentPath('paper-library')}
            onOpenMistakes={() => setCurrentPath('question-bank')}
            onSubmitExam={handleSubmitExam}
            onUpdatePaper={handleSavePaper}
          />
        )}

        {currentPath === 'exam-result' && (
          <ExamResultReportView
            submission={activeSubmission}
            onUpdateSubmission={handleUpdateSubmission}
            onBackToLibrary={() => setCurrentPath('paper-library')}
            onRetakeExam={() => {
              if (activePaper) handleStartExam(activePaper);
              else setCurrentPath('paper-library');
            }}
            onOpenNotebook={() => setCurrentPath('question-bank')}
          />
        )}
      </main>

      {!isFullScreenMode && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-outline-variant/30 bg-surface-container-lowest/95 px-1 pt-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(25,25,45,0.06)] backdrop-blur-md md:hidden" aria-label="手机端主导航">
          {[
            { path: 'dashboard', label: '首页', icon: 'dashboard' },
            { path: 'exam-generator', label: '组卷', icon: 'auto_fix_high' },
            { path: 'paper-library', label: '试卷', icon: 'library_books' },
            { path: 'question-bank', label: '题集', icon: 'collections_bookmark' }
          ].map((item) => {
            const active = currentPath === item.path;
            return (
              <button key={item.path} type="button" onClick={() => setCurrentPath(item.path)} aria-current={active ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors ${active ? 'text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
                <span className={`material-symbols-outlined text-[20px] ${active ? 'material-symbols-fill' : ''}`} aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

