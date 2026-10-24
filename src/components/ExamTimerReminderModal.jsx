import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * 考试剩余时间浮动消息盒组件 (Floating MessageBox HUD)
 * 采用 non-blocking 悬浮 MessageBox 架构，彻底消除全屏遮罩，绝不打断答题
 * 动效遵循 Motion 与 UI Motion Atlas 弹簧物理规范
 */
export default function ExamTimerReminderModal({
  isOpen,
  onClose,
  minutesLeft = 15,
  formattedTime = '00:15:00',
  stage = 'warning', // 'warning' | 'danger' | 'critical'
  answeredCount = 0,
  totalQuestions = 0,
  onSnooze, // 稍后 5 分钟再次提醒
  onDisableThisExam // 本场考试不再提醒
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progressPercent, setProgressPercent] = useState(100);
  const AUTO_MINIMIZE_SECONDS = 12;

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      setProgressPercent(100);
    }
  }, [isOpen]);

  // 12 秒无操作平滑自动收起为微型胶囊 (Hover 时暂停)
  useEffect(() => {
    if (!isOpen || isMinimized || isPaused) return;

    const intervalMs = 100;
    const step = 100 / ((AUTO_MINIMIZE_SECONDS * 1000) / intervalMs);

    const timer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev <= step) {
          setIsMinimized(true);
          return 0;
        }
        return prev - step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isOpen, isMinimized, isPaused]);

  // 支持 Esc 快捷关闭或收起
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isUrgent = stage === 'danger' || stage === 'critical' || minutesLeft <= 5;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const answerPercentage = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <div
      className="fixed top-5 right-5 z-[90] pointer-events-none max-w-[400px] w-full font-sans select-none"
      role="region"
      aria-live="polite"
      aria-label="考试时间提醒"
    >
      <AnimatePresence mode="wait">
        {!isMinimized ? (
          /* ==================== 形态 1: 展开的高保真非打断 MessageBox ==================== */
          <motion.div
            key="expanded-msgbox"
            initial={{ opacity: 0, y: -24, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16, scale: 0.95, filter: 'blur(4px)' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.8 }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className={`pointer-events-auto rounded-2xl bg-surface-container-lowest/95 dark:bg-surface-container-lowest/95 backdrop-blur-xl border shadow-2xl p-4.5 overflow-hidden transition-all ${
              isUrgent
                ? 'border-rose-500/40 ring-4 ring-rose-500/10 shadow-rose-900/10'
                : 'border-amber-500/40 ring-4 ring-amber-500/10 shadow-amber-900/10'
            }`}
          >
            {/* 顶部微细自动折叠流光进度条 */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-surface-container overflow-hidden">
              <motion.div
                className={`h-full ${isUrgent ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>

            {/* Header 顶栏 */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    isUrgent
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isUrgent ? 'alarm' : 'hourglass_bottom'}
                  </span>
                </motion.div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[14px] font-bold text-on-surface leading-tight">
                      考试时间提醒
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isUrgent
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isUrgent ? '最后冲刺' : '进度预警'}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
                    考场非打断悬浮视窗 · 不影响答题
                  </p>
                </div>
              </div>

              {/* 快捷操作：最小化为胶囊 / 关闭 */}
              <div className="flex items-center gap-1 text-on-surface-variant">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded-lg hover:bg-surface-container-high hover:text-on-surface transition cursor-pointer"
                  title="最小化为右上角常驻胶囊"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-surface-container-high hover:text-on-surface transition cursor-pointer"
                  title="关闭提示 (Esc)"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* 核心时钟与作答进度卡片 */}
            <div
              className={`my-3 p-3 rounded-xl flex items-center justify-between border ${
                isUrgent
                  ? 'bg-rose-500/8 border-rose-500/25'
                  : 'bg-amber-500/8 border-amber-500/25'
              }`}
            >
              <div>
                <div className="text-[11px] font-medium text-on-surface-variant">
                  剩余时间
                </div>
                <div className="text-[20px] font-black font-mono tracking-wide text-on-surface flex items-baseline gap-1 mt-0.5">
                  <span>{formattedTime}</span>
                  <span className="text-[11px] font-normal text-on-surface-variant">
                    ({minutesLeft}分钟)
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-medium text-on-surface-variant">
                  答题进度 ({answerPercentage}%)
                </div>
                <div className="text-[15px] font-bold font-mono text-primary mt-0.5">
                  {answeredCount} <span className="text-[11px] text-on-surface-variant font-normal">/ {totalQuestions} 题</span>
                </div>
              </div>
            </div>

            {/* 贴心引导 (紧凑 1 行) */}
            <div className="text-[12px] text-on-surface-variant mb-3 flex items-start gap-1.5 leading-snug">
              <span className={`material-symbols-outlined text-[16px] shrink-0 mt-0.5 ${isUrgent ? 'text-rose-500' : 'text-amber-500'}`}>
                {isUrgent ? 'notification_important' : 'lightbulb'}
              </span>
              <span>
                {isUrgent ? (
                  <>
                    仅剩 <strong className="text-rose-600 dark:text-rose-400">{minutesLeft} 分钟</strong>！尚有 <strong className="text-primary">{unansweredCount}</strong> 题待答，请抓紧涂卡与核对。
                  </>
                ) : (
                  <>
                    还剩 <strong className="text-amber-600 dark:text-amber-400">{minutesLeft} 分钟</strong>，尚有 <strong className="text-primary">{unansweredCount}</strong> 题未答，建议合理掌控大题节奏。
                  </>
                )}
              </span>
            </div>

            {/* Action Buttons 操作按钮 */}
            <div className="space-y-2 pt-2 border-t border-surface-container">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onClose}
                className={`w-full py-2 rounded-xl font-medium text-[13px] shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5 text-white ${
                  isUrgent
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                    : 'bg-primary hover:bg-primary-container shadow-primary/20'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">check</span>
                <span>我知道了，继续答题</span>
              </motion.button>

              <div className="flex items-center justify-between text-[11px] text-on-surface-variant px-0.5">
                {onSnooze && minutesLeft > 5 ? (
                  <button
                    type="button"
                    onClick={onSnooze}
                    className="hover:text-on-surface hover:underline flex items-center gap-1 cursor-pointer transition"
                  >
                    <span className="material-symbols-outlined text-[14px]">snooze</span>
                    <span>稍后 5 分钟提醒</span>
                  </button>
                ) : <span />}

                {onDisableThisExam && (
                  <button
                    type="button"
                    onClick={onDisableThisExam}
                    className="hover:text-on-surface hover:underline flex items-center gap-1 cursor-pointer transition ml-auto"
                  >
                    <span className="material-symbols-outlined text-[14px]">notifications_off</span>
                    <span>本场不再提醒</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* ==================== 形态 2: 微型动态岛常驻胶囊 (Minimized Pill) ==================== */
          <motion.div
            key="minimized-pill"
            initial={{ opacity: 0, y: -20, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="flex justify-end"
          >
            <motion.div
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className={`pointer-events-auto flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-lowest/95 dark:bg-surface-container-lowest/95 backdrop-blur-xl border shadow-lg cursor-pointer ${
                isUrgent
                  ? 'border-rose-500/50 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/10'
                  : 'border-amber-500/50 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/10'
              }`}
              onClick={() => setIsMinimized(false)}
              title="点击展开考试时间详细面板"
            >
              <span className={`material-symbols-outlined text-[17px] ${isUrgent ? 'animate-pulse' : ''}`}>
                alarm
              </span>
              <span className="text-[12px] font-mono font-bold text-on-surface">
                {formattedTime}
              </span>
              <span className="text-[11px] text-on-surface-variant font-medium">
                · {answeredCount}/{totalQuestions} 题
              </span>

              <span className="material-symbols-outlined text-[15px] text-on-surface-variant hover:text-on-surface">
                open_in_full
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="hover:bg-surface-container-high rounded-full p-0.5 text-on-surface-variant hover:text-on-surface ml-0.5"
                title="关闭"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
