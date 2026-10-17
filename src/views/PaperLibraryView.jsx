import React, { useState, useMemo } from 'react';
import SelectMenu from '../components/SelectMenu';
import { calculatePaperMetrics } from '../utils/paperMetrics';
import { getQuestionTypeClass, isPseudoPassage } from '../utils/questionTypes';
import {
  inferPaperSubject,
  DEFAULT_SUBJECTS,
  getCustomSubjects,
  addCustomSubject,
  removeCustomSubject,
  getSubjectBadgeStyle
} from '../utils/paperSubject';

// Dynamically compute real question and section breakdown from paper
function getPaperStructure(paper) {
  if (!paper) return [];
  const questions = paper.questions || [];

  if (questions.length > 0) {
    const sectionMap = new Map();
    const typeMap = new Map();

    questions.forEach((q) => {
      const sec = (q.section || '').trim();
      const type = (q.type || '单项选择题').trim();
      const score = Number(q.score) || 0;

      if (sec) {
        const cur = sectionMap.get(sec) || { count: 0, score: 0, types: new Set() };
        cur.types.add(type);
        sectionMap.set(sec, { count: cur.count + 1, score: cur.score + score, types: cur.types });
      }

      const curType = typeMap.get(type) || { count: 0, score: 0 };
      typeMap.set(type, { count: curType.count + 1, score: curType.score + score });
    });

    if (sectionMap.size > 0) {
      return Array.from(sectionMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        score: data.score,
        typeSummary: Array.from(data.types).join(' / ')
      }));
    }

    if (typeMap.size > 0) {
      return Array.from(typeMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        score: data.score,
        typeSummary: ''
      }));
    }
  }

  // Fallback to typeBreakdown if questions array is not yet present
  if (paper.typeBreakdown) {
    const list = [];
    if (paper.typeBreakdown.choices) {
      list.push({ name: '单项选择题', count: paper.typeBreakdown.choices, score: null, typeSummary: '客观题' });
    }
    if (paper.typeBreakdown.blanks) {
      list.push({ name: '填空题', count: paper.typeBreakdown.blanks, score: null, typeSummary: '填空' });
    }
    if (paper.typeBreakdown.solutions) {
      list.push({ name: '综合主观与解答题', count: paper.typeBreakdown.solutions, score: null, typeSummary: '主观题' });
    }
    if (list.length > 0) return list;
  }

  return [
    {
      name: '综合考查试题',
      count: paper.questionCount || 0,
      score: paper.totalScore || 0,
      typeSummary: '全真试题'
    }
  ];
}

// Safely extract readable question stem or options preview
function getQuestionPreviewContent(q, idx) {
  if (!q) return '试题内容加载中...';

  // 1. Check prompt, stem, question, content, title
  const rawText = (q.prompt || q.stem || q.question || q.content || q.title || '').trim();

  // 2. Options string if available
  const optionsText = Array.isArray(q.options) && q.options.length > 0
    ? q.options.map(opt => `[${opt.key || ''}] ${opt.text || ''}`.trim()).filter(Boolean).join('  ')
    : '';

  // Check if rawText is empty or merely a question index (e.g. "1.", "[1]")
  const isPureNumber = !rawText || /^(\[?\d+\]?|\d+[\.、\s]*)$/.test(rawText);

  if (isPureNumber) {
    if (optionsText) {
      return `【选项】${optionsText}`;
    }
    if (q.passage && !isPseudoPassage(q.passage)) {
      const cleanPassage = q.passage.replace(/[#*`_]/g, '').trim();
      return `【篇章阅读】${cleanPassage.slice(0, 80)}...`;
    }
    return `试题 #${idx + 1}（${q.type || '考题'}，进入考场作答）`;
  }

  if (optionsText && rawText.length < 25) {
    return `${rawText} · ${optionsText}`;
  }

  return rawText;
}

function getPaperSubject(paper) {
  return inferPaperSubject(paper);
}

export default function PaperLibraryView({ papers, onSavePaper, onStartExam, onDeletePaper, onNavigate, onViewSubmission }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeSubject, setActiveSubject] = useState('全部科目');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [paperList, setPaperList] = useState(() => (papers || []));
  const [customSubjects, setCustomSubjects] = useState(getCustomSubjects);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [subjectEditingPaper, setSubjectEditingPaper] = useState(null);
  const [editingPaperSubject, setEditingPaperSubject] = useState('');
  const [customInputInModal, setCustomInputInModal] = useState('');

  React.useEffect(() => {
    setPaperList(papers || []);
  }, [papers]);

  // Submissions history state from localStorage with zero mock data
  const [submissions, setSubmissions] = useState(() => {
    try {
      const raw = localStorage.getItem('examcraft_submissions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Strictly purge legacy mock submission records
          return parsed.filter((s) => s && s.id !== 'sub-2024a-v1' && s.id !== 'sub-2024a-v2');
        }
      }
    } catch {}
    return [];
  });
  const [selectedHistoryPaper, setSelectedHistoryPaper] = useState(null);
  const [submissionToDelete, setSubmissionToDelete] = useState(null);
  const [activeMenuPaperId, setActiveMenuPaperId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [paperToDelete, setPaperToDelete] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const confirmDeletePaper = () => {
    if (!paperToDelete) return;
    const paper = paperToDelete;
    const belongsToPaper = (submission) =>
      submission.paperId === paper.id || (!submission.paperId && submission.paperTitle === paper.title);
    onDeletePaper?.(paper);
    setPaperList((prev) => prev.filter((item) => item.id !== paper.id));
    setSubmissions((prev) => prev.filter((submission) => !belongsToPaper(submission)));
    setPaperToDelete(null);
    showToast(`已删除《${paper.title}》及关联作答记录`);
  };

  const confirmDeleteSubmission = () => {
    if (!submissionToDelete) return;
    const target = submissionToDelete;
    const isTarget = (item) => target.id ? item.id === target.id : item === target;
    setSubmissions((prev) => {
      const next = prev.filter((item) => !isTarget(item));
      try {
        localStorage.setItem('examcraft_submissions', JSON.stringify(next));
      } catch (error) {
        console.warn('Could not save deleted submission history:', error);
      }
      return next;
    });
    setSelectedHistoryPaper((current) => current ? {
      ...current,
      submissions: current.submissions.filter((item) => !isTarget(item)),
    } : current);
    setSubmissionToDelete(null);
    showToast('已删除这条作答记录');
  };

  // Modals
  const [selectedPreviewPaper, setSelectedPreviewPaper] = useState(null);
  const [selectedReportPaper, setSelectedReportPaper] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Toggle star
  const handleToggleStar = (id) => {
    const current = paperList.find((paper) => paper.id === id);
    if (!current) return;
    onSavePaper?.({ ...current, starred: !current.starred }, false);
    setPaperList((prev) => prev.map((paper) => paper.id === id ? { ...paper, starred: !paper.starred } : paper));
  };

  // Filter & Search
  const filteredPapers = paperList.filter(p => {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const matchesSearch = `${p.title || ''} ${tags.join(' ')} ${p.subject || p.subjectName || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = activeSubject === '全部科目' || getPaperSubject(p) === activeSubject;
    if (!matchesSubject) return false;
    
    if (activeCategory === '全部') return matchesSearch;
    if (activeCategory === '已星标') return matchesSearch && p.starred;
    return matchesSearch && p.category === activeCategory;
  }).sort((a, b) => {
    if (sortBy === 'score-desc') return b.totalScore - a.totalScore;
    if (sortBy === 'diff-desc') {
      const diffB = calculatePaperMetrics(b).difficulty;
      const diffA = calculatePaperMetrics(a).difficulty;
      return diffB - diffA;
    }
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
  const subjectCounts = paperList.reduce((counts, paper) => {
    const subject = getPaperSubject(paper);
    counts.set(subject, (counts.get(subject) || 0) + 1);
    return counts;
  }, new Map());

  const allSubjectLabels = useMemo(() => {
    const set = new Set([
      ...DEFAULT_SUBJECTS,
      ...customSubjects,
      ...Array.from(subjectCounts.keys()).filter((k) => k !== '未分类')
    ]);
    return Array.from(set);
  }, [customSubjects, subjectCounts]);

  const subjects = useMemo(() => {
    const list = [
      { label: '全部科目', count: paperList.length },
      ...allSubjectLabels.map((label) => ({
        label,
        count: subjectCounts.get(label) || 0,
        isCustom: customSubjects.includes(label)
      }))
    ];
    const unclassifiedCount = subjectCounts.get('未分类') || 0;
    if (unclassifiedCount > 0) {
      list.push({ label: '未分类', count: unclassifiedCount });
    }
    return list;
  }, [paperList.length, allSubjectLabels, subjectCounts, customSubjects]);

  const handleAddCustomSubject = (rawName) => {
    const name = (rawName || newSubjectInput).trim();
    if (!name) return;
    const updated = addCustomSubject(name);
    setCustomSubjects(updated);
    setNewSubjectInput('');
    setIsAddSubjectModalOpen(false);
    setActiveSubject(name);
    showToast(`已添加科目分类「${name}」`);
  };

  const handleRemoveCustomSubject = (name) => {
    const updated = removeCustomSubject(name);
    setCustomSubjects(updated);
    if (activeSubject === name) setActiveSubject('全部科目');
    showToast(`已移除自定义科目「${name}」`);
  };

  const handleUpdatePaperSubject = (paperId, rawSubject) => {
    const subject = String(rawSubject || '').trim();
    if (!subject) return;
    const target = paperList.find((p) => p.id === paperId);
    if (!target) return;
    const updated = { ...target, subject };
    setPaperList((prev) => prev.map((p) => (p.id === paperId ? updated : p)));
    if (onSavePaper) onSavePaper(updated, false);
    if (!DEFAULT_SUBJECTS.includes(subject) && subject !== '未分类') {
      const list = addCustomSubject(subject);
      setCustomSubjects(list);
    }
    setSubjectEditingPaper(null);
    showToast(`已将《${target.title}》归类为「${subject}」`);
  };

  const handleSaveNote = (id) => {
    const current = paperList.find((paper) => paper.id === id);
    if (current) onSavePaper?.({ ...current, note: noteText }, false);
    setPaperList((prev) => prev.map((paper) => paper.id === id ? { ...paper, note: noteText } : paper));
    setEditingNoteId(null);
  };

  return (
    <div className="flex min-w-0 flex-col w-full pb-16">
      <div className="w-full min-w-0 max-w-[1440px] mx-auto px-3 sm:px-margin-desktop py-4 sm:py-space-xl flex flex-col gap-4 sm:gap-space-xl">
        {/* 1. Header Area: Workstation Telemetry & Action Panel */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-space-lg bg-surface-container-lowest p-4 sm:p-space-xl rounded-xl shadow-sm border border-outline-variant/30">
          <div className="flex flex-col gap-space-xs max-w-3xl">
            <div className="flex items-center gap-space-sm">
              <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-label-mono text-label-mono uppercase tracking-wider font-semibold">
                Repository Node
              </span>
              <span className="text-outline-variant font-label-mono text-label-mono">/</span>
              <span className="text-on-surface-variant font-label-mono text-label-mono">STORAGE OCCUPANCY: {paperList.length} ARTIFACTS</span>
            </div>
            <h1 className="font-headline-xl text-[25px] leading-8 sm:text-headline-xl text-on-surface font-semibold tracking-tight">
              试卷库 (Exam Repository)
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              集中管理导入与生成的试卷，支持搜索、筛选、预览、继续作答和查看交卷记录。
            </p>
          </div>

        </section>

        {/* 2. Filtering & Workbench Control Strip */}
        <section className="flex flex-col gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/30">
          {/* Search & Controls Top Tier */}
          <div className="flex min-w-0 flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
            {/* Search Input with Scope Icon */}
            <div className="relative flex-1 min-w-0 w-full">
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
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-space-sm flex-wrap">
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded border border-outline-variant/30">
                <span className="material-symbols-outlined text-on-surface-variant text-[16px]">swap_vert</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">排序:</span>
                <SelectMenu
                  ariaLabel="试卷排序方式"
                  value={sortBy}
                  onChange={setSortBy}
                  options={[
                    { value: 'date-desc', label: '按导入时间 (由新到旧)' },
                    { value: 'score-desc', label: '按总分值 (由高到低)' },
                    { value: 'diff-desc', label: '按试卷难度等级' }
                  ]}
                  buttonClassName="inline-flex items-center gap-1 bg-transparent px-1 py-0.5 text-left font-label-md text-label-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded cursor-pointer"
                />
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

          <div className="flex items-center gap-2 overflow-x-auto border-t border-outline-variant/20 pt-2 pb-1 scrollbar-none">
            <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant font-medium">科目</span>
            {subjects.map((subject) => {
              const isActive = activeSubject === subject.label;
              return (
                <div key={subject.label} className="relative group/subj shrink-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveSubject(subject.label)}
                    aria-pressed={isActive}
                    className={`shrink-0 px-3 py-1 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-secondary/15 text-secondary border border-secondary/30 font-semibold'
                        : 'bg-surface-container-low text-on-surface-variant border border-transparent hover:border-secondary/20 hover:text-secondary'
                    }`}
                  >
                    <span>{subject.label}</span>
                    <span className="opacity-75">{subject.count}</span>
                  </button>
                  {subject.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCustomSubject(subject.label);
                      }}
                      className="opacity-0 group-hover/subj:opacity-100 hover:text-error text-outline transition-opacity ml-[-6px] mr-1 p-0.5 rounded-full hover:bg-surface-container cursor-pointer text-[12px] leading-none"
                      title={`删除自定义分类「${subject.label}」`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add Subject Button */}
            <button
              type="button"
              onClick={() => setIsAddSubjectModalOpen(true)}
              className="shrink-0 px-2.5 py-1 rounded-full font-label-sm text-label-sm text-primary hover:bg-primary/10 border border-dashed border-primary/40 flex items-center gap-1 transition-colors cursor-pointer ml-1"
              title="添加新科目分类"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>添加科目</span>
            </button>
          </div>
        </section>

        {/* 3. Exam Card Matrix Grid */}
        <div className={viewMode === 'grid' ? 'grid min-w-0 grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-space-lg' : 'flex min-w-0 flex-col gap-space-md'}>
          {filteredPapers.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center p-8 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/40">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined text-[36px]">menu_book</span>
              </div>
              <h3 className="font-headline-sm font-semibold text-on-surface mb-2">试卷库当前暂无试卷</h3>
              <p className="text-body-sm text-on-surface-variant max-w-md mb-6">
                前往「智能组卷」创建并保存一份新试卷。
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('exam-generator')}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>前往智能组卷</span>
                </button>
              </div>
            </div>
          ) : (
            filteredPapers.map((paper) => {
              const isEditingNote = editingNoteId === paper.id;
              const paperMetrics = calculatePaperMetrics(paper);
              return (
                <article
                  key={paper.id}
                  className="group bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative border border-outline-variant/30"
                >
                <div className={`absolute top-0 left-0 bottom-0 w-1 ${paper.sourceType === 'clone' ? 'bg-primary' : 'bg-secondary-fixed-dim'}`}></div>

                <div className="p-space-lg pl-[calc(1rem+6px)] flex flex-col gap-space-md">
                  {/* Top Row: Source, Subject, Time, Bookmark */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-space-xs flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container font-label-mono text-label-mono text-primary font-medium">
                        <span className="material-symbols-outlined text-[13px]">
                          {paper.sourceType === 'clone' ? 'picture_as_pdf' : 'neurology'}
                        </span>
                        {paper.source}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubjectEditingPaper(paper);
                          setEditingPaperSubject(getPaperSubject(paper));
                          setCustomInputInModal('');
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-all hover:scale-105 cursor-pointer shadow-2xs ${getSubjectBadgeStyle(getPaperSubject(paper))}`}
                        title="点击修改此试卷的科目分类"
                      >
                        <span className="material-symbols-outlined text-[13px]">school</span>
                        <span>{getPaperSubject(paper)}</span>
                        <span className="material-symbols-outlined text-[11px] opacity-60">edit</span>
                      </button>
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
                      <span className="flex items-center gap-1.5 font-label-sm text-label-sm text-tertiary">
                        <span>难度:</span>
                        <span className="tracking-widest font-mono font-medium">{paperMetrics.stars}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary-fixed/30 text-tertiary font-label-mono font-medium">
                          {paperMetrics.difficultyLabel}
                        </span>
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
                    const realHighest = hasAttempts ? Math.max(...paperSubs.map((s) => s.score)) : null;
                    const realAttempts = hasAttempts ? paperSubs.length : 0;
                    const latestSub = hasAttempts ? paperSubs[0] : null;
                    const identifiedFlaws = hasAttempts
                      ? (latestSub?.questions?.filter(q => !q.isCorrect).length || 0)
                      : 0;

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
                            <span className="font-label-mono text-label-md text-tertiary font-semibold">{identifiedFlaws} 处典型错因</span>
                          </div>
                        </div>
                      );
                    }

                    const isSealed = paper.status === '已封卷';
                    const isExamining = paper.status === '考试中';

                    return (
                      <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded-lg shadow-xs border border-outline-variant/20">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isSealed ? 'bg-amber-500' : isExamining ? 'bg-primary' : 'bg-secondary'} animate-pulse`}></span>
                          <span className="font-sans text-[11px] text-on-surface-variant font-medium">状态:</span>
                          <span className={`font-sans text-[12px] font-semibold ${isSealed ? 'text-amber-700 dark:text-amber-400' : isExamining ? 'text-primary' : 'text-secondary'}`}>
                            {isSealed ? '🔏 已封卷 · 封盘暂停' : isExamining ? '● 考试中 (作答中)' : (paper.status || '未作答')}
                          </span>
                        </div>
                        <span className="font-sans text-[11px] text-outline">
                          {paper.secondsLeft !== undefined ? `剩余考时 ~${Math.ceil(paper.secondsLeft / 60)}m` : `预计用时 ~${paperMetrics.estimatedMinutes}m`}
                        </span>
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
                  const isSealed = paper.status === '已封卷';
                  const isExamining = paper.status === '考试中';

                  return (
                    <div className="bg-surface-container-low px-space-lg py-2.5 flex items-center justify-between gap-space-sm border-t border-outline-variant/20 flex-wrap">
                      <div className="flex items-center gap-space-xs flex-wrap">
                        <button
                          type="button"
                          onClick={() => onStartExam(paper)}
                          className={`inline-flex items-center gap-1 px-3 h-7.5 rounded font-label-sm text-label-sm transition-all shadow-xs cursor-pointer active:scale-95 font-medium ${
                            isSealed
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : isExamining
                              ? 'bg-primary hover:bg-primary-container text-white'
                              : 'bg-primary-container hover:bg-primary text-on-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {isSealed ? 'lock_open' : isExamining ? 'play_arrow' : 'fullscreen'}
                          </span>
                          {isSealed ? '启封继续考试' : isExamining ? '继续考试' : '进入考场 (专注模式)'}
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
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuPaperId(null);
                                setSubjectEditingPaper(paper);
                                setEditingPaperSubject(getPaperSubject(paper));
                                setCustomInputInModal('');
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors text-left cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px] text-secondary">school</span>
                              <span>修改科目分类</span>
                            </button>
                            <div className="my-1 border-t border-outline-variant/30" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuPaperId(null);
                                setPaperToDelete(paper);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-error-container/50 text-error transition-colors text-left cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                              <span>删除试卷</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </article>
            );
          }))}
        </div>
      </div>

      {/* Modal 1: 大试卷总览 Modal */}
      {selectedPreviewPaper && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-xl shadow-xl border border-outline-variant/40 space-y-space-md animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container shrink-0">
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

            <div className="space-y-space-md text-body-md text-on-surface-variant overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-3 gap-2 text-center p-space-sm bg-surface-container-low rounded-lg font-label-mono text-body-sm">
                <div>总题量: <span className="font-bold text-on-surface">{selectedPreviewPaper.questionCount || (selectedPreviewPaper.questions ? selectedPreviewPaper.questions.length : 0)} 题</span></div>
                <div>总分值: <span className="font-bold text-primary">{selectedPreviewPaper.totalScore} 分</span></div>
                <div>时限: <span className="font-bold text-on-surface">{selectedPreviewPaper.duration} 分钟</span></div>
              </div>

              <div className="p-space-md bg-surface-container-low rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-on-surface">题型结构与模块划分：</p>
                  <span className="text-[12px] text-outline font-label-mono">AI 真实解析结构</span>
                </div>
                {(() => {
                  const struct = getPaperStructure(selectedPreviewPaper);
                  if (struct.length === 0) {
                    return <p className="text-body-sm text-outline italic">暂无细分题型信息</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {struct.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container/60 text-body-sm border border-outline-variant/30">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary-fixed text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-on-surface">{item.name}</span>
                            {item.typeSummary && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-mono">
                                {item.typeSummary}
                              </span>
                            )}
                          </div>
                          <div className="font-label-mono text-outline text-right text-[13px] shrink-0">
                            <span className="text-on-surface font-semibold">{item.count}</span> 题
                            {item.score > 0 && (
                              <span className="ml-2 text-primary font-semibold">({item.score} 分)</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {selectedPreviewPaper.questions && selectedPreviewPaper.questions.length > 0 && (
                <div className="p-space-md bg-surface-container-low/70 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-label-mono text-[11px] text-outline uppercase font-semibold">
                      试卷内容前瞻（前 {Math.min(5, selectedPreviewPaper.questions.length)} 题示例）
                    </p>
                    <span className="text-[11px] text-outline font-label-mono">
                      共 {selectedPreviewPaper.questions.length} 题真实考点
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedPreviewPaper.questions.slice(0, 5).map((q, idx) => (
                      <div key={q.id || idx} className="text-[12px] p-2.5 rounded-lg bg-surface-container-lowest text-on-surface-variant flex items-start gap-2.5 border border-outline-variant/20 hover:border-primary/40 transition-colors">
                        <span className="font-mono text-primary font-bold px-1.5 py-0.5 rounded bg-primary-fixed/40 text-[11px] shrink-0">
                          #{q.num || idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="line-clamp-2 text-on-surface text-[12px] leading-relaxed">
                            {getQuestionPreviewContent(q, idx)}
                          </p>
                        </div>
                        <span className={`text-[11px] px-1.5 py-0.5 border rounded whitespace-nowrap shrink-0 font-label-mono ${getQuestionTypeClass(q.type)}`}>
                          {q.type || '试题'} · {q.score ?? 0}分
                        </span>
                      </div>
                    ))}
                  </div>
                  {selectedPreviewPaper.questions.length > 5 && (
                    <p className="text-center text-[11px] text-outline pt-1">
                      ... 其余 {selectedPreviewPaper.questions.length - 5} 道试题已完成校验，开考后完整呈现
                    </p>
                  )}
                </div>
              )}

              <p className="text-body-sm text-outline italic">
                备注说明：{selectedPreviewPaper.note || '暂无备注。'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container shrink-0">
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
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md shadow-sm hover:bg-primary-container cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                <span>立即进入该考场</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: 诊断报告 Modal */}
      {selectedReportPaper && (() => {
        const reportSubs = submissions.filter(
          (s) => s && (s.paperId === selectedReportPaper.id || s.paperTitle === selectedReportPaper.title)
        );
        const latestSub = reportSubs[0] || null;
        const highestScore = reportSubs.length > 0
          ? Math.max(...reportSubs.map((s) => Number(s.score) || 0))
          : (selectedReportPaper.highestScore ?? null);
        const attemptsCount = reportSubs.length > 0 ? reportSubs.length : (selectedReportPaper.attempts || 0);
        const latestQuestions = latestSub && (Array.isArray(latestSub.questions) ? latestSub.questions : latestSub.results);
        const wrongList = Array.isArray(latestQuestions)
          ? latestQuestions.filter((r) => r.isCorrect === false)
          : [];
        const manualReviewCount = Array.isArray(latestQuestions)
          ? latestQuestions.filter((r) => r.gradingStatus === 'manual-review').length
          : 0;

        return (
          <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-xl shadow-xl border border-outline-variant/40 space-y-space-md animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between pb-space-xs border-b border-surface-container">
                <div>
                  <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-mono text-label-mono">
                    作答记录
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
                      {highestScore !== null && highestScore !== undefined ? highestScore : '--'}{' '}
                      <span className="text-body-md font-normal text-on-surface-variant">/ {selectedReportPaper.totalScore}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-label-mono text-on-surface-variant">ATTEMPTS</p>
                    <p className="text-headline-lg font-bold text-on-surface font-label-mono">
                      {attemptsCount} 次
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-on-surface text-label-md flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">psychology</span>
                    <span>最近一次作答情况：</span>
                  </h4>

                  {attemptsCount === 0 || !latestSub ? (
                    <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/30 text-center space-y-2">
                      <span className="material-symbols-outlined text-[36px] text-outline">history_edu</span>
                      <p className="text-on-surface font-medium text-body-sm">当前试卷尚未产生任何作答提交记录</p>
                      <p className="text-outline text-body-xs max-w-md mx-auto">
                        进入考场完成作答并交卷后，这里会显示实际作答记录与复盘入口。
                      </p>
                    </div>
                  ) : wrongList.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      <p className="text-body-xs text-outline font-label-mono">最近一次自动核对发现 {wrongList.length} 道错题{manualReviewCount > 0 ? `，另有 ${manualReviewCount} 道主观题待人工复核` : ''}：</p>
                      {wrongList.slice(0, 3).map((w, idx) => (
                        <div key={idx} className="p-space-sm bg-error-container/20 border border-error-container/40 rounded-lg space-y-1">
                          <p className="text-on-error-container font-medium text-body-sm">
                            ⚠️ 错题 #{w.questionNumber || idx + 1}：{w.stem || w.question || '题目考点待强化'}
                          </p>
                          <p className="text-on-surface-variant text-code-sm">
                            解析与归因：{w.explanation || '未能准确匹配正确答案，建议重温该题型题眼并复盘知识要点。'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-space-md bg-primary-fixed/30 border border-primary/20 rounded-xl space-y-1">
                      <p className="text-primary font-medium text-body-sm">
                        最近一次自动核对未发现客观题错答。
                      </p>
                      <p className="text-on-surface-variant text-body-xs">
                        {manualReviewCount > 0 ? `另有 ${manualReviewCount} 道主观题待人工复核。` : '可以继续查看完整作答记录或开始下一次练习。'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
                {latestSub && onViewSubmission && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReportPaper(null);
                      onViewSubmission(latestSub);
                    }}
                    className="px-4 py-2 rounded-lg bg-secondary text-on-secondary hover:bg-secondary/90 font-label-md cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    <span>查看完整评卷详情</span>
                  </button>
                )}
                {attemptsCount === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = selectedReportPaper;
                      setSelectedReportPaper(null);
                      onStartExam(p);
                    }}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    <span>开始首次测评</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedReportPaper(null)}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                        <button
                          type="button"
                          onClick={() => setSubmissionToDelete(sub)}
                          aria-label={`删除第 ${selectedHistoryPaper.submissions.length - idx} 次提交记录`}
                          title="删除这条作答记录"
                          className="inline-flex items-center justify-center p-2 rounded-lg text-error hover:bg-error-container/50 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[19px]">delete</span>
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

      {submissionToDelete && (
        <div
          className="fixed inset-0 z-[60] bg-on-background/45 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSubmissionToDelete(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-submission-title"
            aria-describedby="delete-submission-description"
            className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-[24px]">delete</span>
              <div>
                <h3 id="delete-submission-title" className="font-headline-sm text-headline-sm font-semibold text-on-surface">删除这条作答记录？</h3>
                <p id="delete-submission-description" className="mt-1 text-body-sm text-on-surface-variant">删除后将从本地历史记录中移除，无法恢复。</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmissionToDelete(null)}
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
              >取消</button>
              <button
                type="button"
                onClick={confirmDeleteSubmission}
                className="px-4 py-2 rounded-lg bg-error hover:opacity-90 text-on-error font-label-md font-semibold cursor-pointer"
              >删除记录</button>
            </div>
          </div>
        </div>
      )}

      {paperToDelete && (
        <div
          className="fixed inset-0 z-[60] bg-on-background/45 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaperToDelete(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-paper-title"
            aria-describedby="delete-paper-description"
            className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-[24px]">delete_forever</span>
              <div>
                <h2 id="delete-paper-title" className="font-headline-sm text-headline-sm font-semibold text-on-surface">删除这份试卷？</h2>
                <p className="mt-1 text-body-sm font-medium text-on-surface">《{paperToDelete.title}》</p>
              </div>
            </div>
            <p id="delete-paper-description" className="text-body-sm text-on-surface-variant leading-relaxed">
              删除后，这份试卷、答题草稿和关联的历史交卷记录都会从本地移除，且无法恢复。
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setPaperToDelete(null)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeletePaper}
                className="px-4 py-2 rounded-lg bg-error text-on-error font-label-md hover:bg-error/90 transition-colors cursor-pointer"
              >
                删除试卷
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: 添加科目分类 */}
      {isAddSubjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">category</span>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">添加科目分类</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddSubjectModalOpen(false);
                  setNewSubjectInput('');
                }}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-label-mono text-on-surface-variant block mb-1">
                  科目名称
                </label>
                <input
                  type="text"
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSubject();
                    }
                  }}
                  placeholder="例如：自命题830、离散数学、数据结构、信号系统..."
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-body-sm border border-outline-variant/40 focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <span className="text-[11px] font-label-mono text-outline block mb-1.5">快捷推荐（点击直接添加）：</span>
                <div className="flex flex-wrap gap-1.5">
                  {['408', '考研数学', '考研英语', '考研政治', '管理类联考', '自命题专业课', '数据结构', '计算机组成原理', '操作系统', '计算机网络', '信号与系统', '离散数学', '物理学', '化学', '法硕联考'].map(preset => {
                    const exists = allSubjectLabels.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={exists}
                        onClick={() => handleAddCustomSubject(preset)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          exists
                            ? 'bg-surface-container text-outline opacity-40 cursor-not-allowed'
                            : 'bg-surface-container hover:bg-primary/10 hover:text-primary text-on-surface-variant border border-outline-variant/20'
                        }`}
                      >
                        {exists ? `✓ ${preset}` : `+ ${preset}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => {
                  setIsAddSubjectModalOpen(false);
                  setNewSubjectInput('');
                }}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!newSubjectInput.trim()}
                onClick={() => handleAddCustomSubject()}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
              >
                确定添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: 修改试卷科目分类 */}
      {subjectEditingPaper && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">school</span>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">修改试卷科目分类</h3>
              </div>
              <button
                type="button"
                onClick={() => setSubjectEditingPaper(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-label-mono text-outline mb-0.5">当前试卷：</p>
                <p className="text-body-md font-bold text-on-surface truncate">《{subjectEditingPaper.title}》</p>
              </div>

              <div>
                <label className="text-[12px] font-label-mono text-on-surface-variant block mb-2">
                  选择划分到的科目：
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {allSubjectLabels.map((sub) => {
                    const isSelected = editingPaperSubject === sub && !customInputInModal.trim();
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setEditingPaperSubject(sub);
                          setCustomInputInModal('');
                        }}
                        className={`px-3 py-2 rounded-xl border text-[13px] font-medium flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-secondary text-white border-secondary shadow-xs font-semibold'
                            : 'bg-surface-container-low hover:bg-surface-container text-on-surface border-outline-variant/30'
                        }`}
                      >
                        <span className="truncate">{sub}</span>
                        {isSelected && <span className="material-symbols-outlined text-[16px]">check</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-label-mono text-on-surface-variant block mb-1">
                  或输入自定义科目名称：
                </label>
                <input
                  type="text"
                  value={customInputInModal}
                  onChange={(e) => setCustomInputInModal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const targetSubject = customInputInModal.trim() || editingPaperSubject;
                      handleUpdatePaperSubject(subjectEditingPaper.id, targetSubject);
                    }
                  }}
                  placeholder="输入新科目名直接归类并新增该科目..."
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-body-sm border border-outline-variant/40 focus:border-secondary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setSubjectEditingPaper(null)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetSubject = customInputInModal.trim() || editingPaperSubject;
                  handleUpdatePaperSubject(subjectEditingPaper.id, targetSubject);
                }}
                className="px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label-md hover:bg-secondary/90 transition-colors cursor-pointer font-semibold shadow-xs"
              >
                保存分类
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


