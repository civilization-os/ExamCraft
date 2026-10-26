import { create } from 'zustand';
import { apiSavePaper, apiDeletePaper, getToken } from '../utils/auth';
import { deduplicateQuestions } from '../utils/questionTypes';
import { inferPaperSubject } from '../utils/paperSubject';
import { DEFAULT_TEST_MATH_PAPER, DEFAULT_MOCK_PAPERS } from '../data/mockPapers';

const STORAGE_KEY_PAPERS = 'examcraft_papers';
const STORAGE_KEY_ACTIVE_PAPER = 'examcraft_active_paper';
const STORAGE_KEY_BACKUP_PAPERS = 'examcraft_local_backup_papers';

function readLocalPapers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAPERS);
    if (!raw) return DEFAULT_MOCK_PAPERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const hasMathMock = parsed.some((p) => p.id === DEFAULT_TEST_MATH_PAPER.id);
      const fullList = hasMathMock ? parsed : [DEFAULT_TEST_MATH_PAPER, ...parsed];
      return fullList.map((p) => {
        const clean = Array.isArray(p.questions) ? deduplicateQuestions(p.questions, p.title) : [];
        return {
          ...p,
          subject: p.subject || inferPaperSubject(p),
          questions: clean,
          questionCount: clean.length
        };
      });
    }
  } catch {}
  return DEFAULT_MOCK_PAPERS;
}

function readLocalActivePaper() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_PAPER);
    if (!raw) return DEFAULT_TEST_MATH_PAPER;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const clean = Array.isArray(parsed.questions) ? deduplicateQuestions(parsed.questions, parsed.title) : [];
      return {
        ...parsed,
        subject: parsed.subject || inferPaperSubject(parsed),
        questions: clean,
        questionCount: clean.length
      };
    }
  } catch {}
  return DEFAULT_TEST_MATH_PAPER;
}

export const usePaperStore = create((set, get) => ({
  papers: readLocalPapers(),
  activePaper: readLocalActivePaper(),
  isLoading: false,

  setPapers: (papers) => {
    const cleanList = (Array.isArray(papers) ? papers : []).map((p) => {
      const clean = Array.isArray(p.questions) ? deduplicateQuestions(p.questions, p.title) : [];
      return {
        ...p,
        subject: p.subject || inferPaperSubject(p),
        questions: clean,
        questionCount: clean.length
      };
    });
    set({ papers: cleanList });
    try {
      localStorage.setItem(STORAGE_KEY_PAPERS, JSON.stringify(cleanList));
    } catch {}
  },

  setActivePaper: (paper) => {
    if (!paper) {
      set({ activePaper: null });
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_PAPER);
      } catch {}
      return;
    }
    const clean = Array.isArray(paper.questions) ? deduplicateQuestions(paper.questions, paper.title) : [];
    const normalized = {
      ...paper,
      subject: paper.subject || inferPaperSubject(paper),
      questions: clean,
      questionCount: clean.length
    };
    set({ activePaper: normalized });
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PAPER, JSON.stringify(normalized));
    } catch {}
  },

  savePaper: async (paper, isCloudUser = false) => {
    if (!paper || !paper.id) return;
    const cleanQuestions = Array.isArray(paper.questions)
      ? deduplicateQuestions(paper.questions, paper.title)
      : [];
    const normalized = {
      ...paper,
      subject: paper.subject || inferPaperSubject(paper),
      questions: cleanQuestions,
      questionCount: cleanQuestions.length,
      updatedAt: Date.now()
    };

    set((state) => {
      const existsIndex = state.papers.findIndex((p) => p.id === normalized.id);
      let next;
      if (existsIndex >= 0) {
        next = [...state.papers];
        next[existsIndex] = normalized;
      } else {
        next = [normalized, ...state.papers];
      }
      try {
        localStorage.setItem(STORAGE_KEY_PAPERS, JSON.stringify(next));
        if (!isCloudUser) {
          localStorage.setItem(STORAGE_KEY_BACKUP_PAPERS, JSON.stringify(next));
        }
      } catch {}

      const nextActive = state.activePaper?.id === normalized.id ? normalized : state.activePaper;
      if (nextActive) {
        try {
          localStorage.setItem(STORAGE_KEY_ACTIVE_PAPER, JSON.stringify(nextActive));
        } catch {}
      }

      return {
        papers: next,
        activePaper: nextActive
      };
    });

    if (isCloudUser || getToken()) {
      try {
        await apiSavePaper(normalized);
      } catch (err) {
        console.warn('[usePaperStore] Cloud paper save error:', err.message);
      }
    }
  },

  deletePaper: async (paperId, isCloudUser = false) => {
    if (!paperId) return;
    set((state) => {
      const nextPapers = state.papers.filter((p) => p.id !== paperId);
      const nextActive = state.activePaper?.id === paperId ? null : state.activePaper;

      try {
        localStorage.setItem(STORAGE_KEY_PAPERS, JSON.stringify(nextPapers));
        if (state.activePaper?.id === paperId) {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_PAPER);
        }
        localStorage.removeItem(`examcraft_answers_${paperId}`);
        localStorage.removeItem(`examcraft_question_marks_${paperId}`);
        localStorage.removeItem(`examcraft_session_${paperId}`);
      } catch {}

      return {
        papers: nextPapers,
        activePaper: nextActive
      };
    });

    if (isCloudUser || getToken()) {
      try {
        await apiDeletePaper(paperId);
      } catch (err) {
        console.warn('[usePaperStore] Cloud paper delete error:', err.message);
      }
    }
  }
}));
