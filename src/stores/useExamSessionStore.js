import { create } from 'zustand';
import {
  apiGetExamSession,
  apiSaveExamSession,
  apiDeleteExamSession,
  getToken
} from '../utils/auth';

const STORAGE_PREFIX_ANSWERS = 'examcraft_answers_';
const STORAGE_PREFIX_MARKS = 'examcraft_question_marks_';
const STORAGE_PREFIX_SESSION = 'examcraft_session_';

// Debounce timer registry for cloud sync per paperId
const pendingSyncTimers = new Map();
const pendingSyncPayloads = new Map();

function readLocalStorage(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[useExamSessionStore] LocalStorage write failed for ${key}:`, err);
  }
}

function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export const useExamSessionStore = create((set, get) => ({
  // Active sessions mapped by paperId
  sessions: {},
  // Cloud sync status: 'idle' | 'saving' | 'synced' | 'error'
  syncStatus: 'idle',
  syncError: null,
  lastSyncedAt: null,

  /**
   * Get active session for a specific paper
   */
  getSession: (paperId) => {
    if (!paperId) return null;
    return get().sessions[paperId] || null;
  },

  /**
   * Initialize and resume an exam session for a paper.
   * Priority:
   * 1. Read local storage cache for instant UI rendering (zero delay).
   * 2. If user is logged in, asynchronously fetch latest cloud session.
   * 3. Merge: if cloud session has newer `updatedAt`, seamlessly update state & local storage!
   */
  initPaperSession: async (paper, questions = [], currentUser = null) => {
    if (!paper?.id) return null;
    const paperId = String(paper.id);

    // 1. Read local cache
    const localAnswers = readLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, []);
    const localMarks = readLocalStorage(`${STORAGE_PREFIX_MARKS}${paperId}`, []);
    const localMeta = readLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {});

    const baseQuestions = Array.isArray(questions) && questions.length > 0
      ? questions
      : (Array.isArray(paper.questions) ? paper.questions : []);

    // Merge answers into questions
    const answerMap = new Map();
    if (Array.isArray(localAnswers)) {
      localAnswers.forEach((ans, idx) => {
        const key = ans?.id || `q_${ans?.num || idx}`;
        answerMap.set(key, ans);
      });
    }

    const mergedQuestions = baseQuestions.map((q, idx) => {
      const key = q?.id || `q_${q?.num || idx}`;
      const saved = answerMap.get(key) || localAnswers[idx];
      return {
        ...q,
        userAnswer: saved?.userAnswer || q.userAnswer || '',
        aiTranscription: saved?.aiTranscription || q.aiTranscription || '',
        stepScores: saved?.stepScores || q.stepScores || [],
        status: (saved?.userAnswer || q.userAnswer || '').trim() ? 'answered' : 'unanswered'
      };
    });

    const initialSession = {
      paperId,
      answers: mergedQuestions,
      markedQuestionKeys: Array.isArray(localMarks) ? localMarks : [],
      secondsLeft: typeof localMeta.secondsLeft === 'number'
        ? localMeta.secondsLeft
        : (paper.secondsLeft ?? (paper.duration ? Number(paper.duration) * 60 : 5400)),
      currentQIndex: typeof localMeta.currentQIndex === 'number' ? localMeta.currentQIndex : 0,
      status: localMeta.status || paper.status || '考试中',
      sealedAt: localMeta.sealedAt || paper.sealedAt || '',
      updatedAt: localMeta.updatedAt || Date.now()
    };

    // Apply immediate local session
    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: initialSession
      }
    }));

    // 2. Cloud pull if user is logged in
    const token = getToken();
    if (token) {
      try {
        set({ syncStatus: 'saving' });
        const cloudSession = await apiGetExamSession(paperId);
        if (cloudSession && cloudSession.paperId === paperId) {
          const cloudTime = Number(cloudSession.updatedAt) || 0;
          const localTime = Number(initialSession.updatedAt) || 0;

          // If cloud has newer or equal progress, adopt cloud session!
          if (cloudTime >= localTime || !localAnswers.length) {
            const cloudAnswerMap = new Map();
            if (Array.isArray(cloudSession.answers)) {
              cloudSession.answers.forEach((ans, idx) => {
                const key = ans?.id || `q_${ans?.num || idx}`;
                cloudAnswerMap.set(key, ans);
              });
            }

            const updatedAnswers = baseQuestions.map((q, idx) => {
              const key = q?.id || `q_${q?.num || idx}`;
              const cloudAns = cloudAnswerMap.get(key) || cloudSession.answers?.[idx];
              return {
                ...q,
                userAnswer: cloudAns?.userAnswer || '',
                aiTranscription: cloudAns?.aiTranscription || '',
                stepScores: cloudAns?.stepScores || [],
                status: (cloudAns?.userAnswer || '').trim() ? 'answered' : 'unanswered'
              };
            });

            const refreshedSession = {
              ...initialSession,
              ...cloudSession,
              answers: updatedAnswers,
              markedQuestionKeys: Array.isArray(cloudSession.markedQuestionKeys)
                ? cloudSession.markedQuestionKeys
                : initialSession.markedQuestionKeys,
              secondsLeft: typeof cloudSession.secondsLeft === 'number'
                ? cloudSession.secondsLeft
                : initialSession.secondsLeft,
              currentQIndex: typeof cloudSession.currentQIndex === 'number'
                ? cloudSession.currentQIndex
                : initialSession.currentQIndex,
              status: cloudSession.status || initialSession.status,
              sealedAt: cloudSession.sealedAt || initialSession.sealedAt,
              updatedAt: cloudTime || Date.now()
            };

            // Write back to local cache
            writeLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, refreshedSession.answers);
            writeLocalStorage(`${STORAGE_PREFIX_MARKS}${paperId}`, refreshedSession.markedQuestionKeys);
            writeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {
              secondsLeft: refreshedSession.secondsLeft,
              currentQIndex: refreshedSession.currentQIndex,
              status: refreshedSession.status,
              sealedAt: refreshedSession.sealedAt,
              updatedAt: refreshedSession.updatedAt
            });

            set((state) => ({
              sessions: {
                ...state.sessions,
                [paperId]: refreshedSession
              },
              syncStatus: 'synced',
              lastSyncedAt: Date.now()
            }));
            return refreshedSession;
          }
        }
        set({ syncStatus: 'synced', lastSyncedAt: Date.now() });
      } catch (err) {
        console.warn('[useExamSessionStore] Cloud session fetch error (falling back to local):', err);
        set({ syncStatus: 'idle' });
      }
    }

    return initialSession;
  },

  /**
   * Update question answer with immediate local persistence & debounced cloud synchronization
   */
  updateAnswer: (paperId, value, questionIndex) => {
    if (!paperId) return;
    const current = get().sessions[paperId];
    if (!current) return;

    const nextAnswers = current.answers.map((q, idx) =>
      idx === questionIndex
        ? {
            ...q,
            userAnswer: value,
            status: value && value.trim().length > 0 ? 'answered' : 'unanswered'
          }
        : q
    );

    const now = Date.now();
    const updatedSession = {
      ...current,
      answers: nextAnswers,
      updatedAt: now
    };

    // 1. In-memory update
    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: updatedSession
      }
    }));

    // 2. Local storage write
    writeLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, nextAnswers);
    writeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {
      secondsLeft: updatedSession.secondsLeft,
      currentQIndex: updatedSession.currentQIndex,
      status: updatedSession.status,
      sealedAt: updatedSession.sealedAt,
      updatedAt: now
    });

    // 3. Debounced cloud push (700ms)
    get().scheduleCloudSync(paperId, updatedSession, 700);
  },

  /**
   * Toggle question review bookmark
   */
  toggleQuestionMark: (paperId, markKey) => {
    if (!paperId || !markKey) return;
    const current = get().sessions[paperId];
    if (!current) return;

    const exists = current.markedQuestionKeys.includes(markKey);
    const nextMarks = exists
      ? current.markedQuestionKeys.filter((k) => k !== markKey)
      : [...current.markedQuestionKeys, markKey];

    const now = Date.now();
    const updatedSession = {
      ...current,
      markedQuestionKeys: nextMarks,
      updatedAt: now
    };

    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: updatedSession
      }
    }));

    writeLocalStorage(`${STORAGE_PREFIX_MARKS}${paperId}`, nextMarks);
    get().scheduleCloudSync(paperId, updatedSession, 500);
  },

  /**
   * Update exam countdown timer and current question index
   */
  updateExamProgress: (paperId, secondsLeft, currentQIndex = null) => {
    if (!paperId) return;
    const current = get().sessions[paperId];
    if (!current) return;

    const nextSession = {
      ...current,
      secondsLeft: typeof secondsLeft === 'number' ? secondsLeft : current.secondsLeft,
      currentQIndex: typeof currentQIndex === 'number' ? currentQIndex : current.currentQIndex,
      updatedAt: Date.now()
    };

    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: nextSession
      }
    }));

    writeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {
      secondsLeft: nextSession.secondsLeft,
      currentQIndex: nextSession.currentQIndex,
      status: nextSession.status,
      sealedAt: nextSession.sealedAt,
      updatedAt: nextSession.updatedAt
    });

    // Low-frequency cloud sync for timer (every 15 seconds)
    get().scheduleCloudSync(paperId, nextSession, 15000);
  },

  /**
   * Seal exam (freeze timer, mark status as '已封卷')
   */
  sealExam: async (paperId, sealedAtStr) => {
    if (!paperId) return;
    const current = get().sessions[paperId];
    if (!current) return;

    const nextSession = {
      ...current,
      status: '已封卷',
      sealedAt: sealedAtStr || new Date().toISOString(),
      updatedAt: Date.now()
    };

    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: nextSession
      }
    }));

    writeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {
      secondsLeft: nextSession.secondsLeft,
      currentQIndex: nextSession.currentQIndex,
      status: nextSession.status,
      sealedAt: nextSession.sealedAt,
      updatedAt: nextSession.updatedAt
    });

    // Immediate cloud flush
    await get().flushPendingSync(paperId, nextSession);
  },

  /**
   * Unseal exam (resume timer, mark status as '考试中')
   */
  unsealExam: async (paperId) => {
    if (!paperId) return;
    const current = get().sessions[paperId];
    if (!current) return;

    const nextSession = {
      ...current,
      status: '考试中',
      sealedAt: '',
      updatedAt: Date.now()
    };

    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: nextSession
      }
    }));

    writeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {
      secondsLeft: nextSession.secondsLeft,
      currentQIndex: nextSession.currentQIndex,
      status: nextSession.status,
      sealedAt: nextSession.sealedAt,
      updatedAt: nextSession.updatedAt
    });

    await get().flushPendingSync(paperId, nextSession);
  },

  /**
   * Clear current question answer
   */
  clearSingleAnswer: (paperId, questionIndex) => {
    if (!paperId) return;
    const current = get().sessions[paperId];
    if (!current) return;

    const nextAnswers = current.answers.map((q, idx) =>
      idx === questionIndex
        ? { ...q, userAnswer: '', aiTranscription: '', stepScores: [], status: 'unanswered' }
        : q
    );

    const nextSession = {
      ...current,
      answers: nextAnswers,
      updatedAt: Date.now()
    };

    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: nextSession
      }
    }));

    writeLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, nextAnswers);
    get().scheduleCloudSync(paperId, nextSession, 500);
  },

  /**
   * Reset entire exam (clear answers, restore full duration, clear marks)
   */
  resetEntireExam: async (paperId, initialDurationSeconds) => {
    if (!paperId) return;
    const current = get().sessions[paperId];
    if (!current) return;

    const resetAnswers = current.answers.map((q) => ({
      ...q,
      userAnswer: '',
      aiTranscription: '',
      stepScores: [],
      status: 'unanswered'
    }));

    const resetSession = {
      ...current,
      answers: resetAnswers,
      markedQuestionKeys: [],
      secondsLeft: initialDurationSeconds,
      currentQIndex: 0,
      status: '考试中',
      sealedAt: '',
      updatedAt: Date.now()
    };

    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: resetSession
      }
    }));

    writeLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, resetAnswers);
    removeLocalStorage(`${STORAGE_PREFIX_MARKS}${paperId}`);
    writeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {
      secondsLeft: initialDurationSeconds,
      currentQIndex: 0,
      status: '考试中',
      sealedAt: '',
      updatedAt: resetSession.updatedAt
    });

    // Clear cloud session or overwrite with reset state
    await get().flushPendingSync(paperId, resetSession);
  },

  /**
   * Finalize and delete session upon submission
   */
  finishAndCleanupSession: async (paperId) => {
    if (!paperId) return;
    // Cancel pending sync
    if (pendingSyncTimers.has(paperId)) {
      clearTimeout(pendingSyncTimers.get(paperId));
      pendingSyncTimers.delete(paperId);
      pendingSyncPayloads.delete(paperId);
    }

    // Clean up local storage
    removeLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`);
    removeLocalStorage(`${STORAGE_PREFIX_MARKS}${paperId}`);
    removeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`);

    set((state) => {
      const next = { ...state.sessions };
      delete next[paperId];
      return { sessions: next };
    });

    if (getToken()) {
      try {
        await apiDeleteExamSession(paperId);
      } catch (err) {
        console.warn('[useExamSessionStore] Error removing cloud exam session:', err);
      }
    }
  },

  /**
   * Schedule debounced cloud sync
   */
  scheduleCloudSync: (paperId, session, delayMs = 700) => {
    if (!getToken()) return;
    pendingSyncPayloads.set(paperId, session);

    if (pendingSyncTimers.has(paperId)) {
      clearTimeout(pendingSyncTimers.get(paperId));
    }

    set({ syncStatus: 'saving' });

    const timer = setTimeout(async () => {
      pendingSyncTimers.delete(paperId);
      const payload = pendingSyncPayloads.get(paperId);
      pendingSyncPayloads.delete(paperId);
      if (payload) {
        try {
          await apiSaveExamSession(payload);
          set({ syncStatus: 'synced', lastSyncedAt: Date.now(), syncError: null });
        } catch (err) {
          console.warn('[useExamSessionStore] Cloud auto-save failed:', err.message);
          set({ syncStatus: 'error', syncError: err.message });
        }
      }
    }, delayMs);

    pendingSyncTimers.set(paperId, timer);
  },

  /**
   * Immediately execute any pending sync (used before navigating or leaving)
   */
  flushPendingSync: async (paperId, forcedSession = null) => {
    if (!getToken()) return;
    if (pendingSyncTimers.has(paperId)) {
      clearTimeout(pendingSyncTimers.get(paperId));
      pendingSyncTimers.delete(paperId);
    }

    const payload = forcedSession || pendingSyncPayloads.get(paperId) || get().sessions[paperId];
    pendingSyncPayloads.delete(paperId);
    if (payload) {
      try {
        set({ syncStatus: 'saving' });
        await apiSaveExamSession(payload);
        set({ syncStatus: 'synced', lastSyncedAt: Date.now(), syncError: null });
      } catch (err) {
        console.warn('[useExamSessionStore] Flush cloud save failed:', err.message);
        set({ syncStatus: 'error', syncError: err.message });
      }
    }
  }
}));
