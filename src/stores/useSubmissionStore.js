import { create } from 'zustand';
import { apiSaveSubmission, getToken } from '../utils/auth';

const STORAGE_KEY_SUBMISSIONS = 'examcraft_submissions';
const STORAGE_KEY_ACTIVE_SUBMISSION = 'examcraft_active_submission';

function readLocalSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readLocalActiveSubmission() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_SUBMISSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useSubmissionStore = create((set, get) => ({
  submissions: readLocalSubmissions(),
  activeSubmission: readLocalActiveSubmission(),
  isLoading: false,

  setSubmissions: (subs) => {
    const list = Array.isArray(subs) ? subs : [];
    set({ submissions: list });
    try {
      localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(list));
    } catch {}
  },

  setActiveSubmission: (submission) => {
    set({ activeSubmission: submission || null });
    try {
      if (submission) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_SUBMISSION, JSON.stringify(submission));
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_SUBMISSION);
      }
    } catch {}
  },

  saveSubmission: async (submission, isCloudUser = false) => {
    if (!submission || !submission.id) return;
    set((state) => {
      const existsIndex = state.submissions.findIndex((s) => s.id === submission.id);
      let next;
      if (existsIndex >= 0) {
        next = [...state.submissions];
        next[existsIndex] = submission;
      } else {
        next = [submission, ...state.submissions];
      }
      try {
        localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(next));
      } catch {}
      return {
        submissions: next,
        activeSubmission: submission
      };
    });

    if (isCloudUser || getToken()) {
      try {
        await apiSaveSubmission(submission);
      } catch (err) {
        console.warn('[useSubmissionStore] Cloud save submission error:', err.message);
      }
    }
  }
}));
