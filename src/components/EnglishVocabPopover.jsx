import React, { useState, useLayoutEffect, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { lookupWordInLexicon } from '../utils/englishLexicon';

// 全局内存缓存，防止重复请求相同单词
const globalAiWordCache = new Map();

/**
 * 规范化解析多词性释义条目
 * 保证输出标准结构：[{ pos: 'v.', meaning: '在…上做记号；标记；给…评分' }, { pos: 'n.', meaning: '记号，标记；分数' }]
 */
function parseVocabEntries(info) {
  if (!info) return [];
  // 1. 若大模型直接返回规范 items 数组
  if (Array.isArray(info.items) && info.items.length > 0) {
    const list = info.items
      .map((it) => ({
        pos: (it.pos || '释义').trim(),
        meaning: (it.meaning || it.def || it.definition || '').trim()
      }))
      .filter((it) => it.meaning);
    if (list.length > 0) return list;
  }

  const pos = (info.pos || '').trim();
  const def = (info.definition || info.def || '').trim();
  if (!def) return [];

  // 2. 识别文本中嵌套的各种词性前缀（如 v. / n. / adj. / adv. 等）
  const posRegex = /(?:^|\n|[\s;；。]+)(v\.|n\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|vi\.|vt\.)\s*/gi;
  const matches = [...def.matchAll(posRegex)];

  if (matches.length > 0) {
    const results = [];
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const curPos = cur[1].toLowerCase();
      const startIndex = cur.index + cur[0].length;
      const endIndex = i + 1 < matches.length ? matches[i + 1].index : def.length;
      let meaning = def.substring(startIndex, endIndex).trim();
      meaning = meaning.replace(/^[-\s:：]+/, '').replace(/[;；。]+$/, '');
      if (meaning) {
        results.push({ pos: curPos, meaning });
      }
    }
    if (results.length > 0) return results;
  }

  // 3. 多行格式按行拆分 (如 v. - 释义\nn. - 释义)
  if (def.includes('\n')) {
    const lines = def.split('\n').map((l) => l.trim()).filter(Boolean);
    const lineEntries = [];
    for (const line of lines) {
      const match = line.match(/^(v\.|n\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.)\s*[-:：\s]?\s*(.*)$/i);
      if (match) {
        lineEntries.push({ pos: match[1].toLowerCase(), meaning: match[2].trim() });
      } else {
        lineEntries.push({ pos: pos || '释义', meaning: line });
      }
    }
    if (lineEntries.length > 0) return lineEntries;
  }

  // 4. 单条兜底
  return [{ pos: pos || '释义', meaning: def }];
}

/**
 * 确保每个词义条目以分号结尾，各意思条理清晰
 */
function formatMeaning(meaning) {
  if (!meaning) return '';
  const trimmed = meaning.trim().replace(/[;；。]+$/, '');
  return `${trimmed};`;
}

/**
 * EnglishVocabPopover: 考场端英语划词深度 AI 破译卡片
 * 
 * 核心特性：
 * 1. 【防剧透双层开关体系】：
 *    - Header 顶层开关：控制划词是否默认给意思；
 *    - 词卡底层开关：随时单点“👁️ 看意思 / 🙈 收起”；
 * 2. 【词性-意思分行严整排版】：
 *    - 严格遵循“词性 - 意思; 换行”，多词性逐行展示，杜绝挤成一团；
 * 3. 【考场零剧透、聚焦词义、助记与搭配】：
 *    - 考场模式坚决不展示长难句全篇整句翻译，聚焦于音标、多词性释义、词根构词与核心搭配；
 * 4. 【PC 端避让 Edge 原生小菜单，移动端底部沉浸抽屉】；
 * 5. 【严密的 Un-focus 外部点击秒关】。
 */
export default function EnglishVocabPopover({
  popoverData, // { word, sentence, rect, qNum }
  isMarked,
  globalAutoLookup = false,
  onToggleMark,
  onClose
}) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeVoice, setActiveVoice] = useState(null); // 'uk' | 'us'
  const cardRef = useRef(null);

  // 移动端视口检测
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 局部第二层开关：当前单词是否展开查看释义
  const [isWordExpanded, setIsWordExpanded] = useState(globalAutoLookup);
  useEffect(() => {
    setIsWordExpanded(globalAutoLookup);
  }, [popoverData?.word, globalAutoLookup]);

  // 本地离线速查数据
  const lexiconInfo = useMemo(() => {
    if (!popoverData?.word) return null;
    return lookupWordInLexicon(popoverData.word);
  }, [popoverData?.word]);

  // AI 深度长难句语境解析状态
  const [aiData, setAiData] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (!popoverData?.word || !isWordExpanded) return;
    const wordKey = popoverData.word.toLowerCase().trim();

    // 1. 内存缓存
    if (globalAiWordCache.has(wordKey)) {
      setAiData(globalAiWordCache.get(wordKey));
      setIsAiLoading(false);
      return;
    }

    // 2. 本地持久化缓存（严格过滤旧版坏缓存与空套话）
    try {
      const stored = localStorage.getItem(`examcraft_word_ai_${wordKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const hasValidItems = Array.isArray(parsed?.items) && parsed.items.length > 0;
        const isTrashFallback =
          typeof parsed?.definition === 'string' &&
          (parsed.definition.includes('考研真题长难句核心词汇') ||
            parsed.definition.includes('考研英语真题高频核心词汇') ||
            parsed.definition === '考研真题核心词汇');

        if (!isTrashFallback && (hasValidItems || parsed?.definition)) {
          globalAiWordCache.set(wordKey, parsed);
          setAiData(parsed);
          setIsAiLoading(false);
          return;
        } else {
          localStorage.removeItem(`examcraft_word_ai_${wordKey}`);
        }
      }
    } catch {}

    // 3. 异步请求大模型
    let isCancelled = false;
    setIsAiLoading(true);

    fetch('/api/model/lookup-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: popoverData.word,
        sentence: popoverData.sentence || '',
        qNum: popoverData.qNum || ''
      })
    })
      .then((res) => res.json())
      .then((json) => {
        if (isCancelled) return;
        if (json.success && json.data) {
          globalAiWordCache.set(wordKey, json.data);
          try {
            localStorage.setItem(`examcraft_word_ai_${wordKey}`, JSON.stringify(json.data));
          } catch {}
          setAiData(json.data);
        }
      })
      .catch((err) => console.warn('[AI Word Lookup Error]:', err))
      .finally(() => {
        if (!isCancelled) setIsAiLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [popoverData?.word, popoverData?.sentence, isWordExpanded]);

  // 融合后的最终展示数据
  const activeInfo = useMemo(() => {
    const base = lexiconInfo || {};
    if (!aiData) {
      return {
        ...base,
        items: base.def ? [{ pos: base.pos || '释义', meaning: base.def }] : [],
        mnemonic: '',
        collocation: '',
        examFrequency: base.freq || 4,
        isAiEnhanced: false
      };
    }
    return {
      ...base,
      phoneticUk: aiData.phoneticUk || base.phoneticUk,
      phoneticUs: aiData.phoneticUs || base.phoneticUs,
      pos: aiData.pos || base.pos,
      items: aiData.items || [],
      definition: aiData.definition || base.definition || base.def,
      mnemonic: aiData.mnemonic || '',
      collocation: aiData.collocation || '',
      examFrequency: aiData.examFrequency || base.examFrequency || 4,
      isAiEnhanced: true
    };
  }, [lexiconInfo, aiData]);

  // 解析并格式化当前所有释义行
  const vocabEntries = useMemo(() => {
    return parseVocabEntries(activeInfo);
  }, [activeInfo]);

  // 音频发音 (Web Speech API)
  const playWord = useCallback((text, langType = 'us') => {
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
      setActiveVoice(langType);
      utterance.onend = () => {
        setIsPlayingAudio(false);
        setActiveVoice(null);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setActiveVoice(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
      setActiveVoice(null);
    }
  }, []);

  // PC 端视口自适应与选区避让定位计算
  const [coords, setCoords] = useState({ x: 0, y: 0, placement: 'bottom', arrowLeft: 20 });

  const updatePosition = useCallback(() => {
    if (!popoverData?.rect || isMobile) return;
    let targetRect = popoverData.rect;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        const r = range.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) targetRect = r;
      } catch {}
    }

    const { left, top, right, bottom, width } = targetRect;
    const cardEl = cardRef.current;
    const cardWidth = cardEl?.offsetWidth || (isWordExpanded ? 330 : 290);
    const cardHeight = cardEl?.offsetHeight || (isWordExpanded ? 240 : 44);
    const spacing = 12;

    const targetCenterX = left + width / 2;
    const clampedX = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, targetCenterX - cardWidth / 2));
    const arrowOffset = Math.max(16, Math.min(cardWidth - 24, targetCenterX - clampedX));

    const availableBelow = window.innerHeight - bottom - 24;
    const availableAbove = top - 64;

    let targetY = 0;
    let placement = 'bottom';

    // 默认优先排在下方，彻底错开 Edge 浏览器总在右上角弹出的 Mini Menu
    if (availableBelow >= cardHeight + spacing) {
      placement = 'bottom';
      targetY = bottom + spacing;
    } else if (availableAbove >= cardHeight + spacing) {
      placement = 'top';
      targetY = top - cardHeight - spacing;
    } else {
      if (availableBelow >= availableAbove) {
        placement = 'bottom';
        targetY = bottom + spacing;
      } else {
        placement = 'top';
        targetY = Math.max(68, top - cardHeight - spacing);
      }
    }

    setCoords({
      x: clampedX,
      y: targetY,
      placement,
      arrowLeft: arrowOffset
    });
  }, [popoverData?.rect, isWordExpanded, isMobile]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    if (isMobile) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [updatePosition, isMobile]);

  // 全面监听点击卡片外部（Un-focus）、按 ESC 与窗口失焦自动关闭
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (cardRef.current && cardRef.current.contains(e.target)) {
        return;
      }
      onClose?.();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose?.();
      }
    };

    const handleWindowBlur = () => {
      onClose?.();
    };

    const animId = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handleOutsideClick, true);
      document.addEventListener('touchstart', handleOutsideClick, true);
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('blur', handleWindowBlur);
    });

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('pointerdown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [onClose]);

  if (!popoverData || !popoverData.word) return null;

  const currentWord = popoverData.word;
  const sentence = popoverData.sentence || '';
  const starCount = activeInfo?.examFrequency || 4;

  // ==========================================
  // A. 移动端渲染形态 (手机端屏幕正底部 Docked Sheet)
  // ==========================================
  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          ref={cardRef}
          key={`vocab_mobile_${currentWord}_${isWordExpanded ? 'expanded' : 'collapsed'}`}
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className="fixed bottom-3 inset-x-3 z-[9999] max-w-md mx-auto bg-surface-container-lowest/98 dark:bg-slate-900/98 backdrop-blur-2xl border border-outline-variant/40 rounded-2xl shadow-[0_20px_48px_-8px_rgba(0,0,0,0.32)] p-3 text-on-surface flex flex-col gap-2.5 select-none"
          role="dialog"
          aria-label="移动端生词工具栏"
        >
          {/* 移动端顶部操作行 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base font-black font-serif text-on-surface truncate tracking-tight">
                {currentWord}
              </span>
              {activeInfo?.phoneticUk && isWordExpanded && (
                <span className="text-xs font-mono text-on-surface-variant truncate">
                  {activeInfo.phoneticUk}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* 第二层开关：随手看意思 / 隐藏 */}
              <button
                type="button"
                onClick={() => setIsWordExpanded((prev) => !prev)}
                className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                  isWordExpanded
                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30'
                    : 'bg-surface-container text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isWordExpanded ? 'visibility_off' : 'visibility'}
                </span>
                <span>{isWordExpanded ? '收起' : '看意思'}</span>
              </button>

              {/* 标记按钮 */}
              <button
                type="button"
                onClick={() => onToggleMark(currentWord, sentence, activeInfo)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all shadow-xs ${
                  isMarked
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-primary hover:bg-primary-hover text-on-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isMarked ? 'check_circle' : 'bookmark_add'}
                </span>
                <span>{isMarked ? '已收录' : '记为生词'}</span>
              </button>

              {/* 关闭 */}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[16px] block">close</span>
              </button>
            </div>
          </div>

          {/* 移动端展开模式：AI 真题释义（词性-意思换行展示）与词根搭配 */}
          {isWordExpanded && (
            <div className="pt-2 border-t border-surface-container/60 text-xs leading-relaxed space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">menu_book</span>
                  <span>考研真题释义</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => playWord(currentWord, 'uk')}
                    className="px-1.5 py-0.5 rounded bg-surface-container text-primary flex items-center gap-0.5 text-[10px]"
                  >
                    <span className="material-symbols-outlined text-[12px]">volume_up</span>
                    <span>英</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playWord(currentWord, 'us')}
                    className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant flex items-center gap-0.5 text-[10px]"
                  >
                    <span className="material-symbols-outlined text-[12px]">volume_up</span>
                    <span>美</span>
                  </button>
                </div>
              </div>

              {/* 多词性释义列表：词性 - 意思; 换行 */}
              <div className="space-y-1 bg-surface-container-low/70 dark:bg-slate-800/60 p-2 rounded-xl border border-outline-variant/30">
                {vocabEntries.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[12px] leading-relaxed select-text">
                    <span className="font-serif italic font-black text-primary shrink-0 min-w-[20px]">
                      {item.pos}
                    </span>
                    <span className="text-outline-variant font-mono select-none">-</span>
                    <span className="text-on-surface font-medium select-text break-words">
                      {formatMeaning(item.meaning)}
                    </span>
                  </div>
                ))}

                {isAiLoading && (
                  <div className="flex items-center gap-1.5 text-[10.5px] text-primary pt-1 animate-pulse">
                    <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                    <span>AI 正在提炼考研精析与真题搭配...</span>
                  </div>
                )}
              </div>

              {/* 词根词缀助记 */}
              {activeInfo?.mnemonic && (
                <div className="text-[11px] bg-primary/5 text-primary-hover dark:text-primary-light p-1.5 rounded-lg border border-primary/15 flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[12px] text-primary shrink-0 mt-0.5">lightbulb</span>
                  <span className="leading-snug select-text">
                    <strong className="font-bold text-primary mr-1">助记:</strong>
                    {activeInfo.mnemonic}
                  </span>
                </div>
              )}

              {/* 考研核心搭配 */}
              {activeInfo?.collocation && (
                <div className="text-[11px] bg-amber-500/10 text-amber-900 dark:text-amber-200 p-1.5 rounded-lg border border-amber-500/20 flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[12px] text-amber-600 shrink-0 mt-0.5">link</span>
                  <span className="leading-snug select-text">
                    <strong className="font-bold text-amber-700 dark:text-amber-300 mr-1">搭配:</strong>
                    {activeInfo.collocation}
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ==========================================
  // B. PC 端渲染形态 (AI 赋能沉浸卡片)
  // ==========================================
  return (
    <AnimatePresence>
      <motion.div
        ref={cardRef}
        key={`vocab_popover_${currentWord}_${isWordExpanded ? 'expanded' : 'collapsed'}`}
        initial={{
          opacity: 0,
          scale: 0.94,
          y: coords.placement === 'top' ? 6 : -6
        }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        style={{
          position: 'fixed',
          left: `${coords.x}px`,
          top: `${coords.y}px`,
          zIndex: 9999,
          maxWidth: isWordExpanded ? '350px' : 'auto'
        }}
        className="bg-surface-container-lowest/98 dark:bg-slate-900/98 backdrop-blur-2xl border border-outline-variant/40 rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.26)] select-none"
        role="dialog"
        aria-label={isWordExpanded ? '生词解析卡片' : '考场生词标记工具栏'}
      >
        {/* 指示小三角 */}
        <div
          style={{
            position: 'absolute',
            left: `${coords.arrowLeft}px`,
            [coords.placement === 'top' ? 'bottom' : 'top']: '-6px',
            transform: 'translateX(-50%)'
          }}
          className={`w-3 h-3 bg-surface-container-lowest dark:bg-slate-900 border-outline-variant/40 rotate-45 ${
            coords.placement === 'top' ? 'border-b border-r' : 'border-t border-l'
          }`}
        />

        {/* 状态 1：收起态（纯净防剧透胶囊，默认只标不查，高度仅 36px） */}
        {!isWordExpanded ? (
          <div className="flex items-center gap-2 px-3 py-1.5 whitespace-nowrap">
            {/* 选中的词头 */}
            <span className="text-[13px] font-bold font-serif text-on-surface tracking-tight max-w-[130px] truncate">
              {currentWord}
            </span>

            <span className="text-outline-variant/60">·</span>

            {/* 一键标记/取消按钮 */}
            <button
              type="button"
              onClick={() => onToggleMark(currentWord, sentence, activeInfo)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                isMarked
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-primary hover:bg-primary-hover text-on-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {isMarked ? 'check_circle' : 'bookmark_add'}
              </span>
              <span>{isMarked ? '已在生词本' : '记为生词'}</span>
            </button>

            {/* 第二层局部开关：当前单词直接查看释义 */}
            <button
              type="button"
              onClick={() => setIsWordExpanded(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-amber-800 dark:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
              title="点击唤起大模型结合真题长难句进行深度破译"
            >
              <span className="material-symbols-outlined text-[13px] text-amber-600">auto_awesome</span>
              <span>AI 看意思</span>
            </button>

            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={onClose}
              className="text-on-surface-variant hover:text-on-surface p-0.5 rounded hover:bg-surface-container transition-colors cursor-pointer ml-0.5"
              title="关闭"
            >
              <span className="material-symbols-outlined text-[15px] block">close</span>
            </button>
          </div>
        ) : (
          /* 状态 2：展开态（AI 赋能的深度词典、整句长难句翻译与考点点拨） */
          <div className="p-3.5 flex flex-col gap-2.5 w-[335px]">
            {/* 顶部词头、发音与局部收起开关 */}
            <div className="flex items-start justify-between gap-2 border-b border-surface-container/60 pb-2">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black font-serif text-on-surface tracking-tight truncate">
                    {currentWord}
                  </span>
                  {activeInfo?.isAiEnhanced && (
                    <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                      <span>AI 精析</span>
                    </span>
                  )}
                  {/* 第二层局部开关：随时可折叠回防剧透 */}
                  <button
                    type="button"
                    onClick={() => setIsWordExpanded(false)}
                    className="px-1.5 py-0.2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-[10px] font-sans flex items-center gap-0.5 transition-colors cursor-pointer"
                    title="收起释义，切回防剧透胶囊"
                  >
                    <span className="material-symbols-outlined text-[11px]">visibility_off</span>
                    <span>收起</span>
                  </button>
                </div>

                {/* 音标与发音按钮 */}
                <div className="flex items-center gap-1.5 mt-1 text-xs font-mono text-on-surface-variant">
                  <span>{activeInfo?.phoneticUk || `/${currentWord}/`}</span>
                  <button
                    type="button"
                    onClick={() => playWord(currentWord, 'uk')}
                    className={`p-1 rounded-md transition-all cursor-pointer hover:bg-surface-container text-primary ${
                      isPlayingAudio && activeVoice === 'uk' ? 'bg-primary/20 animate-pulse text-primary' : ''
                    }`}
                    title="播放英音发音"
                  >
                    <span className="material-symbols-outlined text-[15px] block">volume_up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playWord(currentWord, 'us')}
                    className={`p-1 rounded-md transition-all cursor-pointer hover:bg-surface-container text-on-surface-variant hover:text-primary ${
                      isPlayingAudio && activeVoice === 'us' ? 'bg-primary/20 animate-pulse text-primary' : ''
                    }`}
                    title="播放美音发音"
                  >
                    <span className="text-[10px] font-bold">US</span>
                  </button>
                </div>
              </div>

              {/* 右侧：考研频度星级与关闭 */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center text-amber-500 text-[11px]" title={`真题考查频度：${starCount}星`}>
                  {'★'.repeat(starCount)}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-on-surface-variant hover:text-on-surface p-0.5 rounded-md hover:bg-surface-container transition-colors cursor-pointer"
                  title="关闭卡片"
                >
                  <span className="material-symbols-outlined text-[16px] block">close</span>
                </button>
              </div>
            </div>

            {/* 核心释义区：词性-意思; 换行排版，绝不截断 */}
            <div className="text-xs leading-relaxed space-y-2">
              {/* 多词性释义列表 */}
              <div className="space-y-1.5 bg-surface-container-low/70 dark:bg-slate-800/60 p-2.5 rounded-xl border border-outline-variant/30">
                {vocabEntries.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed select-text">
                    <span className="font-serif italic font-black text-primary shrink-0 min-w-[22px]">
                      {item.pos}
                    </span>
                    <span className="text-outline-variant font-mono select-none">-</span>
                    <span className="text-on-surface font-medium select-text break-words">
                      {formatMeaning(item.meaning)}
                    </span>
                  </div>
                ))}

                {isAiLoading && (
                  <div className="flex items-center gap-1.5 text-[11px] text-primary pt-1 animate-pulse">
                    <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                    <span>AI 正在提炼更多考研具体词义与真题搭配...</span>
                  </div>
                )}
              </div>

              {/* 词根词缀助记 (帮助考生快速掌握构词，不剧透整题) */}
              {activeInfo?.mnemonic && (
                <div className="text-[11px] bg-primary/5 text-primary-hover dark:text-primary-light p-2 rounded-lg border border-primary/15 flex items-start gap-1.5 shadow-2xs">
                  <span className="material-symbols-outlined text-[13px] text-primary shrink-0 mt-0.5">lightbulb</span>
                  <span className="leading-snug select-text">
                    <strong className="font-bold text-primary mr-1">助记:</strong>
                    {activeInfo.mnemonic}
                  </span>
                </div>
              )}

              {/* 考研真题核心搭配 */}
              {activeInfo?.collocation && (
                <div className="text-[11px] bg-amber-500/10 text-amber-900 dark:text-amber-200 p-2 rounded-lg border border-amber-500/20 flex items-start gap-1.5 shadow-2xs">
                  <span className="material-symbols-outlined text-[13px] text-amber-600 shrink-0 mt-0.5">link</span>
                  <span className="leading-snug select-text">
                    <strong className="font-bold text-amber-700 dark:text-amber-300 mr-1">搭配:</strong>
                    {activeInfo.collocation}
                  </span>
                </div>
              )}
            </div>

            {/* 底部核心操作区 */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-surface-container/60">
              <span className="text-[10.5px] text-outline font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>考研语境切片</span>
              </span>

              <button
                type="button"
                onClick={() => onToggleMark(currentWord, sentence, activeInfo)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 ${
                  isMarked
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-primary hover:bg-primary-hover text-on-primary shadow-xs'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isMarked ? 'check_circle' : 'bookmark_add'}
                </span>
                <span>{isMarked ? '已在生词本 (移除)' : '收录至生词本'}</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
