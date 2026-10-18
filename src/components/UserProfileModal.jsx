import React, { useState, useEffect } from 'react';
import { APP_VERSION, APP_RELEASE_NAME, APP_BUILD_DATE } from '../config/version';
import { apiUpdateProfile, setGuestProfile, getGuestProfile } from '../utils/auth';

export const PRESET_AVATARS = [
  { id: 'scholar', label: '上岸学神', icon: 'school', gradient: 'from-blue-600 to-indigo-600' },
  { id: 'geek', label: '408极客', icon: 'terminal', gradient: 'from-emerald-600 to-teal-700' },
  { id: 'math', label: '数学大师', icon: 'functions', gradient: 'from-amber-500 to-orange-600' },
  { id: 'rocket', label: '极速冲刺', icon: 'rocket_launch', gradient: 'from-rose-500 to-red-600' },
  { id: 'owl', label: '夜战猫头鹰', icon: 'nights_stay', gradient: 'from-purple-600 to-indigo-900' },
  { id: 'coffee', label: '深度专注', icon: 'coffee', gradient: 'from-amber-700 to-stone-800' },
  { id: 'koi', label: '上岸锦鲤', icon: 'star', gradient: 'from-pink-500 to-rose-600' },
  { id: 'lion', label: '沉稳雄狮', icon: 'military_tech', gradient: 'from-yellow-500 to-amber-700' },
  { id: 'light', label: '灵感迸发', icon: 'lightbulb', gradient: 'from-yellow-400 to-orange-500' },
  { id: 'shield', label: '严谨治学', icon: 'shield', gradient: 'from-cyan-600 to-blue-700' },
  { id: 'pen', label: '考场妙笔', icon: 'edit_note', gradient: 'from-violet-600 to-fuchsia-700' },
  { id: 'target', label: '精准命中', icon: 'target', gradient: 'from-red-500 to-pink-600' }
];

export function UserAvatar({ avatarId = 'scholar', className = 'w-9 h-9', iconSize = 'text-[20px]', textFallback = '' }) {
  const avatar = PRESET_AVATARS.find((a) => a.id === avatarId) || PRESET_AVATARS[0];
  return (
    <div
      className={`rounded-full bg-gradient-to-tr ${avatar.gradient} text-white flex items-center justify-center shadow-xs shrink-0 select-none ${className}`}
      title={avatar.label}
    >
      {avatar.icon ? (
        <span className={`material-symbols-outlined ${iconSize}`}>{avatar.icon}</span>
      ) : (
        <span className="font-bold text-xs uppercase">{textFallback ? textFallback.slice(0, 2) : 'EX'}</span>
      )}
    </div>
  );
}

export default function UserProfileModal({ isOpen, onClose, currentUser, onUserUpdated }) {
  const isGuest = !currentUser;
  const guestData = getGuestProfile();

  const [avatar, setAvatar] = useState('scholar');
  const [nickname, setNickname] = useState('');
  const [targetExam, setTargetExam] = useState('');
  const [motto, setMotto] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  // 统计数据
  const [stats, setStats] = useState({ papers: 0, submissions: 0, mistakes: 0 });

  useEffect(() => {
    if (!isOpen) return;

    if (currentUser) {
      setAvatar(currentUser.avatar || 'scholar');
      setNickname(currentUser.nickname || currentUser.username || '');
      setTargetExam(currentUser.targetExam || '2026 考研数学 + 408 统考');
      setMotto(currentUser.motto || '日拱一卒，功不唐捐，高分上岸！');
    } else {
      const g = getGuestProfile();
      setAvatar(g.avatar || 'scholar');
      setNickname(g.nickname || '考研学神 (游客模式)');
      setTargetExam(g.targetExam || '2026 考研数学 + 408 统考');
      setMotto(g.motto || '日拱一卒，功不唐捐，高分上岸！');
    }

    try {
      const papers = (JSON.parse(localStorage.getItem('examcraft_papers') || '[]')).length;
      const subs = (JSON.parse(localStorage.getItem('examcraft_submissions') || '[]')).length;
      const nb = (JSON.parse(localStorage.getItem('examcraft_notebook_data') || '{}')?.items || []).length;
      setStats({ papers, submissions: subs, mistakes: nb });
    } catch {}

    setStatusMsg({ text: '', type: '' });
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    setStatusMsg({ text: '', type: '' });

    const payload = {
      avatar,
      nickname: nickname.trim() || (currentUser?.username || '备考同学'),
      targetExam: targetExam.trim(),
      motto: motto.trim()
    };

    try {
      if (currentUser) {
        const updated = await apiUpdateProfile(payload);
        onUserUpdated?.(updated);
        setStatusMsg({ text: '个人资料已同步至云端！', type: 'success' });
      } else {
        const updated = setGuestProfile(payload);
        onUserUpdated?.(null);
        setStatusMsg({ text: '备考档案已保存到本地！', type: 'success' });
      }
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setStatusMsg({ text: err.message || '保存失败，请重试', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentAvatarObj = PRESET_AVATARS.find((a) => a.id === avatar) || PRESET_AVATARS[0];

  const quickTargetOptions = [
    '2026 考研数学一 + 408 统考',
    '2026 考研数学二 + 统考专业课',
    '高考理科综合冲刺',
    '大学期末高等数学 & 线性代数',
    '教师出卷与教研备课'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="px-5 py-3.5 bg-surface-container-low/80 border-b border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">account_circle</span>
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-on-surface">个人信息与备考档案</h3>
              <p className="text-[11px] text-on-surface-variant">个性化头像、备考目标与战绩看板</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition cursor-pointer"
            title="关闭"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* 内容主体 */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1 text-[13px]">
          {/* 头像选择区域 */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-on-surface flex items-center justify-between">
              <span>选择个性化备考头像：</span>
              <span className="text-[11px] font-normal text-primary">当前选用：{currentAvatarObj.label}</span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/30">
              {PRESET_AVATARS.map((item) => {
                const isSelected = avatar === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAvatar(item.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition cursor-pointer group ${
                      isSelected
                        ? 'bg-surface-container-highest ring-2 ring-primary shadow-xs'
                        : 'hover:bg-surface-container'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-tr ${item.gradient} text-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-105`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                    </div>
                    <span className={`text-[10px] leading-tight truncate w-full text-center ${isSelected ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 基本信息输入 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-stone-600">
                考生昵称 / 真实姓名：
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={24}
                placeholder="例如：张三上岸中"
                className="px-3 py-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-hidden text-[13px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-stone-600">
                登录账号 / 绑定邮箱：
              </label>
              <div className="px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/70 text-on-surface-variant text-[12px] flex items-center justify-between select-none">
                <span className="truncate">{currentUser ? currentUser.username : '游客身份（本地离线）'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container-high text-stone-600 shrink-0">
                  {currentUser?.role === 'admin' ? '管理员' : currentUser ? '注册用户' : '游客'}
                </span>
              </div>
            </div>
          </div>

          {/* 目标考向 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-stone-600">备战目标考向：</label>
              <span className="text-[10px] text-outline">支持点击快捷标签填入</span>
            </div>
            <input
              type="text"
              value={targetExam}
              onChange={(e) => setTargetExam(e.target.value)}
              maxLength={40}
              placeholder="例如：2026 考研数学一 + 408 统考"
              className="px-3 py-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-hidden text-[13px]"
            />
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {quickTargetOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTargetExam(opt)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-container hover:bg-primary/10 hover:text-primary transition cursor-pointer text-stone-600"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* 备考宣言 / 签名 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-stone-600">备考座右铭 / 签名：</label>
            <input
              type="text"
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              maxLength={80}
              placeholder="日拱一卒，功不唐捐，高分上岸！"
              className="px-3 py-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-hidden text-[13px]"
            />
          </div>

          {/* 备战战绩统计看板 */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-stone-600">我的备考战绩统计：</span>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col items-center">
                <span className="text-[10px] text-on-surface-variant">智能组卷库</span>
                <span className="text-[16px] font-bold text-primary font-mono mt-0.5">{stats.papers} <span className="text-[10px] font-normal">份</span></span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col items-center">
                <span className="text-[10px] text-on-surface-variant">实战考练记录</span>
                <span className="text-[16px] font-bold text-secondary font-mono mt-0.5">{stats.submissions} <span className="text-[10px] font-normal">次</span></span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col items-center">
                <span className="text-[10px] text-on-surface-variant">错题重练集</span>
                <span className="text-[16px] font-bold text-tertiary font-mono mt-0.5">{stats.mistakes} <span className="text-[10px] font-normal">题</span></span>
              </div>
            </div>
          </div>

          {statusMsg.text && (
            <div
              className={`p-2.5 rounded-xl text-[12px] flex items-center gap-1.5 ${
                statusMsg.type === 'success'
                  ? 'bg-secondary/10 text-secondary border border-secondary/20'
                  : 'bg-error/10 text-error border border-error/20'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {statusMsg.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* 底部按钮栏与版本号 */}
        <div className="px-5 py-3 bg-surface-container-low/90 border-t border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
            <span className="material-symbols-outlined text-[14px] text-primary">verified</span>
            <span>{APP_VERSION}</span>
            <span className="hidden sm:inline text-outline/60">· {APP_RELEASE_NAME}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-xl border border-outline-variant/60 text-[12px] font-medium text-stone-700 hover:bg-surface-container transition cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl bg-primary text-white text-[12px] font-semibold hover:bg-primary-hover shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  <span>保存中…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  <span>保存档案</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
