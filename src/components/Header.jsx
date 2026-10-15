import React from 'react';

export default function Header({ currentPath, setCurrentPath, onOpenExam }) {
  const navItems = [
    { path: 'dashboard', label: '控制面板', icon: 'dashboard' },
    { path: 'exam-generator', label: '智能组卷', icon: 'auto_fix_high' },
    { path: 'paper-library', label: '试卷库', icon: 'library_books' },
    { path: 'question-bank', label: '我的题集', icon: 'collections_bookmark' },
    { path: 'settings', label: '系统设置', icon: 'settings' }
  ];

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container/60 transition-all">
      <div className="h-14 w-full px-4 sm:px-margin-desktop flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-space-2xl">
          <button
            onClick={() => setCurrentPath('dashboard')}
            className="flex items-center gap-space-sm group text-left cursor-pointer focus:outline-none"
          >
            <div className="w-7 h-7 rounded bg-primary-container flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-on-primary text-[18px]">neurology</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-semibold">
              ExamCraft <span className="text-primary-container">AI</span>
            </span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-space-xs">
            {navItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => setCurrentPath(item.path)}
                  className={`px-space-md py-space-xs rounded-lg font-label-md text-label-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-surface-container text-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] opacity-75">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Telemetry & Actions */}
        <div className="flex items-center gap-space-md">
          {/* Engine indicator */}
          <div className="hidden sm:flex items-center gap-space-xs px- space-sm py-1 px-2.5 bg-surface-container-low rounded-lg text-on-surface-variant font-label-mono text-code-sm border border-outline-variant/30">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>引擎就绪 · v2.4-pro</span>
          </div>

          {/* Quick Enter Exam Room Button */}
          <button
            onClick={() => setCurrentPath('exam-room')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all cursor-pointer shadow-xs ${
              currentPath === 'exam-room'
                ? 'bg-primary text-on-primary ring-2 ring-primary-fixed'
                : 'bg-primary-fixed text-primary hover:bg-primary hover:text-on-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">terminal</span>
            <span className="hidden sm:inline">考场直通</span>
          </button>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-1 border-l border-surface-container">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-label-mono text-label-md text-primary font-semibold border border-primary-fixed-dim">
              EC
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
