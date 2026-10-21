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
// Timer ticks must never keep resetting the answer-edit debounce. This records
// the last timer checkpoint sent for each paper instead.
const lastProgressSyncAt = new Map();

function sendKeepaliveSession(session) {
  const token = getToken();
  if (!token || !session?.paperId) return;

  try {
    fetch('/api/user/exam-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ session }),
      keepalive: true
    }).catch(() => {});
  } catch {}
}

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
 * 权威水合函数：以试卷原题（baseQuestions）为绝对骨架，将用户答题记录（savedAnswers）精准注入
 * 铁律：题干 (prompt)、选项 (options)、分值、公式、题型必须永远来自试卷源题，绝不允许因答案记录而丢失题目！
 */
export function hydrateQuestionsWithAnswers(baseQuestions = [], savedAnswers = []) {
  if (!Array.isArray(baseQuestions) || baseQuestions.length === 0) {
    return Array.isArray(savedAnswers) ? savedAnswers : [];
  }

  const answerMap = new Map();
  const isSameLength = Array.isArray(savedAnswers) && savedAnswers.length === baseQuestions.length;

  if (Array.isArray(savedAnswers)) {
    savedAnswers.forEach((ans, idx) => {
      if (!ans) return;
      if (ans.id) {
        answerMap.set(String(ans.id), ans);
      }
      if (ans.num !== undefined && ans.num !== null && String(ans.num).trim() !== '') {
        const rawNum = String(ans.num).trim();
        const numVal = Number.parseInt(rawNum.replace(/\D/g, ''), 10);
        answerMap.set(`num_${rawNum}`, ans);
        if (Number.isFinite(numVal) && numVal > 0) {
          answerMap.set(`num_${numVal}`, ans);
          answerMap.set(`num_${String(numVal).padStart(2, '0')}`, ans);
        }
      }
      if (isSameLength) {
        answerMap.set(`idx_${idx}`, ans);
      }
    });
  }

  return baseQuestions.map((q, idx) => {
    let saved = null;
    if (q.id && answerMap.has(String(q.id))) {
      saved = answerMap.get(String(q.id));
    }
    if (!saved && q.num !== undefined && q.num !== null && String(q.num).trim() !== '') {
      const rawNum = String(q.num).trim();
      const numVal = Number.parseInt(rawNum.replace(/\D/g, ''), 10);
      saved = answerMap.get(`num_${rawNum}`)
        || (Number.isFinite(numVal) ? (answerMap.get(`num_${numVal}`) || answerMap.get(`num_${String(numVal).padStart(2, '0')}`)) : null);
    }
    if (!saved && isSameLength) {
      saved = answerMap.get(`idx_${idx}`);
    }

    const userAnswer = typeof saved?.userAnswer === 'string'
      ? saved.userAnswer
      : (typeof q.userAnswer === 'string' ? q.userAnswer : '');

    return {
      ...q,
      userAnswer,
      aiTranscription: saved?.aiTranscription || q.aiTranscription || '',
      stepScores: (Array.isArray(saved?.stepScores) && saved.stepScores.length > 0)
        ? saved.stepScores
        : (Array.isArray(q.stepScores) ? q.stepScores : []),
      status: userAnswer.trim().length > 0 ? 'answered' : 'unanswered',
      updatedAt: saved?.updatedAt || q.updatedAt || 0
    };
  });
}

/**
 * 题级智能无损合并 (Smart Question-Level Merge)
 * 核心法则：
 * 1. 以完整的试卷题目 (baseQuestions) 为权威基准，一道题都不能少；
 * 2. 细粒度题级时间戳对比：无论是作答、改选还是清空作答，以后发生的最新操作为准；
 * 3. 初始模板空白不会覆盖已有作答，但用户主动删除/清空的作答会完整双端同步；
 * 4. 统计两端最新修改状态，若本地存在更新的变更（包括删除），自动反向推向云端。
 */
export function mergeAnswersSmartly(baseQuestions = [], localAnswers = [], cloudAnswers = [], localUpdatedAt = 0, cloudUpdatedAt = 0) {
  let actualBase = baseQuestions;
  let actualLocal = localAnswers;
  let actualCloud = cloudAnswers;
  let actualLocalTime = localUpdatedAt;
  let actualCloudTime = cloudUpdatedAt;

  if (arguments.length === 4 && typeof localUpdatedAt === 'number') {
    // 兼容历史调用: mergeAnswersSmartly(localQuestions, cloudQuestions, localTime, cloudTime)
    actualLocal = baseQuestions;
    actualCloud = localAnswers;
    actualLocalTime = cloudAnswers;
    actualCloudTime = localUpdatedAt;
    actualBase = (Array.isArray(actualLocal) && actualLocal.length >= (actualCloud?.length || 0))
      ? actualLocal
      : (actualCloud || []);
  }

  const baseList = Array.isArray(actualBase) ? actualBase : [];
  const localList = Array.isArray(actualLocal) ? actualLocal : [];
  const cloudList = Array.isArray(actualCloud) ? actualCloud : [];

  // 若 baseList 为空，使用较长的一方作为兜底骨架
  const authoritativeList = baseList.length > 0
    ? baseList
    : (localList.length >= cloudList.length ? localList : cloudList);

  const buildLookup = (list) => {
    const map = new Map();
    list.forEach((ans, idx) => {
      if (!ans) return;
      if (ans.id) map.set(String(ans.id), ans);
      if (ans.num !== undefined && ans.num !== null && String(ans.num).trim() !== '') {
        const rawNum = String(ans.num).trim();
        const numVal = Number.parseInt(rawNum.replace(/\D/g, ''), 10);
        map.set(`num_${rawNum}`, ans);
        if (Number.isFinite(numVal) && numVal > 0) {
          map.set(`num_${numVal}`, ans);
          map.set(`num_${String(numVal).padStart(2, '0')}`, ans);
        }
      }
      if (list.length === authoritativeList.length) {
        map.set(`idx_${idx}`, ans);
      }
    });
    return map;
  };

  const localMap = buildLookup(localList);
  const cloudMap = buildLookup(cloudList);

  let localFilledCount = 0;
  let cloudFilledCount = 0;
  let hasLocalNewerEdits = false;

  const findMatch = (baseQ, idx, map, list) => {
    if (baseQ.id && map.has(String(baseQ.id))) return map.get(String(baseQ.id));
    if (baseQ.num !== undefined && baseQ.num !== null && String(baseQ.num).trim() !== '') {
      const rawNum = String(baseQ.num).trim();
      const numVal = Number.parseInt(rawNum.replace(/\D/g, ''), 10);
      const match = map.get(`num_${rawNum}`)
        || (Number.isFinite(numVal) ? (map.get(`num_${numVal}`) || map.get(`num_${String(numVal).padStart(2, '0')}`)) : null);
      if (match) return match;
    }
    if (list.length === authoritativeList.length) {
      return map.get(`idx_${idx}`) || list[idx] || null;
    }
    return null;
  };

  const merged = authoritativeList.map((baseQ, idx) => {
    const localQ = findMatch(baseQ, idx, localMap, localList);
    const cloudQ = findMatch(baseQ, idx, cloudMap, cloudList);

    const localAns = (localQ?.userAnswer || '').trim();
    const cloudAns = (cloudQ?.userAnswer || '').trim();

    if (localAns) localFilledCount++;
    if (cloudAns) cloudFilledCount++;

    // 细粒度题级时间戳：优先题目独立记录的修改时间，其次回退到会话级别时间戳
    const localQTime = Number(localQ?.updatedAt || (localAns ? actualLocalTime : 0)) || 0;
    const cloudQTime = Number(cloudQ?.updatedAt || (cloudAns ? actualCloudTime : 0)) || 0;

    // 1. 若云端修改时间明确更晚（手机端填涂了新答案，或手机端清空/删除了答案）-> 云端胜出
    if (cloudQTime > localQTime) {
      return {
        ...baseQ,
        userAnswer: cloudAns,
        aiTranscription: cloudAns ? (cloudQ?.aiTranscription || '') : '',
        stepScores: (Array.isArray(cloudQ?.stepScores) && cloudQ.stepScores.length > 0)
          ? cloudQ.stepScores
          : (cloudAns ? (baseQ.stepScores || []) : []),
        status: cloudAns ? 'answered' : 'unanswered',
        updatedAt: cloudQTime
      };
    }

    // 2. 若本地修改时间明确更晚（电脑端填涂了新答案，或电脑端清空/删除了答案）-> 本地胜出
    if (localQTime > cloudQTime) {
      hasLocalNewerEdits = true;
      return {
        ...baseQ,
        userAnswer: localAns,
        aiTranscription: localAns ? (localQ?.aiTranscription || '') : '',
        stepScores: (Array.isArray(localQ?.stepScores) && localQ.stepScores.length > 0)
          ? localQ.stepScores
          : (localAns ? (baseQ.stepScores || []) : []),
        status: localAns ? 'answered' : 'unanswered',
        updatedAt: localQTime
      };
    }

    // 3. 时间戳并列/初始加载场景（例如刚从模板打开考卷，或者两端初始状态）
    if (localAns && !cloudAns) {
      hasLocalNewerEdits = true;
      return {
        ...baseQ,
        userAnswer: localAns,
        aiTranscription: localQ?.aiTranscription || baseQ.aiTranscription || '',
        stepScores: (Array.isArray(localQ?.stepScores) && localQ.stepScores.length > 0)
          ? localQ.stepScores
          : (baseQ.stepScores || []),
        status: 'answered',
        updatedAt: localQTime || actualLocalTime || Date.now()
      };
    }

    if (!localAns && cloudAns) {
      return {
        ...baseQ,
        userAnswer: cloudAns,
        aiTranscription: cloudQ?.aiTranscription || baseQ.aiTranscription || '',
        stepScores: (Array.isArray(cloudQ?.stepScores) && cloudQ.stepScores.length > 0)
          ? cloudQ.stepScores
          : (baseQ.stepScores || []),
        status: 'answered',
        updatedAt: cloudQTime || actualCloudTime || Date.now()
      };
    }

    if (localAns && cloudAns) {
      const winner = actualCloudTime >= actualLocalTime ? cloudQ : localQ;
      const winnerAns = actualCloudTime >= actualLocalTime ? cloudAns : localAns;
      const winnerTime = actualCloudTime >= actualLocalTime ? actualCloudTime : actualLocalTime;
      return {
        ...baseQ,
        userAnswer: winnerAns,
        aiTranscription: winner?.aiTranscription || localQ?.aiTranscription || cloudQ?.aiTranscription || baseQ.aiTranscription || '',
        stepScores: (Array.isArray(winner?.stepScores) && winner.stepScores.length > 0)
          ? winner.stepScores
          : (baseQ.stepScores || []),
        status: 'answered',
        updatedAt: winnerTime
      };
    }

    // 4. 双方都无答案 -> 完整保留试卷骨架题目
    return {
      ...baseQ,
      userAnswer: '',
      aiTranscription: '',
      stepScores: [],
      status: 'unanswered',
      updatedAt: 0
    };
  });

  return {
    merged,
    localFilledCount,
    cloudFilledCount,
    shouldPushToCloud: hasLocalNewerEdits || (actualLocalTime > actualCloudTime && localFilledCount > 0)
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

    // 以试卷题目为绝对骨架，精准水合本地答题卡，绝不丢题
    const mergedQuestions = hydrateQuestionsWithAnswers(baseQuestions, localAnswers);

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

          // 题级智能合并：严格以 baseQuestions 为权威基准进行三方对齐
          const { merged, shouldPushToCloud } = mergeAnswersSmartly(
            baseQuestions,
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

    const now = Date.now();
    const nextAnswers = (current.answers || []).map((q, idx) =>
      idx === questionIndex
        ? {
            ...q,
            userAnswer: value,
            status: value && value.trim().length > 0 ? 'answered' : 'unanswered',
            updatedAt: now
          }
        : q
    );

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

    // Checkpoint the timer at most once per 15 seconds. Scheduling a 15-second
    // debounce on every tick would continuously cancel pending answer edits.
    const lastCheckpoint = lastProgressSyncAt.get(paperId) || 0;
    if (nextSession.updatedAt - lastCheckpoint >= 15000) {
      lastProgressSyncAt.set(paperId, nextSession.updatedAt);
      get().scheduleCloudSync(paperId, nextSession, 0);
    }
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
      statusOperation: 'seal',
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
      statusOperation: 'unseal',
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
        currentQIndex: typeof localMeta.currentQIndex === 'number' ? localMeta.currentQIndex : questionIndex,
        status: localMeta.status || '考试中',
        sealedAt: localMeta.sealedAt || '',
        updatedAt: Date.now()
      };
    }

    const now = Date.now();
    const nextAnswers = current.answers.map((q, idx) =>
      idx === questionIndex
        ? { ...q, userAnswer: '', aiTranscription: '', stepScores: [], status: 'unanswered', updatedAt: now }
        : q
    );

    const nextSession = {
      ...current,
      answers: nextAnswers,
      updatedAt: now
    };

    set((state) => ({
      sessions: {
        ...state.sessions,
        [paperId]: nextSession
      }
    }));

    writeLocalStorage(`${STORAGE_PREFIX_ANSWERS}${paperId}`, nextAnswers);
    writeLocalStorage(`${STORAGE_PREFIX_SESSION}${paperId}`, {
      secondsLeft: nextSession.secondsLeft,
      currentQIndex: nextSession.currentQIndex,
      status: nextSession.status,
      sealedAt: nextSession.sealedAt,
      updatedAt: now
    });
    get().scheduleCloudSync(paperId, nextSession, 300);
  },

  /**
   * Reset entire exam (clear answers, restore full duration, clear marks)
   */
  resetEntireExam: async (paperId, initialDurationSeconds) => {
    if (!paperId) return;
    const current = get().sessions[paperId];
    if (!current) return;

    const resetVersion = Date.now();
    const resetAnswers = current.answers.map((q) => ({
      ...q,
      userAnswer: '',
      aiTranscription: '',
      stepScores: [],
      status: 'unanswered',
      // Tombstones need a timestamp too; otherwise a stale device can restore
      // the answer after this reset.
      updatedAt: resetVersion
    }));


    const resetSession = {
      ...current,
      answers: resetAnswers,
      markedQuestionKeys: [],
      secondsLeft: initialDurationSeconds,
      currentQIndex: 0,
      status: '考试中',
      sealedAt: '',
      // resetVersion is consumed server-side exactly once. Unlike a sticky
      // boolean it cannot disable merge behavior for all later edits.
      resetVersion,
      updatedAt: resetVersion
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
    lastProgressSyncAt.delete(paperId);

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
  },

  // pagehide cannot await normal requests. This intentionally sends the final
  // snapshot with keepalive so a sealed exam is visible on another device.
  emergencyKeepaliveSync: (session) => {
    sendKeepaliveSession(session);
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
        sendKeepaliveSession(payload);
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
