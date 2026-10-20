import { create } from 'zustand';
import { apiSaveNotebook, getToken } from '../utils/auth';

const STORAGE_KEY_NOTEBOOK = 'examcraft_notebook_data';

function readLocalNotebook() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTEBOOK);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  } catch {}
  return { items: [] };
}

export const useNotebookStore = create((set, get) => ({
  notebook: readLocalNotebook(),
  isLoading: false,

  setNotebook: (notebookData) => {
    const safeData = notebookData && Array.isArray(notebookData.items) ? notebookData : { items: [] };
    set({ notebook: safeData });
    try {
      localStorage.setItem(STORAGE_KEY_NOTEBOOK, JSON.stringify(safeData));
    } catch {}
  },

  saveNotebook: async (notebookData, isCloudUser = false) => {
    const safeData = notebookData && Array.isArray(notebookData.items) ? notebookData : { items: [] };
    set({ notebook: safeData });
    try {
      localStorage.setItem(STORAGE_KEY_NOTEBOOK, JSON.stringify(safeData));
    } catch {}

    if (isCloudUser || getToken()) {
      try {
        await apiSaveNotebook(safeData);
      } catch (err) {
        console.warn('[useNotebookStore] Cloud save notebook error:', err.message);
      }
    }
  },

  addMistakeItem: async (item, isCloudUser = false) => {
    if (!item || !item.id) return;
    const current = get().notebook;
    const items = Array.isArray(current.items) ? current.items : [];
    const existsIndex = items.findIndex((i) => i.id === item.id);
    let nextItems;
    if (existsIndex >= 0) {
      nextItems = [...items];
      nextItems[existsIndex] = item;
    } else {
      nextItems = [item, ...items];
    }
    const nextNotebook = { ...current, items: nextItems };
    await get().saveNotebook(nextNotebook, isCloudUser);
  },

  removeMistakeItem: async (itemId, isCloudUser = false) => {
    if (!itemId) return;
    const current = get().notebook;
    const items = Array.isArray(current.items) ? current.items : [];
    const nextItems = items.filter((i) => i.id !== itemId);
    const nextNotebook = { ...current, items: nextItems };
    await get().saveNotebook(nextNotebook, isCloudUser);
  },

  updateMasteryLevel: async (itemId, masteryLevel, isCloudUser = false) => {
    if (!itemId) return;
    const current = get().notebook;
    const items = Array.isArray(current.items) ? current.items : [];
    const nextItems = items.map((i) => (i.id === itemId ? { ...i, masteryLevel } : i));
    const nextNotebook = { ...current, items: nextItems };
    await get().saveNotebook(nextNotebook, isCloudUser);
  }
}));
