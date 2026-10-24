import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * 考试剩余时间悬浮消息盒 (Floating HUD MessageBox)
 * 采用极简非打断架构，精准避开顶栏，无全屏遮罩
 * 遵循 Motion 与 UI Motion Atlas 物理弹簧动效规范
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
  const AUTO_MINIMIZE_SECONDS = 10;

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      setProgressPercent(100);
    }
  }, [isOpen]);

  // 10 秒无交互平滑收起为精致小胶囊 (悬停暂停)
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

  // 支持 Esc 快捷收起/关闭
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
      className="fixed top-18 right-6 z-[90] pointer-events-none max-w-[380px] w-full font-sans select-none"
      role="region"
      aria-live="polite"
      aria-label="考试时间提醒"
    >
      <AnimatePresence mode="wait">
        {!isMinimized ? (
          /* ==================== 极简轻奢 MessageBox 卡片 ==================== */
          <motion.div
            key="expanded-msgbox"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96, filter: 'blur(3px)' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320, mass: 0.7 }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="pointer-events-auto relative rounded-2xl bg-white/94 dark:bg-slate-900/94 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-[0_16px_36px_-6px_rgba(15,23,42,0.14),0_0_0_1px_rgba(0,0,0,0.03)] p-4 overflow-hidden transition-all"
          >
            {/* 顶部微细倒计时折叠指示条 */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <motion.div
                className={`h-full ${isUrgent ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>

            {/* 顶栏：时钟、倒计时大字与进度 */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isUrgent
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                  }`}
                >
                  <motion.span
                    animate={isUrgent ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                    className="material-symbols-outlined text-[19px]"
                  >
                    {isUrgent ? 'alarm' : 'hourglass_bottom'}
                  </motion.span>
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                      {formattedTime}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                        isUrgent
                          ? 'bg-rose-100/80 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {isUrgent ? '最后冲刺' : '进度提醒'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    已答 <span className="font-semibold text-slate-700 dark:text-slate-200">{answeredCount}</span> / {totalQuestions} 题 ({answerPercentage}%)
                  </div>
                </div>
              </div>

              {/* 右侧微型操作：收起 / 关闭 */}
              <div className="flex items-center gap-0.5 text-slate-400">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title="最小化为悬浮胶囊"
                >
                  <span className="material-symbols-outlined text-[15px]">remove</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title="关闭 (Esc)"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              </div>
            </div>

            {/* 微细进度条 */}
            <div className="my-2.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${answerPercentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full rounded-full ${isUrgent ? 'bg-rose-500' : 'bg-primary'}`}
              />
            </div>

            {/* 提示文案与紧凑操作 */}
            <div className="flex items-center justify-between gap-2 pt-1 text-[11.5px]">
              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[210px]">
                {unansweredCount > 0 ? (
                  <>尚有 <strong className="text-rose-600 dark:text-rose-400 font-semibold">{unansweredCount}</strong> 题待答，请把握答题节奏</>
                ) : (
                  <>全卷已作答完毕，建议复查核对</>
                )}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {onSnooze && minutesLeft > 5 && (
                  <button
                    type="button"
                    onClick={onSnooze}
                    className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer px-1 py-0.5"
                    title="稍后 5 分钟再次提醒"
                  >
                    5分后再提醒
                  </button>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={onClose}
                  className={`px-3 py-1 rounded-lg text-[12px] font-semibold text-white shadow-xs cursor-pointer transition ${
                    isUrgent
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-primary hover:bg-primary-container shadow-primary/20'
                  }`}
                >
                  知道了
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ==================== 极简动态岛胶囊 (Minimized Pill) ==================== */
          <motion.div
            key="minimized-pill"
            initial={{ opacity: 0, y: -12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ type: 'spring', damping: 24, stiffness: 340 }}
            className="flex justify-end"
          >
            <motion.div
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsMinimized(false)}
              className={`pointer-events-auto flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-white/94 dark:bg-slate-900/94 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-md cursor-pointer transition ${
                isUrgent
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
              title="点击展开时间提醒"
            >
              <span className={`material-symbols-outlined text-[15px] ${isUrgent ? 'animate-pulse' : ''}`}>
                alarm
              </span>
              <span className="text-[12px] font-bold font-mono">
                {formattedTime}
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {answeredCount}/{totalQuestions}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-4.5 h-4.5 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 ml-0.5"
                title="关闭"
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
