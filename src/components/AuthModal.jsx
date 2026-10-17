import React from 'react';
import AuthView from '../views/AuthView';

/**
 * Backward-compatible wrapper for AuthModal.
 * The authentication center is now a first-class full page (AuthView).
 */
export default function AuthModal({ isOpen, onClose, onSuccess, onGuest, allowGuest = true }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface animate-fade-in">
      <AuthView
        onSuccess={onSuccess}
        onGuest={onGuest}
        onBack={onClose}
        allowBack={allowGuest && Boolean(onClose)}
      />
    </div>
  );
}
