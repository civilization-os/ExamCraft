import React, { useState, useEffect } from 'react';

export default function Header({ currentPath, setCurrentPath, onOpenExam }) {
  const [modelStatus, setModelStatus] = useState(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let requestPending = false;
    const refresh = () => {
      if (requestPending) return;
      requestPending = true;
      fetch('/api/model/status')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success) setModelStatus(data);
      })
      .catch(() => {})
      .finally(() => { requestPending = false; });
    };
    refresh();
    const intervalId = window.setInterval(refresh, 10_000);
    const onConfigUpdated = () => refresh();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('examcraft-model-config-updated', onConfigUpdated);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('examcraft-model-config-updated', onConfigUpdated);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const refreshBalance = async () => {
    setIsRefreshingStatus(true);
    try {
      const res = await fetch('/api/model/status?refresh=1');
      const data = await res.json();
      if (data.success) setModelStatus(data);
    } catch {}
    setIsRefreshingStatus(false);
  };

  const walletBalance = modelStatus?.balance?.balances?.find((item) => item.currency === 'CNY') || modelStatus?.balance?.balances?.[0];
  const todayCostKnown = (modelStatus?.today?.pricedCalls || 0) > 0;
  const todayCost = Number(modelStatus?.today?.estimatedCostCny || 0);
  const todayTokens = Number(modelStatus?.today?.tokens || 0);

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
            className="flex items-center gap-space-sm group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
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
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                >
                  <span className="material-symbols-outlined text-[17px] opacity-75">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Telemetry & Actions */}
        <div className="flex items-center gap-space-sm lg:gap-space-md">
          {/* Model Core Engine Status Indicator */}
          <button
            onClick={() => setCurrentPath('settings')}
            title="点击前往设置模型与 API Key"
            className={`hidden sm:flex items-center gap-space-xs py-1 px-3 rounded-lg font-label-mono text-code-sm border transition-all cursor-pointer ${
              modelStatus?.model?.hasApiKey
                ? 'bg-secondary/10 border-secondary/30 text-secondary hover:bg-secondary/20'
                : 'bg-tertiary/10 border-tertiary/30 text-tertiary hover:bg-tertiary/20 animate-pulse'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${modelStatus?.model?.hasApiKey ? 'bg-secondary' : 'bg-tertiary'}`}></span>
            <span>
              {modelStatus?.model?.hasApiKey
                ? `${modelStatus.model.providerMode === 'deepseek-official' ? 'DeepSeek 官方' : '模型就绪'} · ${modelStatus.model.modelName}`
                : '未输入 API Key (点击配置)'}
            </span>
          </button>

          <div className="hidden xl:flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2.5 py-1 font-label-mono text-[11px] text-on-surface-variant" title="自本地用量记录启用后的估算数据；实际扣款请以服务商账单为准">
            <span className="material-symbols-outlined text-[14px] text-primary">payments</span>
            <span>今日 {todayCostKnown ? `¥${todayCost.toFixed(4)}` : '¥—'}</span>
            <span className="text-outline">·</span>
            <span>{todayTokens.toLocaleString()} tokens</span>
          </div>

          {modelStatus?.model?.providerMode === 'deepseek-official' && (
            <div className="hidden lg:flex items-center gap-1 rounded-lg border border-secondary/25 bg-secondary/5 px-2 py-1 font-label-mono text-[11px] text-secondary" title={modelStatus.balanceError || (modelStatus.balanceCheckedAt ? `余额查询于 ${new Date(modelStatus.balanceCheckedAt).toLocaleTimeString()} 更新` : '查询 DeepSeek 官方账户余额')}>
              <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
              <span>{walletBalance ? `钱包 ${walletBalance.currency === 'CNY' ? '¥' : '$'}${walletBalance.totalBalance.toFixed(2)}` : (modelStatus.balanceError ? '钱包查询失败' : '读取钱包…')}</span>
              <button type="button" aria-label="刷新 DeepSeek 钱包余额" onClick={refreshBalance} className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-secondary/10" title="刷新余额">
                <span className={`material-symbols-outlined text-[13px] ${isRefreshingStatus ? 'animate-spin' : ''}`}>refresh</span>
              </button>
            </div>
          )}

          {/* Quick Enter Exam Room Button */}
          <button
            onClick={onOpenExam}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all cursor-pointer shadow-xs ${
              currentPath === 'exam-room'
                ? 'bg-primary text-on-primary ring-2 ring-primary-fixed'
                : 'bg-primary-fixed text-primary hover:bg-primary hover:text-on-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">terminal</span>
            <span className="hidden sm:inline">考场直通</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileNavOpen((open) => !open)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={isMobileNavOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-primary-navigation"
          >
            <span className="material-symbols-outlined" aria-hidden="true">{isMobileNavOpen ? 'close' : 'menu'}</span>
          </button>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-1 border-l border-surface-container">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-label-mono text-label-md text-primary font-semibold border border-primary-fixed-dim">
              EC
            </div>
          </div>
        </div>
      </div>
      {isMobileNavOpen && (
        <nav id="mobile-primary-navigation" className="md:hidden border-t border-surface-container/70 bg-surface-container-lowest px-4 py-2 shadow-lg" aria-label="主导航">
          <div className="mx-auto flex max-w-lg flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  setCurrentPath(item.path);
                  setIsMobileNavOpen(false);
                }}
                aria-current={currentPath === item.path ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${currentPath === item.path ? 'bg-surface-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
