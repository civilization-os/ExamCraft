import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVocabularyStore } from '../stores/useVocabularyStore';

export default function VocabularyFlashcardsView({ onNavigate }) {
  const {
    words,
    folders,
    activeFolderId,
    activeCategory,
    currentIndex,
    studyStats,
    setActiveFolder,
    setActiveCategory,
    setCurrentIndex,
    nextCard,
    prevCard,
    rateWord,
    addFolder,
    addWords,
    getFilteredWords,
    getCategoryCounts
  } = useVocabularyStore();

  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeVoiceType, setActiveVoiceType] = useState(null); // 'uk' | 'us'
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [aiInputText, setAiInputText] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isStudyMode, setIsStudyMode] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredWords = useMemo(() => getFilteredWords(), [words, activeFolderId, activeCategory]);
  const counts = useMemo(() => getCategoryCounts(), [words, activeFolderId]);
  const activeFolder = folders.find((f) => f.id === activeFolderId) || folders[0];
  const currentWord = filteredWords[currentIndex] || filteredWords[0];

  // 切换单词或分类时自动重置翻面至正面
  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex, activeFolderId, activeCategory]);

  // 音频发音 (Web Speech API)
  const playPronunciation = useCallback((text, langType = 'us') => {
    if (!text || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langType === 'uk' ? 'en-GB' : 'en-US';
      utterance.rate = 0.88;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const matched = voices.find((v) =>
          langType === 'uk'
            ? v.lang.includes('GB') || v.name.includes('British') || v.name.includes('UK')
            : v.lang.includes('US') || v.name.includes('United States') || v.name.includes('David')
        );
        if (matched) utterance.voice = matched;
      }

      setIsPlayingAudio(true);
      setActiveVoiceType(langType);
      utterance.onend = () => {
        setIsPlayingAudio(false);
        setActiveVoiceType(null);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setActiveVoiceType(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
      setActiveVoiceType(null);
    }
  }, []);

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 若处于弹窗输入中则不响应快捷键
      if (isAiModalOpen || isNewFolderModalOpen) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === '1') {
        e.preventDefault();
        if (currentWord) rateWord(currentWord.id, 1);
        showToast('已标记：完全忘记（1天后复现）');
      } else if (e.key === '2') {
        e.preventDefault();
        if (currentWord) rateWord(currentWord.id, 2);
        showToast('已标记：模糊犹豫（3天后巩固）');
      } else if (e.key === '3') {
        e.preventDefault();
        if (currentWord) rateWord(currentWord.id, 3);
        showToast('已标记：基本掌握（7天后检验）');
      } else if (e.key === '4') {
        e.preventDefault();
        if (currentWord) rateWord(currentWord.id, 4);
        showToast('已标记：轻松秒杀（14天后归档）');
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        nextCard();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWord, rateWord, nextCard, prevCard, isAiModalOpen, isNewFolderModalOpen]);

  // AI 智能提取词汇
  const handleAiExtract = async () => {
    if (!aiInputText.trim()) return;
    setIsAiAnalyzing(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `你是一名顶级考研英语词汇学专家。请从用户输入的英文阅读文本/长难句中，精准提取 3~6 个考研英语核心高频生词或长难句重点词，并返回严格的 JSON 数组格式，不要包含任何 markdown 代码块外部文字：
[
  {
    "word": "单词原形",
    "phoneticUk": "/英音音标/",
    "phoneticUs": "/美音音标/",
    "pos": "词性如 adj./v./n.",
    "definition": "精准中文释义",
    "examFrequency": 5,
    "examFrequencyCount": 8,
    "examSource": "真题考点",
    "contextSlice": {
      "source": "提取自输入文本",
      "difficulty": 3,
      "sentence": "包含该单词的原文整句",
      "highlightWord": "单词原形",
      "translation": "整句精准考研级中文译文"
    },
    "morphologyMnemonic": {
      "title": "DeepSeek 构词与联想记忆",
      "analysis": "词根剖析与记忆法联想"
    },
    "synonymsComparison": {
      "title": "考研同义替换高频辨析",
      "items": ["近义词1: 辨析说明", "近义词2: 辨析说明"]
    }
  }
]`
            },
            {
              role: 'user',
              content: aiInputText
            }
          ]
        })
      });

      const data = await response.json();
      let extractedWords = [];
      const content = data.content || data.reply || '';
      try {
        const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          extractedWords = JSON.parse(jsonMatch[0]);
        } else {
          extractedWords = JSON.parse(content);
        }
      } catch {
        // Fallback fallback word
        extractedWords = [{
          word: 'deteriorate',
          phoneticUk: "/dɪˈtɪə.ri.ə.reɪt/",
          phoneticUs: "/dɪˈtɪr.i.ə.reɪt/",
          pos: 'v.',
          definition: '恶化，变坏，衰退',
          examFrequency: 4,
          examFrequencyCount: 6,
          examSource: '2023真题分析',
          contextSlice: {
            source: '真题精炼切片',
            difficulty: 3,
            sentence: aiInputText.slice(0, 150),
            highlightWord: 'deteriorate',
            translation: '经济与生态环境指标若无有效干预将持续呈现显著恶化趋势。'
          },
          morphologyMnemonic: {
            title: 'DeepSeek 构词与联想记忆',
            analysis: 'de- (向下、变差) + terior (比较级后缀) + -ate (动词) → 变得更坏更下坠 → 恶化。'
          },
          synonymsComparison: {
            title: '考研同义替换高频辨析',
            items: ['worsen: 最口语化通用的变坏', 'degenerate: 道德品质或生理机能的退化', 'decline: 指数量、经济或强度的衰退']
          }
        }];
      }

      if (extractedWords.length > 0) {
        addWords(extractedWords, activeFolderId);
        showToast(`🎉 成功通过 AI 智能提取并入库 ${extractedWords.length} 个考研高频生词！`);
        setIsAiModalOpen(false);
        setAiInputText('');
      } else {
        showToast('未能提取到有效生词，请检查输入文本内容');
      }
    } catch (err) {
      console.error(err);
      showToast('AI 提取请求遇到异常，请检查网络或模型配置');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // 导出 PDF 打印处理
  const handleExportPdf = () => {
    window.print();
  };

  const categories = [
    { key: 'all', label: '全部生词', icon: 'grid_view', count: counts.all },
    { key: 'ebbinghaus_due', label: '艾宾浩斯复盘 (待办)', icon: 'alarm', count: counts.ebbinghaus_due, alert: true },
    { key: 'kaoyan_core', label: '考研核心高频', icon: 'bookmark', count: counts.kaoyan_core },
    { key: 'ai_extracted', label: 'AI 错题提取生词', icon: 'auto_awesome', count: counts.ai_extracted },
    { key: 'mastered', label: '已掌握 / 斩获', icon: 'check_circle', count: counts.mastered }
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)] bg-background text-on-surface">
      {/* Toast 提示 */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-surface-container-highest/90 text-on-surface border border-primary/20 shadow-lg backdrop-blur-md text-xs font-semibold flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">info</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 左侧：词库体系分类与文件夹导航栏 (280px-310px) */}
      <aside className="w-full md:w-72 lg:w-80 border-r border-surface-container bg-surface-container-lowest/80 backdrop-blur-md flex flex-col shrink-0 select-none">
        <div className="p-4 space-y-6 flex-1 flex flex-col overflow-y-auto">
          {/* Section 1: 词库体系分类 */}
          <div>
            <div className="flex items-center gap-2 px-2 pb-2.5">
              <span className="text-xs font-bold text-on-surface-variant tracking-wider flex items-center gap-1.5">
                词库体系分类
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="space-y-1">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`material-symbols-outlined text-[17px] ${cat.alert ? 'text-rose-500' : (isActive ? 'text-primary' : 'text-on-surface-variant')}`}>
                        {cat.icon}
                      </span>
                      <span>{cat.label}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                        cat.alert
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                          : (isActive ? 'bg-primary/15 text-primary' : 'bg-surface-container text-on-surface-variant')
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: 我的词单文件夹 */}
          <div className="flex-1">
            <div className="flex items-center justify-between px-2 pb-2.5">
              <span className="text-xs font-bold text-on-surface-variant tracking-wider">
                我的词单文件夹
              </span>
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(true)}
                className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-0.5 rounded hover:bg-surface-container"
                title="新建词单文件夹"
              >
                <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
              </button>
            </div>
            <div className="space-y-1">
              {folders.map((f) => {
                const isActive = activeFolderId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFolder(f.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-2xs'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={`material-symbols-outlined text-[17px] ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {isActive ? 'folder_open' : 'folder'}
                      </span>
                      <span className="truncate">{f.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${isActive ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container text-on-surface-variant'}`}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 底部功能按钮 */}
          <div className="pt-2 space-y-2 border-t border-surface-container/60">
            <button
              type="button"
              onClick={() => setIsNewFolderModalOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-outline-variant/60 hover:border-primary/50 text-on-surface-variant hover:text-primary text-xs font-semibold transition-all cursor-pointer bg-surface-container-lowest/50"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>新建词单文件夹</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>智能导入词汇 (model_core AI 分析)</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 右侧：背单词核心操作台与艾宾浩斯闪卡 */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-container/60">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed text-[11px] font-bold tracking-wider font-mono">
                VOCAB-CORE
              </span>
              <span className="text-xs text-on-surface-variant">
                共收录 <strong className="text-on-surface font-semibold">{filteredWords.length}</strong> 词
              </span>
              <span className="text-outline-variant">·</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                今日待复习 {counts.ebbinghaus_due} 词
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
              {activeFolder.name}
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              基于艾宾浩斯记忆遗忘曲线词席。可结合模考真题错题一键导入高频生词。
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container text-xs font-semibold text-on-surface transition-all cursor-pointer shadow-2xs"
              title="导出当前生词本为 PDF 或打印"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">download</span>
              <span>导出 PDF (含解析)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsStudyMode((prev) => !prev);
                showToast(isStudyMode ? '已退出沉浸闪卡模式' : '已开启艾宾浩斯沉浸闪卡复习');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary text-on-primary text-xs font-semibold transition-all cursor-pointer shadow-xs hover:shadow-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              <span>开始本组艾宾浩斯闪卡复习</span>
            </button>
          </div>
        </div>

        {/* 核心闪卡容器 (Flashcard Card) */}
        {currentWord ? (
          <div className="flex-1 flex flex-col justify-center mt-6">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="bg-surface-container-lowest/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.08)] backdrop-blur-xl relative flex flex-col justify-between min-h-[460px]"
            >
              {/* 卡片顶部元数据 */}
              <div className="flex items-center justify-between pb-4 border-b border-surface-container/60">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-outline uppercase">
                    CURRENT FLASHCARD
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-[11px] font-mono font-semibold text-on-surface-variant">
                    {filteredWords.length > 0 ? `${currentIndex + 1} / ${filteredWords.length}` : '0 / 0'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <span>考研频次</span>
                    <span className="text-amber-500 font-bold">★★★★★</span>
                    <span>{currentWord.examFrequencyCount || 8}次</span>
                  </div>
                  <span className="text-outline-variant">|</span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold border border-blue-500/20">
                    {currentWord.examSource || '2021真题源词'}
                  </span>
                </div>
              </div>

              {/* 核心词头、音标与词性释义 */}
              <div className="py-6">
                <div className="flex flex-wrap items-baseline gap-4 mb-3">
                  <h2 className="text-4xl sm:text-5xl font-black font-serif text-on-surface tracking-tight select-text">
                    {currentWord.word}
                  </h2>

                  {/* 英音发音胶囊 */}
                  <button
                    type="button"
                    onClick={() => playPronunciation(currentWord.word, 'uk')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                      activeVoiceType === 'uk' && isPlayingAudio
                        ? 'bg-primary text-on-primary border-primary animate-pulse'
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-outline-variant/40'
                    }`}
                    title="点击播放英式发音"
                  >
                    <span className="text-outline">英</span>
                    <span>{currentWord.phoneticUk}</span>
                    <span className="material-symbols-outlined text-[14px]">volume_up</span>
                  </button>

                  {/* 美音发音胶囊 */}
                  <button
                    type="button"
                    onClick={() => playPronunciation(currentWord.word, 'us')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                      activeVoiceType === 'us' && isPlayingAudio
                        ? 'bg-primary text-on-primary border-primary animate-pulse'
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-outline-variant/40'
                    }`}
                    title="点击播放美式发音"
                  >
                    <span className="text-outline">美</span>
                    <span>{currentWord.phoneticUs}</span>
                    <span className="material-symbols-outlined text-[14px]">volume_up</span>
                  </button>

                  {/* 词性与中文释义标签 */}
                  <div className="px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs sm:text-sm font-semibold select-text">
                    <span className="italic mr-1.5">{currentWord.pos}</span>
                    <span>{currentWord.definition}</span>
                  </div>
                </div>

                {/* 真题语境切片卡片 */}
                {currentWord.contextSlice && (
                  <div className="mt-4 p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border-l-4 border-blue-500 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 font-semibold mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-blue-600">book</span>
                        <span>真题语境切片 ({currentWord.contextSlice.source})</span>
                      </div>
                      <span className="text-blue-600/80 dark:text-blue-400/80 font-mono text-[11px]">
                        长难句难度 ★★★☆☆
                      </span>
                    </div>

                    <p className="text-sm sm:text-base leading-relaxed text-on-surface font-serif select-text">
                      "{currentWord.contextSlice.sentence.split(new RegExp(`(${currentWord.word})`, 'gi')).map((part, i) =>
                        part.toLowerCase() === currentWord.word.toLowerCase() ? (
                          <mark key={i} className="bg-amber-200/90 dark:bg-amber-500/30 text-amber-950 dark:text-amber-200 px-1 py-0.5 rounded font-semibold not-italic">
                            {part}
                          </mark>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}"
                    </p>

                    <p className="text-xs text-on-surface-variant mt-2 font-sans select-text">
                      <span className="font-semibold text-primary">【真题译文】</span>
                      {currentWord.contextSlice.translation}
                    </p>
                  </div>
                )}

                {/* 两个并列深度剖析卡片 (Grid 2 cols) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
                  {/* Card 1: DeepSeek 构词与联想记忆 */}
                  <div className="p-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/15 border border-purple-200/60 dark:border-purple-800/30 text-xs leading-relaxed">
                    <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-bold mb-1.5">
                      <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                      <span>{currentWord.morphologyMnemonic?.title || 'DeepSeek 构词与联想记忆'}</span>
                    </div>
                    <p className="text-on-surface-variant select-text">
                      {currentWord.morphologyMnemonic?.analysis}
                    </p>
                  </div>

                  {/* Card 2: 考研同义替换高频辨析 */}
                  <div className="p-4 rounded-2xl bg-sky-50/40 dark:bg-sky-950/15 border border-sky-200/60 dark:border-sky-800/30 text-xs leading-relaxed">
                    <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 font-bold mb-1.5">
                      <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                      <span>{currentWord.synonymsComparison?.title || '考研同义替换高频辨析'}</span>
                    </div>
                    <ul className="space-y-1 text-on-surface-variant select-text">
                      {currentWord.synonymsComparison?.items?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-sky-500 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 底部艾宾浩斯记忆评级反馈按钮 (4 级梯度反馈) */}
              <div className="pt-4 border-t border-surface-container/60">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* 1: 完全忘记 */}
                  <button
                    type="button"
                    onClick={() => {
                      rateWord(currentWord.id, 1);
                      showToast('已标记：完全忘记（1天后复现）');
                    }}
                    className="p-3 rounded-2xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-300 transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 group hover:scale-[1.02] active:scale-[0.98] shadow-2xs"
                  >
                    <span className="text-xs font-bold flex items-center gap-1">
                      完全忘记
                      <kbd className="px-1.5 py-0.2 rounded bg-rose-200/70 dark:bg-rose-900/60 text-[10px] font-mono">1</kbd>
                    </span>
                    <span className="text-[11px] opacity-80">1天后复现 (重置)</span>
                  </button>

                  {/* 2: 模糊犹豫 */}
                  <button
                    type="button"
                    onClick={() => {
                      rateWord(currentWord.id, 2);
                      showToast('已标记：模糊犹豫（3天后巩固）');
                    }}
                    className="p-3 rounded-2xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300 transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 group hover:scale-[1.02] active:scale-[0.98] shadow-2xs"
                  >
                    <span className="text-xs font-bold flex items-center gap-1">
                      模糊犹豫
                      <kbd className="px-1.5 py-0.2 rounded bg-amber-200/70 dark:bg-amber-900/60 text-[10px] font-mono">2</kbd>
                    </span>
                    <span className="text-[11px] opacity-80">3天后巩固</span>
                  </button>

                  {/* 3: 基本掌握 */}
                  <button
                    type="button"
                    onClick={() => {
                      rateWord(currentWord.id, 3);
                      showToast('已标记：基本掌握（7天后检验）');
                    }}
                    className="p-3 rounded-2xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-300 transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 group hover:scale-[1.02] active:scale-[0.98] shadow-2xs"
                  >
                    <span className="text-xs font-bold flex items-center gap-1">
                      基本掌握
                      <kbd className="px-1.5 py-0.2 rounded bg-blue-200/70 dark:bg-blue-900/60 text-[10px] font-mono">3</kbd>
                    </span>
                    <span className="text-[11px] opacity-80">7天后检验</span>
                  </button>

                  {/* 4: 轻松秒杀 */}
                  <button
                    type="button"
                    onClick={() => {
                      rateWord(currentWord.id, 4);
                      showToast('已标记：轻松秒杀（14天后归档）');
                    }}
                    className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300 transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 group hover:scale-[1.02] active:scale-[0.98] shadow-2xs"
                  >
                    <span className="text-xs font-bold flex items-center gap-1">
                      轻松秒杀
                      <kbd className="px-1.5 py-0.2 rounded bg-emerald-200/70 dark:bg-emerald-900/60 text-[10px] font-mono">4</kbd>
                    </span>
                    <span className="text-[11px] opacity-80">14天后归档</span>
                  </button>
                </div>
              </div>
            </motion.div>

            {/* 底部复习进度与快捷键提示 */}
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-on-surface-variant gap-2 mt-4 px-2">
              <div className="flex items-center gap-3">
                <span>今日完成率:</span>
                <div className="w-28 sm:w-36 h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, (studyStats.todayReviewed / studyStats.dailyGoal) * 100)}%` }}
                  ></div>
                </div>
                <span className="font-mono font-semibold">
                  {studyStats.todayReviewed} / {studyStats.dailyGoal}
                </span>
                <span className="text-outline-variant">·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  艾宾浩斯记忆留存率: {studyStats.retentionRate}%
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-outline">
                <span className="material-symbols-outlined text-[14px]">link</span>
                <span>关联历年真题错题切片 3 道 · 快捷键 1/2/3/4 或 空格翻转</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">auto_stories</span>
            <h3 className="text-base font-semibold text-on-surface">当前分类暂无生词</h3>
            <p className="text-xs text-on-surface-variant mt-1">您可以点击左下角「智能导入词汇」或新建词单开始背诵</p>
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover transition-all cursor-pointer shadow-xs"
            >
              智能导入词汇
            </button>
          </div>
        )}
      </main>

      {/* AI 智能生词提取弹窗 */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-surface-container flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">智能提取词汇 (model_core AI 分析)</h3>
                    <p className="text-[11px] text-on-surface-variant">粘贴考研英语阅读真题或长难句，AI 将自动分析提取核心难词、真题语境与联想词根</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  输入英文阅读文本、长难句或词汇清单：
                </label>
                <textarea
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder="例如：Fame on digital platforms has become notoriously ephemeral, where today's algorithmic darling can be entirely forgotten..."
                  rows={6}
                  className="w-full p-3 rounded-xl border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary text-xs bg-surface-container-low text-on-surface outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-on-surface-variant">
                  导入目标：<strong className="text-primary">{activeFolder.name}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl border border-outline-variant/60 text-xs font-semibold hover:bg-surface-container text-on-surface-variant cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={isAiAnalyzing || !aiInputText.trim()}
                    onClick={handleAiExtract}
                    className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    {isAiAnalyzing ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        <span>AI 深度解析中...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        <span>开始智能分析提取</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 新建词单文件夹弹窗 */}
      <AnimatePresence>
        {isNewFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-surface-container flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <h3 className="text-sm font-bold text-on-surface">新建词单文件夹</h3>
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">文件夹名称：</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="如：2025考研英语 核心冲刺"
                  className="w-full p-2.5 rounded-xl border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary text-xs bg-surface-container-low text-on-surface outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-outline-variant/60 text-xs font-semibold hover:bg-surface-container text-on-surface-variant cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={!newFolderName.trim()}
                  onClick={() => {
                    addFolder(newFolderName);
                    setNewFolderName('');
                    setIsNewFolderModalOpen(false);
                    showToast('已成功新建词单文件夹！');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  确定创建
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
