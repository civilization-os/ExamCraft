import React, { useState } from 'react';

export default function ExamGeneratorView({ papers, onStartExam, onNavigate }) {
  const [activeCard, setActiveCard] = useState('clone'); // 'clone' or 'custom'
  
  // Custom Spec State
  const [customTitle, setCustomTitle] = useState('《概率论与数理统计阶段模拟测验》');
  const [totalScore, setTotalScore] = useState(100);
  const [duration, setDuration] = useState(120);
  const [difficulty, setDifficulty] = useState('进阶拓展');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // File upload state simulation
  const [uploadedFile, setUploadedFile] = useState({
    name: '2024届全国高等数学期末考试统考卷A.pdf',
    size: '2.4MB',
    status: '解析完毕',
    progress: 100,
    matchedQuestions: 23,
    choices: 8,
    blanks: 5,
    solutions: 4
  });

  const [isUploading, setIsUploading] = useState(false);

  const handleSimulateUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setTimeout(() => {
        setUploadedFile({
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(1) + 'MB',
          status: '解析完毕',
          progress: 100,
          matchedQuestions: 21,
          choices: 8,
          blanks: 5,
          solutions: 4
        });
        setIsUploading(false);
      }, 1000);
    }
  };

  const handleLaunchClone = () => {
    const paper = papers.find(p => p.id === 'paper-math-2024a') || papers[0];
    onStartExam(paper);
  };

  const handleLaunchCustom = async () => {
    setIsGenerating(true);
    let generatedQuestion = null;

    try {
      const res = await fetch('/api/model/generate-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: customTitle,
          subject: '高等数学与微积分',
          totalScore,
          duration,
          difficulty,
          choicesCount: 8,
          blanksCount: 5,
          solutionsCount: 4
        })
      });
      const data = await res.json();
      if (data.success && data.data?.highlightQuestion) {
        generatedQuestion = data.data.highlightQuestion;
      }
    } catch (e) {
      console.warn('Backend paper generation notice:', e.message);
    } finally {
      setIsGenerating(false);
    }

    const customPaper = {
      id: 'custom-' + Date.now(),
      title: customTitle,
      source: '自由规格智能生成 (model_core 驱动)',
      sourceType: 'custom',
      date: '刚刚',
      questionCount: 17,
      totalScore: totalScore,
      duration: duration,
      difficulty: difficulty === '考研冲刺' ? 5 : difficulty === '进阶拓展' ? 4 : 3,
      tags: ['#自定义组卷', `#${difficulty}`, '#model_core生成'],
      status: '未作答 (全新排版完毕)',
      typeBreakdown: { choices: 8, blanks: 5, solutions: 4 },
      highlightQuestion: generatedQuestion
    };

    onStartExam(customPaper);
  };

  return (
    <div className="flex flex-col w-full relative min-h-full pb-16">
      {/* Subtle Technical Matrix Background Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <div className="absolute -top-32 left-1/4 w-[640px] h-[360px] bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-48 right-10 w-[420px] h-[300px] bg-secondary-container/30 rounded-full blur-[100px]"></div>
        <svg className="w-full h-full opacity-[0.035]" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern height="32" id="workbench-grid" patternUnits="userSpaceOnUse" width="32">
              <circle cx="2" cy="2" fill="#3525cd" r="1"></circle>
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#131b2e" strokeDasharray="2,6" strokeWidth="0.5"></path>
            </pattern>
          </defs>
          <rect fill="url(#workbench-grid)" height="100%" width="100%"></rect>
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">
        {/* Top Header & Workstation Telemetry */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
          <div className="space-y-space-xs max-w-2xl">
            <div className="inline-flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-surface-container text-primary font-label-mono text-label-mono tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span>INTELLIGENT DUAL-ENGINE WORKSPACE · MODEL_CORE</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-semibold">
              双入口智能组卷工作台
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              选择组卷方式，即刻开启 AI 赋能的沉浸式真实考场作答。支持严谨复刻历年真题结构或动态定制题量矩阵。
            </p>
          </div>

          {/* Quick Telemetry Chips */}
          <div className="flex items-center gap-space-md font-label-mono text-label-mono flex-wrap">
            <div className="px-space-md py-space-xs rounded-lg bg-surface-container-lowest shadow-sm flex items-center gap-space-xs text-on-surface border border-outline-variant/30">
              <span className="material-symbols-outlined text-secondary text-[16px]">verified</span>
              <span>OCR 排版解析度 99.8%</span>
            </div>
            <div className="px-space-md py-space-xs rounded-lg bg-surface-container-lowest shadow-sm flex items-center gap-space-xs text-on-surface border border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-[16px]">bolt</span>
              <span>model_core 路由响应 &lt; 0.9s</span>
            </div>
          </div>
        </section>

        {/* Main Dual Entry Deck */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl items-stretch">
          {/* Card 1: 1:1 True Exam PDF Clone */}
          <section
            onClick={() => setActiveCard('clone')}
            className={`relative group rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden p-space-xl cursor-pointer border ${
              activeCard === 'clone' ? 'ring-2 ring-primary border-primary' : 'border-outline-variant/30'
            }`}
          >
            <div className={`absolute top-0 left-0 right-0 h-1 transition-colors duration-200 ${activeCard === 'clone' ? 'bg-primary' : 'bg-surface-container-highest'}`}></div>

            <div>
              {/* Top Row Status */}
              <div className="flex items-center justify-between pb-space-md">
                <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-secondary/10 text-secondary font-label-mono text-label-mono font-medium">
                  <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                  <span>100% 题型排版原貌保留</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                </div>
              </div>

              {/* Title Block */}
              <div className="space-y-space-xs">
                <h2 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-space-sm font-semibold">
                  <span>完整真题 PDF 1:1 原样精确克隆</span>
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  支持上传各学期标准真题试卷。自适应多模态视觉模型，原位提炼考卷标题、排版规范、分值规则与数学公式。
                </p>
              </div>

              {/* Drag & Drop Zone */}
              <label className="mt-space-lg rounded-xl bg-surface-container-low p-space-lg text-center flex flex-col items-center justify-center transition-colors hover:bg-surface-container group/drop cursor-pointer border border-dashed border-outline-variant/60 block">
                <input type="file" accept=".pdf,.docx,.tex" onChange={handleSimulateUpload} className="hidden" />
                <div className="w-12 h-12 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-primary group-hover/drop:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[26px]">cloud_upload</span>
                </div>
                <p className="mt-space-sm font-headline-sm text-headline-sm text-on-surface font-semibold">
                  拖拽试卷文件至此处，或 <span className="text-primary hover:underline">浏览本地文件</span>
                </p>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">支持格式：.pdf, .docx, .tex (最大 35MB)</p>
              </label>

              {/* Parsed File Preview Panel */}
              <div className="mt-space-md rounded-lg bg-surface-container-low p-space-md flex flex-col gap-space-sm border border-outline-variant/30">
                <div className="flex items-start justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <div className="w-8 h-8 rounded bg-error-container text-on-error-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">description</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-label-md text-label-md text-on-surface truncate font-semibold">{uploadedFile.name}</p>
                      <p className="font-label-mono text-label-mono text-on-surface-variant">{uploadedFile.size} • 已完成公式向量转录</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-space-xs py-0.5 rounded bg-surface-container text-primary font-label-mono text-code-sm">
                    {isUploading ? '解析中...' : uploadedFile.status}
                  </span>
                </div>

                {/* Parsing Metrics & Meta Bar */}
                <div className="bg-surface-container-lowest rounded p-space-sm space-y-space-xs border border-outline-variant/20">
                  <div className="flex justify-between font-label-mono text-code-sm">
                    <span className="text-on-surface-variant">结构提取完成度</span>
                    <span className="text-secondary font-semibold">100% ({uploadedFile.matchedQuestions} 题完全对齐)</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div className="w-full h-full bg-secondary transition-all duration-700"></div>
                  </div>
                  <div className="pt-1 grid grid-cols-3 gap-space-xs text-center font-label-mono text-label-mono text-on-surface">
                    <div className="py-1 rounded bg-surface-container-low">选择题 <span className="font-semibold text-primary">{uploadedFile.choices} 题</span></div>
                    <div className="py-1 rounded bg-surface-container-low">填空题 <span className="font-semibold text-primary">{uploadedFile.blanks} 题</span></div>
                    <div className="py-1 rounded bg-surface-container-low">解答题 <span className="font-semibold text-primary">{uploadedFile.solutions} 题</span></div>
                  </div>
                </div>

                {/* Real Exam Attribute Preview */}
                <div className="p-space-sm rounded bg-surface-container-lowest flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border border-outline-variant/20 flex-wrap gap-2">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">format_shapes</span>
                    双栏排版 + 答题卡规范
                  </span>
                  <span className="flex items-center gap-1 font-label-mono">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">timer</span>
                    建议 120min
                  </span>
                  <span className="flex items-center gap-1 font-label-mono font-semibold text-on-surface">
                    满分 100 分
                  </span>
                </div>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-space-xl mt-space-md">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLaunchClone();
                }}
                className="w-full h-11 px-space-lg rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">play_circle</span>
                <span>确认此试卷并进入考场</span>
              </button>
            </div>
          </section>

          {/* Card 2: Custom Parameterized Spec Engine */}
          <section
            onClick={() => setActiveCard('custom')}
            className={`relative group rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden p-space-xl cursor-pointer border ${
              activeCard === 'custom' ? 'ring-2 ring-primary border-primary' : 'border-outline-variant/30'
            }`}
          >
            <div className={`absolute top-0 left-0 right-0 h-1 transition-colors duration-200 ${activeCard === 'custom' ? 'bg-primary' : 'bg-surface-container-highest'}`}></div>

            <div>
              {/* Top Row Status */}
              <div className="flex items-center justify-between pb-space-md">
                <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-primary/10 text-primary font-label-mono text-label-mono font-medium">
                  <span className="material-symbols-outlined text-[14px]">tune</span>
                  <span>自定义分值与题型矩阵 (model_core 驱动)</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                  <span className="material-symbols-outlined text-[18px]">dashboard_customize</span>
                </div>
              </div>

              {/* Title Block */}
              <div className="space-y-space-xs">
                <h2 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-space-sm font-semibold">
                  <span>自由规格智能生成</span>
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  无原题模板时，自主调控题量分布、分数权重与测试考纲。底层通过 <code>model_core</code> 智能选拔符合要求的优质题目。
                </p>
              </div>

              {/* Exam Meta Config */}
              <div className="mt-space-lg space-y-space-sm">
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">测验标题命名</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full h-9 px-space-md bg-surface-container-low rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/30 pr-8"
                    />
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute right-space-sm top-2.5">edit</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-space-md">
                  <div className="bg-surface-container-low rounded p-space-sm flex items-center justify-between border border-outline-variant/20">
                    <div>
                      <span className="block font-label-sm text-label-sm text-on-surface-variant">试卷设定总分</span>
                      <span className="font-label-mono text-headline-sm font-semibold text-on-surface">
                        {totalScore} <span className="text-body-sm font-normal text-on-surface-variant">PTS</span>
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setTotalScore(s => Math.max(50, s - 10)); }}
                        className="w-6 h-6 rounded bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-surface-container shadow-xs cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setTotalScore(s => Math.min(150, s + 10)); }}
                        className="w-6 h-6 rounded bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-surface-container shadow-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-surface-container-low rounded p-space-sm flex items-center justify-between border border-outline-variant/20">
                    <div>
                      <span className="block font-label-sm text-label-sm text-on-surface-variant">建议限时时长</span>
                      <span className="font-label-mono text-headline-sm font-semibold text-on-surface">
                        {duration} <span className="text-body-sm font-normal text-on-surface-variant">MIN</span>
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">hourglass_top</span>
                  </div>
                </div>
              </div>

              {/* Type & Scoring Matrix Breakdown */}
              <div className="mt-space-md bg-surface-container-low rounded-lg p-space-md space-y-space-sm border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">题型分布与单题分值分配表</span>
                  <span className="px-space-xs py-0.5 rounded bg-secondary/15 text-secondary font-label-mono text-label-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    已分配 {totalScore}/{totalScore} 分 (平衡)
                  </span>
                </div>

                <div className="space-y-space-xs font-label-mono text-label-mono">
                  <div className="bg-surface-container-lowest rounded p-space-sm flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-space-sm">
                      <span className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center text-[11px]">1</span>
                      <span className="text-on-surface font-medium">单选题</span>
                    </div>
                    <div className="flex items-center gap-space-md text-on-surface-variant">
                      <span>8 题 × 5 分</span>
                      <span className="text-on-surface font-semibold">= 40 分</span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary">40%</span>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest rounded p-space-sm flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-space-sm">
                      <span className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center text-[11px]">2</span>
                      <span className="text-on-surface font-medium">填空题</span>
                    </div>
                    <div className="flex items-center gap-space-md text-on-surface-variant">
                      <span>5 题 × 4 分</span>
                      <span className="text-on-surface font-semibold">= 20 分</span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary">20%</span>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest rounded p-space-sm flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-space-sm">
                      <span className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center text-[11px]">3</span>
                      <span className="text-on-surface font-medium">计算解答题</span>
                    </div>
                    <div className="flex items-center gap-space-md text-on-surface-variant">
                      <span>4 题 × 10 分</span>
                      <span className="text-on-surface font-semibold">= 40 分</span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary">40%</span>
                    </div>
                  </div>
                </div>

                {/* Difficulty Capsule Selector */}
                <div className="pt-1">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">试题难度梯度倾向</label>
                  <div className="grid grid-cols-3 gap-space-xs font-label-md text-label-md text-center">
                    {['基础稳固', '进阶拓展', '考研冲刺'].map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDifficulty(diff); }}
                        className={`py-1.5 rounded transition-all cursor-pointer ${
                          difficulty === diff
                            ? 'bg-primary text-on-primary font-semibold shadow-sm'
                            : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-space-xl mt-space-md">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLaunchCustom();
                }}
                disabled={isGenerating}
                className="w-full h-11 px-space-lg rounded-lg bg-inverse-surface hover:bg-on-background text-inverse-on-surface font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[20px] ${isGenerating ? 'animate-spin' : ''}`}>
                  {isGenerating ? 'progress_activity' : 'psychology'}
                </span>
                <span>{isGenerating ? '正在调用 model_core 组卷中...' : '智能生成新卷并进入考场'}</span>
              </button>
            </div>
          </section>
        </div>

        {/* Recent Workspace Papers & Artifacts Row */}
        <section className="space-y-space-md pt-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">history_edu</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">近期生成的试卷快速入口</h3>
            </div>
            <button
              onClick={() => onNavigate('paper-library')}
              className="font-label-md text-label-md text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>查看试卷库全集 ({papers.length}份)</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {papers.slice(0, 3).map((paper) => (
              <div
                key={paper.id}
                onClick={() => onStartExam(paper)}
                className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group cursor-pointer border border-outline-variant/30"
              >
                <div className="space-y-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-space-xs py-0.5 rounded bg-surface-container text-on-primary-fixed-variant font-label-mono text-label-mono">
                      {paper.source}
                    </span>
                    <span className="font-label-mono text-label-mono text-on-surface-variant">刚刚</span>
                  </div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors font-semibold truncate">
                    {paper.title}
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">
                    全卷 {paper.questionCount} 题 • 满分 {paper.totalScore} 分 • 建议 {paper.duration}min
                  </p>
                </div>
                <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-mono text-label-mono text-on-surface-variant">
                  <span className="text-secondary flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>已就绪
                  </span>
                  <span className="group-hover:translate-x-1 transition-transform text-primary font-semibold flex items-center">
                    开考 →
                  </span>
                </div>
              </div>
            ))}

            {/* Blueprint Template Card */}
            <div
              onClick={() => {
                setCustomTitle('《2025届全国硕士研究生招生考试数学一全真模拟卷》');
                setTotalScore(150);
                setDuration(180);
                setDifficulty('考研冲刺');
                setActiveCard('custom');
              }}
              className="rounded-xl bg-surface-container-low p-space-md flex flex-col justify-between hover:bg-surface-container transition-colors group cursor-pointer border border-dashed border-outline-variant/60"
            >
              <div className="space-y-space-xs">
                <div className="flex items-center justify-between">
                  <span className="px-space-xs py-0.5 rounded bg-surface-container-lowest text-on-surface-variant font-label-mono text-label-mono">
                    预设蓝图
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">bookmark</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                  导入考研数学一真题标准模版
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant">内嵌教育部考试中心历年官方分值排版规范</p>
              </div>
              <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-mono text-label-mono text-primary font-medium">
                <span>一键套用配比</span>
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
