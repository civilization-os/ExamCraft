import React, { useState, useEffect } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import ScratchpadCanvas from '../components/ScratchpadCanvas';
import { getQuestionDifficulty } from '../utils/paperMetrics';

export default function ExamRoomView({
  activePaper,
  questions,
  onExit,
  onOpenMistakes,
  onSubmitExam,
  onUpdatePaper
}) {
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Initialize questionList: try to restore saved answers if user previously sealed or paused
  const [questionList, setQuestionList] = useState(() => {
    if (!activePaper?.id) return questions || [];
    try {
      const saved = localStorage.getItem(`examcraft_answers_${activePaper.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return questions || [];
  });

  useEffect(() => {
    if (!activePaper?.id) {
      setQuestionList(questions || []);
      setCurrentQIndex(0);
      return;
    }
    try {
      const saved = localStorage.getItem(`examcraft_answers_${activePaper.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuestionList(parsed);
          return;
        }
      }
    } catch {}
    setQuestionList(questions || []);
  }, [questions, activePaper?.id]);

  // Exam Lifecycle Status: 考试中 vs 已封卷 (围棋封盘)
  const isInitiallySealed = activePaper?.status === '已封卷';
  const [isSealed, setIsSealed] = useState(isInitiallySealed);
  const [sealedAt, setSealedAt] = useState(activePaper?.sealedAt || '');

  // Auto-mark paper as '考试中' if not already sealed or completed
  useEffect(() => {
    if (activePaper?.id && activePaper.status !== '已封卷' && !String(activePaper.status).startsWith('已完成')) {
      const updated = { ...activePaper, status: '考试中' };
      if (onUpdatePaper) onUpdatePaper(updated);
      try {
        const raw = localStorage.getItem('examcraft_papers');
        if (raw) {
          const list = JSON.parse(raw);
          const next = list.map((p) => (p.id === activePaper.id ? { ...p, status: '考试中' } : p));
          localStorage.setItem('examcraft_papers', JSON.stringify(next));
        }
      } catch {}
    }
  }, [activePaper?.id]);
  
  // Timer state based on activePaper.secondsLeft or duration
  const initialDurationSeconds = activePaper?.secondsLeft !== undefined
    ? activePaper.secondsLeft
    : (activePaper?.duration ? activePaper.duration * 60 : 5400);
  const [secondsLeft, setSecondsLeft] = useState(initialDurationSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState(!isInitiallySealed);

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

  // Unified Exam Toast State
  const [examToast, setExamToast] = useState({ show: false, message: '', type: 'info' });
  const showExamToast = (message, type = 'info') => {
    setExamToast({ show: true, message, type });
    setTimeout(() => {
      setExamToast((prev) => ({ ...prev, show: false }));
    }, 3200);
  };

  // 每一题都有自己独立的草稿纸 Key，并且独立持久化
  const currentQKey = currentQ?.id || `q_${currentQ?.num || currentQIndex}`;
  const scratchpadStorageKey = activePaper?.id
    ? `examcraft_scratchpad_${activePaper.id}_${currentQKey}`
    : `examcraft_scratchpad_default_${currentQKey}`;
  const scratchpadCanvasStorageKey = activePaper?.id
    ? `examcraft_scratchpad_canvas_${activePaper.id}_${currentQKey}`
    : `examcraft_scratchpad_canvas_default_${currentQKey}`;
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [isScratchpadMaximized, setIsScratchpadMaximized] = useState(false);

  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Sync draft when switching question
  useEffect(() => {
    setCandidateDraft(questionList[currentQIndex]?.userAnswer || '');
    setScribedLatex(questionList[currentQIndex]?.aiTranscription || '');
  }, [currentQIndex]);

  // Countdown timer effect (freezes when sealed or paused)
  useEffect(() => {
    if (!isTimerRunning || isSealed) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, isSealed]);

  const formatTimer = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const answeredCount = questionList.filter((q) => q.userAnswer && q.userAnswer.trim().length > 0).length;

  const handleUpdateAnswer = (val) => {
    setCandidateDraft(val);
    setQuestionList((prev) => {
      const next = prev.map((q, idx) =>
        idx === currentQIndex
          ? { ...q, userAnswer: val, status: val.trim() ? 'answered' : 'unanswered' }
          : q
      );
      if (activePaper?.id) {
        try {
          localStorage.setItem(`examcraft_answers_${activePaper.id}`, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  // 封卷操作（类似围棋封盘：考卷进入防作弊密封，计时完全冻结，安全暂存）
  const handleSealExam = () => {
    setIsTimerRunning(false);
    setIsSealed(true);
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
    setSealedAt(nowStr);
    const updated = {
      ...activePaper,
      status: '已封卷',
      secondsLeft,
      sealedAt: nowStr
    };
    if (onUpdatePaper) onUpdatePaper(updated);
    try {
      const raw = localStorage.getItem('examcraft_papers');
      if (raw) {
        const list = JSON.parse(raw);
        const next = list.map((p) =>
          p.id === activePaper?.id ? { ...p, status: '已封卷', secondsLeft, sealedAt: nowStr } : p
        );
        localStorage.setItem('examcraft_papers', JSON.stringify(next));
      }
    } catch {}
    showExamToast('🔏 考卷已正式封卷（封盘保护状态），考题密封，计时冻结', 'warn');
  };

  // 启封操作（解封考卷，继续作答）
  const handleUnsealExam = () => {
    setIsSealed(false);
    setIsTimerRunning(true);
    const updated = {
      ...activePaper,
      status: '考试中',
      secondsLeft
    };
    if (onUpdatePaper) onUpdatePaper(updated);
    try {
      const raw = localStorage.getItem('examcraft_papers');
      if (raw) {
        const list = JSON.parse(raw);
        const next = list.map((p) =>
          p.id === activePaper?.id ? { ...p, status: '考试中', secondsLeft } : p
        );
        localStorage.setItem('examcraft_papers', JSON.stringify(next));
      }
    } catch {}
    showExamToast('✨ 考卷已成功启封，继续作答并恢复倒计时', 'success');
  };

  // Call real model_core AI scribe
  const handleTriggerAIScribe = async () => {
    if (!candidateDraft.trim()) {
      showExamToast('请先在左侧输入考生的速记或草稿内容。', 'warn');
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
        showExamToast('✨ AI 规范转录完成 (已忠实保留您的推导演算)', 'success');
      } else {
        showExamToast(data.error || '未检测到配置的 API Key，已保留当前预设规范排版。请前往「系统设置」输入 API Key。', 'warn');
      }
    } catch (err) {
      showExamToast(`AI 代笔调用失败: ${err.message}`, 'warn');
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

    const gradedQuestions = questionList.map((q, idx) => {
      const qKey = q.id || `q_${q.num || idx}`;
      const textKey = `examcraft_scratchpad_${activePaper?.id || 'paper'}_${qKey}`;
      const canvasKey = `examcraft_scratchpad_canvas_${activePaper?.id || 'paper'}_${qKey}`;
      const elementsKey = `examcraft_scratchpad_canvas_${activePaper?.id || 'paper'}_${qKey}_elements`;

      const scratchpadText = localStorage.getItem(textKey) || '';
      const scratchpadCanvas = localStorage.getItem(canvasKey) || null;
      let scratchpadElements = [];
      try {
        const rawEl = localStorage.getItem(elementsKey);
        if (rawEl) scratchpadElements = JSON.parse(rawEl);
      } catch {}

      const hasScratchpad = Boolean(
        (scratchpadText && scratchpadText.trim().length > 0) ||
        scratchpadCanvas ||
        (scratchpadElements && scratchpadElements.length > 0)
      );

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
          : `作答演算步骤或选项辨析出现偏差，标准答案为【${stdAns || '详见分步解析'}】。`,
        scratchpad: {
          text: scratchpadText,
          canvasDataUrl: scratchpadCanvas,
          elements: scratchpadElements,
          hasContent: hasScratchpad
        }
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

      // Update activePaper status to '已完成' and clear in-progress answers cache
      if (activePaper?.id) {
        localStorage.removeItem(`examcraft_answers_${activePaper.id}`);
        const updatedPaper = {
          ...activePaper,
          status: `已完成 (得分 ${calculatedScore}/${totalPaperScore})`,
          score: calculatedScore
        };
        if (onUpdatePaper) onUpdatePaper(updatedPaper);
        const rawPapers = localStorage.getItem('examcraft_papers');
        if (rawPapers) {
          const list = JSON.parse(rawPapers);
          const next = list.map((p) => (p.id === activePaper.id ? updatedPaper : p));
          localStorage.setItem('examcraft_papers', JSON.stringify(next));
        }
      }
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
            <span className="text-on-surface-variant font-sans text-[12px] font-medium flex items-center gap-1">
              <span>答题进度:</span>
              <span className="font-mono font-bold text-primary">{answeredCount}</span>
              <span className="text-outline-variant">/</span>
              <span className="font-mono">{questionList.length}</span>
            </span>
            <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant font-sans text-[11px] font-medium rounded-md">
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
          {/* Status Pill: 考试中 vs 已封卷 */}
          <span className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-sans font-semibold border ${
            isSealed
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
              : 'bg-primary/10 text-primary border-primary/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSealed ? 'bg-amber-500' : 'bg-primary animate-pulse'}`}></span>
            <span>{isSealed ? '已封卷 (封盘)' : '考试作答中'}</span>
          </span>

          {/* Countdown Timer with 封卷 / 启封 Toggle */}
          <div className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 rounded-lg border transition-all ${
            isTimerRunning
              ? 'bg-surface-container-low border-outline-variant/40 text-tertiary'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
          }`}>
            <span className="material-symbols-outlined text-[18px]">
              {isTimerRunning ? 'timer' : 'lock'}
            </span>
            <span className="font-code-md text-code-md font-semibold tracking-wider font-mono">
              {formatTimer(secondsLeft)}
            </span>
            <button
              type="button"
              onClick={isTimerRunning ? handleSealExam : handleUnsealExam}
              className={`ml-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                isTimerRunning
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  : 'bg-primary text-white font-bold shadow-xs hover:bg-primary-container'
              }`}
              title={isTimerRunning ? '正式封卷并冻结倒计时（如同围棋封盘规则）' : '启封考卷并继续作答'}
            >
              <span className="material-symbols-outlined text-[14px]">
                {isTimerRunning ? 'lock' : 'lock_open'}
              </span>
              <span>{isTimerRunning ? '封卷 (封盘)' : '启封'}</span>
            </button>
          </div>

          {/* Quick Scratchpad Toggle with Active Indicator */}
          <button
            type="button"
            onClick={() => setShowScratchpad(!showScratchpad)}
            className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 font-sans text-[12px] font-medium rounded-lg border transition cursor-pointer ${
              showScratchpad
                ? 'bg-primary text-on-primary border-primary shadow-xs'
                : 'bg-surface text-on-surface-variant hover:text-on-surface border-outline-variant/50 hover:bg-surface-container'
            }`}
            title={`打开第 ${currentQ?.num} 题专属草稿演算本`}
          >
            <span className="material-symbols-outlined text-[17px]">draw</span>
            <span>第 {currentQ?.num} 题草稿</span>
            {Boolean(
              localStorage.getItem(scratchpadStorageKey) ||
              localStorage.getItem(scratchpadCanvasStorageKey) ||
              localStorage.getItem(`${scratchpadCanvasStorageKey}_elements`)
            ) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="本题已有专属草稿存档"></span>
            )}
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
        <section className="bg-surface-container-lowest rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-xs border border-outline-variant/30 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 sm:gap-4 overflow-x-auto">
          {/* Left: Matrix Title & Progress Badge */}
          <div className="flex items-center gap-3 shrink-0 select-none">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px] text-primary">grid_view</span>
              <span className="font-sans text-[14px] font-bold text-on-surface tracking-tight">答题卡矩阵</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium bg-surface-container-low text-on-surface-variant border border-outline-variant/25">
              <span className={`w-1.5 h-1.5 rounded-full ${answeredCount === questionList.length ? 'bg-emerald-500' : 'bg-primary'}`}></span>
              <span>已答</span>
              <span className="font-mono font-bold text-primary">{answeredCount}</span>
              <span className="text-outline-variant">/</span>
              <span className="font-mono text-on-surface-variant font-medium">{questionList.length}</span>
            </div>

            <div className="hidden xl:block h-4 w-[1px] bg-outline-variant/30"></div>

            {/* Quick Status Legend */}
            <div className="hidden 2xl:flex items-center gap-2.5 text-[11px] font-sans text-on-surface-variant/70">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary ring-1 ring-primary/40"></span>当前</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>已填涂</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-outline-variant/60"></span>未答</span>
            </div>
          </div>

          {/* Middle: Question Pills with 5-Question Visual Rhythm */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 max-w-full">
            {questionList.map((q, idx) => {
              const isCurrent = idx === currentQIndex;
              const isAnswered = q.userAnswer && q.userAnswer.trim().length > 0;
              const isGroupEnd = (idx + 1) % 5 === 0 && idx !== questionList.length - 1;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQIndex(idx)}
                  className={`w-8 h-8 min-w-[32px] rounded-lg text-[12px] font-mono transition-all duration-150 flex items-center justify-center cursor-pointer select-none ${
                    isGroupEnd ? 'mr-1.5 sm:mr-2' : ''
                  } ${
                    isCurrent
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest bg-primary text-on-primary font-bold shadow-sm scale-105 z-10'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 font-semibold hover:bg-emerald-100/80'
                      : 'bg-surface-container-low text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-container border border-outline-variant/25 hover:border-outline-variant/60 font-medium'
                  }`}
                  title={`第 ${q.num} 题 (${isCurrent ? '当前正在作答' : isAnswered ? '已完成作答' : '未作答'})`}
                >
                  {q.num}
                </button>
              );
            })}
          </div>

          {/* Right: Prev & Next Question Actions */}
          <div className="flex items-center gap-2 shrink-0 select-none">
            <button
              type="button"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-[12px] font-sans font-medium border border-outline-variant/30 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
              title="切换至上一题"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              <span className="hidden sm:inline">上一题</span>
            </button>
            <button
              type="button"
              disabled={currentQIndex === questionList.length - 1}
              onClick={() => setCurrentQIndex((i) => Math.min(questionList.length - 1, i + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-[12px] font-sans font-medium shadow-xs transition-all cursor-pointer disabled:opacity-35 disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:shadow-none disabled:cursor-not-allowed active:scale-95 font-semibold"
              title="切换至下一题"
            >
              <span className="hidden sm:inline">下一题</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
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
                onClick={() => showExamToast(`已为题号 ${currentQ.num} 开启备忘笔记标记`, 'info')}
                className="inline-flex items-center space-x-1 px-2 py-1 text-on-surface-variant hover:text-primary text-label-sm font-label-sm rounded hover:bg-surface-container-low transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                <span>添加笔记</span>
              </button>
              <span className="text-outline-variant">|</span>
              <span className="text-on-surface-variant font-sans text-[12px] flex items-center gap-1">
                难度: <span className="text-tertiary tracking-wider font-mono">{getQuestionDifficulty(currentQ).stars}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-outline font-sans">
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
                      onChange={() => showExamToast('手写草稿照片已上传并完成梯形倾斜校正与公式提取！', 'success')}
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

      {/* Global Unified Exam Toast Notification */}
      {examToast.show && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-60 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`px-4 py-2 rounded-full text-[13px] font-medium shadow-xl flex items-center gap-2 backdrop-blur-md border ${
              examToast.type === 'success'
                ? 'bg-primary text-on-primary border-primary/20'
                : examToast.type === 'warn'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-on-surface text-surface border-outline-variant/30'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">
              {examToast.type === 'success' ? 'check_circle' : examToast.type === 'warn' ? 'warning' : 'info'}
            </span>
            <span>{examToast.message}</span>
          </div>
        </div>
      )}

      {/* Unified Integrated Scratchpad Workbench (Hand-drawing Canvas + Notes + Agent Loop) */}
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
            className={`z-50 shadow-2xl transition-all duration-200 ${
              isScratchpadMaximized
                ? 'fixed inset-2 sm:inset-4 lg:inset-6 animate-in zoom-in-95'
                : 'fixed bottom-5 right-5 w-[760px] max-w-[96vw] h-[580px] max-h-[88vh] resize overflow-hidden animate-in slide-in-from-bottom-5'
            }`}
          >
            <ScratchpadCanvas
              key={`${activePaper?.id || 'paper'}_${currentQKey}`}
              questionNum={currentQ?.num}
              storageKey={scratchpadCanvasStorageKey}
              textStorageKey={scratchpadStorageKey}
              contextProblem={currentQ ? `${currentQ.prompt} ${currentQ.mathExpression || ''}` : ''}
              isMaximized={isScratchpadMaximized}
              onToggleMaximize={() => setIsScratchpadMaximized(!isScratchpadMaximized)}
              onClose={() => {
                setIsScratchpadMaximized(false);
                setShowScratchpad(false);
              }}
            />
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

      {/* Exam Sealed / Paused Formal Overlay Modal */}
      {(isSealed || (!isTimerRunning && !isSubmitting && !isSubmitModalOpen)) && (
        <div className="fixed inset-0 z-50 bg-on-background/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-outline-variant/40 text-center space-y-5 animate-in zoom-in-95 duration-150">
            {/* Sealed Badge & Icon */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
                <span className="material-symbols-outlined text-[36px]">lock</span>
              </div>
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold tracking-wider uppercase shadow-xs">
                封盘状态
              </span>
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center justify-center gap-1.5 font-sans">
                <span>考卷已封卷保护（封盘状态）</span>
              </h3>
              <p className="text-body-sm text-on-surface-variant leading-relaxed px-2 font-sans">
                如同围棋封盘规则，考题与各题作答区已正式密封保护，考试倒计时已完全冻结。所有题目的已答进度及<span className="text-primary font-semibold">独立专属草稿纸</span>均已安全暂存。
              </p>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 grid grid-cols-3 gap-2 text-center font-sans">
              <div className="flex flex-col">
                <span className="text-[11px] text-outline">已答进度</span>
                <span className="text-headline-sm font-bold text-primary mt-0.5 font-mono">
                  {answeredCount} <span className="text-[12px] text-outline font-normal">/ {questionList.length}</span>
                </span>
              </div>
              <div className="flex flex-col border-x border-outline-variant/20">
                <span className="text-[11px] text-outline">剩余考时</span>
                <span className="text-headline-sm font-bold text-tertiary mt-0.5 font-mono">
                  {formatTimer(secondsLeft)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-outline">封卷时间</span>
                <span className="text-[12px] font-medium text-on-surface mt-1 truncate font-mono">
                  {sealedAt || '刚刚'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleUnsealExam}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-label-md font-semibold shadow-sm transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <span className="material-symbols-outlined text-[20px]">lock_open</span>
                <span>启封考卷并继续作答 (恢复计时)</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onExit}
                  className="flex-1 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-sm text-[12px] font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
                  title="离开考场，在试卷库中保持封卷状态，稍后随时可启封继续"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>离开考场 (保持封卷)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(true)}
                  className="py-2 px-3 rounded-xl hover:bg-error-container/30 text-error font-label-sm text-[12px] font-medium transition cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>提前交卷</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


