/**
 * 考试倒计时状态计算、颜色渐变与剩余时间提醒配置工具
 */

export const DEFAULT_REMINDER_MINUTES = 15;
export const DEFAULT_SECOND_REMINDER_MINUTES = 5;

export const REMINDER_PRESET_OPTIONS = [
  { value: 30, label: '30 分钟', desc: '适合 120~150 分钟长考' },
  { value: 15, label: '15 分钟', desc: '考场推荐标准阈值' },
  { value: 10, label: '10 分钟', desc: '紧凑中等提醒' },
  { value: 5, label: '5 分钟', desc: '最后冲刺极限提醒' }
];

/**
 * 读取本地保存的考试提醒配置
 */
export const getExamTimerSettings = () => {
  try {
    const enabled = localStorage.getItem('examcraft_exam_reminder_enabled') !== 'false';
    const rawMinutes = Number(localStorage.getItem('examcraft_exam_reminder_minutes'));
    const reminderMinutes = !isNaN(rawMinutes) && rawMinutes > 0 ? rawMinutes : DEFAULT_REMINDER_MINUTES;

    const secondReminderEnabled = localStorage.getItem('examcraft_exam_second_reminder_enabled') !== 'false';
    const rawSecondMinutes = Number(localStorage.getItem('examcraft_exam_second_reminder_minutes'));
    const secondReminderMinutes = !isNaN(rawSecondMinutes) && rawSecondMinutes > 0 ? rawSecondMinutes : DEFAULT_SECOND_REMINDER_MINUTES;

    const soundEnabled = localStorage.getItem('examcraft_exam_reminder_sound') !== 'false';

    return {
      enabled,
      reminderMinutes,
      secondReminderEnabled,
      secondReminderMinutes,
      soundEnabled
    };
  } catch {
    return {
      enabled: true,
      reminderMinutes: DEFAULT_REMINDER_MINUTES,
      secondReminderEnabled: true,
      secondReminderMinutes: DEFAULT_SECOND_REMINDER_MINUTES,
      soundEnabled: true
    };
  }
};

/**
 * 保存考试提醒配置并广播事件
 */
export const saveExamTimerSettings = (settings) => {
  try {
    if (typeof settings.enabled === 'boolean') {
      localStorage.setItem('examcraft_exam_reminder_enabled', String(settings.enabled));
    }
    if (typeof settings.reminderMinutes === 'number' && settings.reminderMinutes > 0) {
      localStorage.setItem('examcraft_exam_reminder_minutes', String(settings.reminderMinutes));
    }
    if (typeof settings.secondReminderEnabled === 'boolean') {
      localStorage.setItem('examcraft_exam_second_reminder_enabled', String(settings.secondReminderEnabled));
    }
    if (typeof settings.secondReminderMinutes === 'number' && settings.secondReminderMinutes > 0) {
      localStorage.setItem('examcraft_exam_second_reminder_minutes', String(settings.secondReminderMinutes));
    }
    if (typeof settings.soundEnabled === 'boolean') {
      localStorage.setItem('examcraft_exam_reminder_sound', String(settings.soundEnabled));
    }
    window.dispatchEvent(new Event('examcraft-exam-reminder-updated'));
  } catch (err) {
    console.warn('Failed to save exam timer settings:', err);
  }
};

/**
 * 根据倒计时剩余秒数与总时长，计算颜色梯度阶段（绿色 -> 黄色 -> 红色）
 * @param {number} secondsLeft - 剩余秒数
 * @param {number} totalSeconds - 考试总秒数
 * @param {number} reminderMinutes - 设定的预警分钟数（默认 15）
 */
export const getTimerColorStage = (secondsLeft, totalSeconds, reminderMinutes = DEFAULT_REMINDER_MINUTES) => {
  const total = Math.max(totalSeconds || 5400, 60);
  const left = Math.max(0, secondsLeft);
  const ratio = Math.max(0, Math.min(1, left / total));
  const reminderSec = reminderMinutes * 60;

  // 1. 极度紧迫（不足 5 分钟 或 不足 5%）
  if (left <= 300 || (total > 600 && left <= 0.05 * total)) {
    return {
      stage: 'critical',
      label: '即将收卷',
      colorName: 'red',
      progressRatio: Math.round(ratio * 100),
      badgeClass: 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 animate-pulse',
      iconClass: 'text-rose-600 dark:text-rose-400',
      dotClass: 'bg-rose-500 animate-ping',
      barColor: 'bg-rose-500',
      iconName: 'alarm'
    };
  }

  // 2. 红色阶段：剩余时间不足 20% 或 已经达到/低于设定的提醒时间（如剩余 15 分钟）
  if (ratio <= 0.2 || left <= reminderSec) {
    return {
      stage: 'danger',
      label: '时间紧迫',
      colorName: 'red',
      progressRatio: Math.round(ratio * 100),
      badgeClass: 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300',
      iconClass: 'text-rose-600 dark:text-rose-400',
      dotClass: 'bg-rose-500',
      barColor: 'bg-rose-500',
      iconName: 'alarm'
    };
  }

  // 3. 黄色阶段：剩余时间在 20% ~ 50% 之间（时间过半）
  if (ratio <= 0.5) {
    return {
      stage: 'warning',
      label: '时间过半',
      colorName: 'yellow',
      progressRatio: Math.round(ratio * 100),
      badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
      iconClass: 'text-amber-600 dark:text-amber-400',
      dotClass: 'bg-amber-500',
      barColor: 'bg-amber-500',
      iconName: 'hourglass_bottom'
    };
  }

  // 4. 绿色阶段：开始时、剩余时间大于 50%
  return {
    stage: 'safe',
    label: '考时充裕',
    colorName: 'green',
    progressRatio: Math.round(ratio * 100),
    badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    barColor: 'bg-emerald-500',
    iconName: 'timer'
  };
};

/**
 * 使用纯 Web Audio API 合成轻柔优雅的考场提醒音效（无外部音频文件依赖，轻量可靠）
 * @param {'warning' | 'urgent'} type
 */
export const playReminderChime = (type = 'warning') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const now = ctx.currentTime;

    if (type === 'urgent') {
      // 三段递进提示音（急促但温和）
      osc.frequency.setValueAtTime(659.25, now);        // E5
      osc.frequency.setValueAtTime(880.00, now + 0.12); // A5
      osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.start(now);
      osc.stop(now + 0.65);
    } else {
      // 两段悠扬提醒音（清脆宜人）
      osc.frequency.setValueAtTime(523.25, now);        // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    }
  } catch (err) {
    // 浏览器静音或自动播放限制时静默忽略
  }
};
