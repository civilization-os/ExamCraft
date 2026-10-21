import React, { useState, useEffect, useMemo, useRef } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import ScratchpadCanvas from '../components/ScratchpadCanvas';
import ExamTimerReminderModal from '../components/ExamTimerReminderModal';
import { getQuestionDifficulty } from '../utils/paperMetrics';
import { getQuestionTypeClass, normalizeQuestionType, stripAnswerMaterial, healQuestionOptions, deduplicateQuestions } from '../utils/questionTypes';
import {
  getExamTimerSettings,
  saveExamTimerSettings,
  getTimerColorStage,
  playReminderChime,
  DEFAULT_REMINDER_MINUTES,
  REMINDER_PRESET_OPTIONS
} from '../utils/examTimer';
import { useExamSessionStore, hydrateQuestionsWithAnswers } from '../stores/useExamSessionStore';
import { getToken } from '../utils/auth';

const prefersSplitExamLayout = () => {
  try { return window.matchMedia('(min-width: 1024px)').matches && localStorage.getItem('examcraft_exam_default_layout') !== 'stacked'; }
  catch { return true; }
};

export default function ExamRoomView({
  activePaper,
  questions,
  onExit,
  onOpenMistakes,
  onSubmitExam,
  onUpdatePaper
}) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isAnswerCardCollapsed, setIsAnswerCardCollapsed] = useState(false);
  const [modelUsageStatus, setModelUsageStatus] = useState(null);
  const {
    sessions,
    syncStatus,
    initPaperSession,
    updateAnswer: storeUpdateAnswer,
    toggleQuestionMark: storeToggleQuestionMark,
    updateExamProgress: storeUpdateExamProgress,
    sealExam: storeSealExam,
    unsealExam: storeUnsealExam,
    clearSingleAnswer: storeClearSingleAnswer,
    resetEntireExam: storeResetEntireExam,
    finishAndCleanupSession: storeFinishAndCleanupSession,
    flushPendingSync
  } = useExamSessionStore();
  const normalizeQuestions = (list) => deduplicateQuestions(list, activePaper?.title || '').map((rawQuestion) => {
    const question = healQuestionOptions(rawQuestion);
    let userAnswer = question.userAnswer;
    if (typeof userAnswer === 'string' && /^\s*\{/.test(userAnswer) && /"latex"\s*:/.test(userAnswer)) {
      try {
        const parsed = JSON.parse(userAnswer);
        if (typeof parsed?.latex === 'string') userAnswer = parsed.latex;
      } catch {
        const match = /"latex"\s*:\s*"((?:\\.|[^"\\])*)"/s.exec(userAnswer);
        if (match) userAnswer = match[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"');
      }
    }
    return {
      ...question,
      ...(typeof userAnswer === 'string' ? { userAnswer } : {}),
      type: normalizeQuestionType(question, activePaper?.title || '')
    };
  });

  useEffect(() => {
    let active = true;
    let requestPending = false;
    const refreshStatus = () => {
      if (requestPending) return;
      requestPending = true;
      fetch('/api/model/status')
        .then((res) => res.json())
        .then((data) => { if (active && data.success) setModelUsageStatus(data); })
        .catch(() => {})
        .finally(() => { requestPending = false; });
    };
    refreshStatus();
    const intervalId = window.setInterval(refreshStatus, 10_000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refreshStatus(); };
    window.addEventListener('examcraft-model-config-updated', refreshStatus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('examcraft-model-config-updated', refreshStatus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const baseExamQuestions = useMemo(() => {
    const raw = activePaper?.questions?.length ? activePaper.questions : (questions || []);
    return normalizeQuestions(raw);
  }, [activePaper?.id, activePaper?.questions, questions]);

  // Initialize questionList: 以权威试卷题目为骨架，无损水合本地答题卡，绝不丢失原卷题目与题干
  const [questionList, setQuestionList] = useState(() => {
    const base = baseExamQuestions;
    if (!activePaper?.id || base.length === 0) return base;
    try {
      const saved = localStorage.getItem(`examcraft_answers_${activePaper.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return hydrateQuestionsWithAnswers(base, parsed);
        }
      }
    } catch {}
    return base;
  });

  useEffect(() => {
    let cancelled = false;
    const base = baseExamQuestions;
    if (!activePaper?.id || base.length === 0) {
      setQuestionList(base);
      setCurrentQIndex(0);
      return;
    }

    // 1. 本地极速秒开渲染 (以试卷原题为骨架无损水合本地答案)
    try {
      const saved = localStorage.getItem(`examcraft_answers_${activePaper.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuestionList(hydrateQuestionsWithAnswers(base, parsed));
        }
      }
    } catch {}

    // 2. 异步拉取云端实时答题会话并智能水合（手机 ⇄ 电脑多端无缝接续，永不丢题）
    initPaperSession(activePaper, base).then((session) => {
      if (cancelled || !session) return;
      if (Array.isArray(session.answers) && session.answers.length > 0) {
        setQuestionList(hydrateQuestionsWithAnswers(base, session.answers));
      }
      if (Array.isArray(session.markedQuestionKeys)) {
        setMarkedQuestionKeys(session.markedQuestionKeys);
      }
      if (typeof session.secondsLeft === 'number') {
        setSecondsLeft(session.secondsLeft);
        secondsLeftRef.current = session.secondsLeft;
      }
      if (typeof session.currentQIndex === 'number' && session.currentQIndex >= 0 && session.currentQIndex < (base?.length || 100)) {
        setCurrentQIndex(session.currentQIndex);
      }
      if (session.status === '已封卷') {
        setIsSealed(true);
        setIsTimerRunning(false);
        setSealedAt(session.sealedAt || '');
      }
    }).catch((err) => {
      console.warn('[ExamRoomView] Session init warning:', err);
    });

    // 3. 多端漫游感知：当用户从手机/其他标签切回当前前台时，自动智能合并最新的作答进展
    let lastFocusSyncTime = Date.now();
    const handleVisibilitySync = () => {
      if (document.visibilityState === 'visible' && !cancelled && activePaper?.id && getToken()) {
        const now = Date.now();
        // 限制防抖：至少间隔 5 秒
        if (now - lastFocusSyncTime < 5000) return;
        lastFocusSyncTime = now;

        initPaperSession(activePaper, base).then((session) => {
          if (cancelled || !session) return;
          if (Array.isArray(session.answers) && session.answers.length > 0) {
            setQuestionList(hydrateQuestionsWithAnswers(base, session.answers));
          }
          if (Array.isArray(session.markedQuestionKeys)) {
            setMarkedQuestionKeys(session.markedQuestionKeys);
          }
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilitySync);
    window.addEventListener('focus', handleVisibilitySync);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilitySync);
      window.removeEventListener('focus', handleVisibilitySync);
    };
  }, [baseExamQuestions, activePaper?.id]);

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
  const secondsLeftRef = useRef(initialDurationSeconds);
  const sealedRef = useRef(isInitiallySealed);
  const timerRunningRef = useRef(!isInitiallySealed);
  const submittingRef = useRef(false);
  secondsLeftRef.current = secondsLeft;
  sealedRef.current = isSealed;
  timerRunningRef.current = isTimerRunning;

  // 考试总时长推导 (用于计算倒计时百分比与颜色梯度：绿 -> 黄 -> 红)
  const totalExamDurationSeconds = useMemo(() => {
    if (activePaper?.totalDurationSeconds) return Number(activePaper.totalDurationSeconds);
    if (activePaper?.duration) return Number(activePaper.duration) * 60;
    if (activePaper?.totalSeconds) return Number(activePaper.totalSeconds);
    return Math.max(initialDurationSeconds, 5400);
  }, [activePaper, initialDurationSeconds]);

  // 考时提醒配置与触发状态
  const [reminderSettings, setReminderSettings] = useState(getExamTimerSettings);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [disableReminderForThisExam, setDisableReminderForThisExam] = useState(false);
  const [snoozeSecondsRemaining, setSnoozeSecondsRemaining] = useState(null);
  const [reminderModalState, setReminderModalState] = useState({
    isOpen: false,
    minutesLeft: 15,
    stage: 'warning',
    formattedTime: '00:15:00'
  });
  const triggeredReminderKeysRef = useRef(new Set());
  const prevSecondsLeftRef = useRef(initialDurationSeconds);

  useEffect(() => {
    const handleSettingsUpdated = () => {
      setReminderSettings(getExamTimerSettings());
    };
    window.addEventListener('examcraft-exam-reminder-updated', handleSettingsUpdated);
    return () => window.removeEventListener('examcraft-exam-reminder-updated', handleSettingsUpdated);
  }, []);

  // 倒计时颜色梯度阶段：绿 (>50%) -> 黄 (20%~50%) -> 红 (<=20% 或达设定预警阈值)
  const timerStage = useMemo(() => {
    return getTimerColorStage(secondsLeft, totalExamDurationSeconds, reminderSettings.reminderMinutes);
  }, [secondsLeft, totalExamDurationSeconds, reminderSettings.reminderMinutes]);

  // Submitting state for AI grading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitRequestInFlightRef = useRef(false);
  const [submitProgressText, setSubmitProgressText] = useState('');
  const [submitProgressStage, setSubmitProgressStage] = useState(0);
  const [submitElapsedSeconds, setSubmitElapsedSeconds] = useState(0);
  submittingRef.current = isSubmitting;

  // Keep the latest countdown in local persistence so a reload never restores the
  // original duration. The parent paper list is updated on seal/exit, not every tick.
  useEffect(() => {
    if (!activePaper?.id) return;
    const status = isSealed ? '已封卷' : '考试中';
    const snapshot = {
      ...activePaper,
      status,
      secondsLeft,
      sealedAt: isSealed ? (sealedAt || activePaper.sealedAt || '') : null
    };
    try {
      localStorage.setItem('examcraft_active_paper', JSON.stringify(snapshot));
      const raw = localStorage.getItem('examcraft_papers');
      if (raw) {
        const papers = JSON.parse(raw);
        if (Array.isArray(papers)) {
          localStorage.setItem('examcraft_papers', JSON.stringify(papers.map((paper) => (
            paper.id === activePaper.id ? { ...paper, status, secondsLeft, sealedAt: snapshot.sealedAt } : paper
          ))));
        }
      }
    } catch {}
    if (activePaper?.id) {
      storeUpdateExamProgress(activePaper.id, secondsLeft, currentQIndex);
    }
  }, [activePaper?.id, secondsLeft, currentQIndex, isSealed, sealedAt]);

  // pagehide is also fired by F5, so it must never be treated as a submission
  // or seal action. The session store's global keepalive handler flushes the
  // latest pending answer snapshot; an explicit "封卷" remains the only way to
  // lock an attempt.
  const [submitAiUsage, setSubmitAiUsage] = useState({ checked: 0, total: 0, calls: 0, totalTokens: 0, estimatedCostCny: 0, costKnown: true });

  useEffect(() => {
    if (!isSubmitting) {
      setSubmitElapsedSeconds(0);
      return undefined;
    }
    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      setSubmitElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [isSubmitting]);

  // Answering Mode: 'ai-scribe' or 'ocr'
  const [answerMode, setAnswerMode] = useState('ai-scribe');

  // Candidate draft input for current question
  const currentQ = questionList[currentQIndex] || questionList[0] || null;

  // 1. Intelligent passage resolution (defense in depth for papers with missing passage links)
  const isClozeQuestion = useMemo(() => {
    return /完形|cloze|Use of English/i.test(currentQ?.type || currentQ?.section || '');
  }, [currentQ]);

  const resolvedPassage = useMemo(() => {
    if (currentQ?.passage && typeof currentQ.passage === 'string' && currentQ.passage.trim()) {
      return currentQ.passage.trim();
    }
    // Sibling cloze question fallback
    if (isClozeQuestion) {
      const sibling = questionList.find((q) => q.passage && typeof q.passage === 'string' && q.passage.trim() && /完形|cloze|Use of English/i.test(q.type || q.section || ''));
      if (sibling?.passage) return sibling.passage.trim();
    }
    // Sibling in same section fallback
    if (currentQ?.section) {
      const siblingInSec = questionList.find((q) => q.section === currentQ.section && q.passage && typeof q.passage === 'string' && q.passage.trim());
      if (siblingInSec?.passage) return siblingInSec.passage.trim();
    }
    // activePaper level fallback
    if (activePaper?.passage && typeof activePaper.passage === 'string' && activePaper.passage.trim()) {
      return activePaper.passage.trim();
    }
    return '';
  }, [currentQ, questionList, isClozeQuestion, activePaper]);

  const resolvedPassageTitle = useMemo(() => {
    if (currentQ?.passageTitle) return currentQ.passageTitle;
    if (isClozeQuestion) return '完形填空短文 (Use of English)';
    return '阅读材料';
  }, [currentQ, isClozeQuestion]);

  // Passage items that share the resolved passage
  const currentPassageItems = useMemo(() => {
    if (!resolvedPassage) return [];
    return questionList
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => {
        if (!question?.options?.length) return false;
        if (currentQ?.passageGroupId && question.passageGroupId) {
          return question.passageGroupId === currentQ.passageGroupId;
        }
        const qPassage = (question.passage && question.passage.trim()) || (isClozeQuestion && /完形|cloze|Use of English/i.test(question.type || question.section || '') ? resolvedPassage : null);
        return qPassage === resolvedPassage;
      });
  }, [questionList, resolvedPassage, currentQ, isClozeQuestion]);

  // View mode for multi-question passages: 'focus' (show passage + current question) vs 'all' (show passage + all questions)
  const [passageViewMode, setPassageViewMode] = useState('focus'); // 'focus' | 'all'
  const isMultiQuestionPassage = currentPassageItems.length > 1 && passageViewMode === 'all';

  // In-place passage repair modal state
  const [isPassageModalOpen, setIsPassageModalOpen] = useState(false);
  const [passageInputText, setPassageInputText] = useState('');
  const [isMobileAnswerDrawerOpen, setIsMobileAnswerDrawerOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  const handleSavePassageToPaper = () => {
    if (!passageInputText.trim() || !activePaper) return;
    const text = passageInputText.trim();
    const title = resolvedPassageTitle || '完形填空短文 (Use of English)';
    const groupId = `passage-user-${Date.now()}`;

    const updatedQuestions = questionList.map((q) => {
      const isTarget = isClozeQuestion
        ? /完形|cloze|Use of English/i.test(q.type || q.section || '') || (Number(q.num || q.id) >= 1 && Number(q.num || q.id) <= 20)
        : (q.section === currentQ?.section || q.id === currentQ?.id);
      if (isTarget) {
        return {
          ...q,
          passage: text,
          passageTitle: title,
          passageGroupId: groupId
        };
      }
      return q;
    });

    const updatedPaper = {
      ...activePaper,
      questions: updatedQuestions
    };

    if (onUpdatePaper) onUpdatePaper(updatedPaper);
    try {
      const rawPapers = localStorage.getItem('examcraft_papers');
      if (rawPapers) {
        const list = JSON.parse(rawPapers);
        const next = list.map((p) => (p.id === activePaper.id ? updatedPaper : p));
        localStorage.setItem('examcraft_papers', JSON.stringify(next));
      }
    } catch {}

    setIsPassageModalOpen(false);
    showExamToast('✨ 篇章短文已成功补全并关联到当前题组！', 'success');
  };
  const [candidateDraft, setCandidateDraft] = useState(currentQ?.userAnswer || '');
  const fillAnswerInputRef = useRef(null);
  const mathFieldRef = useRef(null);
  const [fillInputMode, setFillInputMode] = useState('visual');
  const [mathLiveReady, setMathLiveReady] = useState(false);
  
  // Real AI Scribe result state
  const [isScribing, setIsScribing] = useState(false);
  const scribeRequestInFlightRef = useRef(false);
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
  const scratchpadCanvasStorageKey = activePaper?.id
    ? `examcraft_scratchpad_canvas_${activePaper.id}_${currentQKey}`
    : `examcraft_scratchpad_canvas_default_${currentQKey}`;
  const [showScratchpad, setShowScratchpad] = useState(prefersSplitExamLayout);
  const [isScratchpadMaximized, setIsScratchpadMaximized] = useState(false);
  const [isSplitWorkspace, setIsSplitWorkspace] = useState(prefersSplitExamLayout);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener?.('change', updateViewport);
    return () => media.removeEventListener?.('change', updateViewport);
  }, []);
  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('examcraft_exam_split_ratio'));
      return saved >= 0.35 && saved <= 0.72 ? saved : 0.56;
    } catch { return 0.56; }
  });
  const splitWorkspaceRef = useRef(null);
  const [scratchpadDraftRevision, setScratchpadDraftRevision] = useState(0);
  const [examResetCounter, setExamResetCounter] = useState(0);
  const questionMarksStorageKey = `examcraft_question_marks_${activePaper?.id || 'paper'}`;
  const getQuestionMarkKey = (question, index) => `qmark_${index}_${question?.id || question?.num || 'question'}`;
  const normalizeSavedQuestionMarks = (savedKeys) => {
    if (!Array.isArray(savedKeys)) return [];
    const nextKeys = [];
    savedKeys.forEach((savedKey) => {
      if (typeof savedKey !== 'string') return;
      if (savedKey.startsWith('qmark_')) {
        if (questionList.some((question, index) => getQuestionMarkKey(question, index) === savedKey)) nextKeys.push(savedKey);
        return;
      }
      const matches = questionList
        .map((question, index) => ({ question, index }))
        .filter(({ question, index }) => savedKey === question?.id || savedKey === `q_${question?.num || index}`);
      // Legacy IDs/numbers that identify multiple questions are ambiguous; drop them
      // instead of painting a review marker onto every matching question.
      if (matches.length === 1) nextKeys.push(getQuestionMarkKey(matches[0].question, matches[0].index));
    });
    return [...new Set(nextKeys)];
  };
  const [markedQuestionKeys, setMarkedQuestionKeys] = useState(() => {
    try {
      const saved = localStorage.getItem(`examcraft_question_marks_${activePaper?.id || 'paper'}`);
      const parsed = saved ? JSON.parse(saved) : [];
      return normalizeSavedQuestionMarks(parsed);
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(questionMarksStorageKey);
      const normalized = normalizeSavedQuestionMarks(saved ? JSON.parse(saved) : []);
      setMarkedQuestionKeys(normalized);
      localStorage.setItem(questionMarksStorageKey, JSON.stringify(normalized));
    } catch {
      setMarkedQuestionKeys([]);
    }
  }, [questionMarksStorageKey, questionList]);
  const currentQuestionMarkKey = getQuestionMarkKey(currentQ, currentQIndex);
  const isCurrentQuestionMarked = markedQuestionKeys.includes(currentQuestionMarkKey);
  const toggleCurrentQuestionMark = () => {
    const next = isCurrentQuestionMarked
      ? markedQuestionKeys.filter((key) => key !== currentQuestionMarkKey)
      : [...markedQuestionKeys, currentQuestionMarkKey];
    setMarkedQuestionKeys(next);
    try {
      localStorage.setItem(questionMarksStorageKey, JSON.stringify(next));
    } catch {}
    if (activePaper?.id) {
      storeToggleQuestionMark(activePaper.id, currentQuestionMarkKey);
    }
    showExamToast(isCurrentQuestionMarked ? '已取消本题复查标记' : `已标记第 ${currentQ?.num} 题，交卷前可在答题卡中定位`, 'info');
  };
  const questionScratchpadKeys = useMemo(() => questionList.map((question, index) => {
    const key = question?.id || `q_${question?.num || index}`;
    const prefix = activePaper?.id
      ? `examcraft_scratchpad_${activePaper.id}_${key}`
      : `examcraft_scratchpad_default_${key}`;
    const canvasKey = activePaper?.id
      ? `examcraft_scratchpad_canvas_${activePaper.id}_${key}`
      : `examcraft_scratchpad_canvas_default_${key}`;
    return { textKey: prefix, canvasKey };
  }), [questionList, activePaper?.id, scratchpadDraftRevision]);
  const questionDraftFlags = useMemo(() => questionScratchpadKeys.map(({ textKey, canvasKey }) => {
    try {
      return Boolean(
        localStorage.getItem(textKey)?.trim() ||
        localStorage.getItem(canvasKey) ||
        localStorage.getItem(`${canvasKey}_elements`) ||
        localStorage.getItem(`${canvasKey}_recovery`)
      );
    } catch {
      return false;
    }
  }), [questionScratchpadKeys]);

  // 草稿纸窗口自由拖拽移动与透视透明度状态
  const [scratchpadPos, setScratchpadPos] = useState(null);
  const [scratchpadOpacity, setScratchpadOpacity] = useState(() => {
    try {
      const saved = localStorage.getItem('examcraft_scratchpad_opacity');
      return saved ? Number(saved) : 100;
    } catch {
      return 100;
    }
  });
  const [isDraggingScratchpad, setIsDraggingScratchpad] = useState(false);
  const scratchpadModalRef = useRef(null);

  const handleScratchpadOpacityChange = (newVal) => {
    const clamped = Math.max(30, Math.min(100, Math.round(Number(newVal))));
    setScratchpadOpacity(clamped);
    try {
      localStorage.setItem('examcraft_scratchpad_opacity', String(clamped));
    } catch {}
  };

  const handleScratchpadDragStart = (e) => {
    if (isScratchpadMaximized) return;
    if (e.button !== 0) return; // 仅响应鼠标左键
    if (e.target.closest('button, input, select, textarea, [data-no-drag]')) return;

    const modalEl = scratchpadModalRef.current;
    if (!modalEl) return;

    e.preventDefault();
    const rect = modalEl.getBoundingClientRect();
    const startLeft = rect.left;
    const startTop = rect.top;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    let nextPosition = { x: startLeft, y: startTop };
    let frameId = null;
    let hasMoved = false;

    setIsDraggingScratchpad(true);
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvt) => {
      const deltaX = moveEvt.clientX - startMouseX;
      const deltaY = moveEvt.clientY - startMouseY;
      if (deltaX === 0 && deltaY === 0) return;
      hasMoved = true;

      const modalW = modalEl.offsetWidth || 760;
      const modalH = modalEl.offsetHeight || 580;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      // 保证草稿纸不被完全拖出视口边界
      const newX = Math.max(0, Math.min(winW - Math.min(modalW, 120), startLeft + deltaX));
      const newY = Math.max(0, Math.min(winH - Math.min(modalH, 40), startTop + deltaY));
      nextPosition = { x: Math.round(newX), y: Math.round(newY) };
      if (frameId === null) {
        frameId = window.requestAnimationFrame(() => {
          modalEl.style.translate = `${nextPosition.x - startLeft}px ${nextPosition.y - startTop}px`;
          frameId = null;
        });
      }
    };

    const onMouseUp = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      modalEl.style.translate = 'none';
      if (hasMoved) {
        modalEl.style.left = `${nextPosition.x}px`;
        modalEl.style.top = `${nextPosition.y}px`;
        setScratchpadPos(nextPosition);
      }
      setIsDraggingScratchpad(false);
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSplitResizeStart = (e) => {
    if (e.button !== 0) return;
    const workspace = splitWorkspaceRef.current;
    if (!workspace) return;
    e.preventDefault();
    const rect = workspace.getBoundingClientRect();
    let latestRatio = splitRatio;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onPointerMove = (moveEvent) => {
      const ratio = Math.max(0.35, Math.min(0.72, (moveEvent.clientX - rect.left) / rect.width));
      latestRatio = ratio;
      setSplitRatio(ratio);
    };
    const onPointerUp = () => {
      try { localStorage.setItem('examcraft_exam_split_ratio', String(latestRatio)); } catch {}
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isClearCurrentAnswerModalOpen, setIsClearCurrentAnswerModalOpen] = useState(false);
  const [isResetExamModalOpen, setIsResetExamModalOpen] = useState(false);
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

  // 倒计时到达设定阈值时自动弹出专属考试时间提醒弹窗 MSG
  useEffect(() => {
    if (!isTimerRunning || isSealed || disableReminderForThisExam || !reminderSettings.enabled) {
      prevSecondsLeftRef.current = secondsLeft;
      return;
    }

    const prevSec = prevSecondsLeftRef.current;
    const currSec = secondsLeft;
    prevSecondsLeftRef.current = currSec;

    const paperKey = activePaper?.id || 'current_paper';
    const primaryThresholdSec = reminderSettings.reminderMinutes * 60;
    const secondThresholdSec = reminderSettings.secondReminderMinutes * 60;

    // 1. 首要提醒阈值触发（如剩余 15 分钟）
    const primaryKey = `${paperKey}_primary_${reminderSettings.reminderMinutes}`;
    if (
      prevSec > primaryThresholdSec &&
      currSec <= primaryThresholdSec &&
      !triggeredReminderKeysRef.current.has(primaryKey)
    ) {
      triggeredReminderKeysRef.current.add(primaryKey);
      const stageInfo = getTimerColorStage(currSec, totalExamDurationSeconds, reminderSettings.reminderMinutes);
      setReminderModalState({
        isOpen: true,
        minutesLeft: Math.max(1, Math.ceil(currSec / 60)),
        stage: stageInfo.stage,
        formattedTime: formatTimer(currSec)
      });
      if (reminderSettings.soundEnabled) {
        playReminderChime('warning');
      }
      showExamToast(`⏰ 考试时间提醒：当前剩余 ${Math.ceil(currSec / 60)} 分钟！`, 'warn');
    }

    // 2. 二次冲刺阈值触发（如剩余 5 分钟）
    const secondKey = `${paperKey}_second_${reminderSettings.secondReminderMinutes}`;
    if (
      reminderSettings.secondReminderEnabled &&
      prevSec > secondThresholdSec &&
      currSec <= secondThresholdSec &&
      !triggeredReminderKeysRef.current.has(secondKey)
    ) {
      triggeredReminderKeysRef.current.add(secondKey);
      setReminderModalState({
        isOpen: true,
        minutesLeft: Math.max(1, Math.ceil(currSec / 60)),
        stage: 'critical',
        formattedTime: formatTimer(currSec)
      });
      if (reminderSettings.soundEnabled) {
        playReminderChime('urgent');
      }
      showExamToast(`🚨 冲刺预警：考试仅剩最后 ${Math.ceil(currSec / 60)} 分钟！`, 'warn');
    }

    // 3. 稍后提醒 (Snooze) 触发
    if (snoozeSecondsRemaining !== null && currSec <= snoozeSecondsRemaining) {
      setSnoozeSecondsRemaining(null);
      setReminderModalState({
        isOpen: true,
        minutesLeft: Math.max(1, Math.ceil(currSec / 60)),
        stage: currSec <= 300 ? 'critical' : 'danger',
        formattedTime: formatTimer(currSec)
      });
      if (reminderSettings.soundEnabled) {
        playReminderChime('warning');
      }
      showExamToast(`⏰ 稍后提醒：考试仅剩 ${Math.ceil(currSec / 60)} 分钟！`, 'warn');
    }
  }, [
    secondsLeft,
    isTimerRunning,
    isSealed,
    disableReminderForThisExam,
    reminderSettings,
    totalExamDurationSeconds,
    activePaper?.id,
    snoozeSecondsRemaining
  ]);

  const answeredCount = questionList.filter((q) => q.userAnswer && q.userAnswer.trim().length > 0).length;
  const questionGroups = useMemo(() => {
    const groups = [];
    const groupIndex = new Map();
    questionList.forEach((question, index) => {
      const type = question.type || '未分类';
      if (!groupIndex.has(type)) {
        groupIndex.set(type, groups.length);
        groups.push({ type, items: [] });
      }
      groups[groupIndex.get(type)].items.push({ question, index });
    });
    return groups;
  }, [questionList]);
  const examTodayTokens = Number(modelUsageStatus?.today?.tokens || 0);
  const examTodayCostKnown = (modelUsageStatus?.today?.pricedCalls || 0) > 0;
  const examTodayCost = Number(modelUsageStatus?.today?.estimatedCostCny || 0);
  const examWalletBalance = modelUsageStatus?.balance?.balances?.find((item) => item.currency === 'CNY')
    || modelUsageStatus?.balance?.balances?.[0];

  const handleUpdateAnswer = (val, targetIndex = currentQIndex) => {
    if (targetIndex === currentQIndex) setCandidateDraft(val);
    const now = Date.now();
    setQuestionList((prev) => {
      const next = prev.map((q, idx) =>
        idx === targetIndex
          ? { ...q, userAnswer: val, status: val.trim() ? 'answered' : 'unanswered', updatedAt: now }
          : q
      );
      if (activePaper?.id) {
        try {
          localStorage.setItem(`examcraft_answers_${activePaper.id}`, JSON.stringify(next));
          const prevMeta = localStorage.getItem(`examcraft_session_${activePaper.id}`);
          const parsedMeta = prevMeta ? JSON.parse(prevMeta) : {};
          localStorage.setItem(`examcraft_session_${activePaper.id}`, JSON.stringify({
            ...parsedMeta,
            currentQIndex: targetIndex,
            updatedAt: now
          }));
        } catch {}
      }
      return next;
    });
    if (activePaper?.id) {
      storeUpdateAnswer(activePaper.id, val, targetIndex);
    }
  };

  // 全局考场作答键盘快捷键支持 (上一题/下一题/选项填涂/标记复查/草稿纸)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. 若有弹窗处于打开状态，仅响应 Esc 关闭辅助窗口
      if (
        isSubmitModalOpen ||
        isResetExamModalOpen ||
        isPassageModalOpen ||
        isClearCurrentAnswerModalOpen ||
        reminderModalState.isOpen ||
        isSealed
      ) {
        if (e.key === 'Escape') {
          setIsPassageModalOpen(false);
          setIsMobileAnswerDrawerOpen(false);
          setIsShortcutsHelpOpen(false);
        }
        return;
      }

      // 2. 检查输入焦点：如果在文本框、公式编辑器或可编辑区域内，不触发试卷导航/选项单键快捷键
      const target = e.target;
      const tagName = target?.tagName?.toUpperCase();
      const isInputFocused =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        tagName === 'MATH-FIELD' ||
        target?.isContentEditable ||
        Boolean(target?.closest('math-field, [contenteditable="true"], .exam-math-field'));

      if (isInputFocused) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // 忽略 Ctrl 或 Cmd 组合键（避免干扰浏览器复制、刷新等默认行为）
      if (e.ctrlKey || e.metaKey) return;

      // 3. 下一题快捷键：
      // - 方向右键 ArrowRight
      // - PageDown
      // - Alt + ArrowRight
      // - Alt + N 或 Alt + J
      if (
        e.key === 'ArrowRight' ||
        e.key === 'PageDown' ||
        (e.altKey && (e.key === 'n' || e.key === 'N' || e.key === 'j' || e.key === 'J'))
      ) {
        e.preventDefault();
        setCurrentQIndex((idx) => {
          if (idx < questionList.length - 1) {
            return idx + 1;
          }
          return idx;
        });
        return;
      }

      // 4. 上一题快捷键：
      // - 方向左键 ArrowLeft
      // - PageUp
      // - Alt + ArrowLeft
      // - Alt + P 或 Alt + K
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'PageUp' ||
        (e.altKey && (e.key === 'p' || e.key === 'P' || e.key === 'k' || e.key === 'K'))
      ) {
        e.preventDefault();
        setCurrentQIndex((idx) => {
          if (idx > 0) {
            return idx - 1;
          }
          return idx;
        });
        return;
      }

      // 5. 标记复查：按按键 M
      if (!e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleCurrentQuestionMark();
        return;
      }

      // 6. 快捷开关本题专属草稿纸：Alt + D 或 Alt + S
      if (e.altKey && (e.key === 'd' || e.key === 'D' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (isSplitWorkspace) setIsSplitWorkspace(false);
        setShowScratchpad((prev) => !prev);
        return;
      }

      // 7. 打开/关闭快捷键提示：按键 ? (Shift + /)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsHelpOpen((prev) => !prev);
        return;
      }

      // 8. 选择题快捷填涂 (A, B, C, D, E, F)
      if (
        !e.altKey &&
        currentQ?.options?.length > 0 &&
        ['a', 'b', 'c', 'd', 'e', 'f', 'A', 'B', 'C', 'D', 'E', 'F'].includes(e.key)
      ) {
        const keyUpper = e.key.toUpperCase();
        const optionExists = currentQ.options.some((opt) => opt.key === keyUpper);
        if (optionExists) {
          e.preventDefault();
          const isMultiple = currentQ.type?.includes('多项选择') || currentQ.type?.includes('多选');
          if (isMultiple) {
            const currentSelected = (currentQ.userAnswer || '').split('').filter(Boolean);
            const nextSelected = currentSelected.includes(keyUpper)
              ? currentSelected.filter((k) => k !== keyUpper)
              : [...currentSelected, keyUpper].sort();
            handleUpdateAnswer(nextSelected.join(''));
          } else {
            handleUpdateAnswer(currentQ.userAnswer === keyUpper ? '' : keyUpper);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    questionList.length,
    currentQ,
    currentQIndex,
    isSubmitModalOpen,
    isResetExamModalOpen,
    isPassageModalOpen,
    isClearCurrentAnswerModalOpen,
    reminderModalState.isOpen,
    isSealed,
    isSplitWorkspace,
    toggleCurrentQuestionMark,
    handleUpdateAnswer
  ]);

  const handleClearCurrentAnswer = () => {
    const now = Date.now();
    const cleared = questionList.map((question, index) => index === currentQIndex
      ? { ...question, userAnswer: '', aiTranscription: '', stepScores: [], status: 'unanswered', updatedAt: now }
      : question);
    setQuestionList(cleared);
    if (activePaper?.id) {
      try {
        localStorage.setItem(`examcraft_answers_${activePaper.id}`, JSON.stringify(cleared));
        const prevMeta = localStorage.getItem(`examcraft_session_${activePaper.id}`);
        const parsedMeta = prevMeta ? JSON.parse(prevMeta) : {};
        localStorage.setItem(`examcraft_session_${activePaper.id}`, JSON.stringify({
          ...parsedMeta,
          updatedAt: now
        }));
      } catch {}
      storeClearSingleAnswer(activePaper.id, currentQIndex);
    }
    setCandidateDraft('');
    setScribedLatex('');
    setStepScores([]);
    setIsClearCurrentAnswerModalOpen(false);
    showExamToast(`已清空第 ${currentQ?.num || currentQIndex + 1} 题答案；其他题目和草稿纸内容已保留。`, 'success');
  };

  // 重置整场考试（清空全部答案、全部草稿纸与恢复初始考试倒计时）
  const handleResetEntireExam = () => {
    // 1. 获取初始考试时长
    const pristineDuration = activePaper?.duration
      ? Number(activePaper.duration) * 60
      : (activePaper?.totalDurationSeconds || activePaper?.totalSeconds || 5400);

    // 2. 清空所有题目的答题记录与 AI 转录
    const resetQuestions = questionList.map((question) => ({
      ...question,
      userAnswer: '',
      aiTranscription: '',
      stepScores: [],
      status: 'unanswered'
    }));
    setQuestionList(resetQuestions);
    setCurrentQIndex(0);
    setCandidateDraft('');
    setScribedLatex('');
    setStepScores([]);

    // 3. 清空所有题目的复查标记
    setMarkedQuestionKeys([]);

    // 4. 重置考时倒计时与状态
    setSecondsLeft(pristineDuration);
    secondsLeftRef.current = pristineDuration;
    prevSecondsLeftRef.current = pristineDuration;
    setIsTimerRunning(true);
    setIsSealed(false);
    setSealedAt('');
    sealedRef.current = false;
    timerRunningRef.current = true;

    // 5. 重置提醒状态与已触发记录
    triggeredReminderKeysRef.current.clear();
    setDisableReminderForThisExam(false);
    setSnoozeSecondsRemaining(null);
    setReminderModalState({
      isOpen: false,
      minutesLeft: 15,
      stage: 'warning',
      formattedTime: formatTimer(pristineDuration)
    });

    // 6. 清理本地持久化中该试卷的答题卡、草稿纸与标记缓存
    if (activePaper?.id) {
      try {
        localStorage.removeItem(`examcraft_answers_${activePaper.id}`);
        localStorage.removeItem(questionMarksStorageKey);

        const paperId = String(activePaper.id);
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.includes(`scratchpad_${paperId}`) ||
              key.includes(`scratchpad_canvas_${paperId}`) ||
              key.includes(`scratchpad_agent_chat_${paperId}`))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch (err) {
        console.warn('Failed to clear scratchpad cache for paper:', err);
      }
    }

    // 7. 递增草稿版本与重置计数器以强制卸载并重置草稿画板与组件缓存
    setScratchpadDraftRevision((rev) => rev + 1);
    setExamResetCounter((cnt) => cnt + 1);
    if (activePaper?.id) {
      storeResetEntireExam(activePaper.id, pristineDuration);
    }

    // 8. 更新 activePaper 试卷快照与试卷列表
    if (activePaper?.id) {
      const freshPaper = {
        ...activePaper,
        status: '考试中',
        secondsLeft: pristineDuration,
        sealedAt: null
      };
      try {
        localStorage.setItem('examcraft_active_paper', JSON.stringify(freshPaper));
        const raw = localStorage.getItem('examcraft_papers');
        if (raw) {
          const list = JSON.parse(raw);
          const next = list.map((p) => (p.id === activePaper.id ? freshPaper : p));
          localStorage.setItem('examcraft_papers', JSON.stringify(next));
        }
      } catch {}
      if (onUpdatePaper) onUpdatePaper(freshPaper);
    }

    // 9. 关闭确认弹窗并给予成功提示
    setIsResetExamModalOpen(false);
    showExamToast('✨ 整场考试已重置！所有答案、草稿纸与倒计时均已恢复至初始状态。', 'success');
  };

  useEffect(() => {
    let cancelled = false;
    if (fillInputMode !== 'visual' || !currentQ || currentQ.options?.length) return undefined;
    Promise.all([import('mathlive'), import('mathlive/fonts.css')]).then(() => {
      if (!cancelled) setMathLiveReady(true);
    }).catch(() => {
      if (!cancelled) setMathLiveReady(false);
    });
    return () => { cancelled = true; };
  }, [currentQIndex, currentQ?.type, Boolean(currentQ?.options?.length), fillInputMode]);

  useEffect(() => {
    setFillInputMode(currentQ?.type?.includes('填空') ? 'visual' : 'description');
  }, [currentQIndex]);

  useEffect(() => {
    const field = mathFieldRef.current;
    if (fillInputMode !== 'visual' || !mathLiveReady || !field) return undefined;
    if (field.value !== candidateDraft) field.value = candidateDraft;
    const syncAnswer = () => handleUpdateAnswer(field.value);
    field.addEventListener('input', syncAnswer);
    return () => field.removeEventListener('input', syncAnswer);
  }, [candidateDraft, currentQIndex, fillInputMode, mathLiveReady]);

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
    if (activePaper?.id) {
      storeSealExam(activePaper.id, nowStr);
    }
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
    setSealedAt('');
    const updated = {
      ...activePaper,
      status: '考试中',
      secondsLeft,
      sealedAt: null
    };
    if (onUpdatePaper) onUpdatePaper(updated);
    if (activePaper?.id) {
      storeUnsealExam(activePaper.id);
    }
    try {
      const raw = localStorage.getItem('examcraft_papers');
      if (raw) {
        const list = JSON.parse(raw);
        const next = list.map((p) =>
            p.id === activePaper?.id ? { ...p, status: '考试中', secondsLeft, sealedAt: null } : p
        );
        localStorage.setItem('examcraft_papers', JSON.stringify(next));
      }
    } catch {}
    showExamToast('✨ 考卷已成功启封，继续作答并恢复倒计时', 'success');
  };

  const handleExitExam = () => {
    if (activePaper?.id) {
      flushPendingSync(activePaper.id);
    }
    if (isTimerRunning && !isSealed) handleSealExam();
    onExit();
  };

  // Call real model_core AI scribe
  const handleTriggerAIScribe = async () => {
    if (scribeRequestInFlightRef.current) return;
    if (!candidateDraft.trim()) {
      showExamToast('请先在左侧输入考生的速记或草稿内容。', 'warn');
      return;
    }
    scribeRequestInFlightRef.current = true;
    setIsScribing(true);
    try {
      const res = await fetch('/api/model/ai-scribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawDraft: candidateDraft,
          mathProblem: `${stripAnswerMaterial(currentQ.prompt)} ${currentQ.mathExpression || ''}`,
          questionType: currentQ.type
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        const transcription = String(data.data.latex || '').trim();
        if (!transcription || transcription.includes('考场纪律')) {
          showExamToast('没有识别到可填写的转写内容，原草稿已保留。', 'warn');
          return;
        }
        setScribedLatex(transcription);
        handleUpdateAnswer(transcription);
        if (currentQ.type?.includes('填空')) setFillInputMode('visual');
        if (data.data.stepScores && data.data.stepScores.length > 0) {
          setStepScores(data.data.stepScores);
        } else if (currentQ.type?.includes('填空')) {
          setStepScores([]);
        }
        showExamToast('✨ 转写结果已同步到本题答案，请检查公式后继续作答', 'success');
      } else {
        showExamToast(data.error || '未检测到配置的 API Key，已保留当前预设规范排版。请前往「系统设置」输入 API Key。', 'warn');
      }
    } catch (err) {
      showExamToast(`AI 代笔调用失败: ${err.message}`, 'warn');
    } finally {
      scribeRequestInFlightRef.current = false;
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
    if (submitRequestInFlightRef.current) return;
    submitRequestInFlightRef.current = true;
    setIsSubmitModalOpen(false);
    setIsSubmitting(true);
    setSubmitProgressStage(0);
    setSubmitAiUsage({ enabled: false, checked: 0, failed: 0, total: 0, calls: 0, totalTokens: 0, estimatedCostCny: 0, costKnown: true });
    setSubmitProgressText('正在核对客观题并汇总本次作答...');

    // 1. Evaluate answers
    let calculatedScore = 0;
    let correctCount = 0;

    let gradedQuestions = questionList.map((q, idx) => {
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
        const isMultiChoice = q.type?.includes('多项选择') || q.type?.includes('多选');
        const normalizedUser = isMultiChoice ? [...cleanUser].sort().join('') : cleanUser;
        const normalizedStd = isMultiChoice ? [...cleanStd].sort().join('') : cleanStd;
        isCorrect = normalizedUser === normalizedStd && normalizedUser.length > 0;
        scoreObtained = isCorrect ? maxScore : 0;
      } else if (isBlank) {
        const normUser = userAns.replace(/\s+/g, '').toLowerCase();
        const normStd = stdAns.replace(/\s+/g, '').toLowerCase();
        isCorrect = normUser.length > 0 && normStd.length > 0 && (normUser === normStd || normStd.includes(normUser) || normUser.includes(normStd));
        scoreObtained = isCorrect ? maxScore : 0;
      } else if (userAns) {
        // Subjective answers need human review; length is not evidence of correctness.
        isCorrect = null;
      }

      if (isCorrect) correctCount++;
      calculatedScore += scoreObtained;

      return {
        ...q,
        isCorrect,
        scoreObtained,
        userAnswer: userAns,
        standardAnswer: stdAns,
        aiInsight: null,
        gradingStatus: isCorrect === null ? 'manual-review' : 'auto-checked',
        scratchpad: {
          text: scratchpadText,
          canvasDataUrl: scratchpadCanvas,
          elements: scratchpadElements,
          hasContent: hasScratchpad
        }
      };
    });

    const totalPaperScore = activePaper?.totalScore || questionList.reduce((sum, q) => sum + (q.score || 5), 0);
    const durationTotal = activePaper?.duration ? activePaper.duration * 60 : 5400;
    const durationSpent = Math.max(10, durationTotal - secondsLeft);

    // Ask the configured model to independently review each answered question,
    // one request at a time to keep provider load predictable.
    const answeredIndexes = gradedQuestions.reduce((indexes, q, index) => {
      if (q.userAnswer?.trim()) indexes.push(index);
      return indexes;
    }, []);
    let availableModelStatus = modelUsageStatus;
    if (!availableModelStatus) {
      try {
        const statusResponse = await fetch('/api/model/status');
        const statusData = await statusResponse.json();
        if (statusData.success) {
          availableModelStatus = statusData;
          setModelUsageStatus(statusData);
        }
      } catch {}
    }
    const modelAvailable = availableModelStatus?.model?.hasApiKey === true;
    const usageTotals = { enabled: modelAvailable, checked: 0, failed: 0, total: answeredIndexes.length, calls: 0, totalTokens: 0, estimatedCostCny: 0, costKnown: true };
    setSubmitAiUsage({ ...usageTotals });
    if (modelAvailable && answeredIndexes.length > 0) {
      setSubmitProgressStage(1);
      for (let position = 0; position < answeredIndexes.length; position += 1) {
        const questionIndex = answeredIndexes[position];
        const q = gradedQuestions[questionIndex];
        setSubmitProgressText(`AI 正在复核第 ${q.num || questionIndex + 1} 题（${position + 1}/${answeredIndexes.length}）…`);
        try {
          const response = await fetch('/api/model/grade-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: {
                num: q.num,
                type: q.type,
                prompt: q.prompt,
                options: q.options,
                maxScore: Number(q.score) || 0,
                userAnswer: q.userAnswer,
                standardAnswer: q.standardAnswer,
                analysis: q.analysis,
                localCheck: typeof q.isCorrect === 'boolean' ? q.isCorrect : null,
                scratchpad: q.scratchpad
              }
            })
          });
          const result = await response.json();
          if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'AI 复核失败');

          const review = result.data;
          const suggestedScore = review.scoreObtained === null || review.scoreObtained === undefined
            ? null
            : Math.min(Math.max(0, Number(q.score) || 0), Math.max(0, Number(review.scoreObtained) || 0));
          gradedQuestions[questionIndex] = {
            ...q,
            ...(suggestedScore !== null ? {
              scoreObtained: suggestedScore,
              isCorrect: review.isCorrect === true,
              gradingStatus: 'ai-graded'
            } : { gradingStatus: 'manual-review' }),
            aiInsight: typeof review.comment === 'string' ? review.comment.slice(0, 1200) : q.aiInsight
          };
          usageTotals.checked += 1;
          usageTotals.calls += Number(result.usage ? 1 : 0);
          usageTotals.totalTokens += Number(result.usage?.totalTokens) || 0;
          if (result.usage?.estimatedCostCny !== null && result.usage?.estimatedCostCny !== undefined && Number.isFinite(Number(result.usage.estimatedCostCny))) usageTotals.estimatedCostCny += Number(result.usage.estimatedCostCny);
          else usageTotals.costKnown = false;
        } catch (error) {
          console.warn(`AI question review failed (${q.num || questionIndex + 1}):`, error);
          usageTotals.failed += 1;
        }
        setSubmitAiUsage({ ...usageTotals });
      }
    }

    calculatedScore = gradedQuestions.reduce((sum, question) => sum + (Number(question.scoreObtained) || 0), 0);
    correctCount = gradedQuestions.filter((question) => question.userAnswer?.trim() && question.isCorrect === true).length;
    const answeredCountForAccuracy = gradedQuestions.filter((question) => question.userAnswer?.trim()).length;
    let accuracy = answeredCountForAccuracy ? Math.round((correctCount / answeredCountForAccuracy) * 100) : 0;

    setSubmitProgressText('正在生成全卷作答诊断...');
    setSubmitProgressStage(2);

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
          questionsSummary: gradedQuestions.slice(0, 60).map((q, index) => ({
            index,
            num: q.num,
            type: q.type,
            prompt: String(q.prompt || '').slice(0, 500),
            isCorrect: q.isCorrect,
            scoreObtained: q.scoreObtained,
            maxScore: Number(q.score) || 0,
            aiInsight: String(q.aiInsight || '').slice(0, 300)
          }))
        })
      });
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        aiReviewData = resJson.data;
      }
    } catch (e) {
      console.warn('AI evaluation request failed:', e);
    }

    setSubmitProgressStage(3);
    setSubmitProgressText('正在整理逐题评语并保存报告...');

    if (Array.isArray(aiReviewData?.questionReviews)) {
      const reviewByIndex = new Map(aiReviewData.questionReviews
        .filter((review) => Number.isInteger(Number(review.index)))
        .map((review) => [Number(review.index), review]));
      gradedQuestions = gradedQuestions.map((question, index) => {
        const review = reviewByIndex.get(index);
        if (!review) return question;
        const hasSuggestedScore = question.gradingStatus === 'manual-review'
          && question.userAnswer
          && review.scoreObtained !== null
          && review.scoreObtained !== undefined
          && review.scoreObtained !== ''
          && Number.isFinite(Number(review.scoreObtained));
        const maxScore = Math.max(0, Number(question.score) || 0);
        const aiScore = hasSuggestedScore
          ? Math.min(maxScore, Math.max(0, Number(review.scoreObtained)))
          : question.scoreObtained;
        return {
          ...question,
          ...(hasSuggestedScore ? {
            scoreObtained: aiScore,
            isCorrect: aiScore >= maxScore && maxScore > 0,
            gradingStatus: 'ai-graded'
          } : {}),
          aiInsight: typeof review.comment === 'string' ? review.comment.slice(0, 1200) : question.aiInsight
        };
      });
      calculatedScore = gradedQuestions.reduce((sum, question) => sum + (Number(question.scoreObtained) || 0), 0);
      const answeredQuestions = gradedQuestions.filter((question) => question.userAnswer?.trim());
      accuracy = answeredQuestions.length
        ? Math.round((gradedQuestions.filter((question) => question.userAnswer?.trim() && question.isCorrect === true).length / answeredQuestions.length) * 100)
        : 0;
    }

    if (!aiReviewData) {
      aiReviewData = {
        summary: '智能诊断暂不可用。客观题按标准答案核对，主观题请对照答案与解析自行复核。',
        strengths: [],
        weaknesses: [],
        actionPlan: ['将需要复习的题目收录至错题本，方便后续练习']
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
      aiOverallReview: aiReviewData,
      aiGradingUsage: { ...usageTotals, estimatedCostCny: usageTotals.costKnown ? usageTotals.estimatedCostCny : null }
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

    submitRequestInFlightRef.current = false;
    setIsSubmitting(false);

    if (activePaper?.id) {
      storeFinishAndCleanupSession(activePaper.id);
    }

    if (onSubmitExam) {
      onSubmitExam(submissionRecord);
    } else {
      setIsResultModalOpen(true);
    }
  };

  const renderScratchpadCanvas = (docked = false) => (
    <ScratchpadCanvas
      key={`${activePaper?.id || 'paper'}_${currentQKey}_reset_${examResetCounter}`}
      questionNum={currentQ?.num}
      questionData={currentQ}
      questionIndex={currentQIndex}
      questionCount={questionList.length}
      questionNums={questionList.map((question, index) => question?.num || index + 1)}
      questionDraftFlags={questionDraftFlags}
      modelStatus={modelUsageStatus}
      onNavigateQuestion={setCurrentQIndex}
      onDraftChange={() => setScratchpadDraftRevision((revision) => revision + 1)}
      storageKey={scratchpadCanvasStorageKey}
      contextProblem={currentQ ? `${currentQ.prompt} ${currentQ.mathExpression || ''}` : ''}
      isMaximized={docked ? false : isScratchpadMaximized}
      onToggleMaximize={() => {
        if (docked) setIsSplitWorkspace(false);
        setShowScratchpad(true);
        setIsScratchpadMaximized(!isScratchpadMaximized);
      }}
      onClose={() => {
        setIsScratchpadMaximized(false);
        setIsSplitWorkspace(false);
        setShowScratchpad(false);
      }}
      opacity={scratchpadOpacity}
      onOpacityChange={handleScratchpadOpacityChange}
      onWindowDragStart={docked ? null : handleScratchpadDragStart}
      isMoved={docked ? false : scratchpadPos !== null}
      onResetPosition={docked ? undefined : () => setScratchpadPos(null)}
    />
  );

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
      <header className="sticky top-0 z-40 w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/30 px-3 sm:px-margin-desktop py-2 sm:py-space-sm flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 shadow-sm">
        {/* Left: Exam Title & Secure Integrity Status */}
        <div className="flex flex-1 items-center space-x-1 sm:space-x-space-md min-w-0">
          <button
            type="button"
            onClick={handleExitExam}
            className="flex items-center text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer mr-1"
            title="退出时自动封卷并冻结倒计时"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex items-center space-x-space-xs text-primary font-headline-sm text-headline-sm">
            <span className="material-symbols-outlined text-primary text-[20px] material-symbols-fill">terminal</span>
            <span className="tracking-tight text-on-surface font-headline-sm truncate max-w-xs md:max-w-md font-semibold">
              {activePaper?.title || '当前试卷'}
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-secondary-container/30 text-secondary font-label-mono text-label-mono border border-secondary-container">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
            <span>防作弊闭卷监考模式</span>
          </span>
        </div>

        {/* Center: Global Progress Bar & Current Type */}
        <div className="hidden 2xl:flex flex-col items-center justify-center min-w-[260px]">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-on-surface-variant font-sans text-[12px] font-medium flex items-center gap-1">
              <span>答题进度:</span>
              <span className="font-mono font-bold text-primary">{answeredCount}</span>
              <span className="text-outline-variant">/</span>
              <span className="font-mono">{questionList.length}</span>
            </span>
            <span className={`px-2 py-0.5 border font-sans text-[11px] font-medium rounded-md ${getQuestionTypeClass(currentQ.type)}`}>
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
        <div className="ml-auto flex items-center space-x-1 sm:space-x-space-md">
          {/* Live model usage remains visible while the global workspace header is hidden. */}
          <div
            className="hidden lg:flex shrink-0 items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container-low px-2 py-1 font-label-mono text-[10px] text-on-surface-variant"
            title={`本机今日用量：${examTodayTokens.toLocaleString()} tokens；费用估算 ${examTodayCostKnown ? `¥${examTodayCost.toFixed(4)}` : '暂无单价'}${examWalletBalance ? `；钱包 ${examWalletBalance.currency === 'CNY' ? '¥' : '$'}${examWalletBalance.totalBalance.toFixed(2)}` : ''}`}
            aria-label={`AI 今日 ${examTodayTokens.toLocaleString()} tokens，费用估算 ${examTodayCostKnown ? `¥${examTodayCost.toFixed(4)}` : '暂无单价'}`}
          >
            <span className="material-symbols-outlined text-[14px] text-primary">token</span>
            <span>AI 今日 {examTodayTokens.toLocaleString()}</span>
            <span className="text-outline-variant">·</span>
            <span>{examTodayCostKnown ? `¥${examTodayCost.toFixed(4)}` : '¥—'}</span>
            {modelUsageStatus?.model?.providerMode === 'deepseek-official' && (
              <>
                <span className="hidden 2xl:inline max-w-24 truncate text-on-surface-variant">DeepSeek</span>
                <span className="hidden xl:inline text-outline-variant">·</span>
                <span className="hidden xl:inline-flex max-w-24 items-center gap-0.5 truncate text-secondary" title={modelUsageStatus.balanceError || 'DeepSeek 官方钱包余额'}>
                  <span className="material-symbols-outlined text-[13px]">account_balance_wallet</span>
                  {examWalletBalance ? `${examWalletBalance.currency === 'CNY' ? '¥' : '$'}${examWalletBalance.totalBalance.toFixed(2)}` : '钱包—'}
                </span>
              </>
            )}
          </div>

          {/* Status Pill: 考试中 vs 已封卷 */}
          <span className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-sans font-semibold border ${
            isSealed
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
              : 'bg-primary/10 text-primary border-primary/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSealed ? 'bg-amber-500' : 'bg-primary animate-pulse'}`}></span>
            <span>{isSealed ? '已封卷 (封盘)' : '考试作答中'}</span>
          </span>

          {/* Countdown Timer with 动态颜色渐变 (绿 -> 黄 -> 红) and 封卷 / 启封 Toggle */}
          <div className="relative">
            <div className={`relative flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 rounded-lg border transition-all ${
              isSealed
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : timerStage.badgeClass
            }`}>
              {/* Bottom Subtle Progress Track */}
              {!isSealed && (
                <div className="absolute -bottom-[1px] left-1.5 right-1.5 h-[2px] rounded-full overflow-hidden bg-outline-variant/20 pointer-events-none">
                  <div
                    className={`h-full transition-all duration-700 ${timerStage.barColor}`}
                    style={{ width: `${timerStage.progressRatio}%` }}
                  />
                </div>
              )}

              <span className={`material-symbols-outlined text-[18px] ${!isSealed ? timerStage.iconClass : ''}`}>
                {isSealed ? 'lock' : timerStage.iconName}
              </span>
              <span className="font-code-md text-code-md font-semibold tracking-wider font-mono">
                {formatTimer(secondsLeft)}
              </span>

              {/* Quick Reminder Bell Indicator & Popover Trigger */}
              <button
                type="button"
                onClick={() => setShowTimerMenu((prev) => !prev)}
                className={`p-0.5 rounded hover:bg-surface-container-high transition cursor-pointer flex items-center justify-center ${
                  reminderSettings.enabled ? 'text-primary' : 'text-on-surface-variant opacity-60'
                }`}
                title={`考时提醒设置 (当前: 剩余 ${reminderSettings.reminderMinutes} 分钟提醒)`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {reminderSettings.enabled ? 'notifications_active' : 'notifications_off'}
                </span>
              </button>

              {/* Seal / Unseal Button */}
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
                <span>{isTimerRunning ? <><span className="hidden sm:inline">封卷 (封盘)</span><span className="sm:hidden">封卷</span></> : '启封'}</span>
              </button>
            </div>

            {/* Quick Reminder Settings Dropdown */}
            {showTimerMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl z-60 text-[12px] space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between font-semibold text-on-surface pb-1.5 border-b border-surface-container">
                  <span className="flex items-center gap-1 text-primary">
                    <span className="material-symbols-outlined text-[16px]">timer</span>
                    <span>剩余时间提醒</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTimerMenu(false)}
                    className="text-on-surface-variant hover:text-on-surface p-0.5 rounded"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
                <div className="text-[11px] text-on-surface-variant">
                  到达指定剩余时间时，自动弹出全景答题提醒：
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[30, 15, 10, 5].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const next = { ...reminderSettings, enabled: true, reminderMinutes: m };
                        setReminderSettings(next);
                        saveExamTimerSettings(next);
                        setShowTimerMenu(false);
                        showExamToast(`已设为剩余 ${m} 分钟自动提醒`, 'info');
                      }}
                      className={`px-2 py-1.5 rounded-lg text-center font-medium transition cursor-pointer border ${
                        reminderSettings.enabled && reminderSettings.reminderMinutes === m
                          ? 'border-primary bg-primary text-white font-bold shadow-xs'
                          : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      剩余 {m} 分钟
                    </button>
                  ))}
                </div>
                <div className="pt-1.5 border-t border-surface-container flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...reminderSettings, enabled: !reminderSettings.enabled };
                      setReminderSettings(next);
                      saveExamTimerSettings(next);
                      showExamToast(next.enabled ? '已开启考时提醒' : '已关闭考时提醒', 'info');
                    }}
                    className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    {reminderSettings.enabled ? '关闭本场提醒' : '开启提醒'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTimerMenu(false);
                      if (reminderSettings.soundEnabled) playReminderChime('warning');
                      setReminderModalState({
                        isOpen: true,
                        minutesLeft: Math.max(1, Math.ceil(secondsLeft / 60)),
                        stage: timerStage.stage,
                        formattedTime: formatTimer(secondsLeft)
                      });
                    }}
                    className="text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[13px]">visibility</span>
                    <span>试看弹窗</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Scratchpad Toggle with Active Indicator */}
          <button
            type="button"
            onClick={() => {
              if (isSplitWorkspace) setIsSplitWorkspace(false);
              setShowScratchpad(!showScratchpad);
            }}
            className={`inline-flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 font-sans text-[11px] sm:text-[12px] font-medium rounded-lg border transition cursor-pointer ${
              showScratchpad
                ? 'bg-primary text-on-primary border-primary shadow-xs'
                : 'bg-surface text-on-surface-variant hover:text-on-surface border-outline-variant/50 hover:bg-surface-container'
            }`}
            title={`打开第 ${currentQ?.num} 题专属草稿演算本`}
          >
            <span className="material-symbols-outlined text-[17px]">draw</span>
            <span className="hidden sm:inline">第 {currentQ?.num} 题草稿</span>
            {Boolean(
              localStorage.getItem(scratchpadCanvasStorageKey) ||
              localStorage.getItem(`${scratchpadCanvasStorageKey}_elements`)
            ) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="本题已有专属草稿存档"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (isSplitWorkspace) {
                setIsSplitWorkspace(false);
                setShowScratchpad(false);
              } else {
                setIsSplitWorkspace(true);
                setShowScratchpad(true);
                setIsScratchpadMaximized(false);
              }
            }}
            aria-pressed={isSplitWorkspace}
            className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-sans font-medium transition cursor-pointer ${isSplitWorkspace ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-on-surface-variant border-outline-variant/50 hover:bg-surface-container'}`}
            title="左右分栏：左侧答题，右侧草稿；拖动中间分隔线可调整宽度"
          >
            <span className="material-symbols-outlined text-[16px]">vertical_split</span>
            <span>{isSplitWorkspace ? '退出分栏' : '左右工作台'}</span>
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

          {/* Reset Entire Exam Button */}
          <button
            type="button"
            onClick={() => setIsResetExamModalOpen(true)}
            className="inline-flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 border border-outline-variant/40 hover:border-error/30 text-[11px] sm:text-[12px] font-sans font-medium rounded-lg transition-all active:scale-95 cursor-pointer"
            title="重置整场考试：清空所有题目的答案与草稿纸，恢复初始考试倒计时"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span className="hidden sm:inline">重置整卷</span>
          </button>

          {/* Submit Exam Button */}
          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="inline-flex items-center space-x-1 px-2 sm:px-space-lg py-1.5 bg-primary hover:bg-primary-container text-on-primary text-[11px] sm:font-label-md sm:text-label-md rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
            title="交卷并提交评测"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span className="hidden sm:inline">交卷并提交评测</span>
          </button>
        </div>
      </header>

      {/* Main Focus Runner Layout */}
      <div className={`w-full min-w-0 ${isSplitWorkspace ? 'max-w-none' : 'max-w-7xl'} mx-auto px-3 sm:px-margin-tablet lg:px-margin-desktop py-3 sm:py-space-xl flex flex-col space-y-4 sm:space-y-space-xl pb-24`}>
        {/* Answer card matrix */}
        <section className="bg-surface-container-lowest rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-xs border border-outline-variant/30 flex flex-col gap-2 sm:gap-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 select-none">
            <div className="flex flex-wrap items-center gap-3">
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
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium bg-surface-container-low border border-outline-variant/25 transition-all">
                {!getToken() ? (
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400" title="未登录状态：答题草稿已在当前浏览器安全留存，登录账号后即可启用双端秒级漫游">
                    <span className="material-symbols-outlined text-[13px]">lock</span>
                    <span>未登录 · 本地已保护</span>
                  </span>
                ) : (
                  <>
                    {syncStatus === 'saving' && (
                      <span className="flex items-center gap-1 text-primary animate-pulse">
                        <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                        <span>云端同步中</span>
                      </span>
                    )}
                    {syncStatus === 'synced' && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="答题进度已自动云端同步，换设备可无缝接续">
                        <span className="material-symbols-outlined text-[13px]">cloud_done</span>
                        <span>已云端同步</span>
                      </span>
                    )}
                    {syncStatus === 'error' && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400" title="离线模式：已在本地安全缓存，网络恢复将自动同步">
                        <span className="material-symbols-outlined text-[13px]">cloud_off</span>
                        <span>离线已存</span>
                      </span>
                    )}
                    {syncStatus === 'idle' && (
                      <span className="flex items-center gap-1 text-on-surface-variant/70" title="实时跨端答题同步就绪">
                        <span className="material-symbols-outlined text-[13px]">cloud</span>
                        <span>实时同步</span>
                      </span>
                    )}
                  </>
                )}
              </div>
              <span className="hidden 2xl:inline-flex items-center gap-2.5 text-[11px] font-sans text-on-surface-variant/70">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary ring-1 ring-primary/40"></span>当前</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>已填涂</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-outline-variant/60"></span>未答</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsResetExamModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-error/10 text-on-surface-variant hover:text-error text-[12px] font-sans font-medium border border-outline-variant/30 transition-colors cursor-pointer"
                title="重置整场考试：清空所有答案、草稿纸与恢复初始考试时间"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                <span className="hidden sm:inline">重置整卷</span>
              </button>
              <button type="button" onClick={() => setIsAnswerCardCollapsed((collapsed) => !collapsed)} aria-expanded={!isAnswerCardCollapsed} aria-controls="exam-answer-card-questions" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-[12px] font-sans font-medium border border-outline-variant/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{isAnswerCardCollapsed ? 'expand_more' : 'expand_less'}</span>
                <span>{isAnswerCardCollapsed ? '展开答题卡' : '收起答题卡'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsShortcutsHelpOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-primary/10 text-on-surface-variant hover:text-primary text-[12px] font-sans font-medium border border-outline-variant/30 transition-colors cursor-pointer"
                title="查看键盘快捷键指南（按 ? 键）"
              >
                <span className="material-symbols-outlined text-[15px]">keyboard</span>
                <span className="hidden sm:inline">快捷键</span>
                <kbd className="hidden md:inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-mono border border-outline-variant/40 text-on-surface-variant/80">?</kbd>
              </button>
              <button
                type="button"
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-[12px] font-sans font-medium border border-outline-variant/30 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
                title="切换至上一题 (快捷键: ← 或 PageUp 或 Alt+P)"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                <span className="hidden sm:inline">上一题</span>
                <kbd className="hidden lg:inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-mono border border-outline-variant/40 text-on-surface-variant/80">←</kbd>
              </button>
              <button
                type="button"
                disabled={currentQIndex === questionList.length - 1}
                onClick={() => setCurrentQIndex((i) => Math.min(questionList.length - 1, i + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-[12px] font-sans font-medium shadow-xs transition-all cursor-pointer disabled:opacity-35 disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:shadow-none disabled:cursor-not-allowed active:scale-95 font-semibold"
                title="切换至下一题 (快捷键: → 或 PageDown 或 Alt+N)"
              >
                <span className="hidden sm:inline">下一题</span>
                <kbd className="hidden lg:inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono border border-white/30 text-white">→</kbd>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
          <div id="exam-answer-card-questions" hidden={isAnswerCardCollapsed} className="max-h-56 min-w-0 overflow-y-auto overscroll-contain py-1 pr-1">
            <div className="flex flex-col gap-2.5">
              {questionGroups.map((group) => (
                <div key={group.type} className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1.5">
                  <div className="flex w-32 shrink-0 items-center gap-1.5 pt-1 sm:w-40">
                    <span className={`max-w-32 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${getQuestionTypeClass(group.type)}`} title={group.type}>{group.type}</span>
                    <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">{group.items.length}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {group.items.map(({ question: q, index: idx }) => {
                      const isCurrent = idx === currentQIndex;
                      const isAnswered = Boolean(q.userAnswer && q.userAnswer.trim().length > 0);
                      const isMarked = markedQuestionKeys.includes(getQuestionMarkKey(q, idx));
                      return (
                        <button key={`q_pill_${q.id ?? 'item'}_${idx}`} type="button" onClick={() => setCurrentQIndex(idx)} aria-current={isCurrent ? 'step' : undefined} aria-label={`第 ${q.num} 题，${q.type}${isCurrent ? '，当前题目' : isAnswered ? '，已作答' : '，未作答'}${isMarked ? '，已标记复查' : ''}`} className={`relative flex h-8 min-w-[32px] select-none items-center justify-center rounded-lg border px-1.5 font-mono text-[12px] transition-all duration-150 ${getQuestionTypeClass(q.type)} ${isCurrent ? 'z-10 scale-105 font-bold ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest shadow-sm' : isAnswered ? 'font-semibold ring-1 ring-emerald-500/60 hover:brightness-95' : 'font-medium hover:brightness-95'}`} title={`第 ${q.num} 题 · ${q.type} · ${isCurrent ? '当前' : isAnswered ? '已作答' : '未答'}${isMarked ? ' · 标记复查' : ''}`}>
                          {q.num}
                          {isAnswered && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest" aria-hidden="true" />}
                          {isMarked && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-surface-container-lowest" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div ref={splitWorkspaceRef} className={`${isSplitWorkspace ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,var(--answer-ratio))_12px_minmax(360px,1fr)] items-start' : 'flex flex-col'} gap-space-md xl:gap-space-lg min-w-0`} style={isSplitWorkspace ? { '--answer-ratio': `${splitRatio * 100}%` } : undefined}>
        <div className="min-w-0 space-y-space-md">
        <section className="bg-surface-container-lowest rounded-xl p-3 sm:p-space-xl shadow-sm border border-outline-variant/40 flex flex-col space-y-space-md min-w-0">
          <div className="flex items-center justify-between gap-3 pb-space-xs border-b border-surface-container">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="shrink-0 px-2.5 py-1 bg-primary-fixed text-on-primary-fixed font-headline-sm text-headline-sm rounded font-semibold">题号 {currentQ.num}</span>
              <span className={`shrink-0 rounded-md border px-2 py-1 text-label-sm font-medium ${getQuestionTypeClass(currentQ.type)}`}>{currentQ.type} · 满分 {currentQ.score} 分</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={toggleCurrentQuestionMark} aria-pressed={isCurrentQuestionMarked} className={`inline-flex items-center gap-1 px-2 py-1 text-label-sm rounded hover:bg-surface-container-low transition cursor-pointer ${isCurrentQuestionMarked ? 'text-amber-700' : 'text-on-surface-variant hover:text-primary'}`}>
                <span className="material-symbols-outlined text-[16px]">{isCurrentQuestionMarked ? 'bookmark_added' : 'bookmark_add'}</span>
                <span>{isCurrentQuestionMarked ? '已标记复查' : '标记复查'}</span>
              </button>
              <span className="text-outline-variant">|</span>
              <span className="text-on-surface-variant text-[12px]">难度: <span className="text-tertiary tracking-wider font-mono">{getQuestionDifficulty(currentQ).stars}</span></span>
            </div>
          </div>
          {/* Resolved Passage Section */}
          {resolvedPassage ? (
            <div className="p-space-md bg-surface-container-low rounded-xl border border-secondary/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-secondary font-semibold font-label-md flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">menu_book</span>
                  <span>{resolvedPassageTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  {currentPassageItems.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 rounded-full bg-secondary-container/40 px-2 py-0.5 text-[11px] font-medium text-secondary">
                        已答 {currentPassageItems.filter(({ question }) => Boolean(question.userAnswer?.trim())).length} / {currentPassageItems.length} 题
                      </span>
                      <button
                        type="button"
                        onClick={() => setPassageViewMode((m) => m === 'focus' ? 'all' : 'focus')}
                        className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary text-[11px] font-sans border border-outline-variant/30 transition-colors cursor-pointer"
                        title={passageViewMode === 'focus' ? '切换为篇章整组展开' : '切换为单题聚焦模式'}
                      >
                        {passageViewMode === 'focus' ? '篇章整组展开' : '聚焦单题模式'}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPassageInputText(resolvedPassage);
                      setIsPassageModalOpen(true);
                    }}
                    className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-surface-container transition-colors text-[11px] flex items-center gap-0.5 cursor-pointer"
                    title="编辑或校对本篇材料"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                    <span className="hidden sm:inline">编辑材料</span>
                  </button>
                </div>
              </div>
              <div className="exam-english-passage max-h-80 overflow-y-auto p-space-sm sm:px-4 sm:py-3 bg-surface-container-lowest rounded-lg text-on-surface border border-outline-variant/20 text-[13.5px] leading-relaxed">
                <MathMarkdown content={resolvedPassage.replace(/\{\{\s*(\d+)\s*\}\}/g, '**($1) ______**').replace(/\[(\d+)\]/g, '**[$1] ______**')} />
              </div>
            </div>
          ) : isClozeQuestion ? (
            <div className="p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-[22px] shrink-0">warning</span>
                <div className="text-[13px] leading-relaxed">
                  <div className="font-bold text-amber-900">完形填空需结合上下文篇章短文作答</div>
                  <div className="text-on-surface-variant text-[12px]">当前题组未绑定短文材料，考生无法对照上下文挖空选词。您可以直接在此一键补录短文。</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPassageInputText('');
                  setIsPassageModalOpen(true);
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-[12px] flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                <span>补录/粘贴完形短文</span>
              </button>
            </div>
          ) : null}
          {!isMultiQuestionPassage && <div className="py-space-md min-w-0 overflow-x-auto">
            <MathMarkdown content={currentQ.prompt || (isClozeQuestion ? `请根据上下文，选择最佳词汇填入第 (${currentQ.num}) 空空白处。` : '')} className="font-headline-md text-headline-md text-on-surface tracking-tight mb-space-sm font-semibold" />
            {currentQ.mathExpression && (
              <div className="bg-surface-container-low px-space-xl py-space-lg rounded-lg border-l-4 border-primary overflow-x-auto my-2">
                <MathMarkdown content={currentQ.mathExpression.startsWith('$') ? currentQ.mathExpression : `$$${currentQ.mathExpression}$$`} className="text-headline-md" />
              </div>
            )}
          </div>}
          {isMultiQuestionPassage && (
            <div className="space-y-3">
              {currentPassageItems.map(({ question, index }) => (
                <article key={question.id || `passage-question-${index}`} className={`rounded-xl border p-3 sm:p-4 transition-colors ${index === currentQIndex ? 'border-primary/50 bg-primary/[0.035] ring-1 ring-primary/20' : 'border-outline-variant/30 bg-surface-container-lowest'}`}>
                  <div className="mb-2 flex items-start gap-2">
                    <button type="button" onClick={() => setCurrentQIndex(index)} className="shrink-0 rounded-md bg-primary-fixed px-2 py-1 text-xs font-bold text-primary hover:bg-primary/15" aria-label={`定位第 ${question.num} 题`}>
                      {question.num || String(index + 1).padStart(2, '0')}
                    </button>
                    <MathMarkdown content={question.prompt} className="min-w-0 flex-1 font-body-md text-body-md font-medium text-on-surface" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = question.userAnswer === option.key;
                      return (
                        <button
                          key={`${question.id || index}-${option.key || optionIndex}`}
                          type="button"
                          onClick={() => handleUpdateAnswer(selected ? '' : option.key, index)}
                          aria-pressed={selected}
                          className={`flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/30' : 'border-outline-variant/30 bg-surface-container-low text-on-surface hover:border-primary/40 hover:bg-primary/[0.03]'}`}
                        >
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`}>{option.key}</span>
                          <MathMarkdown content={option.text} className="min-w-0 flex-1 text-body-sm" />
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        {!isMultiQuestionPassage && currentQ.options?.length > 0 && (
          <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40 space-y-space-md min-w-0">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">候选项选择：</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {currentQ.options.map((opt, optIdx) => {
                const isSelected = currentQ.userAnswer === opt.key;
                return <button key={`opt_${opt.key || 'k'}_${optIdx}`} type="button" onClick={() => handleUpdateAnswer(isSelected ? '' : opt.key)} aria-pressed={isSelected} className={`flex items-center gap-space-md p-space-md rounded-xl border text-left transition-all cursor-pointer min-w-0 ${isSelected ? 'bg-primary/5 border-primary ring-2 ring-primary text-primary font-semibold' : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-label-md shrink-0 ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`}>{opt.key}</span>
                  <MathMarkdown content={opt.text} className="font-body-md text-body-md min-w-0" />
                </button>;
              })}
            </div>
          </section>
        )}
        {/* If Blank Fill */}
        {currentQ.type?.includes('填空') && !currentQ.options?.length && (
          <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40 space-y-space-md">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">填写答案，或用文字描述后转成公式：</h3>
              <p className="text-body-sm text-on-surface-variant mt-1">可输入公式或文字描述；转换优先使用数学符号，例如“x 大于 5 且小于 7”→5&lt;x&lt;7，“p 大于 1 或 p 小于 2”→p&gt;1 ∨ p&lt;2。只做转写，不推导答案。</p>
            </div>
            <div className="space-y-3">
              <div className="inline-flex rounded-lg bg-surface-container-low p-1 border border-outline-variant/30" role="tablist" aria-label="答案输入方式">
                <button type="button" role="tab" aria-selected={fillInputMode === 'visual'} onClick={() => setFillInputMode('visual')}
                  className={`px-3 py-1.5 rounded-md text-label-md transition ${fillInputMode === 'visual' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface'}`}>
                  公式编辑
                </button>
                <button type="button" role="tab" aria-selected={fillInputMode === 'description'} onClick={() => setFillInputMode('description')}
                  className={`px-3 py-1.5 rounded-md text-label-md transition ${fillInputMode === 'description' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface'}`}>
                  文字描述
                </button>
              </div>
              {fillInputMode === 'visual' ? (
                <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus-within:ring-2 focus-within:ring-primary focus-within:bg-surface-container-lowest">
                  {mathLiveReady ? (
                    <>
                      <math-field
                        ref={mathFieldRef}
                        virtual-keyboard-mode="onfocus"
                        smart-fence
                        aria-label="可视化公式答案编辑器"
                        className="exam-math-field block w-full min-h-12 bg-transparent text-xl text-on-surface outline-none"
                        style={{ display: 'block', width: '100%', minWidth: '360px', boxSizing: 'border-box', minHeight: '48px', padding: '4px 0', '--caret-color': 'var(--color-primary, #3825d8)' }}
                      />
                      <div className="mt-1 text-label-sm text-on-surface-variant">点击后可用屏幕公式键盘，也可直接使用键盘输入；公式会自动排版。</div>
                    </>
                  ) : <div className="py-3 text-body-sm text-on-surface-variant">正在加载公式编辑器…</div>}
                </div>
              ) : (
                <textarea
                  ref={fillAnswerInputRef}
                  value={candidateDraft}
                  onChange={(e) => handleUpdateAnswer(e.target.value)}
                  placeholder="用文字描述答案，例如：x 大于 5 且小于 7、根号二分之一"
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-container-low rounded-lg font-body-md text-body-md border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest resize-y"
                />
              )}
              <button
                type="button"
                onClick={handleTriggerAIScribe}
                disabled={isScribing || !candidateDraft.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary font-label-md rounded-lg shadow-xs hover:bg-primary-container transition cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[17px] ${isScribing ? 'animate-spin' : ''}`}>{isScribing ? 'progress_activity' : 'auto_fix_high'}</span>
                <span>{isScribing ? 'AI 正在转写…' : 'AI 转成公式并填入答案'}</span>
              </button>
            </div>
          </section>
        )}

        {/* Comprehensive Calculus / Proof Question (Dual Modality Input Switcher) */}
        {!currentQ.options?.length && !currentQ.type?.includes('填空') && (
          <section className="flex flex-col space-y-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-space-sm">
                <span className="text-on-surface font-headline-sm text-headline-sm font-semibold">
                  考生作答交付模式
                </span>
                <span className="text-on-surface-variant font-body-sm text-body-sm">
                  请选择一种作答方式
                </span>
              </div>
              <div className="text-label-mono text-label-mono text-on-surface-variant" aria-live="polite">
                {candidateDraft.trim()
                  ? <span className="text-secondary font-semibold">已自动保存</span>
                  : <span>尚未作答</span>}
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
                        <div className="inline-flex rounded-lg bg-surface-container-low p-1 border border-outline-variant/30" role="tablist" aria-label="答案编辑方式">
                          <button type="button" role="tab" aria-selected={fillInputMode === 'description'} onClick={() => setFillInputMode('description')}
                            className={`px-2.5 py-1 rounded-md text-label-sm transition ${fillInputMode === 'description' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface'}`}>
                            排版预览
                          </button>
                          <button type="button" role="tab" aria-selected={fillInputMode === 'visual'} onClick={() => setFillInputMode('visual')}
                            className={`px-2.5 py-1 rounded-md text-label-sm transition ${fillInputMode === 'visual' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface'}`}>
                            公式编辑
                          </button>
                        </div>
                      </div>

                      {/* Mathematical Render Container */}
                      <div className="mt-space-sm p-space-md bg-surface-container-low rounded-lg space-y-space-sm border border-outline-variant/30 overflow-x-auto leading-relaxed">
                        {fillInputMode === 'visual' ? (mathLiveReady ? (
                          <>
                            <math-field
                              ref={mathFieldRef}
                              virtual-keyboard-mode="onfocus"
                              smart-fence
                              aria-label="简答题可视化公式答案编辑器"
                              className="exam-math-field block w-full min-h-48 bg-transparent text-lg text-on-surface outline-none"
                              style={{ display: 'block', width: '100%', minWidth: '360px', boxSizing: 'border-box', minHeight: '192px', padding: '8px 0', '--caret-color': 'var(--color-primary, #3825d8)' }}
                            />
                            <div className="text-label-sm text-on-surface-variant">公式会直接排版；文字说明和多步推导可继续在左侧草稿区输入。</div>
                          </>
                        ) : <div className="py-8 text-on-surface-variant">正在加载公式编辑器…</div>) : scribedLatex ? (
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

        {isSplitWorkspace && showScratchpad && (
          <>
            <div
              role="separator"
              aria-label="调整答题区与草稿纸宽度"
              aria-orientation="vertical"
              aria-valuenow={Math.round(splitRatio * 100)}
              aria-valuemin={35}
              aria-valuemax={72}
              tabIndex={0}
              onPointerDown={handleSplitResizeStart}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const next = Math.max(0.35, Math.min(0.72, splitRatio + (event.key === 'ArrowRight' ? 0.02 : -0.02)));
                setSplitRatio(next);
                try { localStorage.setItem('examcraft_exam_split_ratio', String(next)); } catch {}
              }}
              className="hidden xl:flex h-[calc(100vh-240px)] min-h-[520px] items-center justify-center cursor-col-resize touch-none rounded-full outline-none group"
              title="拖动调整左右区域宽度；也可用键盘左右方向键调整"
            >
              <span className="h-16 w-1 rounded-full bg-outline-variant/60 group-hover:bg-primary group-focus:bg-primary transition-colors" />
            </div>
            <aside className="min-w-0 h-[min(72dvh,640px)] min-h-[380px] xl:h-[calc(100vh-240px)] xl:min-h-[520px] xl:sticky xl:top-4">
              {renderScratchpadCanvas(true)}
            </aside>
          </>
        )}
        </div>
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
      {showScratchpad && !isSplitWorkspace && (
        <>
          {/* Backdrop when maximized */}
          {isScratchpadMaximized && (
            <div
              onClick={() => setIsScratchpadMaximized(false)}
              className="fixed inset-0 z-45 bg-on-background/25 backdrop-blur-xs animate-in fade-in duration-200"
            />
          )}

          <div
            ref={scratchpadModalRef}
            style={{
              left: !isMobileViewport && !isScratchpadMaximized && scratchpadPos ? `${scratchpadPos.x}px` : undefined,
              top: !isMobileViewport && !isScratchpadMaximized && scratchpadPos ? `${scratchpadPos.y}px` : undefined,
              bottom: !isMobileViewport && !isScratchpadMaximized && !scratchpadPos ? '20px' : undefined,
              right: !isMobileViewport && !isScratchpadMaximized && !scratchpadPos ? '20px' : undefined,
            }}
            className={`z-50 shadow-2xl ${
              isDraggingScratchpad
                ? 'transition-none select-none'
                : 'transition-opacity duration-150'
            } ${
              isScratchpadMaximized
                ? 'fixed inset-2 sm:inset-4 lg:inset-6 animate-in zoom-in-95'
                : isMobileViewport
                ? 'fixed inset-x-2 bottom-2 top-auto w-auto h-[min(78dvh,680px)] min-h-0 max-h-[calc(100dvh-1rem)] resize-none overflow-hidden animate-in slide-in-from-bottom-5'
                : 'fixed w-[760px] max-w-[96vw] h-[min(680px,88vh)] min-h-[420px] max-h-[88vh] resize overflow-hidden animate-in slide-in-from-bottom-5'
            }`}
          >
            {renderScratchpadCanvas(false)}
          </div>
        </>
      )}

      {/* Submit Confirmation Modal */}
      {isClearCurrentAnswerModalOpen && (
        <div className="fixed inset-0 z-[60] bg-on-background/45 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md" role="dialog" aria-modal="true" aria-labelledby="clear-answers-title">
            <div className="flex items-center gap-space-sm text-error">
              <span className="material-symbols-outlined text-[26px]">ink_eraser</span>
              <h3 id="clear-answers-title" className="font-headline-sm text-headline-sm font-semibold text-on-surface">清空第 {currentQ?.num || currentQIndex + 1} 题答案？</h3>
            </div>
            <p className="text-body-md text-on-surface-variant leading-relaxed">
              只会清空本题答案及 AI 转写，并将本题恢复为未答。其他题目和本题草稿纸内容都会保留，此操作无法撤销。
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button type="button" onClick={() => setIsClearCurrentAnswerModalOpen(false)} className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md cursor-pointer">取消</button>
              <button type="button" onClick={handleClearCurrentAnswer} className="px-4 py-2 rounded-lg bg-error hover:bg-error/90 text-white font-label-md shadow-sm cursor-pointer inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Entire Exam Confirmation Modal */}
      {isResetExamModalOpen && (
        <div className="fixed inset-0 z-60 bg-on-background/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" role="presentation">
          <div
            className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/40 space-y-4 animate-in zoom-in-95 duration-200"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-exam-title"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0 border border-error/20">
                <span className="material-symbols-outlined text-[26px]">restart_alt</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="reset-exam-title" className="text-title-lg font-bold text-on-surface">
                  重置整场考试？
                </h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  将试卷《{activePaper?.title || '当前考卷'}》彻底还原至最初开考状态。
                </p>
              </div>
            </div>

            {/* Detailed summary of items being reset */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-body-sm space-y-2 text-on-surface">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-error">edit_off</span>
                <span><strong>清空已答内容</strong>：已填涂的 {answeredCount} 题答案与 AI 转写板书将被完全清除。</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-error">draw</span>
                <span><strong>清空全部草稿纸</strong>：所有题目的手绘笔迹、坐标系图元与推导板书一并清空。</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">timer</span>
                <span><strong>恢复考试倒计时</strong>：倒计时重新恢复至初始 {Math.floor(totalExamDurationSeconds / 60)} 分钟，解除封卷。</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">bookmark_remove</span>
                <span><strong>重置标记与序号</strong>：清空复查标记，题目定位自动回到第 1 题。</span>
              </div>
            </div>

            <p className="text-[12px] text-error font-medium">
              ⚠️ 此操作无法撤销，确定要放弃现有进度并重新开考吗？
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setIsResetExamModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleResetEntireExam}
                className="px-4 py-2 rounded-xl bg-error hover:bg-error/90 text-white font-label-md font-semibold cursor-pointer transition-colors shadow-sm flex items-center gap-1.5 active:scale-98"
              >
                <span className="material-symbols-outlined text-[17px]">restart_alt</span>
                <span>确认重置并重新开考</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md">
            <div className="flex items-center gap-space-sm text-primary">
              <span className="material-symbols-outlined text-[28px]">fact_check</span>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">确认交卷并评测？</h3>
            </div>
            <p className="text-body-md text-on-surface-variant leading-relaxed">
              当前已填涂 <span className="font-bold text-primary">{answeredCount}</span> 题，未作答 <span className="font-bold text-tertiary">{questionList.length - answeredCount}</span> 题。
              交卷后将按标准答案核对客观题；主观题不会自动判分，请在报告中对照解析复核。智能诊断服务可用时会补充本次作答分析。
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
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-primary-container/20 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px] animate-spin">sync</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  正在提交并生成报告
                </h3>
                <p className="text-body-sm text-on-surface-variant mt-1" aria-live="polite">
                  {submitProgressText || '正在准备评测…'}
                </p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container" role="progressbar" aria-label="交卷评测进度">
              <div className="exam-submit-progress-sweep h-full w-[38%] rounded-full bg-primary" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs sm:text-sm">
              {['核对答案', '逐题 AI 复核', '生成全卷诊断', '整理并保存'].map((label, index) => (
                <div key={label} className={`rounded-lg px-2 py-2 transition-colors ${index < submitProgressStage ? 'bg-secondary-container/60 text-secondary' : index === submitProgressStage ? 'bg-primary-container/50 text-primary font-semibold' : 'bg-surface-container-low text-on-surface-variant'}`}>
                  {index < submitProgressStage ? '✓ ' : index === submitProgressStage ? '● ' : ''}{label}
                </div>
              ))}
            </div>
            {submitAiUsage.total > 0 && (
              <p className="text-center text-xs text-on-surface-variant">
                {submitAiUsage.enabled
                  ? `逐题 AI 复核 ${submitAiUsage.checked}/${submitAiUsage.total} 题${submitAiUsage.failed ? ` · 失败 ${submitAiUsage.failed} 题` : ''}`
                  : '未配置模型，逐题复核使用本地判分'}
                {submitAiUsage.totalTokens > 0 ? ` · ${submitAiUsage.totalTokens.toLocaleString()} Tokens` : ''}
                {submitAiUsage.costKnown && submitAiUsage.calls > 0 ? ` · 约 ¥${submitAiUsage.estimatedCostCny.toFixed(4)}` : ''}
              </p>
            )}
            <p className="text-center text-xs text-on-surface-variant">已用时 {Math.floor(submitElapsedSeconds / 60)}:{String(submitElapsedSeconds % 60).padStart(2, '0')}</p>
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

      {/* Exam Timer Remaining Time Alert Modal (Our Custom UI MSG) */}
      <ExamTimerReminderModal
        isOpen={reminderModalState.isOpen}
        onClose={() => setReminderModalState((prev) => ({ ...prev, isOpen: false }))}
        minutesLeft={reminderModalState.minutesLeft}
        formattedTime={reminderModalState.formattedTime}
        stage={reminderModalState.stage}
        answeredCount={answeredCount}
        totalQuestions={questionList.length}
        onSnooze={() => {
          setSnoozeSecondsRemaining(secondsLeft - 300);
          setReminderModalState((prev) => ({ ...prev, isOpen: false }));
          showExamToast('已设置 5 分钟后再次提醒', 'info');
        }}
        onDisableThisExam={() => {
          setDisableReminderForThisExam(true);
          setReminderModalState((prev) => ({ ...prev, isOpen: false }));
          showExamToast('本场考试已关闭弹窗提醒', 'info');
        }}
      />

      {/* Passage Edit / In-Place Repair Modal */}
      {isPassageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">menu_book</span>
                <h3 className="text-title-md font-bold text-on-surface">补录 / 编辑篇章短文材料</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPassageModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-5 flex flex-col space-y-3 overflow-y-auto">
              <div className="p-3 rounded-lg bg-surface-container-low text-on-surface-variant text-[12px] leading-relaxed flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">info</span>
                <span>
                  在此粘贴完整的英文完形填空或阅读短文（支持带挖空编号如 1、[1] 或 1~20 空）。保存后将自动应用至本卷相关题组，并持久化保存。
                </span>
              </div>
              <textarea
                rows={12}
                value={passageInputText}
                onChange={(e) => setPassageInputText(e.target.value)}
                placeholder="请在此粘贴或输入英文篇章短文，例如：&#10;&#10;The ancient Greek philosopher Aristotle viewed happiness as... 1 [A] ... 2 [B] ..."
                className="w-full p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/30 font-sans text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed resize-y"
              />
            </div>
            <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-between">
              <span className="text-[11px] text-outline">
                {passageInputText.length} 字符 · {passageInputText.split(/\s+/).filter(Boolean).length} 词
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPassageModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container font-label-md font-medium transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSavePassageToPaper}
                  disabled={!passageInputText.trim()}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold cursor-pointer shadow-xs disabled:opacity-50 active:scale-95 transition-all"
                >
                  保存并应用到题组
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {isShortcutsHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">keyboard</span>
                <h3 className="text-title-md font-bold text-on-surface">考场键盘快捷键指南</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutsHelpOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition cursor-pointer"
                title="关闭快捷键指南 (Esc)"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-5 flex flex-col space-y-4 overflow-y-auto">
              <div className="p-3 rounded-xl bg-surface-container-low text-on-surface-variant text-[12px] leading-relaxed flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">tips_and_updates</span>
                <span>
                  在考场答题过程中，无需鼠标点击即可快速切题、填涂答案或呼出草稿纸。
                  <strong className="text-on-surface font-semibold ml-1">在文本框或数学公式编辑器打字时，快捷键会自动暂停响应，绝不干扰输入。</strong>
                </span>
              </div>

              {/* Group 1: 题目切换 */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>题目导航与切换</span>
                </h4>
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50 border border-outline-variant/20">
                    <span className="text-on-surface font-medium">下一题</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">→</kbd>
                      <span className="text-outline-variant text-[10px]">或</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">PageDown</kbd>
                      <span className="text-outline-variant text-[10px]">或</span>
                      <span className="flex items-center gap-0.5">
                        <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">Alt</kbd>
                        <span>+</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">N</kbd>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50 border border-outline-variant/20">
                    <span className="text-on-surface font-medium">上一题</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">←</kbd>
                      <span className="text-outline-variant text-[10px]">或</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">PageUp</kbd>
                      <span className="text-outline-variant text-[10px]">或</span>
                      <span className="flex items-center gap-0.5">
                        <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">Alt</kbd>
                        <span>+</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">P</kbd>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 2: 作答与标记 */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  <span>快速作答与试题标记</span>
                </h4>
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50 border border-outline-variant/20">
                    <div>
                      <span className="text-on-surface font-medium">选择题快速填涂</span>
                      <span className="text-[11px] text-on-surface-variant block">单选直接选中，多选题按对应字母追加/取消</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">A</kbd>
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">B</kbd>
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">C</kbd>
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">D</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50 border border-outline-variant/20">
                    <div>
                      <span className="text-on-surface font-medium">标记复查</span>
                      <span className="text-[11px] text-on-surface-variant block">在答题卡上高亮此题，便于回头检查</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">M</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 3: 工具与交互 */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">handyman</span>
                  <span>草稿纸与窗口控制</span>
                </h4>
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50 border border-outline-variant/20">
                    <span className="text-on-surface font-medium">打开 / 关闭本题专属草稿纸</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">Alt</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">D</kbd>
                      <span className="text-outline-variant text-[10px]">或</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">S</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50 border border-outline-variant/20">
                    <span className="text-on-surface font-medium">打开 / 关闭本快捷键指南</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">?</kbd>
                      <span className="text-outline-variant text-[10px]">(Shift + /)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50 border border-outline-variant/20">
                    <span className="text-on-surface font-medium">关闭弹窗 / 取消输入焦点</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/40 shadow-2xs">Esc</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsShortcutsHelpOpen(false)}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-Only Bottom Sticky Action Bar (sm:hidden, completely isolated from Web) */}
      <nav aria-label="移动端快速答题导航" className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/30 px-3 py-2 flex items-center justify-between shadow-lg pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={currentQIndex === 0}
          onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-[12px] font-sans font-medium border border-outline-variant/30 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          <span>上一题</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileAnswerDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/25 text-[12px] font-sans font-semibold active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">grid_view</span>
          <span>答题卡 ({answeredCount}/{questionList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setShowScratchpad(!showScratchpad)}
          className={`p-1.5 rounded-lg border text-[12px] transition cursor-pointer ${showScratchpad ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30'}`}
          title="打开草稿纸"
        >
          <span className="material-symbols-outlined text-[18px]">draw</span>
        </button>

        <button
          type="button"
          disabled={currentQIndex === questionList.length - 1}
          onClick={() => setCurrentQIndex((i) => Math.min(questionList.length - 1, i + 1))}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-sans font-semibold shadow-xs disabled:opacity-35 disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:shadow-none disabled:cursor-not-allowed active:scale-95 transition cursor-pointer"
        >
          <span>下一题</span>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </nav>

      {/* Mobile Answer Card Bottom Sheet / Drawer */}
      {isMobileAnswerDrawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150">
          <div className="w-full bg-surface-container-lowest rounded-t-2xl max-h-[75vh] flex flex-col shadow-2xl border-t border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <div className="px-4 py-3 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">grid_view</span>
                <span className="font-bold text-on-surface text-[14px]">答题卡与题目跳转</span>
                <span className="text-xs font-mono text-outline">({answeredCount}/{questionList.length})</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center gap-1 font-medium">
                  {!getToken() ? (
                    <span className="text-amber-600 dark:text-amber-400">本地已存</span>
                  ) : syncStatus === 'saving' ? (
                    <span className="text-primary flex items-center gap-0.5"><span className="material-symbols-outlined text-[11px] animate-spin">sync</span>同步中</span>
                  ) : syncStatus === 'synced' ? (
                    <span className="text-emerald-600 flex items-center gap-0.5"><span className="material-symbols-outlined text-[11px]">cloud_done</span>已同步</span>
                  ) : (
                    <span className="text-on-surface-variant">实时同步</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileAnswerDrawerOpen(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {questionGroups.map((group) => (
                <div key={group.type} className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-secondary flex items-center gap-1">
                    <span>{group.type}</span>
                    <span className="text-outline-variant">({group.items.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map(({ question: q, index: idx }) => {
                      const isCurrent = idx === currentQIndex;
                      const isAnswered = Boolean(q.userAnswer && q.userAnswer.trim().length > 0);
                      const isMarked = markedQuestionKeys.includes(getQuestionMarkKey(q, idx));
                      return (
                        <button
                          key={`mob_q_${q.id ?? 'item'}_${idx}`}
                          type="button"
                          onClick={() => {
                            setCurrentQIndex(idx);
                            setIsMobileAnswerDrawerOpen(false);
                          }}
                          className={`relative flex h-9 w-9 items-center justify-center rounded-lg border font-mono text-[13px] ${getQuestionTypeClass(q.type)} ${
                            isCurrent
                              ? 'ring-2 ring-primary ring-offset-2 font-bold shadow-xs'
                              : isAnswered
                              ? 'ring-1 ring-emerald-500 font-semibold'
                              : 'opacity-85'
                          }`}
                        >
                          {q.num}
                          {isAnswered && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-surface-container-lowest" />}
                          {isMarked && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-surface-container-lowest" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


