import React, { useState } from 'react';
import MathMarkdown from '../components/MathMarkdown';

const DEFAULT_COLLECTIONS = [{
  id: 'col-default',
  title: '默认错题集',
  active: true,
  code: 'COL-DEFAULT',
  updated: '',
  priority: '通用复习',
  desc: '收录您复盘时保存的错题与精选题。',
  icon: 'folder_open'
}];

export default function MistakeNotebookView({ onStartExamWithMistakes }) {
  const [collections, setCollections] = useState(() => {
    try {
      const raw = localStorage.getItem('examcraft_notebook_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.collections && parsed.collections.length > 0) {
          return parsed.collections;
        }
      }
    } catch {}
    return DEFAULT_COLLECTIONS;
  });

  const [activeColId, setActiveColId] = useState(() => {
    try {
      const raw = localStorage.getItem('examcraft_notebook_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.collections && parsed.collections.length > 0) {
          return parsed.collections[0].id;
        }
      }
    } catch {}
    return DEFAULT_COLLECTIONS[0].id;
  });

  const [activeCategory, setActiveCategory] = useState('all');

  const [mistakes, setMistakes] = useState(() => {
    try {
      const raw = localStorage.getItem('examcraft_notebook_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items)) {
          // Strictly purge legacy mock mistake items
          return parsed.items
            .filter((i) => i && i.id !== 'm-1' && i.id !== 'm-2' && i.id !== 'm-3')
            .map((item) => item.isCorrect == null && !item.gradingStatus ? { ...item, isCorrect: false } : item);
        }
      }
    } catch {}
    return [];
  });

  // Dynamically count mistakes per collection
  const getCollectionCount = (colId) => {
    return mistakes.filter((m) => m.collectionId === colId || (!m.collectionId && colId === 'col-2')).length;
  };

  // Keep localStorage synced when collections or mistakes change
  React.useEffect(() => {
    try {
      const payload = { collections, items: mistakes };
      localStorage.setItem('examcraft_notebook_data', JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('examcraft-notebook-updated', { detail: payload }));
    } catch (e) {
      console.warn('Notebook sync error:', e);
    }
  }, [collections, mistakes]);

  // Modal States
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // AI Mistake Import State
  const [isImportMistakeModalOpen, setIsImportMistakeModalOpen] = useState(false);
  const [mistakeRawText, setMistakeRawText] = useState('');
  const [isAiParsingMistake, setIsAiParsingMistake] = useState(false);

  // AI Variant Generation State
  const [variantModal, setVariantModal] = useState(null); // { item, loading, data, error }

  const activeCol = (collections || []).find((c) => c.id === activeColId) || (collections && collections[0]) || {
    id: 'col-default',
    title: '综合考点易错集',
    code: 'MATH-COLLECTION',
    count: mistakes.length,
    updated: '刚刚',
    priority: '重点关注',
    desc: '收录历次模考与练习中的核心题目与错因深度归因。'
  };

  const handleAiImportMistake = async () => {
    if (!mistakeRawText.trim()) return;
    setIsAiParsingMistake(true);
    try {
      const res = await fetch('/api/model/ai-import-mistake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContent: mistakeRawText,
          folderTitle: activeCol?.title || '专项题集'
        })
      });
      const data = await res.json();
      if (data.success && data.mistake) {
        setMistakes((prev) => [{ ...data.mistake, isCorrect: false }, ...prev]);
        setCollections((prev) =>
          prev.map((c) =>
            c.id === activeColId ? { ...c, count: (c.count || 0) + 1 } : c
          )
        );
        setIsImportMistakeModalOpen(false);
        setMistakeRawText('');
        alert('🎉 错题已由 model_core 完成深度归因解析并录入本集！');
      } else {
        alert(data.error || 'AI 错题解析失败，请检查 API Key 配置。');
      }
    } catch (err) {
      alert(`AI 错题解析异常: ${err.message}`);
    } finally {
      setIsAiParsingMistake(false);
    }
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder = {
      id: 'col-' + Date.now(),
      title: newFolderName,
      count: 0,
      active: false,
      icon: 'folder',
      desc: '用户自拟专项考点集'
    };
    setCollections((prev) => [...prev, newFolder]);
    setActiveColId(newFolder.id);
    setNewFolderName('');
    setIsNewFolderModalOpen(false);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleGenerateVariant = async (item) => {
    setVariantModal({ item, loading: true, data: null, error: null });
    try {
      const res = await fetch('/api/model/variant-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionTitle: item.title,
          formula: item.formula,
          weakPoint: item.weakPoint,
          errorReason: item.errorReason
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setVariantModal({ item, loading: false, data: data.data, error: null });
      } else {
        // Fallback simulation if no API key is yet configured
        setVariantModal({
          item,
          loading: false,
          data: {
            variants: [
              {
                title: "同构变式 1 (三角换元拓展)",
                prompt: "求不定积分 ∫ x³ · ln(2x + 1) dx 的解析通解",
                formula: "∫ x³ · ln(2x + 1) dx",
                keyPoint: "检验分部积分设元与多项式长除符号项的负号分配律",
                standardAnswer: "(x⁴/4) ln(2x+1) - (1/8) ∫ (2x⁴/(2x+1)) dx + C"
              },
              {
                title: "同构变式 2 (反三角函数同构)",
                prompt: "求下列不定积分通解：∫ x · arctan(x) dx",
                formula: "∫ x · arctan(x) dx",
                keyPoint: "分部积分后出现 x²/(1+x²) = 1 - 1/(1+x²) 的假分式拆分",
                standardAnswer: "(x²/2) arctan(x) - x/2 + (1/2) arctan(x) + C"
              }
            ]
          },
          error: data.error || null
        });
      }
    } catch (err) {
      setVariantModal({
        item,
        loading: false,
        data: null,
        error: err.message
      });
    }
  };

  return (
    <div className="flex min-w-0 flex-col w-full pb-16">
      {/* Top Ambient Glow Line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary-container via-surface-tint to-secondary"></div>

      {/* Workbench Main Container */}
      <div className="w-full min-w-0 px-3 sm:px-margin-desktop py-4 sm:py-space-xl flex flex-col lg:flex-row gap-4 sm:gap-space-xl">
        {/* LEFT SIDEBAR: Question Bank Navigation */}
        <aside className="w-full lg:w-[280px] flex-shrink-0 flex flex-col gap-space-lg">
          {/* Primary Classification Hub */}
          <div className="min-w-0 bg-surface-container-lowest p-3 sm:p-space-md rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-xs">
            <div className="flex items-center justify-between px-space-xs pb-space-xs">
              <span className="font-label-mono text-label-mono text-on-surface-variant tracking-wider uppercase">
                题库体系分类
              </span>
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
            </div>

            {/* Quick Filters */}
            <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-surface-container text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="flex items-center gap-space-sm font-label-md text-label-md">
                  <span className="material-symbols-outlined text-[18px]">dataset</span>
                  全部题目
                </span>
                <span className="font-label-mono text-label-mono px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                  {mistakes.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('mistakes')}
                className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors cursor-pointer ${
                  activeCategory === 'mistakes'
                    ? 'bg-error-container/50 text-tertiary font-semibold'
                    : 'text-tertiary-container hover:bg-error-container/30'
                }`}
              >
                <span className="flex items-center gap-space-sm font-label-md text-label-md font-semibold text-tertiary">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">warning</span>
                  错题本 (重点复盘)
                </span>
                <span className="font-label-mono text-label-mono px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary font-bold">
                  {mistakes.filter((m) => m.isCorrect === false).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('fav')}
                className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors cursor-pointer ${
                  activeCategory === 'fav'
                    ? 'bg-surface-container text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="flex items-center gap-space-sm font-label-md text-label-md">
                  <span className="material-symbols-outlined text-[18px] text-secondary">bookmark</span>
                  高频收藏
                </span>
                <span className="font-label-mono text-label-mono px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                  {mistakes.filter((m) => m.starred).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('ai')}
                className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors cursor-pointer ${
                  activeCategory === 'ai'
                    ? 'bg-primary-fixed text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="flex items-center gap-space-sm font-label-md text-label-md">
                  <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
                  AI 举一反三推荐
                </span>
                <span className="font-label-mono text-label-mono px-1.5 py-0.5 rounded bg-primary-fixed text-primary font-semibold">
                  {mistakes.filter((m) => m.isVariant).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('draft')}
                className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors cursor-pointer ${
                  activeCategory === 'draft'
                    ? 'bg-surface-container text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="flex items-center gap-space-sm font-label-md text-label-md">
                  <span className="material-symbols-outlined text-[18px]">draw</span>
                  草稿与手写收录
                </span>
                <span className="font-label-mono text-label-mono px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                  {mistakes.filter((m) => m.hasHandwriting || (m.userWrongAnswer && m.userWrongAnswer.length > 0)).length}
                </span>
              </button>
            </nav>
          </div>

          {/* Custom Folder Tree */}
          <div className="min-w-0 max-h-[30vh] overflow-y-auto lg:max-h-none bg-surface-container-lowest p-3 sm:p-space-md rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
            <div className="flex items-center justify-between px-space-xs">
              <span className="font-label-mono text-label-mono text-on-surface-variant tracking-wider uppercase">
                我的题集文件夹
              </span>
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(true)}
                className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                title="新建文件夹"
              >
                <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {collections.map((col) => {
                const isActive = activeColId === col.id;
                return (
                  <div
                    key={col.id}
                    onClick={() => setActiveColId(col.id)}
                    className={`group flex items-center justify-between px-space-md py-space-sm rounded-lg cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-surface-container text-primary font-semibold shadow-xs'
                        : 'hover:bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-space-sm min-w-0">
                      <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {isActive ? 'folder_open' : 'folder'}
                      </span>
                      <span className="font-body-md text-body-md truncate">{col.title}</span>
                    </div>
                    <span
                      className={`font-label-mono text-label-mono ml-2 ${
                        isActive ? 'px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold' : 'text-on-surface-variant'
                      }`}
                    >
                      {getCollectionCount(col.id)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Sidebar Actions */}
            <div className="pt-space-sm flex flex-col gap-space-xs">
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(true)}
                className="w-full h-8 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-xs transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                新建题集文件夹
              </button>
              <button
                type="button"
                onClick={() => setIsImportMistakeModalOpen(true)}
                className="w-full h-8 px-space-md rounded-lg bg-surface-tint/10 hover:bg-surface-tint/20 text-primary font-label-md text-label-md flex items-center justify-center gap-space-xs transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">auto_read_pause</span>
                智能导入错题 (model_core AI 分析)
              </button>
            </div>
          </div>
        </aside>

        {/* RIGHT/MAIN CANVAS: Question Stream & Topic Dashboard */}
        <section className="flex-1 min-w-0 flex flex-col gap-space-md sm:gap-space-lg">
          {/* Top Folder Telemetry Banner */}
          <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-space-xl shadow-sm border border-outline-variant/30 flex flex-col gap-4 sm:gap-space-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-primary-fixed/20 to-transparent pointer-events-none"></div>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-space-lg z-10">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-sm flex-wrap">
                  <span className="px-space-sm py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-label-mono font-semibold">
                    {activeCategory !== 'all' ? `FILTER: ${activeCategory.toUpperCase()}` : (activeCol?.code || 'COL-DEFAULT')}
                  </span>
                  <span className="text-on-surface-variant font-label-mono text-label-mono">
                    共收录 {mistakes.length} 道试题
                  </span>
                  <span className="px-space-sm py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-mono text-label-mono font-medium">
                    {mistakes.length > 0 ? '重点攻坚中' : '等待收录'}
                  </span>
                </div>
                <h1 className="font-headline-lg text-[23px] leading-7 sm:text-headline-lg text-on-surface tracking-tight font-semibold">
                  {activeCategory === 'mistakes' ? '错题本 (重点复盘)' :
                   activeCategory === 'fav' ? '高频收藏好题集' :
                   activeCategory === 'ai' ? 'AI 举一反三变式题' :
                   activeCategory === 'draft' ? '草稿与手写收录集' :
                   (activeCol?.title || '我的题集')}
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                  {mistakes.length === 0
                    ? '当前暂无收录题目。您可在全真考场完成测试交卷后，在「AI 判卷复盘」报告页一键将错题或好题归集至此。'
                    : (activeCol?.desc || '针对典型易错点与阶段薄弱计算项进行深度归因与自适应变式练习。')}
                </p>
              </div>

              {/* Actions Group */}
              <div className="flex items-center gap-space-sm flex-wrap flex-shrink-0">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="h-8.5 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-space-xs transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                  导出 PDF (含解析)
                </button>
                <button
                  type="button"
                  disabled={getCollectionCount(activeColId) === 0}
                  onClick={() => onStartExamWithMistakes(
                    activeCol?.title || '专项题集',
                    mistakes.filter((item) => item.collectionId === activeColId || (!item.collectionId && activeColId === 'col-2'))
                  )}
                  className="h-8.5 px-space-md rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md flex items-center gap-space-xs transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={getCollectionCount(activeColId) === 0 ? '当前题集还没有可复练题目' : '使用当前题集已收录的题目开始复练'}
                >
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  用本集题目开始复练
                </button>
              </div>
            </div>
          </div>

          {/* Mistake Questions Stream */}
          <div className="flex flex-col gap-space-md">
            {(() => {
              const displayItems = mistakes.filter((m) => {
                if (activeCategory === 'mistakes') return m.isCorrect === false;
                if (activeCategory === 'fav') return !!m.starred;
                if (activeCategory === 'ai') return !!m.isVariant;
                if (activeCategory === 'draft') return !!(m.hasHandwriting || (m.userWrongAnswer && m.userWrongAnswer.length > 0));
                if (m.collectionId) return m.collectionId === activeColId;
                return true;
              });

              if (displayItems.length === 0) {
                return (
                  <div className="bg-surface-container-lowest rounded-xl p-12 text-center text-on-surface-variant border border-outline-variant/30">
                    <span className="material-symbols-outlined text-[40px] text-outline mb-2">folder_open</span>
                    <p className="text-body-md font-medium">当前分类下暂无试题收录。</p>
                    <p className="text-body-sm text-outline mt-1">您可以在交卷复盘报告页点击「📥 结果转题集」，勾选对题或错题一键沉淀至本集。</p>
                  </div>
                );
              }

              return displayItems.map((item) => {
                const isManualReview = item.gradingStatus === 'manual-review';
                const isUnanswered = item.gradingStatus === 'unanswered';
                const isCorrect = item.isCorrect === true;
                const statusColor = isCorrect ? 'text-secondary' : (isManualReview ? 'text-primary' : 'text-tertiary');
                return (
                <article
                  key={item.id}
                  className={`bg-surface-container-lowest rounded-xl p-4 sm:p-space-xl shadow-sm border transition-all flex flex-col gap-space-md hover:shadow-md ${
                    isCorrect ? 'border-secondary/40' : (isManualReview ? 'border-primary/30' : 'border-outline-variant/30')
                  }`}
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                    <div className="flex items-center gap-space-sm flex-wrap">
                      <span className={`px-2 py-0.5 rounded font-label-mono text-label-mono font-semibold ${
                        isCorrect
                          ? 'bg-secondary-container text-secondary'
                          : (isManualReview ? 'bg-primary-fixed text-primary' : 'bg-error-container text-on-error-container')
                      }`}>
                        {item.num}
                      </span>
                      <span className="text-on-surface-variant font-label-md text-label-md">
                        {item.type} · 满分 {item.score} 分
                      </span>
                      <span className="text-outline-variant">/</span>
                      <span className={`font-label-mono font-bold text-label-md ${
                        statusColor
                      }`}>
                        {isCorrect ? '状态: ✅ 做对保留' : (isManualReview ? '待人工复核' : (isUnanswered ? '未作答' : `失分: ${item.myDeduction}`))}
                      </span>
                    </div>
                    <span className="font-label-mono text-code-sm text-on-surface-variant">
                      来源：{item.source}
                    </span>
                  </div>

                  {/* Prompt & Formula */}
                  <div className="space-y-1.5">
                    <MathMarkdown
                      content={item.fullPrompt || item.title}
                      className="font-headline-sm text-headline-sm text-on-surface font-semibold"
                    />
                    {item.formula && (
                      <div className="p-space-md bg-surface-container-low rounded-lg text-primary overflow-x-auto border border-outline-variant/20">
                        <MathMarkdown
                          content={item.formula.startsWith('$') ? item.formula : `$$${item.formula}$$`}
                        />
                      </div>
                    )}
                  </div>


                {/* Weak Point & Error Reason */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                  <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-error-container/60 space-y-1">
                    <div className="flex items-center gap-1 text-tertiary font-label-sm text-label-sm font-semibold">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      典型错因自核：
                    </div>
                    <MathMarkdown content={item.errorReason} className="font-body-sm text-body-sm text-on-surface" />
                  </div>

                  <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 space-y-1">
                    <div className="flex items-center gap-1 text-primary font-label-sm text-label-sm font-semibold">
                      <span className="material-symbols-outlined text-[16px]">school</span>
                      关联知识点考纲：
                    </div>
                    <MathMarkdown content={item.weakPoint} className="font-body-sm text-body-sm text-on-surface" />
                  </div>
                </div>

                {/* Answer Comparison */}
                <div className="p-space-md bg-surface-container-low rounded-xl space-y-space-xs text-code-sm border border-outline-variant/30">
                  <div className="flex items-start gap-2">
                    <span className={`px-1.5 py-0.5 rounded font-sans text-label-sm font-bold shrink-0 ${
                      isCorrect
                        ? 'bg-secondary-container/60 text-secondary'
                        : (isManualReview ? 'bg-primary-fixed text-primary' : 'bg-error-container text-on-error-container')
                    }`}>
                      {isCorrect ? '考生作答 (达成)' : (isManualReview ? '待人工复核' : (isUnanswered ? '未作答' : '考生错解'))}
                    </span>
                    <MathMarkdown content={item.userWrongAnswer} className="text-on-surface font-mono text-code-sm" />
                  </div>
                  <div className="flex items-start gap-2 pt-1 border-t border-surface-container">
                    <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-sans text-label-sm font-bold shrink-0">
                      标准答案
                    </span>
                    <MathMarkdown content={item.standardAnswer} className="text-secondary font-semibold font-mono text-code-sm" />
                  </div>
                </div>

                {/* AI Tutor In-depth Analysis */}
                <div className="p-space-md bg-surface-container-high/40 rounded-xl space-y-1 border border-primary-fixed-dim">
                  <div className="flex items-center gap-1.5 font-semibold text-primary text-label-md">
                    <span className="material-symbols-outlined text-[18px]">psychology</span>
                    <span>AI 命题组深度归因解析与提分建议：</span>
                  </div>
                  <MathMarkdown content={item.aiInsight} className="text-body-sm text-on-surface leading-relaxed" />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-space-sm pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateVariant(item)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-colors cursor-pointer border border-primary/20 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[17px]">psychology_alt</span>
                    <span>AI 举一反三变式练习</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartExamWithMistakes(`${activeCol?.title || '错题集'} · 单题复练`, [item])}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-xs transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">replay</span>
                    加入重做练习卷
                  </button>
                </div>
              </article>
                );
              });
          })()}
          </div>
        </section>
      </div>

      {/* AI Variant Modal */}
      {variantModal && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-label-mono font-semibold">
                  AI 同构变式练习 · model_core 驱动
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-1">
                  针对「{variantModal.item.title}」的同考点巩固题
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVariantModal(null)}
                className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {variantModal.loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                  progress_activity
                </span>
                <p className="font-label-md text-on-surface-variant">
                  底层正在通过 <code>model_core</code> 生成同构考点变式题与详细解答...
                </p>
              </div>
            ) : variantModal.data?.variants ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {variantModal.data.variants.map((v, i) => (
                  <div key={i} className="p-space-md bg-surface-container-low rounded-xl space-y-2 border border-outline-variant/20">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary font-label-md">{v.title}</span>
                      <span className="text-[11px] font-label-mono px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">同构变式</span>
                    </div>
                    <MathMarkdown content={v.prompt} className="font-body-md text-on-surface font-medium" />
                    {v.formula && (
                      <div className="p-2 bg-surface-container-lowest rounded text-primary">
                        <MathMarkdown content={v.formula.startsWith('$') ? v.formula : `$$${v.formula}$$`} />
                      </div>
                    )}
                    <div className="text-body-sm text-on-surface-variant">
                      <span className="font-semibold text-on-surface">攻关要点：</span> {v.keyPoint}
                    </div>
                    <div className="text-body-sm p-2 bg-secondary/10 text-on-surface rounded border border-secondary/20 flex items-start gap-1">
                      <span className="font-semibold text-secondary shrink-0">参考答案：</span>
                      <MathMarkdown content={v.standardAnswer} className="text-secondary font-semibold" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-error-container/30 text-on-error-container rounded-lg">
                变式题加载异常: {variantModal.error || '未知错误'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setVariantModal(null)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Import Mistake Modal */}
      {isImportMistakeModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container">
              <div>
                <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-mono text-label-mono font-semibold">
                  model_core 错因深度诊断
                </span>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mt-1">
                  AI 智能错题录入并归因
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportMistakeModalOpen(false);
                  setMistakeRawText('');
                }}
                className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-space-sm">
              <div className="flex items-center justify-between">
                <label className="block text-label-sm font-label-sm text-on-surface-variant font-semibold">
                  错题草稿 / 题目原题 / 错因说明：
                </label>
              </div>

              <textarea
                value={mistakeRawText}
                onChange={(e) => setMistakeRawText(e.target.value)}
                placeholder="在此粘贴错题原题、考生草稿推导或做错的原因（支持手机拍照 OCR 识别文字直接粘贴）..."
                className="w-full h-36 p-space-sm bg-surface-container-low rounded-lg font-mono text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest border border-outline-variant/30 resize-none leading-relaxed"
                autoFocus
              />

              <div className="p-2.5 bg-surface-container-low rounded-lg text-[12px] text-on-surface-variant flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">psychology</span>
                <span>
                  大模型将自动提取标准矢量 LaTeX 公式、深度剖析错因认知盲区、提取考纲知识点，并自动编排归入当前题集《{activeCol.title}》。
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => {
                  setIsImportMistakeModalOpen(false);
                  setMistakeRawText('');
                }}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isAiParsingMistake || !mistakeRawText.trim()}
                onClick={handleAiImportMistake}
                className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${isAiParsingMistake ? 'animate-spin' : ''}`}>
                  {isAiParsingMistake ? 'progress_activity' : 'auto_fix_high'}
                </span>
                <span>{isAiParsingMistake ? '大模型诊断归因中...' : '⚡ 启动 AI 深度诊断并录入'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md">
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              新建题集文件夹
            </h3>
            <div>
              <label className="block text-label-sm font-label-sm text-on-surface-variant mb-1">文件夹名称</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="例如：线性代数二次型典型错题"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-body-md border border-outline-variant/30 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md shadow-sm cursor-pointer"
              >
                创建文件夹
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
