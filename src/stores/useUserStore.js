import { create } from 'zustand';
import {
  getToken,
  clearToken,
  getStoredUser,
  apiGetCurrentUser,
  apiLogin,
  apiRegister,
  apiUpdateProfile,
  getGuestProfile,
  setGuestProfile
} from '../utils/auth';

export const useUserStore = create((set, get) => ({
  currentUser: getStoredUser(),
  token: getToken(),
  isGuestMode: localStorage.getItem('examcraft_guest_mode') === 'true',
  isProfileModalOpen: false,
  guestProfile: getGuestProfile(),

  setProfileModalOpen: (isOpen) => set({ isProfileModalOpen: Boolean(isOpen) }),

  initUser: async () => {
    const token = getToken();
    if (!token) return null;
    try {
      const user = await apiGetCurrentUser();
      if (user) {
        set({ currentUser: user, token });
        return user;
      }
    } catch (err) {
      console.warn('[useUserStore] User session restore failed:', err);
    }
    return null;
  },

  login: async (username, password) => {
    const user = await apiLogin(username, password);
    set({
      currentUser: user,
      token: getToken(),
      isGuestMode: false
    });
    localStorage.removeItem('examcraft_guest_mode');
    return user;
  },

  register: async (username, password, roleType = 'teacher', email = '') => {
    const user = await apiRegister(username, password, roleType, email);
    set({
      currentUser: user,
      token: getToken(),
      isGuestMode: false
    });
    localStorage.removeItem('examcraft_guest_mode');
    return user;
  },

  logout: () => {
    clearToken();
    set({
      currentUser: null,
      token: null,
      isGuestMode: false
    });
    localStorage.removeItem('examcraft_guest_mode');
  },

  setGuestMode: (enable = true) => {
    if (enable) {
      localStorage.setItem('examcraft_guest_mode', 'true');
      set({ isGuestMode: true });
    } else {
      localStorage.removeItem('examcraft_guest_mode');
      set({ isGuestMode: false });
    }
  },

  updateProfile: async (profileData) => {
    const { currentUser, isGuestMode } = get();
    if (isGuestMode || !currentUser) {
      const updated = setGuestProfile(profileData);
      set({ guestProfile: updated });
      return updated;
    }
    const updated = await apiUpdateProfile(profileData);
    set({ currentUser: updated });
    return updated;
  }
}));
