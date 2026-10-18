import React, { useEffect } from 'react';

/**
 * 考试剩余时间提醒弹窗组件 (专属定制 UI MSG)
 */
export default function ExamTimerReminderModal({
  isOpen,
  onClose,
  minutesLeft = 15,
  formattedTime = '00:15:00',
  stage = 'warning', // 'warning' (yellow) | 'danger' (red) | 'critical'
  answeredCount = 0,
  totalQuestions = 0,
  onSnooze, // 稍后 5 分钟再次提醒
  onDisableThisExam // 本场考试不再提醒
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isUrgent = stage === 'danger' || stage === 'critical' || minutesLeft <= 5;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-reminder-title"
    >
      <div
        className={`w-full max-w-md rounded-2xl bg-surface-container-lowest border shadow-2xl p-6 overflow-hidden transition-all transform animate-in zoom-in-95 duration-200 ${
          isUrgent
            ? 'border-rose-500/40 ring-4 ring-rose-500/10'
            : 'border-amber-500/40 ring-4 ring-amber-500/10'
        }`}
      >
        {/* Header with decorative badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-xs ${
                isUrgent
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              <span className={`material-symbols-outlined text-[28px] ${isUrgent ? 'animate-bounce' : ''}`}>
                {isUrgent ? 'alarm' : 'hourglass_bottom'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="exam-reminder-title" className="text-title-md font-bold text-on-surface">
                  考试时间提醒
                </h3>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isUrgent
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {isUrgent ? '最后冲刺' : '进度预警'}
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                考场倒计时实时节奏提醒
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            title="关闭提示 (Esc)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Big Remaining Time Clock Badge */}
        <div
          className={`my-5 p-4 rounded-xl flex items-center justify-between border ${
            isUrgent
              ? 'bg-rose-500/8 border-rose-500/25'
              : 'bg-amber-500/8 border-amber-500/25'
          }`}
        >
          <div>
            <div className="text-[12px] font-medium text-on-surface-variant">
              考试剩余时间
            </div>
            <div className="text-headline-md font-extrabold font-mono tracking-wider mt-0.5 text-on-surface flex items-baseline gap-1.5">
              <span>{formattedTime}</span>
              <span className="text-[13px] font-medium text-on-surface-variant">
                (约 {minutesLeft} 分钟)
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-on-surface-variant">答题进度</div>
            <div className="text-title-md font-bold font-mono text-primary mt-0.5">
              {answeredCount} <span className="text-[12px] text-on-surface-variant font-normal">/ {totalQuestions}</span>
            </div>
          </div>
        </div>

        {/* Tip / Reminder Advice */}
        <div className="space-y-2 mb-6">
          <div className="text-body-sm text-on-surface flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary mt-0.5 shrink-0">
              tips_and_updates
            </span>
            <span>
              {isUrgent ? (
                <>
                  距离考试结束仅剩 <strong className="text-rose-600 dark:text-rose-400">{minutesLeft} 分钟</strong>！请抓紧核对已作答题目，优先检查未填选项和答题卡。
                </>
              ) : (
                <>
                  距离考试结束还剩 <strong className="text-amber-600 dark:text-amber-400">{minutesLeft} 分钟</strong>。请合理安排剩余答题时间，建议进入主观题推导收尾与查漏补缺阶段。
                </>
              )}
            </span>
          </div>
          {totalQuestions - answeredCount > 0 && (
            <div className="text-[12px] text-on-surface-variant pl-6">
              当前尚有 <strong className="text-primary">{totalQuestions - answeredCount}</strong> 道题目未作答，主观题可使用「AI 规范代笔」将草稿快速整理为标准卷面。
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1 border-t border-surface-container">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={`w-full py-2.5 rounded-xl font-label-md font-bold shadow-sm transition cursor-pointer flex items-center justify-center gap-2 active:scale-98 text-white ${
              isUrgent
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                : 'bg-primary hover:bg-primary-container shadow-primary/20'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>我知道了，继续答题</span>
          </button>

          <div className="flex items-center justify-between text-[12px] pt-1 px-1 text-on-surface-variant">
            {onSnooze && minutesLeft > 5 ? (
              <button
                type="button"
                onClick={onSnooze}
                className="hover:text-on-surface hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">snooze</span>
                <span>稍后 5 分钟再次提醒</span>
              </button>
            ) : <span />}

            {onDisableThisExam && (
              <button
                type="button"
                onClick={onDisableThisExam}
                className="hover:text-on-surface hover:underline flex items-center gap-1 cursor-pointer ml-auto"
              >
                <span className="material-symbols-outlined text-[15px]">notifications_off</span>
                <span>本场考试不再提醒</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
