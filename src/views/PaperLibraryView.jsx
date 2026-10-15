import React, { useState } from 'react';
import { INITIAL_SUBMISSIONS } from '../data/mockData';

export default function PaperLibraryView({ papers, onStartExam, onNavigate, onViewSubmission }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [paperList, setPaperList] = useState(papers);

  // Submissions history state from localStorage with fallback to INITIAL_SUBMISSIONS
  const [submissions, setSubmissions] = useState(() => {
    try {
      const raw = localStorage.getItem('examcraft_submissions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      localStorage.setItem('examcraft_submissions', JSON.stringify(INITIAL_SUBMISSIONS));
    } catch {}
    return INITIAL_SUBMISSIONS;
  });
  const [selectedHistoryPaper, setSelectedHistoryPaper] = useState(null);
  const [activeMenuPaperId, setActiveMenuPaperId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };


  // Modals
  const [selectedPreviewPaper, setSelectedPreviewPaper] = useState(null);
  const [selectedReportPaper, setSelectedReportPaper] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState('');

  // AI Import Paper State
  const [importRawText, setImportRawText] = useState('');
  const [importFileName, setImportFileName] = useState('2025届高数期末测试卷.pdf');
  const [isAiImporting, setIsAiImporting] = useState(false);
  const [importSuccessPaper, setImportSuccessPaper] = useState(null);

  const handleAiImportPaper = async () => {
    const textToParse = importRawText.trim() || `2025届高等数学期末统考真题
一、单项选择题
1. 当 x 趋于 0 时，极限 lim x->0 (sin 3x) / x 等于多少？
A. 1  B. 3  C. 0  D. 不存在
答案是B，因为等价无穷小sin3x ~ 3x。

二、填空题
2. 计算定积分 ∫_0^1 (3x^2 + 2x) dx 的值。
答案是 2。原式 = [x^3 + x^2]_0^1 = 2。

三、综合计算解答题
3. 求不定积分 ∫ x^2 ln(x+1) dx 的解析通解。
解析: 采用分部积分法，设 u = ln(x+1), dv = x^2 dx。`;

    setIsAiImporting(true);
    try {
      const res = await fetch('/api/model/ai-import-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContent: textToParse,
          fileName: importFileName
        })
      });
      const data = await res.json();
      if (data.success && data.paper) {
        setPaperList(prev => [data.paper, ...prev]);
        setImportSuccessPaper(data.paper);
      } else {
        alert(data.error || 'AI 导入解析失败，请检查 API Key 配置。');
      }
    } catch (err) {
      alert(`AI 导入异常: ${err.message}`);
    } finally {
      setIsAiImporting(false);
    }
  };

  // Toggle star
  const handleToggleStar = (id) => {
    setPaperList(prev => prev.map(p => p.id === id ? { ...p, starred: !p.starred } : p));
  };

  // Filter & Search
  const filteredPapers = paperList.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (activeCategory === '全部') return matchesSearch;
    if (activeCategory === '已星标') return matchesSearch && p.starred;
    return matchesSearch && p.category === activeCategory;
  }).sort((a, b) => {
    if (sortBy === 'score-desc') return b.totalScore - a.totalScore;
    if (sortBy === 'diff-desc') return b.difficulty - a.difficulty;
    return 0; // default date order
  });

  const categories = [
    { label: '全部', count: paperList.length },
    { label: '考研真题', count: paperList.filter(p => p.category === '考研真题').length },
    { label: '高校期末', count: paperList.filter(p => p.category === '高校期末').length },
    { label: '章节小测', count: paperList.filter(p => p.category === '章节小测').length },
    { label: '薄弱强化', count: paperList.filter(p => p.category === '薄弱强化').length },
    { label: '已星标', count: paperList.filter(p => p.starred).length, isStar: true }
  ];

  const handleSaveNote = (id) => {
    setPaperList(prev => prev.map(p => p.id === id ? { ...p, note: noteText } : p));
    setEditingNoteId(null);
  };

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-margin-desktop py-space-xl flex flex-col gap-space-xl">
        {/* 1. Header Area: Workstation Telemetry & Action Panel */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30">
          <div className="flex flex-col gap-space-xs max-w-3xl">
            <div className="flex items-center gap-space-sm">
              <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-label-mono text-label-mono uppercase tracking-wider font-semibold">
                Repository Node
              </span>
              <span className="text-outline-variant font-label-mono text-label-mono">/</span>
              <span className="text-on-surface-variant font-label-mono text-label-mono">STORAGE OCCUPANCY: {paperList.length} ARTIFACTS</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
              试卷库 (Exam Repository)
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              集中管理历年真题与智能生成的模拟卷，支持多维标注、标签体系与快速入场开考，实时同构评估模型并追踪知识点攻防表现。
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-space-sm shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-space-xs px-3 h-9 rounded bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-md text-label-md shadow-sm transition-all hover:shadow border border-outline-variant/40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px] text-on-surface-variant">upload_file</span>
              <span>导入新试卷 (PDF/Word)</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('exam-generator')}
              className="inline-flex items-center gap-space-xs px-3.5 h-9 rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md shadow-sm transition-all hover:shadow active:scale-[0.99] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              <span>+ 智能生成新卷</span>
            </button>
          </div>
        </section>

        {/* 2. Filtering & Workbench Control Strip */}
        <section className="flex flex-col gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/30">
          {/* Search & Controls Top Tier */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
            {/* Search Input with Scope Icon */}
            <div className="relative flex-1 min-w-[280px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索试卷名称、知识点（例如：高数、特征值、多元微分）..."
                className="w-full h-9 pl-9 pr-12 text-body-md font-body-md bg-surface-container-low text-on-surface placeholder:text-outline rounded focus:outline-none focus:bg-surface-container-lowest transition-all border border-outline-variant/30"
              />
              <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface-container-lowest font-label-mono text-[10px] text-on-surface-variant shadow-xs border border-outline-variant/30">
                ⌘K
              </kbd>
            </div>

            {/* Sorting & Views Controls */}
            <div className="flex items-center gap-space-sm flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded border border-outline-variant/30">
                <span className="material-symbols-outlined text-on-surface-variant text-[16px]">swap_vert</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">排序:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-label-md text-label-md text-on-surface focus:outline-none cursor-pointer pr-1"
                >
                  <option value="date-desc">按导入时间 (由新到旧)</option>
                  <option value="score-desc">按总分值 (由高到低)</option>
                  <option value="diff-desc">按试卷难度等级</option>
                </select>
              </div>

              {/* View Mode Toggles */}
              <div className="flex items-center bg-surface-container-low p-0.5 rounded border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                  title="网格卡片视图"
                >
                  <span className="material-symbols-outlined text-[18px] block">grid_view</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition-all cursor-pointer ${viewMode === 'list' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                  title="紧凑列表视图"
                >
                  <span className="material-symbols-outlined text-[18px] block">view_headline</span>
                </button>
              </div>
            </div>
          </div>

          {/* Categories & Tag Navigation Pill Bar */}
          <div className="flex items-center justify-between gap-space-md pt-space-xs overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 shrink-0">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setActiveCategory(cat.label)}
                    className={`px-3 py-1 rounded-full font-label-mono text-label-mono transition-all flex items-center gap-1 cursor-pointer ${
                      isActive
                        ? 'bg-primary-container text-on-primary font-medium shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {cat.isStar && (
                      <span className="material-symbols-outlined text-[14px] text-tertiary-container material-symbols-fill">star</span>
                    )}
                    <span>{cat.label}</span>
                    <span className={isActive ? 'opacity-80' : 'text-outline'}>{cat.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. Exam Card Matrix Grid */}
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 xl:grid-cols-2 gap-space-lg' : 'flex flex-col gap-space-md'}>
          {filteredPapers.map((paper) => {
            const isEditingNote = editingNoteId === paper.id;
            return (
              <article
                key={paper.id}
                className="group bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative border border-outline-variant/30"
              >
                <div className={`absolute top-0 left-0 bottom-0 w-1 ${paper.sourceType === 'clone' ? 'bg-primary' : 'bg-secondary-fixed-dim'}`}></div>

                <div className="p-space-lg pl-[calc(1rem+6px)] flex flex-col gap-space-md">
                  {/* Top Row: Source, Time, Bookmark */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container font-label-mono text-label-mono text-primary font-medium">
                        <span className="material-symbols-outlined text-[13px]">
                          {paper.sourceType === 'clone' ? 'picture_as_pdf' : 'neurology'}
                        </span>
                        {paper.source}
                      </span>
                      <span className="text-on-surface-variant font-label-mono text-label-mono">{paper.date}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleStar(paper.id)}
                      className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-container-low transition-colors cursor-pointer"
                      title="星标试卷"
                    >
                      <span className={`material-symbols-outlined text-[18px] ${paper.starred ? 'text-tertiary-container material-symbols-fill' : 'text-outline-variant'}`}>
                        star
                      </span>
                    </button>
                  </div>

                  {/* Title & Specs */}
                  <div className="flex flex-col gap-1.5">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors flex items-center gap-2 font-semibold">
                      <span>{paper.title}</span>
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-on-surface-variant font-body-sm text-body-sm">
                      <span className="flex items-center gap-1 font-label-mono text-label-mono">
                        <span className="material-symbols-outlined text-[14px] text-outline">format_list_numbered</span>
                        共 {paper.questionCount} 题
                      </span>
                      <span>·</span>
                      <span className="font-label-mono text-label-mono">满分 {paper.totalScore} 分</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-label-mono text-label-mono">
                        <span className="material-symbols-outlined text-[14px] text-outline">schedule</span>
                        建议 {paper.duration} 分钟
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-label-sm text-label-sm text-tertiary">
                        难度: <span className="tracking-widest">{'★'.repeat(paper.difficulty)}{'☆'.repeat(5 - paper.difficulty)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {paper.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-mono text-[11px]">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Candidate Note Editor Box */}
                  <div
                    onClick={() => {
                      if (!isEditingNote) {
                        setEditingNoteId(paper.id);
                        setNoteText(paper.note || '');
                      }
                    }}
                    className="bg-surface-container-low/70 rounded-lg p-space-sm flex items-start gap-space-sm group/note cursor-pointer hover:bg-surface-container-low transition-colors border border-outline-variant/20"
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant mt-0.5">edit_note</span>
                    <div className="flex-1 min-w-0">
                      {isEditingNote ? (
                        <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className="w-full px-2 py-1 bg-surface-container-lowest rounded text-body-sm border border-primary focus:outline-none"
                            autoFocus
                          />
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-0.5 text-label-sm text-on-surface-variant hover:bg-surface-container rounded"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveNote(paper.id)}
                              className="px-2 py-0.5 text-label-sm bg-primary text-on-primary rounded font-medium"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="font-body-sm text-body-sm text-on-surface truncate">
                          {paper.note || '点击添加复习备忘或知识点攻防要点...'}
                        </p>
                      )}
                    </div>
                    {!isEditingNote && (
                      <span className="font-label-mono text-[10px] text-outline opacity-0 group-hover/note:opacity-100 transition-opacity">
                        点击编辑
                      </span>
                    )}
                  </div>

                  {/* Answer Telemetry Metric Strip */}
                  {(() => {
                    const paperSubs = submissions.filter(
                      (s) => s.paperId === paper.id || s.paperTitle === paper.title
                    );
                    const hasAttempts = paperSubs.length > 0;
                    const realHighest = hasAttempts ? Math.max(...paperSubs.map((s) => s.score)) : paper.highestScore;
                    const realAttempts = hasAttempts ? paperSubs.length : (paper.attempts || 0);

                    if (realAttempts > 0) {
                      return (
                        <div className="grid grid-cols-3 gap-space-xs bg-surface-container-lowest p-2 rounded-lg shadow-xs border border-outline-variant/20">
                          <div className="flex flex-col">
                            <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">Highest Score</span>
                            <span className="font-label-mono text-label-md text-secondary font-semibold">
                              {realHighest} <span className="text-[11px] font-normal text-on-surface-variant">/ {paper.totalScore}</span>
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">Attempts</span>
                            <span className="font-label-mono text-label-md text-on-surface font-semibold">{realAttempts} 次作答</span>
                            {hasAttempts && (
                              <button
                                type="button"
                                onClick={() => setSelectedHistoryPaper({ paper, submissions: paperSubs })}
                                className="text-primary hover:underline text-[10px] font-label-mono text-left cursor-pointer font-medium mt-0.5"
                              >
                                回看历次记录 &gt;
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">Identified Flaws</span>
                            <span className="font-label-mono text-label-md text-tertiary font-semibold">{paper.flaws || 0} 处典型错因</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded-lg shadow-xs border border-outline-variant/20">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                          <span className="font-label-mono text-label-sm text-on-surface-variant">STATUS:</span>
                          <span className="font-label-mono text-label-sm text-secondary font-semibold">{paper.status}</span>
                        </div>
                        <span className="font-label-mono text-[11px] text-outline">预计平均完成用时 ~{Math.round(paper.duration * 0.75)}m</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer Action Strip */}
                {(() => {
                  const paperSubs = submissions.filter(
                    (s) => s.paperId === paper.id || s.paperTitle === paper.title
                  );
                  const latestSub = paperSubs[0] || null;

                  return (
                    <div className="bg-surface-container-low px-space-lg py-2.5 flex items-center justify-between gap-space-sm border-t border-outline-variant/20 flex-wrap">
                      <div className="flex items-center gap-space-xs flex-wrap">
                        <button
                          type="button"
                          onClick={() => onStartExam(paper)}
                          className="inline-flex items-center gap-1 px-3 h-7.5 rounded bg-primary-container hover:bg-primary text-on-primary font-label-sm text-label-sm transition-all shadow-xs cursor-pointer active:scale-95 font-medium"
                        >
                          <span className="material-symbols-outlined text-[15px]">fullscreen</span>
                          进入考场 (专注模式)
                        </button>

                        {/* Direct Jump to Latest Submission Review */}
                        {latestSub && (
                          <button
                            type="button"
                            onClick={() => {
                              if (onViewSubmission) onViewSubmission(latestSub);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 h-7.5 rounded bg-secondary-container/40 hover:bg-secondary-container text-secondary font-label-sm text-label-sm transition-colors shadow-xs border border-secondary/30 cursor-pointer font-semibold"
                            title={`查看最新一次交卷复盘报告 (${latestSub.score}分)`}
                          >
                            <span className="material-symbols-outlined text-[15px]">analytics</span>
                            <span>AI 判卷复盘 ({latestSub.score}分)</span>
                          </button>
                        )}

                        {/* History Records Button if multiple attempts */}
                        {paperSubs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedHistoryPaper({ paper, submissions: paperSubs })}
                            className="inline-flex items-center gap-1 px-2.5 h-7.5 rounded bg-surface-container-lowest hover:bg-surface text-on-surface font-label-sm text-label-sm transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
                            title={`回看此卷全部 ${paperSubs.length} 次作答提交报告`}
                          >
                            <span className="material-symbols-outlined text-[15px]">history</span>
                            <span>作答记录 ({paperSubs.length})</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedPreviewPaper(paper)}
                          className="inline-flex items-center gap-1 px-2.5 h-7.5 rounded bg-surface-container-lowest hover:bg-surface text-on-surface font-label-sm text-label-sm transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
                        >
                          大试卷总览
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (latestSub && onViewSubmission) {
                              onViewSubmission(latestSub);
                            } else {
                              setSelectedReportPaper(paper);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 h-7.5 rounded bg-surface-container-lowest hover:bg-surface text-on-surface font-label-sm text-label-sm transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
                        >
                          诊断报告
                        </button>
                      </div>

                      {/* Modern Dropdown Popover Action instead of alert */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuPaperId(activeMenuPaperId === paper.id ? null : paper.id);
                          }}
                          className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors cursor-pointer"
                          title="更多操作"
                        >
                          <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                        </button>

                        {activeMenuPaperId === paper.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 bottom-full mb-1 w-48 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/40 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150 text-body-sm text-on-surface"
                          >
                            {paperSubs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuPaperId(null);
                                  setSelectedHistoryPaper({ paper, submissions: paperSubs });
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors text-left cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px] text-primary">history</span>
                                <span>历次作答记录 ({paperSubs.length})</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuPaperId(null);
                                showToast(`已将《${paper.title}》加入快速导出任务列表`);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors text-left cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px] text-secondary">file_download</span>
                              <span>导出本卷 PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuPaperId(null);
                                handleToggleStar(paper.id);
                                showToast(paper.starred ? `已取消星标《${paper.title}》` : `已星标收藏《${paper.title}》`);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors text-left cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px] text-tertiary">
                                {paper.starred ? 'star_half' : 'star'}
                              </span>
                              <span>{paper.starred ? '取消星标' : '设为重点星标'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuPaperId(null);
                                setSelectedPreviewPaper(paper);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors text-left cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px] text-outline">visibility</span>
                              <span>大试卷排版总览</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </article>
            );
          })}
        </div>
      </div>

      {/* Modal 1: 大试卷总览 Modal */}
      {selectedPreviewPaper && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-xl shadow-xl border border-outline-variant/40 space-y-space-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-label-mono">
                  试卷结构总览
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-1">
                  {selectedPreviewPaper.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewPaper(null)}
                className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-space-sm text-body-md text-on-surface-variant">
              <div className="grid grid-cols-3 gap-2 text-center p-space-sm bg-surface-container-low rounded-lg font-label-mono">
                <div>总题量: <span className="font-bold text-on-surface">{selectedPreviewPaper.questionCount} 题</span></div>
                <div>总分值: <span className="font-bold text-primary">{selectedPreviewPaper.totalScore} 分</span></div>
                <div>时限: <span className="font-bold text-on-surface">{selectedPreviewPaper.duration} 分钟</span></div>
              </div>
              <div className="p-space-md bg-surface-container-low rounded-lg space-y-2">
                <p className="font-semibold text-on-surface">题型结构构成：</p>
                <ul className="list-disc pl-5 space-y-1 font-body-sm">
                  <li>第一部分：单项选择题（8 题，每题 5 分，共 40 分）</li>
                  <li>第二部分：填空题（5 题，每题 4 分，共 20 分）</li>
                  <li>第三部分：综合计算与解答证明题（4 题，每题 10 分，共 40 分）</li>
                </ul>
              </div>
              <p className="text-body-sm italic">
                备忘说明：{selectedPreviewPaper.note || '暂无标注'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setSelectedPreviewPaper(null)}
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
              >
                关闭预览
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = selectedPreviewPaper;
                  setSelectedPreviewPaper(null);
                  onStartExam(p);
                }}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md shadow-sm hover:bg-primary-container cursor-pointer"
              >
                立即进入该考场
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: 诊断报告 Modal */}
      {selectedReportPaper && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-xl shadow-xl border border-outline-variant/40 space-y-space-md">
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container">
              <div>
                <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-mono text-label-mono">
                  AI 知识点攻防诊断报告
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-1">
                  {selectedReportPaper.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportPaper(null)}
                className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-space-md text-body-md">
              <div className="flex items-center justify-between p-space-md bg-surface-container-low rounded-xl">
                <div>
                  <p className="text-label-mono text-on-surface-variant">HISTORIC HIGHEST</p>
                  <p className="text-headline-lg font-bold text-secondary font-label-mono">
                    {selectedReportPaper.highestScore ?? '--'} <span className="text-body-md font-normal">/ {selectedReportPaper.totalScore}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-label-mono text-on-surface-variant">ATTEMPTS</p>
                  <p className="text-headline-lg font-bold text-on-surface font-label-mono">{selectedReportPaper.attempts} 次</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-on-surface text-label-md">检测到的典型易错考点：</h4>
                <div className="p-space-sm bg-error-container/30 border border-error-container rounded-lg space-y-1">
                  <p className="text-on-error-container font-medium text-body-sm">
                    ⚠️ 第 16 题：分部积分法与有理假分式长除符号漏乘
                  </p>
                  <p className="text-on-surface-variant text-code-sm">
                    归因分析：负号分配律错误导致最后通解相差常数项。建议强化多项式长除与换元拆解。
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setSelectedReportPaper(null)}
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: AI 智能导入试卷 Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container">
              <div>
                <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-mono text-label-mono font-semibold">
                  model_core 驱动 · AI 格式深度分析
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-1">
                  导入试卷 (PDF / Word / 文本大模型解析)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportSuccessPaper(null);
                }}
                className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {importSuccessPaper ? (
              <div className="p-space-md bg-secondary/10 border border-secondary/30 rounded-xl space-y-space-sm text-body-md animate-in fade-in">
                <div className="flex items-center gap-2 text-secondary font-semibold font-headline-sm">
                  <span className="material-symbols-outlined text-[24px]">verified</span>
                  <span>AI 解析完成！试卷已成功入库</span>
                </div>
                <div className="bg-surface-container-lowest p-space-sm rounded-lg space-y-1 text-on-surface">
                  <p className="font-bold text-headline-sm">{importSuccessPaper.title}</p>
                  <p className="text-body-sm text-on-surface-variant font-label-mono">
                    总分: <span className="font-bold text-primary">{importSuccessPaper.totalScore}</span> 分 · 
                    总题量: <span className="font-bold text-secondary">{importSuccessPaper.questionCount}</span> 题 · 
                    建议时限: {importSuccessPaper.duration} 分钟
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-secondary/20">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setImportSuccessPaper(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
                  >
                    留在试卷库
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = importSuccessPaper;
                      setIsImportModalOpen(false);
                      setImportSuccessPaper(null);
                      onStartExam(p);
                    }}
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md shadow-sm cursor-pointer"
                  >
                    🚀 立即进入该考场开考
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-space-sm">
                {/* File Dropzone */}
                <label className="p-space-md border-2 border-dashed border-primary-fixed-dim hover:border-primary rounded-xl text-center bg-surface-container-low transition-colors cursor-pointer block">
                  <input
                    type="file"
                    accept=".pdf,.docx,.tex,.md,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImportFileName(file.name);
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setImportRawText(ev.target.result);
                        };
                        try {
                          reader.readAsText(file);
                        } catch {}
                      }
                    }}
                    className="hidden"
                  />
                  <span className="material-symbols-outlined text-[32px] text-primary">upload_file</span>
                  <p className="mt-1 font-label-md font-semibold text-on-surface">
                    点击选择试卷文件或拖拽至此
                  </p>
                  <p className="font-label-mono text-[11px] text-on-surface-variant">
                    已选: {importFileName} (支持 PDF, Word, TXT, Markdown)
                  </p>
                </label>

                {/* Direct Paste Raw Textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                      或者直接粘贴试卷题目/整卷文本：
                    </label>
                    <button
                      type="button"
                      onClick={() => setImportRawText(`2025届高数期末考试仿真卷
一、单项选择题
1. 极限 lim x->0 (sin 3x)/x 等于多少？
A. 1  B. 3  C. 0  D. 不存在
答案是B，因为等价无穷小。

二、填空题
2. 计算定积分 ∫_0^1 (3x^2 + 2x) dx 的值。
答案是 2。

三、解答题
3. 求不定积分 ∫ x^2 ln(x+1) dx 的解析通解。`)}
                      className="text-primary hover:underline font-label-sm text-[12px] cursor-pointer"
                    >
                      填入示例考题测试
                    </button>
                  </div>
                  <textarea
                    value={importRawText}
                    onChange={(e) => setImportRawText(e.target.value)}
                    placeholder="可在此粘贴非结构化试卷文本，大模型将自动提取标题、题干、选项、分值与 LaTeX 公式..."
                    className="w-full h-32 p-space-sm bg-surface-container-low rounded-lg font-mono text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest border border-outline-variant/30 resize-none leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={isAiImporting}
                    onClick={handleAiImportPaper}
                    className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isAiImporting ? 'animate-spin' : ''}`}>
                      {isAiImporting ? 'progress_activity' : 'bolt'}
                    </span>
                    <span>{isAiImporting ? 'model_core 解析中...' : '⚡ 启动 AI 深度解析并入库'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: 历史作答提交记录回溯抽屉/弹窗 */}
      {selectedHistoryPaper && (
        <div className="fixed inset-0 z-50 bg-on-background/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-3xl w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container shrink-0">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-label-mono font-semibold">
                  作答历史回溯中心
                </span>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mt-1">
                  《{selectedHistoryPaper.paper.title}》· 提交记录 ({selectedHistoryPaper.submissions.length} 次作答)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryPaper(null)}
                className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Submissions List */}
            <div className="flex-1 overflow-y-auto space-y-space-sm pr-1">
              {selectedHistoryPaper.submissions.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">暂无真实作答记录。</div>
              ) : (
                selectedHistoryPaper.submissions.map((sub, idx) => {
                  const correctCount = sub.questions?.filter((q) => q.isCorrect).length || 0;
                  const wrongCount = sub.questions?.filter((q) => !q.isCorrect && q.userAnswer?.trim()).length || 0;

                  return (
                    <div
                      key={sub.id || idx}
                      className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-space-md hover:bg-surface-container transition-colors"
                    >
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-mono text-[11px] font-bold">
                            第 {selectedHistoryPaper.submissions.length - idx} 次提交
                          </span>
                          <span className="text-[12px] font-label-mono text-on-surface-variant">
                            提交时间: {sub.submitTime}
                          </span>
                        </div>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-[30px] font-mono font-bold text-secondary">
                            {sub.score}
                          </span>
                          <span className="text-body-sm font-mono text-on-surface-variant">
                            / {sub.totalScore || 100} 分
                          </span>
                          <span className="text-[12px] font-label-mono text-primary font-semibold pl-2">
                            正确率: {sub.accuracy}%
                          </span>
                          <span className="text-[11px] font-label-mono text-outline">
                            (做对 {correctCount} 题 · 答错 {wrongCount} 题)
                          </span>
                        </div>
                        {sub.aiOverallReview?.summary && (
                          <p className="text-body-sm text-on-surface-variant line-clamp-2 italic max-w-xl">
                            “{sub.aiOverallReview.summary}”
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHistoryPaper(null);
                            if (onViewSubmission) onViewSubmission(sub);
                          }}
                          className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center space-x-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>查看该次 AI 判卷复盘</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-container shrink-0">
              <button
                type="button"
                onClick={() => {
                  const p = selectedHistoryPaper.paper;
                  setSelectedHistoryPaper(null);
                  onStartExam(p);
                }}
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer flex items-center space-x-1"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                <span>再刷一次本卷</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedHistoryPaper(null)}
                className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Floating Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2 rounded-full shadow-2xl font-label-md flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}


