import React, { useState } from 'react';
import { MISTAKE_COLLECTIONS, MISTAKE_ITEMS } from '../data/mockData';

export default function MistakeNotebookView({ onStartExamWithMistakes }) {
  const [collections, setCollections] = useState(MISTAKE_COLLECTIONS);
  const [activeColId, setActiveColId] = useState('col-2');
  const [activeCategory, setActiveCategory] = useState('mistakes'); // 'all' | 'mistakes' | 'fav' | 'ai' | 'draft'
  const [mistakes, setMistakes] = useState(MISTAKE_ITEMS);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const activeCol = collections.find((c) => c.id === activeColId) || collections[1];

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

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Ambient Glow Line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary-container via-surface-tint to-secondary"></div>

      {/* Workbench Main Container */}
      <div className="w-full px-4 sm:px-margin-desktop py-space-xl flex flex-col lg:flex-row gap-space-xl">
        {/* LEFT SIDEBAR: Question Bank Navigation */}
        <aside className="w-full lg:w-[280px] flex-shrink-0 flex flex-col gap-space-lg">
          {/* Primary Classification Hub */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-xs">
            <div className="flex items-center justify-between px-space-xs pb-space-xs">
              <span className="font-label-mono text-label-mono text-on-surface-variant tracking-wider uppercase">
                题库体系分类
              </span>
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
            </div>

            {/* Quick Filters */}
            <nav className="flex flex-col gap-0.5">
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
                  142
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
                  38
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
                  24
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
                  18
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
                  15
                </span>
              </button>
            </nav>
          </div>

          {/* Custom Folder Tree */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
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
                      {col.count}
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
                onClick={() => alert('智能错题导入已就绪：支持直接扫描拍照试卷或 PDF 导入错题。')}
                className="w-full h-8 px-space-md rounded-lg bg-surface-tint/10 hover:bg-surface-tint/20 text-primary font-label-md text-label-md flex items-center justify-center gap-space-xs transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">auto_read_pause</span>
                智能导入错题 (OCR / PDF)
              </button>
            </div>
          </div>

          {/* Storage & Sync Telemetry Pill Card */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">同步状态</span>
              <span className="font-label-mono text-label-mono text-secondary flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> 实时就绪
              </span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary-container h-full w-[44%] rounded-full"></div>
            </div>
            <div className="flex justify-between items-center text-on-surface-variant font-label-mono text-label-mono">
              <span>云端容量: 1.48 GB / 10 GB</span>
              <span>44%</span>
            </div>
          </div>
        </aside>

        {/* RIGHT/MAIN CANVAS: Question Stream & Topic Dashboard */}
        <section className="flex-1 min-w-0 flex flex-col gap-space-lg">
          {/* Top Folder Telemetry Banner */}
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-primary-fixed/20 to-transparent pointer-events-none"></div>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-space-lg z-10">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-sm flex-wrap">
                  <span className="px-space-sm py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-label-mono font-semibold">
                    {activeCol.code || 'MATH-COLLECTION'}
                  </span>
                  <span className="text-on-surface-variant font-label-mono text-label-mono">
                    更新于 {activeCol.updated || '刚刚'}
                  </span>
                  <span className="px-space-sm py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-mono text-label-mono font-medium">
                    {activeCol.priority || '重点关注'}
                  </span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-semibold">
                  {activeCol.title}
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                  {activeCol.desc || '针对典型易错点与阶段薄弱计算项进行深度归因与自适应变式练习。'}
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
                  onClick={() => alert('已开启错题批量标签与难度筛选整理模式。')}
                  className="h-8.5 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-space-xs transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">checklist_rtl</span>
                  批量整理
                </button>
                <button
                  type="button"
                  onClick={() => onStartExamWithMistakes(activeCol.title)}
                  className="h-8.5 px-space-md rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md flex items-center gap-space-xs transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  一键智能组卷并开考
                </button>
              </div>
            </div>
          </div>

          {/* Mistake Questions Stream */}
          <div className="flex flex-col gap-space-md">
            {mistakes.map((item) => (
              <article
                key={item.id}
                className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-md hover:shadow-md transition-all"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <div className="flex items-center gap-space-sm">
                    <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-mono text-label-mono font-semibold">
                      {item.num}
                    </span>
                    <span className="text-on-surface-variant font-label-md text-label-md">
                      {item.type} · 满分 {item.score} 分
                    </span>
                    <span className="text-outline-variant">/</span>
                    <span className="font-label-mono text-tertiary font-bold text-label-md">
                      失分: {item.myDeduction}
                    </span>
                  </div>
                  <span className="font-label-mono text-code-sm text-on-surface-variant">
                    来源：{item.source}
                  </span>
                </div>

                {/* Prompt & Formula */}
                <div className="space-y-1.5">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    {item.title}
                  </h3>
                  <div className="p-space-md bg-surface-container-low rounded-lg font-mono text-code-md text-primary font-semibold overflow-x-auto border border-outline-variant/20">
                    {item.formula}
                  </div>
                </div>

                {/* Weak Point & Error Reason */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                  <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-error-container/60 space-y-1">
                    <div className="flex items-center gap-1 text-tertiary font-label-sm text-label-sm font-semibold">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      典型错因自核：
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface">{item.errorReason}</p>
                  </div>

                  <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 space-y-1">
                    <div className="flex items-center gap-1 text-primary font-label-sm text-label-sm font-semibold">
                      <span className="material-symbols-outlined text-[16px]">school</span>
                      关联知识点考纲：
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface">{item.weakPoint}</p>
                  </div>
                </div>

                {/* Answer Comparison */}
                <div className="p-space-md bg-surface-container-low rounded-xl space-y-space-xs font-mono text-code-sm border border-outline-variant/30">
                  <div className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-sans text-label-sm font-bold shrink-0">
                      考生错解
                    </span>
                    <span className="text-on-surface-variant">{item.userWrongAnswer}</span>
                  </div>
                  <div className="flex items-start gap-2 pt-1 border-t border-surface-container">
                    <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-sans text-label-sm font-bold shrink-0">
                      标准答案
                    </span>
                    <span className="text-secondary font-semibold">{item.standardAnswer}</span>
                  </div>
                </div>

                {/* AI Tutor In-depth Analysis */}
                <div className="p-space-md bg-surface-container-high/40 rounded-xl space-y-1 border border-primary-fixed-dim">
                  <div className="flex items-center gap-1.5 font-semibold text-primary text-label-md">
                    <span className="material-symbols-outlined text-[18px]">psychology</span>
                    <span>AI 命题组深度归因解析与提分建议：</span>
                  </div>
                  <p className="text-body-sm text-on-surface leading-relaxed">{item.aiInsight}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-space-sm pt-1">
                  <button
                    type="button"
                    onClick={() => alert(`已为「${item.num}」生成 3 道同构变式题，已加入专项训练队列。`)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">psychology_alt</span>
                    AI 举一反三变式练习
                  </button>
                  <button
                    type="button"
                    onClick={() => alert(`已将「${item.num}」加入当前待练试卷！`)}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-xs transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">replay</span>
                    加入重做练习卷
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

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
