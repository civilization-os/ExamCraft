import React, { useState, useEffect } from 'react';

export default function Header({ currentPath, setCurrentPath, onOpenExam }) {
  const [modelStatus, setModelStatus] = useState({ hasApiKey: false, modelName: '未配置', vendor: '' });

  useEffect(() => {
    fetch('/api/model/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setModelStatus({
            hasApiKey: data.config.hasApiKey,
            modelName: data.config.modelName || 'gemini-2.5-flash',
            vendor: data.config.vendor || data.config.protocol || 'model_core'
          });
        }
      })
      .catch(() => {});
  }, [currentPath]); // refresh when navigating

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
          {/* Model Core Engine Status Indicator */}
          <button
            onClick={() => setCurrentPath('settings')}
            title="点击前往设置模型与 API Key"
            className={`hidden sm:flex items-center gap-space-xs py-1 px-3 rounded-lg font-label-mono text-code-sm border transition-all cursor-pointer ${
              modelStatus.hasApiKey
                ? 'bg-secondary/10 border-secondary/30 text-secondary hover:bg-secondary/20'
                : 'bg-tertiary/10 border-tertiary/30 text-tertiary hover:bg-tertiary/20 animate-pulse'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${modelStatus.hasApiKey ? 'bg-secondary' : 'bg-tertiary'}`}></span>
            <span>
              {modelStatus.hasApiKey
                ? `model_core 就绪 · ${modelStatus.modelName}`
                : '未输入 API Key (点击配置)'}
            </span>
          </button>

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
