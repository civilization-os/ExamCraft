import React, { useState } from 'react';
import { apiLogin, apiRegister } from '../utils/auth';

export default function AuthModal({ isOpen, onClose, onSuccess, onGuest, allowGuest = true }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMsg('请输入用户名');
      return;
    }
    if (!password) {
      setErrorMsg('请输入密码');
      return;
    }
    if (tab === 'register') {
      if (cleanUsername.length < 2 || cleanUsername.length > 24) {
        setErrorMsg('用户名长度需在 2 到 24 个字符之间');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('密码长度不能少于 6 位');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('两次输入的密码不一致');
        return;
      }
    }

    setIsLoading(true);
    try {
      let user;
      if (tab === 'login') {
        user = await apiLogin(cleanUsername, password);
      } else {
        user = await apiRegister(cleanUsername, password);
      }
      if (onSuccess) onSuccess(user);
      if (onClose) onClose();
    } catch (err) {
      setErrorMsg(err.message || '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Banner */}
        <div className="relative px-6 pt-7 pb-6 bg-gradient-to-br from-primary-container/20 via-surface-container-low to-surface-container-lowest border-b border-surface-container/70">
          {allowGuest && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container/60 transition-colors"
              title="关闭"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shadow-md text-on-primary">
              <span className="material-symbols-outlined text-[24px]">neurology</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface tracking-tight">
                ExamCraft <span className="text-primary font-semibold">云端考练平台</span>
              </h2>
              <p className="text-xs text-on-surface-variant font-medium">多设备云端漫游 · 数据加密隔离 · AI 智能考练</p>
            </div>
          </div>

          {/* Value Props Pills */}
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              <span className="material-symbols-outlined text-[13px]">lock</span>
              账号专属隔离
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20 font-medium">
              <span className="material-symbols-outlined text-[13px]">cloud_sync</span>
              手机/电脑实时同步
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 font-medium">
              <span className="material-symbols-outlined text-[13px]">security</span>
              数据持久化防丢
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-surface-container bg-surface-container-low/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              tab === 'login'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            账号登录
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              tab === 'register'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            新用户注册
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-lg bg-error/10 border border-error/30 text-error flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              用户名
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                person
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名（支持中英文、数字）"
                className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-on-surface transition-all"
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              密码
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                key
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入登录密码（至少 6 位）"
                className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-on-surface transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                确认密码
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                  lock_reset
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入登录密码"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-on-surface transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl font-medium text-sm text-on-primary bg-primary hover:bg-primary-hover active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                <span>正在处理...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">
                  {tab === 'login' ? 'login' : 'how_to_reg'}
                </span>
                <span>{tab === 'login' ? '立即登录' : '创建账号并开启云端体验'}</span>
              </>
            )}
          </button>

          {allowGuest && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  if (onGuest) onGuest();
                  if (onClose) onClose();
                }}
                className="text-xs text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer"
              >
                暂不登录，以离线游客身份体验 →
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
