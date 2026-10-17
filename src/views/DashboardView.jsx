import React from 'react';

const TOKEN_DAY_FORMATTER = new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', month: 'long', day: 'numeric' });

export default function DashboardView({ onNavigate, papers, onStartExam }) {
  const [modelStatus, setModelStatus] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    let requestPending = false;
    const refresh = () => {
      if (requestPending) return;
      requestPending = true;
      fetch('/api/model/status')
        .then((res) => res.json())
        .then((data) => { if (active && data.success) setModelStatus(data); })
        .catch(() => {})
        .finally(() => { requestPending = false; });
    };
    refresh();
    const intervalId = window.setInterval(refresh, 15_000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('examcraft-model-config-updated', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('examcraft-model-config-updated', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Dynamically compute stats from actual papers, submissions, and mistake notebook
  const submissions = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('examcraft_submissions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, []);

  const notebookItems = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('examcraft_notebook_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items)) return parsed.items;
      }
    } catch {}
    return [];
  }, []);

  const avgScore = submissions.length > 0
    ? (submissions.reduce((acc, s) => acc + (s.score || 0), 0) / submissions.length).toFixed(1)
    : null;

  const calendarData = modelStatus?.recentDays || [];
  const calendarWeeks = React.useMemo(() => {
    if (calendarData.length === 0) return [];
    const firstWeekday = (new Date(`${calendarData[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
    const cells = [...Array(firstWeekday).fill(null), ...calendarData];
    const weeks = [];
    for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
    return weeks;
  }, [calendarData]);
  const tokenValues = calendarData.map((day) => Number(day.tokens) || 0).filter((tokens) => tokens > 0).sort((a, b) => a - b);
  const tokenThresholds = [0.25, 0.5, 0.75].map((ratio) => tokenValues[Math.floor((tokenValues.length - 1) * ratio)] || 0);
  const yearTokens = calendarData.reduce((total, day) => total + (Number(day.tokens) || 0), 0);
  const activeDays = calendarData.filter((day) => Number(day.tokens) > 0).length;

  const stats = [
    {
      label: '库中总试卷数',
      value: `${papers.length} 份`,
      icon: 'description',
      color: 'text-primary',
      change: '涵盖真题克隆与智能组卷'
    },
    {
      label: '自动核对平均得分',
      value: avgScore === null ? '暂无数据' : `${avgScore} 分`,
      icon: 'military_tech',
      color: 'text-primary',
      change: submissions.length > 0 ? `基于 ${submissions.length} 次交卷记录` : '完成首次模考后显示'
    },
    {
      label: '错题收录与攻坚',
      value: `${notebookItems.length} 题`,
      icon: 'warning',
      color: 'text-tertiary',
      change: '支持靶向变式组卷'
    },
    {
      label: '已完成模考总数',
      value: `${submissions.length} 次`,
      icon: 'fact_check',
      color: 'text-secondary',
      change: '历次作答均可回溯'
    }
  ];

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">
        {/* Welcome Hero Banner */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-space-xl">
          <div className="space-y-space-xs z-10 max-w-2xl">
            <div className="inline-flex items-center gap-space-xs px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-label-mono text-label-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span>EXAMCRAFT AI WORKBENCH v2.4</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
              从组卷、模考到错题复盘
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              导入试卷或生成练习，进入考场作答；交卷后查看得分与逐题反馈，再把错题加入题集继续练习。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-space-sm z-10 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('exam-generator')}
              className="px-space-xl py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2 justify-center"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>进入智能组卷</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('question-bank')}
              className="px-space-lg py-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm transition-all cursor-pointer flex items-center gap-2 justify-center border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <span>复盘错题本</span>
            </button>
          </div>
        </section>

        {/* Stats 4 Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface-variant">{s.label}</span>
                <span className={`material-symbols-outlined text-[24px] ${s.color}`}>{s.icon}</span>
              </div>
              <div className="mt-space-md">
                <p className="font-headline-xl text-headline-xl font-bold text-on-surface font-mono">{s.value}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  {s.change}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-space-lg shadow-sm" aria-label="AI Token 用量">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">token</span>
              <div>
                <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">AI 用量</h2>
                <p className="text-label-sm text-on-surface-variant">本地调用统计 · 每 15 秒更新</p>
              </div>
            </div>
            <button type="button" onClick={() => onNavigate('settings')} className="text-label-sm text-primary hover:underline">调用明细与模型设置 →</button>
          </div>
          <div className="mt-space-md grid grid-cols-2 lg:grid-cols-5 gap-2">
            {[
              ['今日 Token', modelStatus ? Number(modelStatus.today.tokens || 0).toLocaleString() : '读取中…'],
              ['今日输入 / 输出', modelStatus ? `${Number(modelStatus.today.inputTokens || 0).toLocaleString()} / ${Number(modelStatus.today.outputTokens || 0).toLocaleString()}` : '—'],
              ['今日费用估算', modelStatus?.today?.pricedCalls ? `¥${Number(modelStatus.today.estimatedCostCny || 0).toFixed(4)}` : '暂无单价'],
              ['累计 Token', modelStatus ? Number(modelStatus.allTime.tokens || 0).toLocaleString() : '读取中…'],
              ['累计费用估算', modelStatus?.allTime?.pricedCalls ? `¥${Number(modelStatus.allTime.estimatedCostCny || 0).toFixed(4)}` : '暂无单价']
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg bg-surface-container-low px-3 py-2.5">
                <p className="truncate text-label-sm text-on-surface-variant">{label}</p>
                <p className="mt-1 truncate font-label-mono text-body-md font-bold text-on-surface" title={value}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-space-lg border-t border-outline-variant/20 pt-space-md">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface">近一年 Token 日历</h3>
                <p className="mt-0.5 text-label-sm text-on-surface-variant">
                  {modelStatus ? `${yearTokens.toLocaleString()} tokens · ${activeDays} 天有调用` : '正在读取每日用量…'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant" aria-label="颜色越深，Token 消耗越多">
                <span>少</span>
                {['bg-surface-container-high', 'bg-green-200', 'bg-green-400', 'bg-green-600', 'bg-green-800'].map((color) => (
                  <span key={color} className={`h-3 w-3 rounded-[3px] border border-black/5 ${color}`} />
                ))}
                <span>多</span>
              </div>
            </div>
            {calendarWeeks.length > 0 ? (
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[790px]">
                  <div className="mb-1 grid grid-flow-col auto-cols-[12px] gap-[3px] pl-7 text-[10px] text-on-surface-variant">
                    {calendarWeeks.map((week, weekIndex) => {
                      const firstDate = week.find(Boolean)?.date;
                      const monthStart = week.find((day) => day?.date.endsWith('-01'))?.date;
                      const labelDate = monthStart || (weekIndex === 0 ? firstDate : null);
                      return <span key={`month-${weekIndex}`} className="overflow-visible whitespace-nowrap">{labelDate ? `${Number(labelDate.slice(5, 7))}月` : ''}</span>;
                    })}
                  </div>
                  <div className="flex gap-[3px]">
                    <div className="mr-1 grid grid-rows-7 gap-[3px] text-[9px] leading-3 text-on-surface-variant">
                      {['一', '', '三', '', '五', '', '日'].map((label, index) => <span key={`weekday-${index}`} className="h-3 w-5">{label}</span>)}
                    </div>
                    <div className="grid grid-flow-col grid-rows-7 auto-cols-[12px] gap-[3px]">
                      {calendarWeeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => {
                        if (!day) return <span key={`empty-${weekIndex}-${dayIndex}`} className="h-3 w-3" aria-hidden="true" />;
                        const tokens = Number(day.tokens) || 0;
                        const level = tokens === 0 ? 0 : tokens <= tokenThresholds[0] ? 1 : tokens <= tokenThresholds[1] ? 2 : tokens <= tokenThresholds[2] ? 3 : 4;
                        const shades = ['bg-surface-container-high', 'bg-green-200', 'bg-green-400', 'bg-green-600', 'bg-green-800'];
                        const dateLabel = TOKEN_DAY_FORMATTER.format(new Date(`${day.date}T00:00:00Z`));
                        return <span key={day.date} className={`h-3 w-3 rounded-[3px] border border-black/5 ${shades[level]}`} title={`${dateLabel} · ${tokens.toLocaleString()} tokens · ${day.calls || 0} 次调用`} aria-label={`${dateLabel}，${tokens.toLocaleString()} tokens`} />;
                      }))}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-on-surface-variant">颜色按有调用日期的 Token 消耗分布加深。历史从已有本机记录开始，之后按天持续保存。</p>
                </div>
              </div>
            ) : <p className="py-6 text-center text-label-sm text-on-surface-variant">读取日历用量中…</p>}
          </div>
          {modelStatus?.model?.providerMode === 'deepseek-official' && (
            <p className="mt-3 flex items-center gap-1.5 text-label-sm text-secondary">
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              DeepSeek 钱包 {modelStatus.balance?.balances?.find((item) => item.currency === 'CNY')
                ? `¥${modelStatus.balance.balances.find((item) => item.currency === 'CNY').totalBalance.toFixed(2)}`
                : (modelStatus.balanceError || '余额查询中')}
            </p>
          )}
        </section>

        {/* Quick Launch & Recommendation Deck */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-space-xl">
          {/* Recommended Exam */}
          <div className="lg:col-span-2 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">recommend</span>
                  <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    最近试卷
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('paper-library')}
                  className="text-label-md text-primary hover:underline cursor-pointer"
                >
                  试卷库全部 &rarr;
                </button>
              </div>

              <div className="mt-space-md space-y-space-md">
                {papers.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center p-6 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">
                    <span className="material-symbols-outlined text-[32px] text-primary mb-2 opacity-80">note_add</span>
                    <p className="text-body-md font-medium text-on-surface">暂无试卷</p>
                    <p className="text-body-sm text-on-surface-variant mt-1 mb-4">
                      进入「智能组卷」大厅快速导入真题或通过 Markdown 智能转卷生成第一份试卷。
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('exam-generator')}
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold text-center transition-all cursor-pointer shadow-xs"
                    >
                      立即智能组卷
                    </button>
                  </div>
                ) : (
                  papers.slice(0, 2).map((paper) => (
                    <div
                      key={paper.id}
                      onClick={() => onStartExam(paper)}
                      className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-between group border border-outline-variant/20"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded font-sans text-[11px] font-medium ${
                            paper.status === '已封卷'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                              : paper.status === '考试中'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-surface-container-lowest text-primary border border-outline-variant/20'
                          }`}>
                            {paper.status === '已封卷' ? '🔏 已封卷 (封盘)' : paper.status === '考试中' ? '● 考试中' : paper.source}
                          </span>
                          <h4 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors font-semibold">
                            {paper.title}
                          </h4>
                        </div>
                        <p className="text-body-sm text-on-surface-variant font-sans">
                          共 {paper.questionCount} 题 · 满分 {paper.totalScore} 分 · {paper.secondsLeft !== undefined ? `剩余考时 ~${Math.ceil(paper.secondsLeft / 60)}m` : `建议 ${paper.duration} 分钟`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`px-3.5 py-1.5 rounded-lg text-white font-sans text-[12px] font-semibold shadow-xs group-hover:scale-105 transition-transform ${
                          paper.status === '已封卷'
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : 'bg-primary hover:bg-primary-container'
                        }`}
                      >
                        {paper.status === '已封卷' ? '启封继续' : paper.status === '考试中' ? '继续考试' : '开考'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-space-lg p-space-sm bg-surface-container-lowest rounded-lg border border-outline-variant/20 flex items-center justify-between text-body-sm text-on-surface-variant">
              <span>💡 提示：你可以直接拖曳历年期末考试或真题 PDF 进「智能组卷」，10 秒内完成全卷结构还原。</span>
            </div>
          </div>

          {/* Quick Learning Path */}
          <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="space-y-space-md">
              <div className="flex items-center gap-2 pb-space-xs border-b border-surface-container">
                <span className="material-symbols-outlined text-secondary text-[20px]">track_changes</span>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  答题概况
                </h3>
              </div>

              {submissions.length === 0 ? (
                <div className="py-6 text-center text-on-surface-variant flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-[32px] text-outline mb-2">analytics</span>
                  <p className="text-body-sm font-medium text-on-surface">暂无模考态势数据</p>
                  <p className="text-[12px] text-on-surface-variant mt-1 leading-relaxed">
                    完成考试并交卷后，这里会根据实际作答记录汇总答题情况。
                  </p>
                </div>
              ) : (
                <div className="space-y-3 font-label-sm">
                  <div>
                    <div className="flex justify-between text-on-surface mb-1">
                      <span>选择题答对率</span>
                      <span className="font-mono text-secondary font-semibold">
                        {Math.round(
                          (submissions.flatMap((s) => s.questions || []).filter((q) => q.type?.includes('选择') && q.isCorrect).length /
                            Math.max(1, submissions.flatMap((s) => s.questions || []).filter((q) => q.type?.includes('选择')).length)) * 100
                        )}%
                      </span>
                    </div>
                    <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-secondary h-full rounded-full"
                        style={{
                          width: `${Math.round(
                            (submissions.flatMap((s) => s.questions || []).filter((q) => q.type?.includes('选择') && q.isCorrect).length /
                              Math.max(1, submissions.flatMap((s) => s.questions || []).filter((q) => q.type?.includes('选择')).length)) * 100
                          )}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-on-surface mb-1">
                      <span>自动核对得分率</span>
                      <span className="font-mono text-primary font-semibold">
                        {Math.round(
                          (submissions.reduce((acc, s) => acc + (s.score || 0), 0) /
                            Math.max(1, submissions.reduce((acc, s) => acc + (s.totalScore || 100), 0))) * 100
                        )}%
                      </span>
                    </div>
                    <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{
                          width: `${Math.round(
                            (submissions.reduce((acc, s) => acc + (s.score || 0), 0) /
                              Math.max(1, submissions.reduce((acc, s) => acc + (s.totalScore || 100), 0))) * 100
                          )}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('question-bank')}
              className="mt-space-lg w-full py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-md font-semibold text-center transition-colors cursor-pointer"
            >
              查看错题本
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
