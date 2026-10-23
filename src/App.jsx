import React, { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import ExamGeneratorView from './views/ExamGeneratorView';
import PaperLibraryView from './views/PaperLibraryView';
import ExamRoomView from './views/ExamRoomView';
import ExamResultReportView from './views/ExamResultReportView';
import MistakeNotebookView from './views/MistakeNotebookView';
import SettingsView from './views/SettingsView';
import AuthView from './views/AuthView';
import UserProfileModal from './components/UserProfileModal';
import {
  getToken,
  clearToken,
  getStoredUser,
  apiGetCurrentUser,
  apiSyncUserData,
  apiSavePaper,
  apiDeletePaper,
  apiSaveSubmission,
  apiSaveNotebook,
  apiSaveSubjects,
  apiMigrateLocalData,
  apiSaveExamSession
} from './utils/auth';
import { deduplicateQuestions } from './utils/questionTypes';
import { inferPaperSubject } from './utils/paperSubject';
import { mergeAnswersSmartly } from './stores/useExamSessionStore';

const APP_PATHS = new Set(['dashboard', 'exam-generator', 'paper-library', 'question-bank', 'settings', 'exam-room', 'exam-result', 'login']);

function getPathFromLocation() {
  const hashPath = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  if (APP_PATHS.has(hashPath)) return hashPath;
  if (!getStoredUser() && localStorage.getItem('examcraft_guest_mode') !== 'true') {
    return 'login';
  }
  return 'exam-generator';
}

function readStoredObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function syncCloudExamSessions(examSessions, papersList = []) {
  if (!examSessions || typeof examSessions !== 'object') return;
  let papers = papersList;
  if (!Array.isArray(papers) || papers.length === 0) {
    try {
      const raw = localStorage.getItem('examcraft_papers');
      if (raw) papers = JSON.parse(raw);
    } catch {}
  }
  const paperMap = new Map();
  if (Array.isArray(papers)) {
    papers.forEach((p) => { if (p?.id) paperMap.set(String(p.id), p); });
  }

  Object.entries(examSessions).forEach(([paperId, session]) => {
    if (!session || !Array.isArray(session.answers)) return;
    try {
      const localAnswersRaw = localStorage.getItem(`examcraft_answers_${paperId}`);
      const localAnswers = localAnswersRaw ? JSON.parse(localAnswersRaw) : [];
      const localSessionRaw = localStorage.getItem(`examcraft_session_${paperId}`);
      const localSession = localSessionRaw ? JSON.parse(localSessionRaw) : {};
      const localTime = Number(localSession?.updatedAt) || 0;
      const cloudTime = Number(session.updatedAt) || 0;

      const matchedPaper = paperMap.get(String(paperId));
      const baseQuestions = Array.isArray(matchedPaper?.questions) && matchedPaper.questions.length > 0
        ? matchedPaper.questions
        : [];

      // 题级智能无损合并：以试卷原题为骨架对齐，绝不允许题干或选项丢失
      const { merged, shouldPushToCloud } = mergeAnswersSmartly(
        baseQuestions,
        localAnswers,
        session.answers,
        localTime,
        cloudTime
      );

      // 合并标记题号
      const localMarksRaw = localStorage.getItem(`examcraft_question_marks_${paperId}`);
      const localMarks = localMarksRaw ? JSON.parse(localMarksRaw) : [];
      const mergedMarks = Array.isArray(session.markedQuestionKeys) && session.markedQuestionKeys.length > 0
        ? Array.from(new Set([...(Array.isArray(localMarks) ? localMarks : []), ...session.markedQuestionKeys]))
        : (Array.isArray(localMarks) ? localMarks : []);

      // 单向封卷权威法则（Irreversible Seal Priority）：
      const isSealed = session.status === '已封卷' || localSession.status === '已封卷';
      const finalStatus = isSealed ? '已封卷' : (session.status || localSession.status || '考试中');
      const finalSealedAt = isSealed ? (session.sealedAt || localSession.sealedAt || new Date().toISOString()) : '';

      localStorage.setItem(`examcraft_answers_${paperId}`, JSON.stringify(merged));
      localStorage.setItem(`examcraft_question_marks_${paperId}`, JSON.stringify(mergedMarks));
      localStorage.setItem(`examcraft_session_${paperId}`, JSON.stringify({
        secondsLeft: typeof session.secondsLeft === 'number'
          ? (typeof localSession.secondsLeft === 'number' ? Math.min(localSession.secondsLeft, session.secondsLeft) : session.secondsLeft)
          : localSession.secondsLeft,
        currentQIndex: typeof session.currentQIndex === 'number' ? session.currentQIndex : (localSession.currentQIndex || 0),
        status: finalStatus,
        sealedAt: finalSealedAt,
        updatedAt: Math.max(cloudTime, localTime, Date.now())
      }));

      // 若处于封卷状态，联动更新本地 examcraft_papers 列表，确保大厅卡片与考场即时闭环
      if (isSealed) {
        try {
          const rawPapers = localStorage.getItem('examcraft_papers');
          if (rawPapers) {
            const list = JSON.parse(rawPapers);
            let changed = false;
            const updatedList = list.map((p) => {
              if (p.id === paperId && p.status !== '已封卷') {
                changed = true;
                return { ...p, status: '已封卷', sealedAt: finalSealedAt, secondsLeft: session.secondsLeft ?? p.secondsLeft };
              }
              return p;
            });
            if (changed) localStorage.setItem('examcraft_papers', JSON.stringify(updatedList));
          }
        } catch {}
      }

      // 如果本地作答更完整（例如电脑端刷新时拉取，发现本地答题卡更全），立即异步回推云端补全
      if (shouldPushToCloud && getToken()) {
        apiSaveExamSession({
          paperId,
          answers: merged,
          markedQuestionKeys: mergedMarks,
          secondsLeft: session.secondsLeft ?? localSession.secondsLeft,
          currentQIndex: session.currentQIndex ?? localSession.currentQIndex,
          status: finalStatus,
          sealedAt: finalSealedAt
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Sync exam session failed for paper:', paperId, e);
    }
  });
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
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [isGuestMode, setIsGuestMode] = useState(() => localStorage.getItem('examcraft_guest_mode') === 'true');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    const handleProfileUpdated = () => {
      setCurrentUser(getStoredUser());
    };
    window.addEventListener('examcraft-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('examcraft-profile-updated', handleProfileUpdated);
  }, []);

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

  // Initialize session and sync cloud data on load
  useEffect(() => {
    let isMounted = true;
    const initSession = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const user = await apiGetCurrentUser();
        if (!isMounted) return;
        if (user) {
          setCurrentUser(user);
          const cloudData = await apiSyncUserData();
          if (!isMounted) return;
          if (cloudData && Array.isArray(cloudData.papers)) {
            const cleanPapers = cloudData.papers.map((p) => {
              const clean = Array.isArray(p.questions) ? deduplicateQuestions(p.questions, p.title) : [];
              return {
                ...p,
                subject: p.subject || inferPaperSubject(p),
                questions: clean,
                questionCount: clean.length
              };
            });
            setPapers(cleanPapers);
            localStorage.setItem('examcraft_papers', JSON.stringify(cleanPapers));
            if (Array.isArray(cloudData.submissions)) {
              localStorage.setItem('examcraft_submissions', JSON.stringify(cloudData.submissions));
            }
            if (cloudData.notebook) {
              localStorage.setItem('examcraft_notebook_data', JSON.stringify(cloudData.notebook));
            }
            if (Array.isArray(cloudData.subjects)) {
              localStorage.setItem('examcraft_custom_subjects', JSON.stringify(cloudData.subjects));
            }
            if (cloudData.examSessions) {
              syncCloudExamSessions(cloudData.examSessions, cleanPapers);
              if (activePaper?.id && cloudData.examSessions[activePaper.id]) {
                const activeSession = cloudData.examSessions[activePaper.id];
                if (activeSession.status === '已封卷') {
                  setActivePaper((prev) => (prev ? { ...prev, status: '已封卷', sealedAt: activeSession.sealedAt || prev.sealedAt } : null));
                }
              }
            }

            // Check if there are local unmigrated papers from guest sessions
            const serverPaperIds = new Set(cleanPapers.map((p) => p.id));
            const rawBackup = localStorage.getItem('examcraft_local_backup_papers');
            if (rawBackup) {
              const localBackup = JSON.parse(rawBackup);
              const unmigrated = (Array.isArray(localBackup) ? localBackup : []).filter((p) => !serverPaperIds.has(p.id));
              if (unmigrated.length > 0) {
                setMigrationNotice({ count: unmigrated.length });
              }
            }
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('[App] Session init warning:', err);
      }
    };

    initSession();

    // Listen for external updates (e.g. from notebook view or subject classification)
    const onNotebookUpdated = (e) => {
      if (currentUser && e.detail) {
        apiSaveNotebook(e.detail).catch(() => {});
      }
    };
    const onSubjectsUpdated = (e) => {
      if (currentUser && e.detail) {
        apiSaveSubjects(e.detail).catch(() => {});
      }
    };
    window.addEventListener('examcraft-notebook-updated', onNotebookUpdated);
    window.addEventListener('examcraft-subjects-updated', onSubjectsUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('examcraft-notebook-updated', onNotebookUpdated);
      window.removeEventListener('examcraft-subjects-updated', onSubjectsUpdated);
    };
  }, [currentUser?.id]);

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

  const handleAuthSuccess = async (user) => {
    setCurrentUser(user);
    setIsGuestMode(false);
    localStorage.removeItem('examcraft_guest_mode');
    setCurrentPath('dashboard');

    try {
      const cloudData = await apiSyncUserData();
      const cleanPapers = (Array.isArray(cloudData.papers) ? cloudData.papers : []).map((p) => {
        const clean = Array.isArray(p.questions) ? deduplicateQuestions(p.questions, p.title) : [];
        return {
          ...p,
          subject: p.subject || inferPaperSubject(p),
          questions: clean,
          questionCount: clean.length
        };
      });
      setPapers(cleanPapers);
      localStorage.setItem('examcraft_papers', JSON.stringify(cleanPapers));
      if (Array.isArray(cloudData.submissions)) {
        localStorage.setItem('examcraft_submissions', JSON.stringify(cloudData.submissions));
      }
      if (cloudData.notebook) {
        localStorage.setItem('examcraft_notebook_data', JSON.stringify(cloudData.notebook));
      }
      if (Array.isArray(cloudData.subjects)) {
        localStorage.setItem('examcraft_custom_subjects', JSON.stringify(cloudData.subjects));
      }
      if (cloudData.examSessions) {
        syncCloudExamSessions(cloudData.examSessions, cleanPapers);
      }

      // Check for local backup papers to offer migration
      const serverPaperIds = new Set(cleanPapers.map((p) => p.id));
      const rawBackup = localStorage.getItem('examcraft_local_backup_papers') || localStorage.getItem('examcraft_papers');
      if (rawBackup) {
        const localBackup = JSON.parse(rawBackup);
        const unmigrated = (Array.isArray(localBackup) ? localBackup : []).filter((p) => !serverPaperIds.has(p.id));
        if (unmigrated.length > 0) {
          setMigrationNotice({ count: unmigrated.length });
        }
      }
    } catch (err) {
      console.warn('Sync after auth failed:', err);
    }
  };

  const handleGuestMode = () => {
    setIsGuestMode(true);
    localStorage.setItem('examcraft_guest_mode', 'true');
    setCurrentPath('dashboard');
  };

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setIsGuestMode(false);
    localStorage.removeItem('examcraft_guest_mode');
    setCurrentPath('login');
  };

  const handleMigrateLocal = async () => {
    if (!currentUser) return;
    setIsMigrating(true);
    try {
      const localPapers = JSON.parse(localStorage.getItem('examcraft_papers') || '[]');
      const localSubs = JSON.parse(localStorage.getItem('examcraft_submissions') || '[]');
      const localNotebook = JSON.parse(localStorage.getItem('examcraft_notebook_data') || '{"items":[]}');
      const localSubjects = JSON.parse(localStorage.getItem('examcraft_custom_subjects') || '[]');

      await apiMigrateLocalData({
        papers: localPapers,
        submissions: localSubs,
        notebook: localNotebook,
        subjects: localSubjects
      });

      localStorage.removeItem('examcraft_local_backup_papers');
      setMigrationNotice(null);

      const refreshed = await apiSyncUserData();
      if (refreshed && Array.isArray(refreshed.papers)) {
        const clean = refreshed.papers.map((p) => ({
          ...p,
          subject: p.subject || inferPaperSubject(p),
          questions: deduplicateQuestions(p.questions || [], p.title),
          questionCount: (p.questions || []).length
        }));
        setPapers(clean);
        localStorage.setItem('examcraft_papers', JSON.stringify(clean));
      }
    } catch (err) {
      alert(`数据迁移失败: ${err.message || '请重试'}`);
    } finally {
      setIsMigrating(false);
    }
  };

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
        if (!currentUser) {
          localStorage.setItem('examcraft_local_backup_papers', JSON.stringify(next));
        }
      } catch {}
      return next;
    });

    if (currentUser) {
      apiSavePaper(normalizedPaper).catch((err) => console.warn('Cloud save error:', err));
    }

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

    if (currentUser) {
      apiDeletePaper(paper.id).catch((err) => console.warn('Cloud delete error:', err));
    }

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
    if (currentUser && submission) {
      apiSaveSubmission(submission).catch((err) => console.warn('Cloud submission sync failed:', err));
    }
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

  const isFullScreenMode = currentPath === 'exam-room' || currentPath === 'exam-result' || currentPath === 'login';

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans selection:bg-primary-fixed selection:text-primary">
      {/* Top Header - hidden during full focus exam room, result review, or login page */}
      {!isFullScreenMode && (
        <Header
          currentPath={currentPath}
          setCurrentPath={setCurrentPath}
          onOpenExam={() => handleStartExam(papers[0])}
          currentUser={currentUser}
          onOpenAuth={() => setCurrentPath('login')}
          onLogout={handleLogout}
          onTriggerMigrate={handleMigrateLocal}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />
      )}

      {/* 个人中心与头像选择档案模态框 */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updated) => {
          if (updated) setCurrentUser(updated);
          else setCurrentUser(getStoredUser());
        }}
      />

      {/* Cloud Migration Notification Banner */}
      {!isFullScreenMode && migrationNotice && (
        <div className="bg-primary-container/20 border-b border-primary/20 px-4 py-2.5 text-xs flex items-center justify-between text-on-surface mt-14 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">cloud_upload</span>
            <span>
              检测到本地浏览器有 <strong>{migrationNotice.count}</strong> 套离线试卷尚未同步到云端账号。
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isMigrating}
              onClick={handleMigrateLocal}
              className="px-3 py-1 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-hover transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-xs"
            >
              {isMigrating && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
              <span>{isMigrating ? '正在同步...' : '立即同步到云端'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMigrationNotice(null)}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors cursor-pointer"
              title="稍后提醒"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className={`flex-1 flex flex-col ${!isFullScreenMode ? (migrationNotice ? 'pb-16 md:pb-0' : 'pt-14 pb-16 md:pb-0') : ''}`}>
        {currentPath === 'login' && (
          <AuthView
            onSuccess={handleAuthSuccess}
            onGuest={handleGuestMode}
            onBack={() => setCurrentPath('dashboard')}
            allowBack={Boolean(currentUser || isGuestMode)}
          />
        )}

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
    </MotionConfig>
  );
}

