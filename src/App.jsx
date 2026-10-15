import React, { useState } from 'react';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import ExamGeneratorView from './views/ExamGeneratorView';
import PaperLibraryView from './views/PaperLibraryView';
import ExamRoomView from './views/ExamRoomView';
import MistakeNotebookView from './views/MistakeNotebookView';
import SettingsView from './views/SettingsView';
import { INITIAL_PAPERS, MOCK_EXAM_QUESTIONS } from './data/mockData';

export default function App() {
  const [currentPath, setCurrentPath] = useState('exam-generator'); // default to Exam Generator Workbench
  const [papers, setPapers] = useState(INITIAL_PAPERS);
  const [activePaper, setActivePaper] = useState(INITIAL_PAPERS[0]);
  const [questions, setQuestions] = useState(MOCK_EXAM_QUESTIONS);

  const handleStartExam = (paper) => {
    setActivePaper(paper);
    setCurrentPath('exam-room');
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
    setCurrentPath('exam-room');
  };

  const isExamRoom = currentPath === 'exam-room';

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans selection:bg-primary-fixed selection:text-primary">
      {/* Top Header - hidden only during full focus exam room mode */}
      {!isExamRoom && (
        <Header
          currentPath={currentPath}
          setCurrentPath={setCurrentPath}
          onOpenExam={() => handleStartExam(papers[0])}
        />
      )}

      {/* Main Container */}
      <main className={`flex-1 flex flex-col ${!isExamRoom ? 'pt-14' : ''}`}>
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
          />
        )}
      </main>
    </div>
  );
}
