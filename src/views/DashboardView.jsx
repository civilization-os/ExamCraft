import React from 'react';

export default function DashboardView({ onNavigate, papers, onStartExam }) {
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
    : '86.4';

  const stats = [
    {
      label: '库中总试卷数',
      value: `${papers.length} 份`,
      icon: 'description',
      color: 'text-primary',
      change: '涵盖真题克隆与智能组卷'
    },
    {
      label: '考场模拟平均分',
      value: `${avgScore} 分`,
      icon: 'military_tech',
      color: 'text-primary',
      change: submissions.length > 0 ? `基于 ${submissions.length} 次真实模考测算` : '已接入智能判卷系统'
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
              掌控考点脉络，重构命题与考练闭环
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              支持真实考卷 1:1 原貌克隆与多模态公式向量化、自由规格智能编排试题矩阵，配备闭卷专注考场与 AI 规范代笔系统。
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

        {/* Quick Launch & Recommendation Deck */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-space-xl">
          {/* Recommended Exam */}
          <div className="lg:col-span-2 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">recommend</span>
                  <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    今日高频推荐模拟卷
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
                {papers.slice(0, 2).map((paper) => (
                  <div
                    key={paper.id}
                    onClick={() => onStartExam(paper)}
                    className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-between group border border-outline-variant/20"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-surface-container-lowest font-label-mono text-label-mono text-primary font-medium">
                          {paper.source}
                        </span>
                        <h4 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors font-semibold">
                          {paper.title}
                        </h4>
                      </div>
                      <p className="text-body-sm text-on-surface-variant font-label-mono">
                        共 {paper.questionCount} 题 · 满分 {paper.totalScore} 分 · 建议 {paper.duration} 分钟 · 难度 ★★★★☆
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm font-semibold shadow-xs group-hover:scale-105 transition-transform"
                    >
                      开考
                    </button>
                  </div>
                ))}
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
                  考纲知识点攻防态势
                </h3>
              </div>

              <div className="space-y-3 font-label-sm">
                <div>
                  <div className="flex justify-between text-on-surface mb-1">
                    <span>多元函数微分学与极值</span>
                    <span className="font-mono text-secondary font-semibold">92% 掌握</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className="bg-secondary h-full rounded-full" style={{ width: '92%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-on-surface mb-1">
                    <span>定积分应用与有理分式积分</span>
                    <span className="font-mono text-primary font-semibold">78% 掌握</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: '78%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-on-surface mb-1">
                    <span>线性代数特征值与二次型</span>
                    <span className="font-mono text-tertiary font-semibold">64% 待巩固</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className="bg-tertiary h-full rounded-full" style={{ width: '64%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-on-surface mb-1">
                    <span>常微分方程初值解题通法</span>
                    <span className="font-mono text-secondary font-semibold">88% 掌握</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className="bg-secondary h-full rounded-full" style={{ width: '88%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('question-bank')}
              className="mt-space-lg w-full py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-md font-semibold text-center transition-colors cursor-pointer"
            >
              一键针对薄弱点生成专项特训卷
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
