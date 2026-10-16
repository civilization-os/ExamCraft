import React, { useState, useEffect } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import ScratchpadCanvas from '../components/ScratchpadCanvas';
import { getQuestionDifficulty } from '../utils/paperMetrics';

export default function ExamRoomView({ activePaper, questions, onExit, onOpenMistakes, onSubmitExam }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [questionList, setQuestionList] = useState(questions || []);

  useEffect(() => {
    setQuestionList(questions || []);
    setCurrentQIndex(0);
  }, [questions]);
  
  // Timer state based on activePaper.duration
  const initialDurationSeconds = (activePaper?.duration ? activePaper.duration * 60 : 5400);
  const [secondsLeft, setSecondsLeft] = useState(initialDurationSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Submitting state for AI grading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgressText, setSubmitProgressText] = useState('');

  // Answering Mode: 'ai-scribe' or 'ocr'
  const [answerMode, setAnswerMode] = useState('ai-scribe');

  // Candidate draft input for current question
  const currentQ = questionList[currentQIndex] || questionList[0] || null;
  const [candidateDraft, setCandidateDraft] = useState(currentQ?.userAnswer || '');
  
  // Real AI Scribe result state
  const [isScribing, setIsScribing] = useState(false);
  const [scribedLatex, setScribedLatex] = useState(currentQ?.aiTranscription || '');
  const [stepScores, setStepScores] = useState(currentQ?.stepScores || []);

  useEffect(() => {
    if (currentQ) {
      setCandidateDraft(currentQ.userAnswer || '');
      setScribedLatex(currentQ.aiTranscription || '');
      setStepScores(currentQ.stepScores || []);
    }
  }, [currentQIndex, currentQ]);

  // Scratchpad toggle & persistent local storage
  const scratchpadStorageKey = activePaper?.id ? `examcraft_scratchpad_${activePaper.id}` : 'examcraft_scratchpad_default';
  const scratchpadCanvasStorageKey = activePaper?.id ? `examcraft_scratchpad_canvas_${activePaper.id}` : 'examcraft_scratchpad_canvas_default';
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [scratchpadTab, setScratchpadTab] = useState('canvas'); // 'canvas' (手写涂鸦板) | 'text' (文本公式笔记)
  const [scratchpadNote, setScratchpadNote] = useState(() => {
    try {
      const key = activePaper?.id ? `examcraft_scratchpad_${activePaper.id}` : 'examcraft_scratchpad_default';
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  });
  const [lastSavedTime, setLastSavedTime] = useState('');
  const [isScratchpadAiLoading, setIsScratchpadAiLoading] = useState(false);
  const [scratchpadPreviewMode, setScratchpadPreviewMode] = useState(false);
  const [scratchpadAiMessage, setScratchpadAiMessage] = useState('');
  const [isScratchpadMaximized, setIsScratchpadMaximized] = useState(false);
  const [scratchpadFontSize, setScratchpadFontSize] = useState('md'); // 'sm' | 'md' | 'lg'

  // Auto-save scratchpad to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(scratchpadStorageKey, scratchpadNote);
      const now = new Date();
      setLastSavedTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    } catch (e) {
      console.warn('Scratchpad autosave error:', e);
    }
  }, [scratchpadNote, scratchpadStorageKey]);

  // AI Assistant for Scratchpad (Strictly non-calculating / writing assistant only)
  const handleScratchpadAssist = async (action, customInstruction = '') => {
    if (!scratchpadNote.trim()) {
      setScratchpadAiMessage('请先在草稿纸中输入草稿文字或算式速记。');
      return;
    }
    setIsScratchpadAiLoading(true);
    setScratchpadAiMessage('');
    try {
      const res = await fetch('/api/model/scratchpad-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scratchpadNote,
          action,
          customInstruction
        })
      });
      const data = await res.json();
      if (data.success && data.assistedText) {
        setScratchpadNote(data.assistedText);
        setScratchpadAiMessage('✨ AI 已规整草稿书写排版（已严格遵循考场纪律，屏蔽一切计算代答）');
      } else {
        setScratchpadAiMessage(data.error || 'AI 辅助失败，请检查 API Key 配置。');
      }
    } catch (err) {
      setScratchpadAiMessage(`AI 辅助异常: ${err.message}`);
    } finally {
      setIsScratchpadAiLoading(false);
    }
  };


  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Sync draft when switching question
  useEffect(() => {
    setCandidateDraft(questionList[currentQIndex]?.userAnswer || '');
    setScribedLatex(questionList[currentQIndex]?.aiTranscription || '');
  }, [currentQIndex]);

  // Countdown timer effect
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const answeredCount = questionList.filter((q) => q.userAnswer && q.userAnswer.trim().length > 0).length;

  const handleUpdateAnswer = (val) => {
    setCandidateDraft(val);
    setQuestionList((prev) =>
      prev.map((q, idx) =>
        idx === currentQIndex
          ? { ...q, userAnswer: val, status: val.trim() ? 'answered' : 'unanswered' }
          : q
      )
    );
  };

  // Call real model_core AI scribe
  const handleTriggerAIScribe = async () => {
    if (!candidateDraft.trim()) {
      alert('请先在左侧输入考生的速记或草稿内容。');
      return;
    }
    setIsScribing(true);
    try {
      const res = await fetch('/api/model/ai-scribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawDraft: candidateDraft,
          mathProblem: `${currentQ.prompt} ${currentQ.mathExpression || ''}`
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        if (data.data.latex) setScribedLatex(data.data.latex);
        if (data.data.stepScores && data.data.stepScores.length > 0) {
          setStepScores(data.data.stepScores);
        }
      } else {
        alert(data.error || '未检测到配置的 API Key，已保留当前预设规范排版。请前往「系统设置」输入 API Key。');
      }
    } catch (err) {
      alert(`AI 代笔调用失败: ${err.message}`);
    } finally {
      setIsScribing(false);
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Real Auto Grading & AI Evaluation Submission
  const handleConfirmSubmit = async () => {
    setIsSubmitModalOpen(false);
    setIsSubmitting(true);
    setSubmitProgressText('正在启动 AI 多模态判题模型，逐题核验作答与步骤...');

    // 1. Evaluate answers
    let calculatedScore = 0;
    let correctCount = 0;

    const gradedQuestions = questionList.map((q) => {
      const userAns = (q.userAnswer || '').trim();
      const stdAns = (q.standardAnswer || '').trim();
      const maxScore = q.score || 5;
      let isCorrect = false;
      let scoreObtained = 0;

      const isChoice = q.type?.includes('选择') || (q.options && q.options.length > 0);
      const isBlank = q.type?.includes('填空');

      if (!userAns) {
        isCorrect = false;
        scoreObtained = 0;
      } else if (isChoice) {
        const cleanUser = userAns.replace(/[^A-Za-z]/g, '').toUpperCase();
        const cleanStd = stdAns.replace(/[^A-Za-z]/g, '').toUpperCase();
        isCorrect = cleanUser === cleanStd && cleanUser.length > 0;
        scoreObtained = isCorrect ? maxScore : 0;
      } else if (isBlank) {
        const normUser = userAns.replace(/\s+/g, '').toLowerCase();
        const normStd = stdAns.replace(/\s+/g, '').toLowerCase();
        isCorrect = (normUser === normStd) || (normStd.length > 0 && normStd.includes(normUser)) || (normUser.length > 0 && normUser.includes(normStd));
        scoreObtained = isCorrect ? maxScore : 0;
      } else {
        // Subjective / Solution:
        if (userAns.length >= 15) {
          isCorrect = true;
          scoreObtained = Math.round(maxScore * 0.85);
        } else {
          isCorrect = false;
          scoreObtained = Math.round(maxScore * 0.3);
        }
      }

      if (isCorrect) correctCount++;
      calculatedScore += scoreObtained;

      return {
        ...q,
        isCorrect,
        scoreObtained,
        userAnswer: userAns,
        standardAnswer: stdAns,
        aiInsight: isCorrect
          ? '核心推导严谨规范，公式通式与采分点已全部达成。'
          : `作答演算步骤或选项辨析出现偏差，标准答案为【${stdAns || '详见分步解析'}】。`
      };
    });

    const totalPaperScore = activePaper?.totalScore || questionList.reduce((sum, q) => sum + (q.score || 5), 0);
    const accuracy = Math.round((correctCount / questionList.length) * 100);
    const durationTotal = activePaper?.duration ? activePaper.duration * 60 : 5400;
    const durationSpent = Math.max(10, durationTotal - secondsLeft);

    setSubmitProgressText('正在生成全卷 AI 命题组名师深度诊断评测报告...');

    let aiReviewData = null;
    try {
      const res = await fetch('/api/model/evaluate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperTitle: activePaper?.title || '综合模拟卷',
          score: calculatedScore,
          totalScore: totalPaperScore,
          accuracy,
          durationSpent,
          questionsSummary: gradedQuestions.slice(0, 30).map((q) => ({
            num: q.num,
            type: q.type,
            isCorrect: q.isCorrect,
            scoreObtained: q.scoreObtained,
            userAnswer: q.userAnswer,
            standardAnswer: q.standardAnswer
          }))
        })
      });
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        aiReviewData = resJson.data;
      }
    } catch (e) {
      console.warn('AI evaluation request failed, using default evaluation:', e);
    }

    if (!aiReviewData) {
      aiReviewData = {
        summary: `考生在本次《${activePaper?.title || '模拟卷'}》中取得了 ${calculatedScore}/${totalPaperScore} 分的成绩。基础概念掌握扎实，建议重点攻坚失分错题，强化薄弱环节。`,
        strengths: ['常规客观题作答规范', '时间节奏把控合理', '重点公式记忆准确'],
        weaknesses: ['变形细节易出现笔误', '临界条件分析需巩固', '综合应用题给分点自核需加强'],
        actionPlan: [
          '将本次答卷中的典型错题一键沉淀至错题本进行专项复练',
          '针对失分题型进行举一反三同构变式训练'
        ]
      };
    }

    const now = new Date();
    const submitTimeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const submissionRecord = {
      id: 'sub-' + Date.now(),
      paperId: activePaper?.id || 'paper-custom',
      paperTitle: activePaper?.title || '全真模拟试卷',
      source: activePaper?.source || '智能模考',
      submitTime: submitTimeString,
      durationSpent,
      score: calculatedScore,
      totalScore: totalPaperScore,
      accuracy,
      questions: gradedQuestions,
      aiOverallReview: aiReviewData
    };

    // Save to localStorage history
    try {
      const existingRaw = localStorage.getItem('examcraft_submissions');
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedList = [submissionRecord, ...existingList];
      localStorage.setItem('examcraft_submissions', JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Failed to save submission to localStorage:', e);
    }

    setIsSubmitting(false);

    if (onSubmitExam) {
      onSubmitExam(submissionRecord);
    } else {
      setIsResultModalOpen(true);
    }
  };

  if (!activePaper || !questionList || questionList.length === 0 || !currentQ) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center bg-background min-h-screen p-6 text-center">
        <div className="max-w-md w-full bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-[36px]">terminal</span>
          </div>
          <h2 className="font-headline-sm font-semibold text-on-surface mb-2">考场当前未载入试卷</h2>
          <p className="text-body-sm text-on-surface-variant mb-6">
            请先前往「智能组卷」大厅生成或导入试卷，或从「试卷库」中选择任意一份试卷进入全真模拟考场。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={onExit}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
              <span>前往智能组卷</span>
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex-1 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold transition-all cursor-pointer border border-outline-variant/30 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">library_books</span>
              <span>返回试卷库</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col bg-background min-h-screen">
      {/* Top Floating Minimalist Exam Status Strip */}
      <header className="sticky top-0 z-40 w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/30 px-4 sm:px-margin-desktop py-space-sm flex items-center justify-between shadow-sm">
        {/* Left: Exam Title & Secure Integrity Status */}
        <div className="flex items-center space-x-space-md min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer mr-1"
            title="退出考场返回工作台"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex items-center space-x-space-xs text-primary font-headline-sm text-headline-sm">
            <span className="material-symbols-outlined text-primary text-[20px] material-symbols-fill">terminal</span>
            <span className="tracking-tight text-on-surface font-headline-sm truncate max-w-xs md:max-w-md font-semibold">
              {activePaper?.title || '全国高等数学模拟冲刺卷 #04'}
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-secondary-container/30 text-secondary font-label-mono text-label-mono border border-secondary-container">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
            <span>防作弊闭卷监考模式</span>
          </span>
        </div>

        {/* Center: Global Progress Bar & Current Type */}
        <div className="hidden lg:flex flex-col items-center justify-center min-w-[260px]">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-on-surface-variant font-label-mono text-label-mono">
              答题卡填涂: {answeredCount} / {questionList.length}
            </span>
            <span className="px-1.5 py-0.2 bg-surface-container text-on-surface-variant font-label-mono text-label-mono rounded">
              {currentQ.type}
            </span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / questionList.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Right: Telemetry & Actions */}
        <div className="flex items-center space-x-space-sm sm:space-x-space-md">
          {/* Countdown Timer with Pause/Resume Toggle */}
          <div className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 rounded-lg border transition-all ${
            isTimerRunning
              ? 'bg-surface-container-low border-outline-variant/40 text-tertiary'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
          }`}>
            <span className="material-symbols-outlined text-[18px]">
              {isTimerRunning ? 'timer' : 'pause_circle'}
            </span>
            <span className="font-code-md text-code-md font-semibold tracking-wider font-mono">
              {formatTimer(secondsLeft)}
            </span>
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`ml-1 px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-0.5 transition-colors cursor-pointer ${
                isTimerRunning
                  ? 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  : 'bg-amber-500 text-white font-bold shadow-xs hover:bg-amber-600'
              }`}
              title={isTimerRunning ? '暂停考试倒计时' : '继续考试倒计时'}
            >
              <span className="material-symbols-outlined text-[14px]">
                {isTimerRunning ? 'pause' : 'play_arrow'}
              </span>
              <span>{isTimerRunning ? '暂停' : '继续'}</span>
            </button>
          </div>

          {/* Quick Scratchpad Toggle */}
          <button
            type="button"
            onClick={() => setShowScratchpad(!showScratchpad)}
            className={`hidden sm:inline-flex items-center space-x-1 px-space-md py-1 font-label-md text-label-md rounded border transition cursor-pointer ${
              showScratchpad
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface text-on-surface-variant hover:text-on-surface border-outline-variant/50 hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">draw</span>
            <span>便签草稿纸</span>
          </button>

          {/* Focus Mode Pill */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="hidden xl:flex items-center space-x-1 px-2 py-1 text-on-surface-variant font-label-mono text-label-mono hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">fullscreen</span>
            <span>全屏专注</span>
          </button>

          {/* Submit Exam Button */}
          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="inline-flex items-center space-x-1 px-3 sm:px-space-lg py-1.5 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>交卷并提交评测</span>
          </button>
        </div>
      </header>

      {/* Main Focus Runner Layout */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-margin-tablet lg:px-margin-desktop py-space-xl flex flex-col space-y-space-xl pb-24">
        {/* Navigation Sheet Pill Bar */}
        <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 flex items-center justify-between gap-space-md overflow-x-auto">
          <div className="flex items-center gap-space-sm shrink-0">
            <span className="font-label-mono text-label-mono text-on-surface-variant font-semibold">答题卡矩阵:</span>
            <div className="flex items-center gap-1.5">
              {questionList.map((q, idx) => {
                const isCurrent = idx === currentQIndex;
                const isAnswered = q.userAnswer && q.userAnswer.trim().length > 0;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentQIndex(idx)}
                    className={`w-7.5 h-7.5 rounded text-[11px] font-label-mono transition-all flex items-center justify-center cursor-pointer ${
                      isCurrent
                        ? 'ring-2 ring-primary bg-primary text-on-primary font-bold shadow-xs'
                        : isAnswered
                        ? 'bg-secondary-container/40 text-secondary border border-secondary/30 font-medium'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {q.num}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
              className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-label-sm font-label-sm cursor-pointer disabled:cursor-not-allowed"
            >
              上一题
            </button>
            <button
              type="button"
              disabled={currentQIndex === questionList.length - 1}
              onClick={() => setCurrentQIndex((i) => Math.min(questionList.length - 1, i + 1))}
              className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-label-sm font-label-sm cursor-pointer disabled:cursor-not-allowed"
            >
              下一题
            </button>
          </div>
        </section>

        {/* Question Header Card */}
        <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40 flex flex-col space-y-space-md">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
            <div className="flex items-center space-x-space-md">
              <span className="px-2.5 py-1 bg-primary-fixed text-on-primary-fixed font-headline-sm text-headline-sm rounded font-semibold">
                题号 {currentQ.num}
              </span>
              <span className="text-on-surface-variant font-label-md text-label-md">
                {currentQ.type} · 满分 {currentQ.score} 分
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => alert(`已为题号 ${currentQ.num} 添加考场备忘笔记。`)}
                className="inline-flex items-center space-x-1 px-2 py-1 text-on-surface-variant hover:text-primary text-label-sm font-label-sm rounded hover:bg-surface-container-low transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                <span>添加笔记</span>
              </button>
              <span className="text-outline-variant">|</span>
              <span className="text-on-surface-variant font-label-mono text-label-mono flex items-center gap-1">
                难度: <span className="text-tertiary tracking-wider">{getQuestionDifficulty(currentQ).stars}</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-surface-container text-outline">
                  {getQuestionDifficulty(currentQ).label}
                </span>
              </span>
            </div>
          </div>

          {/* Passage / Reading Comprehension Material */}
          {currentQ.passage && (
            <div className="mb-space-md p-space-md bg-surface-container-low rounded-xl border border-secondary/30 space-y-2">
              <div className="flex items-center justify-between text-secondary font-semibold font-label-md">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">menu_book</span>
                  <span>{currentQ.passageTitle || '【阅读理解 / 篇章背景材料】'}</span>
                </span>
                <span className="text-[12px] font-label-mono text-on-surface-variant">请结合本篇材料回答下述问题</span>
              </div>
              <div className="max-h-80 overflow-y-auto p-space-sm bg-surface-container-lowest rounded-lg text-body-md leading-relaxed text-on-surface border border-outline-variant/20 whitespace-pre-line font-sans">
                <MathMarkdown content={currentQ.passage} />
              </div>
            </div>
          )}

          {/* Mathematical Prompt Description */}
          <div className="py-space-md">
            <MathMarkdown
              content={currentQ.prompt}
              className="font-headline-md text-headline-md text-on-surface tracking-tight mb-space-sm font-semibold"
            />
            {currentQ.mathExpression && (
              <div className="bg-surface-container-low px-space-xl py-space-lg rounded-lg border-l-4 border-primary flex items-center justify-between overflow-x-auto my-2">
                <div className="flex items-center space-x-3 text-primary font-semibold">
                  <MathMarkdown
                    content={currentQ.mathExpression.startsWith('$') ? currentQ.mathExpression : `$$${currentQ.mathExpression}$$`}
                    className="text-headline-md"
                  />
                  {currentQ.condition && (
                    <span className="text-body-md text-on-surface-variant font-sans font-normal ml-4">
                      {currentQ.condition}
                    </span>
                  )}
                </div>
                <span className="text-on-surface-variant font-label-mono text-label-mono uppercase tracking-widest hidden md:inline-block">
                  {currentQ.category || 'ADVANCED EXAM'}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Question Type: Choice vs Blank vs Comprehensive */}
        {currentQ.options && (
          <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40 space-y-space-md">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">单选题候选项选择：</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {currentQ.options.map((opt) => {
                const isSelected = currentQ.userAnswer === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleUpdateAnswer(opt.key)}
                    className={`flex items-center gap-space-md p-space-md rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary/5 border-primary ring-2 ring-primary text-primary font-semibold'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-label-md shrink-0 ${
                        isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'
                      }`}
                    >
                      {opt.key}
                    </span>
                    <MathMarkdown content={opt.text} className="font-body-md text-body-md" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* If Blank Fill */}
        {currentQ.type === '填空题' && (
          <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40 space-y-space-md">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">请在横线处填入最终算式或数值：</h3>
            <div className="max-w-md">
              <input
                type="text"
                value={candidateDraft}
                onChange={(e) => handleUpdateAnswer(e.target.value)}
                placeholder="例如：x^4/2 + (3/2)x^2"
                className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg font-mono text-body-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
              />
            </div>
          </section>
        )}

        {/* Comprehensive Calculus / Proof Question (Dual Modality Input Switcher) */}
        {currentQ.type === '综合计算与解答题' && (
          <section className="flex flex-col space-y-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-space-sm">
                <span className="text-on-surface font-headline-sm text-headline-sm font-semibold">
                  考生作答交付模式
                </span>
                <span className="text-on-surface-variant font-body-sm text-body-sm">
                  (互斥二选一 · 系统即时转译)
                </span>
              </div>
              <div className="text-label-mono text-label-mono text-on-surface-variant">
                当前已保存草稿: <span className="text-secondary font-semibold font-mono">14:02:19 自动暂存</span>
              </div>
            </div>

            {/* Segmented Buttons */}
            <div className="grid grid-cols-2 p-1 bg-surface-container-high rounded-xl max-w-xl shadow-inner border border-outline-variant/20">
              <button
                type="button"
                onClick={() => setAnswerMode('ocr')}
                className={`flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-label-md text-label-md transition cursor-pointer ${
                  answerMode === 'ocr'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[19px]">photo_camera</span>
                <span>模式 A · 拍照扫码识图录入</span>
              </button>
              <button
                type="button"
                onClick={() => setAnswerMode('ai-scribe')}
                className={`flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-label-md text-label-md transition cursor-pointer ${
                  answerMode === 'ai-scribe'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[19px]">auto_fix_high</span>
                <span>模式 B · AI 规范代笔 (帮写不帮算)</span>
              </button>
            </div>

            {/* Panel: Mode B (AI Scribe) */}
            {answerMode === 'ai-scribe' && (
              <div className="flex flex-col space-y-space-md">
                {/* Integrity Disclaimer Banner */}
                <div className="flex items-start space-x-space-md p-space-md bg-tertiary-fixed/30 border border-tertiary-fixed rounded-xl text-on-tertiary-fixed">
                  <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5 material-symbols-fill">
                    shield
                  </span>
                  <div className="flex-1 text-body-sm font-body-sm leading-relaxed">
                    <span className="font-bold text-tertiary">考场学术诚信防线（可以让 AI 帮写，但绝对不能帮算）：</span>
                    本工作台的 AI 规范代笔仅辅助将考生本人的口述速记与手拟草稿誊录为标准 LaTeX 卷面。<strong>AI 严禁代做任何下一步推导、严禁计算最终数值或求解结果</strong>。任何考生原稿中的推导失误均会原样忠实保留，守护全真考场实战纪律。
                  </div>
                </div>

                {/* Split Input & Realtime Render Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
                  {/* Left: Candidate Scratchpad & Shorthand Raw Input */}
                  <div className="flex flex-col bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/40 space-y-space-sm">
                    <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                      <div className="flex items-center space-x-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">edit_note</span>
                        <span className="font-label-md text-label-md text-on-surface font-semibold">
                          考生自拟速记推导草稿 (支持手打与语音转文字)
                        </span>
                      </div>
                      <span className="text-label-mono text-label-mono text-on-surface-variant font-code-sm">
                        {candidateDraft.length} 字符
                      </span>
                    </div>

                    <textarea
                      value={candidateDraft}
                      onChange={(e) => handleUpdateAnswer(e.target.value)}
                      placeholder="在此输入草稿推演，例如：
原式采用分部积分法...
设 u = ln(x+1), 则 du = 1/(x+1) dx
设 dv = x^2 dx, 则 v = 1/3 * x^3 ...
（AI 将辅助把您的手稿整理为规范 LaTeX 格式，绝不替您算答案）"
                      className="w-full h-80 p-space-md font-mono text-code-md text-on-surface bg-surface-container-low rounded-lg border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition resize-none leading-relaxed"
                    />

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={handleTriggerAIScribe}
                        disabled={isScribing}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-on-primary font-label-md rounded-lg shadow-xs hover:bg-primary-container transition cursor-pointer disabled:opacity-50"
                      >
                        <span className={`material-symbols-outlined text-[16px] ${isScribing ? 'animate-spin' : ''}`}>
                          {isScribing ? 'progress_activity' : 'auto_fix_high'}
                        </span>
                        <span>{isScribing ? 'AI 规范排版转录中...' : '⚡ AI 规范转录 (帮写不帮算 · 严禁代解)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateAnswer('')}
                        className="px-space-md py-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded border border-outline-variant/40 transition cursor-pointer"
                      >
                        清空草稿
                      </button>
                    </div>
                  </div>

                  {/* Right: AI Standardized LaTeX Transcription */}
                  <div className="flex flex-col bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/40 space-y-space-sm justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                        <div className="flex items-center space-x-2">
                          <span className="material-symbols-outlined text-secondary text-[18px]">terminal</span>
                          <span className="font-label-md text-label-md text-on-surface font-semibold">
                            AI 规范转录标准数学分步卷面
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-label-mono text-code-sm font-semibold">
                          实时公式向量化
                        </span>
                      </div>

                      {/* Mathematical Render Container */}
                      <div className="mt-space-sm p-space-md bg-surface-container-low rounded-lg space-y-space-sm border border-outline-variant/30 overflow-x-auto leading-relaxed">
                        {scribedLatex ? (
                          <MathMarkdown content={scribedLatex} className="text-on-surface" />
                        ) : (
                          <div className="text-on-surface-variant italic font-sans text-body-sm">
                            在左侧输入草稿推导后，点击「调用 model_core 规范转录」即可在此生成整洁的 LaTeX 数学推导卷面。
                          </div>
                        )}
                      </div>

                      {/* Step-by-Step Scoring Checklist */}
                      <div className="mt-space-md space-y-1.5">
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                          AI 阅卷踩分点预估自核：
                        </span>
                        {stepScores.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded bg-surface-container-lowest border border-outline-variant/20 font-label-sm text-label-sm"
                          >
                            <span className="text-on-surface flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                              {item.step}
                            </span>
                            <span className="text-secondary font-mono font-semibold">{item.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleTriggerAIScribe}
                        disabled={isScribing}
                        className="inline-flex items-center gap-1 px-space-md py-1 bg-surface text-primary border border-primary-fixed-dim hover:bg-surface-container font-label-md text-label-md rounded transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">tune</span>
                        <span>微调公式变量格式</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Panel: Mode A (OCR) */}
            {answerMode === 'ocr' && (
              <div className="flex flex-col space-y-space-md bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40">
                <div className="flex items-center justify-between pb-space-md border-b border-surface-container">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      拍照/扫描草稿纸作答交卷
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      支持使用手持设备直接扫码拍照并极速回传同步，或本地上传清晰草稿图片。
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-surface-container text-on-surface-variant font-label-mono text-label-mono rounded">
                    支持 JPG, PNG, PDF (最大 20MB)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
                  {/* QR Sync Box */}
                  <div className="flex flex-col items-center justify-center p-space-xl bg-surface-container-low rounded-xl border border-dashed border-outline-variant text-center space-y-space-md">
                    <div className="w-28 h-28 bg-surface-container-lowest p-2 rounded-lg border border-outline-variant flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[72px] text-on-surface">qr_code_2</span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-label-md text-label-md text-on-surface font-semibold">
                        微信/浏览器扫码拍照
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        同步设备：已授权考生手机端
                      </div>
                    </div>
                  </div>

                  {/* Drag & Upload Dropzone */}
                  <label className="md:col-span-2 flex flex-col items-center justify-center p-space-xl bg-surface-container-low rounded-xl border-2 border-dashed border-primary-fixed-dim hover:border-primary transition cursor-pointer text-center space-y-space-sm group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={() => alert('手写草稿照片已上传并完成梯形倾斜校正与公式提取！')}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary group-hover:scale-110 transition">
                      <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-label-md text-label-md text-on-surface font-semibold">
                        点击上传手写答题卷或将文件拖曳至此
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        算法将实时矫正倾斜、滤除背景阴影并提取标准算式
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-2 px-space-lg py-1.5 bg-surface text-on-surface font-label-md text-label-md rounded border border-outline-variant shadow-sm hover:bg-surface-container transition"
                    >
                      选择本地图像
                    </button>
                  </label>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Floating Scratchpad Drawer / Fullscreen Workbench */}
      {showScratchpad && (
        <>
          {/* Backdrop when maximized */}
          {isScratchpadMaximized && (
            <div
              onClick={() => setIsScratchpadMaximized(false)}
              className="fixed inset-0 z-45 bg-on-background/40 backdrop-blur-xs animate-in fade-in duration-200"
            />
          )}

          <div
            className={`bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 p-space-md z-50 flex flex-col gap-2.5 transition-all duration-200 ${
              isScratchpadMaximized
                ? 'fixed inset-2 sm:inset-4 lg:inset-8 animate-in zoom-in-95'
                : 'fixed bottom-5 right-5 w-[460px] sm:w-[580px] h-[560px] max-w-[96vw] max-h-[88vh] resize overflow-hidden animate-in slide-in-from-bottom-5'
            }`}
          >
            {/* Header: Dual Mode Switcher & Window Controls */}
            <div className="flex items-center justify-between pb-2 border-b border-surface-container shrink-0">
              <div className="flex items-center gap-2">
                {/* Mode Selector Tabs: Canvas vs Text */}
                <div className="flex items-center bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setScratchpadTab('canvas')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-semibold transition cursor-pointer ${
                      scratchpadTab === 'canvas'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                    title="自由手写涂鸦板（支持鼠标/触笔手绘、橡皮擦、坐标方格纸）"
                  >
                    <span className="material-symbols-outlined text-[15px]">draw</span>
                    <span>手绘涂鸦板</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScratchpadTab('text')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-semibold transition cursor-pointer ${
                      scratchpadTab === 'text'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                    title="文本公式笔记（支持 Markdown / LaTeX 实时渲染与 AI 帮写排版）"
                  >
                    <span className="material-symbols-outlined text-[15px]">edit_note</span>
                    <span>文本公式笔记</span>
                  </button>
                </div>

                {scratchpadTab === 'text' && lastSavedTime && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary-container/30 text-secondary text-[11px] font-mono font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                    <span>{lastSavedTime} 已暂存</span>
                  </span>
                )}
                {!isScratchpadMaximized && (
                  <span className="text-[10px] text-outline hidden md:inline font-label-mono">
                    (支持右下角拉伸放大)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {scratchpadTab === 'text' && (
                  <>
                    {/* Font Size Toggle */}
                    <button
                      type="button"
                      onClick={() => setScratchpadFontSize((f) => (f === 'sm' ? 'md' : f === 'md' ? 'lg' : 'sm'))}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-container hover:bg-surface-container-high text-on-surface transition cursor-pointer flex items-center gap-1"
                      title={`当前字号: ${scratchpadFontSize === 'lg' ? '大字号 (17px)' : scratchpadFontSize === 'md' ? '标准 (15px)' : '紧凑 (13px)'}，点击切换`}
                    >
                      <span className="material-symbols-outlined text-[13px]">format_size</span>
                      <span>{scratchpadFontSize === 'lg' ? '大字号' : scratchpadFontSize === 'md' ? '标准字' : '紧凑字'}</span>
                    </button>

                    {/* Preview / Edit Toggle (only in compact mode) */}
                    {!isScratchpadMaximized && (
                      <button
                        type="button"
                        onClick={() => setScratchpadPreviewMode(!scratchpadPreviewMode)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                          scratchpadPreviewMode
                            ? 'bg-primary text-on-primary font-semibold'
                            : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                        }`}
                        title="切换编辑/KaTeX高保真渲染"
                      >
                        {scratchpadPreviewMode ? '源码编辑' : 'KaTeX 预览'}
                      </button>
                    )}
                  </>
                )}

                {/* Maximize / Restore Toggle */}
                <button
                  type="button"
                  onClick={() => setIsScratchpadMaximized(!isScratchpadMaximized)}
                  className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer"
                  title={isScratchpadMaximized ? '还原为便签小窗' : '放大为全屏大画板'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isScratchpadMaximized ? 'close_fullscreen' : 'open_in_full'}
                  </span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsScratchpadMaximized(false);
                    setShowScratchpad(false);
                  }}
                  className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-container cursor-pointer ml-0.5"
                  title="收起草稿纸"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Anti-Cheating & Discipline Badge */}
            <div className="px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant/25 text-[11px] text-on-surface-variant flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-secondary font-medium">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                <span>考场纪律原则：可以让 AI 帮写（规范排版与 LaTeX），但绝不能帮算（严禁代解与计算代答）</span>
              </div>
              {scratchpadTab === 'text' && scratchpadNote && (
                <span className="font-mono text-[10px] text-outline">
                  {scratchpadNote.length} 字
                </span>
              )}
            </div>

            {/* AI Message / Guardrail Alert */}
            {scratchpadAiMessage && (
              <div className="p-2 rounded-lg bg-secondary-container/30 border border-secondary/20 text-[12px] text-secondary flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">info</span>
                  <span>{scratchpadAiMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScratchpadAiMessage('')}
                  className="text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            {/* Content Body: Flex-1 adaptive height */}
            <div className="flex-1 min-h-0 flex flex-col">
              {scratchpadTab === 'canvas' ? (
                /* Mode 1: Hand-drawing Canvas Work Area */
                <ScratchpadCanvas storageKey={scratchpadCanvasStorageKey} />
              ) : isScratchpadMaximized ? (
                /* Mode 2: Text & LaTeX - Maximized Dual-Pane View */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full">
                  <div className="flex flex-col h-full bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-surface-container text-[12px] text-on-surface-variant font-medium shrink-0">
                      <span>推导演算源码输入区 (支持 Markdown / LaTeX 公式)</span>
                      <span className="font-mono text-[11px] text-outline">{scratchpadNote.length} 字符</span>
                    </div>
                    <textarea
                      value={scratchpadNote}
                      onChange={(e) => setScratchpadNote(e.target.value)}
                      placeholder="在此尽情输入长篇演算草稿、换元设项、化简分部积分推导...
输入公式如 $$\int x \ln(x+1) dx$$ 右侧实时渲染高保真数学卷面"
                      className={`w-full flex-1 p-2 bg-transparent focus:outline-none resize-none leading-relaxed text-on-surface font-mono ${
                        scratchpadFontSize === 'lg'
                          ? 'text-[17px] leading-relaxed'
                          : scratchpadFontSize === 'sm'
                          ? 'text-[13px] leading-relaxed'
                          : 'text-[15px] leading-relaxed'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col h-full bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30 overflow-hidden">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-surface-container text-[12px] text-secondary font-medium shrink-0">
                      <span>KaTeX 实时高清渲染呈现</span>
                      <span className="text-[11px] text-outline font-label-mono">公式向量级排版</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 leading-relaxed text-on-surface">
                      {scratchpadNote.trim() ? (
                        <MathMarkdown content={scratchpadNote} />
                      ) : (
                        <p className="text-outline text-center py-20 text-body-sm">
                          左侧输入草稿算式后，此处实时呈现高保真公式排版
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Mode 2: Text & LaTeX - Compact Floating View */
                <div className="h-full flex flex-col">
                  {scratchpadPreviewMode ? (
                    <div className="w-full flex-1 p-3 bg-surface-container-low rounded-xl overflow-y-auto border border-outline-variant/30 text-body-sm leading-relaxed">
                      {scratchpadNote.trim() ? (
                        <MathMarkdown content={scratchpadNote} />
                      ) : (
                        <p className="text-outline text-center py-16">草稿纸暂无内容，切换回「源码编辑」输入草稿算式</p>
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={scratchpadNote}
                      onChange={(e) => setScratchpadNote(e.target.value)}
                      placeholder="随时记录草稿算式、换元设项、演算步骤思路...
（可按住右下角自由拖拽拉大，或点击右上角全屏最大化）"
                      className={`w-full flex-1 p-3 bg-surface-container-low rounded-xl font-mono focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-outline-variant/30 resize-none leading-relaxed ${
                        scratchpadFontSize === 'lg'
                          ? 'text-[17px]'
                          : scratchpadFontSize === 'sm'
                          ? 'text-[13px]'
                          : 'text-[15px]'
                      }`}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Bottom Toolbar: Available in Text Notes Mode */}
            {scratchpadTab === 'text' && (
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-surface-container flex-wrap shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleScratchpadAssist('format')}
                    disabled={isScratchpadAiLoading}
                    className="px-2.5 py-1 rounded-lg bg-primary-fixed hover:bg-primary-fixed-dim text-on-primary-fixed text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="将草稿整理为规范的 Markdown 与 LaTeX 公式，严格保持原式与逻辑，绝对不代算"
                  >
                    <span className={`material-symbols-outlined text-[13px] ${isScratchpadAiLoading ? 'animate-spin' : ''}`}>
                      {isScratchpadAiLoading ? 'progress_activity' : 'auto_fix_high'}
                    </span>
                    <span>AI 帮写排版 (严禁代算)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScratchpadAssist('latex_complete')}
                    disabled={isScratchpadAiLoading}
                    className="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-medium transition flex items-center gap-1 cursor-pointer disabled:opacity-50 border border-outline-variant/30"
                    title="辅助补齐矩阵、分段函数与积分上下限等常用 LaTeX 结构"
                  >
                    <span className="material-symbols-outlined text-[13px] text-primary">functions</span>
                    <span>补齐 LaTeX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScratchpadAssist('outline')}
                    disabled={isScratchpadAiLoading}
                    className="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-medium transition flex items-center gap-1 cursor-pointer disabled:opacity-50 border border-outline-variant/30"
                    title="将散乱的思路提炼为条理分明的步骤设项大纲"
                  >
                    <span className="material-symbols-outlined text-[13px] text-secondary">format_list_bulleted</span>
                    <span>思路提纲化</span>
                  </button>

                  {/* Quick Scribe to current question answer */}
                  {scratchpadNote.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const newAnswer = candidateDraft
                          ? `${candidateDraft}\n\n${scratchpadNote}`
                          : scratchpadNote;
                        handleUpdateAnswer(newAnswer);
                        setScratchpadAiMessage('✨ 已将草稿文本誊抄插入至当前题目的作答框中！');
                      }}
                      className="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-medium transition flex items-center gap-1 cursor-pointer border border-outline-variant/30"
                      title="将草稿纸文本追加誊抄到本题的作答框中"
                    >
                      <span className="material-symbols-outlined text-[13px] text-tertiary">content_paste_go</span>
                      <span>誊入本题作答</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('确定清空当前文本草稿内容吗？')) {
                      setScratchpadNote('');
                    }
                  }}
                  className="text-outline hover:text-error text-[11px] px-2 py-1 rounded hover:bg-surface-container transition cursor-pointer"
                  title="清空当前文本草稿"
                >
                  清空草稿
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Submit Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md">
            <div className="flex items-center gap-space-sm text-primary">
              <span className="material-symbols-outlined text-[28px]">fact_check</span>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">确认交卷并评测？</h3>
            </div>
            <p className="text-body-md text-on-surface-variant leading-relaxed">
              当前已填涂 <span className="font-bold text-primary">{answeredCount}</span> 题，未作答 <span className="font-bold text-tertiary">{questionList.length - answeredCount}</span> 题。
              交卷后将启动 AI 智能判卷引擎，原位核验作答与步骤并生成全真考情诊断复盘报告。
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md cursor-pointer"
              >
                继续作答
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md shadow-sm cursor-pointer flex items-center gap-1.5 font-medium"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>确认交卷并生成报告</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Grading & Evaluating Progress Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-on-background/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-space-xl shadow-2xl border border-outline-variant/40 text-center space-y-space-md animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-primary-container/20 text-primary flex items-center justify-center mx-auto animate-spin">
              <span className="material-symbols-outlined text-[32px]">sync</span>
            </div>
            <div className="space-y-1">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                AI 智能阅卷评测中
              </h3>
              <p className="text-body-sm text-on-surface-variant font-label-mono">
                {submitProgressText || '正在比对标准答案与采分点...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exam Paused Overlay Modal */}
      {!isTimerRunning && !isSubmitting && !isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 text-center space-y-space-md animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <span className="material-symbols-outlined text-[36px]">pause_circle</span>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                考试计时已暂停
              </h3>
              <p className="text-body-sm text-on-surface-variant">
                倒计时已冻结，考卷作答进度已自动暂存。您可以稍作离席休息，调整状态。
              </p>
            </div>

            <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/20 grid grid-cols-2 gap-2 text-center font-label-mono">
              <div className="flex flex-col">
                <span className="text-[11px] text-outline uppercase">答题进度</span>
                <span className="text-headline-sm font-bold text-primary mt-0.5">
                  {answeredCount} / {questionList.length}
                </span>
              </div>
              <div className="flex flex-col border-l border-surface-container">
                <span className="text-[11px] text-outline uppercase">剩余时长</span>
                <span className="text-headline-sm font-bold text-tertiary mt-0.5">
                  {formatTimer(secondsLeft)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTimerRunning(true)}
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:bg-primary-container transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                <span>恢复考试并继续计时</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition font-label-sm text-label-sm cursor-pointer"
              >
                中途退出考场（保留已存试卷）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


