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

/**
 * 题级智能无损合并 (Smart Question-Level Merge)
 * 核心法则：
 * 1. 绝不允许云端的“空答案”覆盖本地已经填涂的“有效答案”；
 * 2. 若双方都有答案，比对时间戳并优先最新作答；
 * 3. 统计两端有效作答数，若本地作答数多于云端，自动将本地合并结果反向推向云端。
 */
export function mergeAnswersSmartly(localQuestions = [], cloudQuestions = [], localUpdatedAt = 0, cloudUpdatedAt = 0) {
  const localList = Array.isArray(localQuestions) ? localQuestions : [];
  const cloudList = Array.isArray(cloudQuestions) ? cloudQuestions : [];

  // 建立题目索引字典
  const cloudMap = new Map();
  cloudList.forEach((q, idx) => {
    const key = q?.id || `q_${q?.num || idx}`;
    cloudMap.set(key, q);
  });

  const localMap = new Map();
  localList.forEach((q, idx) => {
    const key = q?.id || `q_${q?.num || idx}`;
    localMap.set(key, q);
  });

  // 以本地题库或云端题库的并集为基准
  const allBaseQuestions = localList.length >= cloudList.length ? localList : cloudList;

  let localFilledCount = 0;
  let cloudFilledCount = 0;

  const merged = allBaseQuestions.map((baseQ, idx) => {
    const key = baseQ?.id || `q_${baseQ?.num || idx}`;
    const localQ = localMap.get(key) || localList[idx];
    const cloudQ = cloudMap.get(key) || cloudList[idx];

    const localAns = (localQ?.userAnswer || '').trim();
    const cloudAns = (cloudQ?.userAnswer || '').trim();

    if (localAns) localFilledCount++;
    if (cloudAns) cloudFilledCount++;

    // 1. 若本地有答案，云端无答案 -> 绝对保留本地答案
    if (localAns && !cloudAns) {
      return {
        ...baseQ,
        ...(localQ || {}),
        userAnswer: localAns,
        status: 'answered'
      };
    }

    // 2. 若云端有答案，本地无答案 -> 采纳云端答案
    if (!localAns && cloudAns) {
      return {
        ...baseQ,
        ...(cloudQ || {}),
        userAnswer: cloudAns,
        status: 'answered'
      };
    }

    // 3. 若双方都有答案 -> 比较时间戳
    if (localAns && cloudAns) {
      if (cloudUpdatedAt > localUpdatedAt) {
        return {
          ...baseQ,
          ...(cloudQ || {}),
          userAnswer: cloudAns,
          status: 'answered'
        };
      }
      return {
        ...baseQ,
        ...(localQ || {}),
        userAnswer: localAns,
        status: 'answered'
      };
    }

    // 4. 双方都无答案 -> 继承基础题型信息
    return {
      ...baseQ,
      userAnswer: '',
      aiTranscription: localQ?.aiTranscription || cloudQ?.aiTranscription || '',
      stepScores: localQ?.stepScores || cloudQ?.stepScores || [],
      status: 'unanswered'
    };
  });

  return {
    merged,
    localFilledCount,
    cloudFilledCount,
    shouldPushToCloud: localFilledCount > cloudFilledCount || (localFilledCount > 0 && cloudFilledCount === 0)
  };
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

          // 题级智能合并：绝不允许云端空答案覆盖本地有效答案
          const { merged, shouldPushToCloud } = mergeAnswersSmartly(
            initialSession.answers,
            cloudSession.answers || [],
            localTime,
            cloudTime
          );

          const refreshedSession = {
            ...initialSession,
            ...cloudSession,
            answers: merged,
            markedQuestionKeys: Array.isArray(cloudSession.markedQuestionKeys) && cloudSession.markedQuestionKeys.length > 0
              ? Array.from(new Set([...initialSession.markedQuestionKeys, ...cloudSession.markedQuestionKeys]))
              : initialSession.markedQuestionKeys,
            secondsLeft: typeof cloudSession.secondsLeft === 'number'
              ? Math.min(initialSession.secondsLeft, cloudSession.secondsLeft)
              : initialSession.secondsLeft,
            currentQIndex: typeof cloudSession.currentQIndex === 'number'
              ? cloudSession.currentQIndex
              : initialSession.currentQIndex,
            status: cloudSession.status || initialSession.status,
            sealedAt: cloudSession.sealedAt || initialSession.sealedAt,
            updatedAt: Math.max(cloudTime, localTime, Date.now())
          };

          // 刷新本地持久化
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

          // 如果本地作答更全（例如在手机新答的题目），立即自动反向同步到云端
          if (shouldPushToCloud) {
            get().scheduleCloudSync(paperId, refreshedSession, 200);
          }

          return refreshedSession;
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
   * 具备自愈能力：若 current 不存在，从本地存储自动水合构建，绝不静默退出！
   */
  updateAnswer: (paperId, value, questionIndex) => {
    if (!paperId) return;
    let current = get().sessions[paperId];

    // 自愈保护：若当前内存中尚未完成 initPaperSession，从本地缓存立即回构
    if (!current) {
      const localAnswers = readLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, []);
      const localMarks = readLocalStorage(`${STORAGE_PREFIX_MARKS}${paperId}`, []);
      const localMeta = readLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {});
      current = {
        paperId,
        answers: Array.isArray(localAnswers) ? localAnswers : [],
        markedQuestionKeys: Array.isArray(localMarks) ? localMarks : [],
        secondsLeft: typeof localMeta.secondsLeft === 'number' ? localMeta.secondsLeft : 5400,
        currentQIndex: typeof localMeta.currentQIndex === 'number' ? localMeta.currentQIndex : questionIndex,
        status: localMeta.status || '考试中',
        sealedAt: localMeta.sealedAt || '',
        updatedAt: Date.now()
      };
    }

    const nextAnswers = (current.answers || []).map((q, idx) =>
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

    // 2. Local storage immediate write
    writeLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, nextAnswers);
    writeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {
      secondsLeft: updatedSession.secondsLeft,
      currentQIndex: updatedSession.currentQIndex,
      status: updatedSession.status,
      sealedAt: updatedSession.sealedAt,
      updatedAt: now
    });

    // 3. Debounced cloud push (针对选择题更灵敏：300ms)
    get().scheduleCloudSync(paperId, updatedSession, 300);
  },

  /**
   * Toggle question review bookmark
   */
  toggleQuestionMark: (paperId, markKey) => {
    if (!paperId || !markKey) return;
    let current = get().sessions[paperId];
    if (!current) {
      const localAnswers = readLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, []);
      const localMarks = readLocalStorage(`${STORAGE_PREFIX_MARKS}${paperId}`, []);
      const localMeta = readLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {});
      current = {
        paperId,
        answers: Array.isArray(localAnswers) ? localAnswers : [],
        markedQuestionKeys: Array.isArray(localMarks) ? localMarks : [],
        secondsLeft: typeof localMeta.secondsLeft === 'number' ? localMeta.secondsLeft : 5400,
        currentQIndex: typeof localMeta.currentQIndex === 'number' ? localMeta.currentQIndex : 0,
        status: localMeta.status || '考试中',
        sealedAt: localMeta.sealedAt || '',
        updatedAt: Date.now()
      };
    }

    const exists = (current.markedQuestionKeys || []).includes(markKey);
    const nextMarks = exists
      ? current.markedQuestionKeys.filter((k) => k !== markKey)
      : [...(current.markedQuestionKeys || []), markKey];

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
    get().scheduleCloudSync(paperId, updatedSession, 300);
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
      isReset: true,
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

// 全局移动端/PC端页面关闭、卸载、切后台时的高优先级保活数据推送 (Unload & Pagehide Keepalive)
if (typeof window !== 'undefined') {
  const executeEmergencyKeepaliveSync = () => {
    const token = getToken();
    if (!token) return;

    // 1. 遍历待发送的防抖队列
    pendingSyncPayloads.forEach((payload) => {
      if (payload && payload.paperId) {
        try {
          fetch('/api/user/exam-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ session: payload }),
            keepalive: true
          }).catch(() => {});
        } catch {}
      }
    });

    // 2. 清空待发队列
    pendingSyncTimers.forEach((timer) => clearTimeout(timer));
    pendingSyncTimers.clear();
    pendingSyncPayloads.clear();
  };

  window.addEventListener('pagehide', executeEmergencyKeepaliveSync);
  window.addEventListener('beforeunload', executeEmergencyKeepaliveSync);
}
