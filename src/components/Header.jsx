import React, { useState, useEffect } from 'react';
import { APP_VERSION } from '../config/version';
import { UserAvatar } from './UserProfileModal';
import { getGuestProfile } from '../utils/auth';

export default function Header({
  currentPath,
  setCurrentPath,
  onOpenExam,
  currentUser = null,
  onOpenAuth,
  onLogout,
  onTriggerMigrate,
  onOpenProfile
}) {
  const [modelStatus, setModelStatus] = useState(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-semibold">
                ExamCraft <span className="text-primary-container">AI</span>
              </span>
              <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 select-none tracking-normal" title={`当前发布版本: ${APP_VERSION}`}>
                {APP_VERSION}
              </span>
            </div>
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

          {/* User Authentication & Profile Menu */}
          <div className="relative flex items-center gap-2 pl-2 border-l border-surface-container">
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-container transition-all cursor-pointer group"
                  title={`当前账号: ${currentUser.nickname || currentUser.username} (${currentUser.role === 'admin' ? '管理员' : '成员'})`}
                >
                  <UserAvatar
                    avatarId={currentUser.avatar || 'scholar'}
                    className="w-8 h-8 group-hover:scale-105 transition-transform"
                    textFallback={currentUser.username}
                  />
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-on-surface leading-tight flex items-center gap-1">
                      {currentUser.nickname || currentUser.username}
                      {currentUser.role === 'admin' && (
                        <span className="px-1 py-0.2 bg-primary/10 text-primary text-[10px] rounded font-mono">
                          管理员
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-secondary flex items-center gap-0.5 truncate max-w-[120px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0"></span>
                      <span className="truncate">{currentUser.targetExam || '备考中'}</span>
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_drop_down</span>
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl bg-surface-container-lowest border border-surface-container shadow-xl py-2 z-50 animate-fade-in">
                    <div className="px-4 py-2 border-b border-surface-container/60">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <UserAvatar avatarId={currentUser.avatar || 'scholar'} className="w-8 h-8" iconSize="text-[18px]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-on-surface truncate leading-tight">{currentUser.nickname || currentUser.username}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">@{currentUser.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="px-1.5 py-0.5 rounded font-medium bg-surface-container text-on-surface-variant">
                          权限: {currentUser.role === 'admin' ? '平台管理员' : '普通用户'}
                        </span>
                        <span className="text-outline font-mono">{APP_VERSION}</span>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onOpenProfile) onOpenProfile();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-surface-container flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary">account_circle</span>
                        <span>个人中心 / 头像档案</span>
                      </button>

                      {onTriggerMigrate && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onTriggerMigrate();
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-surface-container flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary">cloud_upload</span>
                          <span>同步本地离线数据到云端</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onLogout) onLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-error hover:bg-error/10 flex items-center gap-2 cursor-pointer transition-colors border-t border-surface-container/40 mt-1 pt-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span>退出当前账号</span>
                      </button>
                    </div>

                    <div className="px-4 py-1.5 border-t border-surface-container/60 text-[10px] font-mono text-outline flex items-center justify-between select-none">
                      <span>ExamCraft AI</span>
                      <span>{APP_VERSION}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition cursor-pointer"
                  title="查看或设置备考档案与头像"
                >
                  <UserAvatar avatarId={getGuestProfile().avatar || 'scholar'} className="w-7 h-7" iconSize="text-[17px]" />
                  <span className="text-[11px] hidden xl:inline text-stone-600 font-medium truncate max-w-[100px]">{getGuestProfile().nickname || '备战档案'}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:bg-primary-hover shadow-xs transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">login</span>
                  <span>登录 / 注册</span>
                </button>
              </div>
            )}
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
