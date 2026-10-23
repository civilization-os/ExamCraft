import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import katex from 'katex';

/**
 * KatexBadge
 * 高保真轻量渲染单行 LaTeX
 */
function KatexBadge({ math, className = '' }) {
  const html = useMemo(() => {
    if (!math) return '';
    try {
      const clean = String(math).replace(/^\$+|\$+$/g, '').trim();
      return katex.renderToString(clean, {
        throwOnError: false,
        displayMode: false
      });
    } catch {
      return math;
    }
  }, [math]);

  return (
    <span
      className={`inline-flex items-center leading-none font-mono ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// 数学推导语言基本结构类别定义
export const DERIVATION_CATEGORIES = [
  {
    id: 'logic',
    label: '逻辑与量词',
    icon: 'alt_route',
    description: '核心关系：因为、所以、推出、充要、任意与存在',
    items: [
      { id: 'because', label: '因为', symbol: '\\because', latex: '\\because', insertText: '\\because ', desc: '引入已知条件或定理' },
      { id: 'therefore', label: '所以', symbol: '\\therefore', latex: '\\therefore', insertText: '\\therefore ', desc: '导出阶段性或最终结论' },
      { id: 'implies', label: '推出', symbol: '\\implies', latex: '\\implies', insertText: '\\implies ', desc: '单向逻辑蕴含 (若P则Q)' },
      { id: 'iff', label: '当且仅当', symbol: '\\iff', latex: '\\iff', insertText: '\\iff ', desc: '充要条件 / 等价关系' },
      { id: 'forall', label: '对任意', symbol: '\\forall', latex: '\\forall', insertText: '\\forall ', desc: '全称量词 (所有/任意)' },
      { id: 'exists', label: '存在', symbol: '\\exists', latex: '\\exists', insertText: '\\exists ', desc: '存在量词 (至少有一个)' },
      { id: 'exists_unique', label: '存在且唯一', symbol: '\\exists!', latex: '\\exists!', insertText: '\\exists! ', desc: '唯一存在性断言' },
      { id: 'and', label: '合取(且)', symbol: '\\land', latex: '\\land', insertText: '\\land ', desc: '逻辑且' },
      { id: 'or', label: '析取(或)', symbol: '\\lor', latex: '\\lor', insertText: '\\lor ', desc: '逻辑或' },
      { id: 'not', label: '否定(非)', symbol: '\\neg', latex: '\\neg', insertText: '\\neg ', desc: '逻辑非' },
      { id: 'in', label: '属于', symbol: '\\in', latex: '\\in', insertText: '\\in ', desc: '元素归属于集合' },
      { id: 'subset', label: '包含于', symbol: '\\subseteq', latex: '\\subseteq', insertText: '\\subseteq ', desc: '子集关系' },
      { id: 'such_that', label: '使得', symbol: '\\text{ s.t. }', latex: '\\text{ s.t. }', insertText: ' \\text{ s.t. } ', desc: '使得条件满足' },
    ]
  },
  {
    id: 'setup',
    label: '设定与假设',
    icon: 'flag',
    description: '起手式：设定变量域、换元代换、反证假设',
    items: [
      { id: 'let', label: '设', symbol: '\\text{设 }', latex: '\\text{设 } x \\in \\mathbb{R}', insertText: '设 $x \\in \\mathbb{R}$，', desc: '引入新变量或函数' },
      { id: 'set_var', label: '令', symbol: '\\text{令 }', latex: '\\text{令 } t = x^2', insertText: '令 $t = $，', desc: '换元或特化指定值' },
      { id: 'assume', label: '假设', symbol: '\\text{假设}', latex: '\\text{假设原命题不成立}', insertText: '假设原命题不成立，即', desc: '引入假定条件' },
      { id: 'contradiction_init', label: '反设', symbol: '\\text{反设}', latex: '\\text{反设结论为假}', insertText: '反设结论不成立，则', desc: '反证法起手步' },
      { id: 'denote', label: '记作', symbol: '\\text{记 }', latex: '\\text{记 } S = \\{x \\mid f(x)=0\\}', insertText: '记 $S = $，', desc: '简记复杂集合或表达式' },
      { id: 'wlog', label: '不失一般性', symbol: '\\text{W.L.O.G.}', latex: '\\text{不失一般性地设 } a \\le b', insertText: '不失一般性地设 $a \\le b$，', desc: '利用对称性化简情况' }
    ]
  },
  {
    id: 'inference',
    label: '递进与引用',
    icon: 'sync_alt',
    description: '推理骨架：又因为、结合前式、同理可得',
    items: [
      { id: 'moreover', label: '又因为', symbol: '\\text{又 } \\because', latex: '\\text{又 } \\because', insertText: '又因为 ', desc: '引入并列已知条件' },
      { id: 'from_eq1', label: '由式①可得', symbol: '\\text{由(1)得}', latex: '\\text{由 (1) 可得}', insertText: '由式①可得：', desc: '引用前序推导方程' },
      { id: 'combine', label: '结合①②可知', symbol: '\\text{结合(1)(2)}', latex: '\\text{结合 (1)(2) 得}', insertText: '结合①②可知：', desc: '联合解方程或联立不等式' },
      { id: 'similarly', label: '同理可得', symbol: '\\text{同理}', latex: '\\text{同理可得}', insertText: '同理可得：', desc: '对称情形类比推理' },
      { id: 'both_sides', label: '两边同时', symbol: '\\text{两端取}', latex: '\\lim_{x \\to 0}', insertText: '等式两边同时取极限，可得：', desc: '代数或微积分保等变形' },
      { id: 'substitute', label: '代入化简', symbol: '\\text{代入得}', latex: '\\text{代入原式化简}', insertText: '代入原式化简可得：', desc: '等量代换演算' }
    ]
  },
  {
    id: 'conclusion',
    label: '论证与收尾',
    icon: 'task_alt',
    description: '推导结语：易知、矛盾判定、综上所述、证毕 Q.E.D.',
    items: [
      { id: 'obviously', label: '易知/显然', symbol: '\\text{易知}', latex: '\\text{易知 } f(x) > 0', insertText: '易知 ', desc: '跳过平凡运算' },
      { id: 'contradiction_hit', label: '产生矛盾', symbol: '\\text{矛盾!}', latex: '\\text{产生矛盾!}', insertText: '这与已知条件矛盾，故假设不成立。', desc: '反证法导出矛盾点' },
      { id: 'in_summary', label: '综上所述', symbol: '\\text{综上}', latex: '\\text{综上所述}', insertText: '综上所述，原命题对所有实数均成立。', desc: '全部分支讨论汇流' },
      { id: 'qed_square', label: '证毕 (Q.E.D.)', symbol: '\\blacksquare', latex: '\\blacksquare \\text{ 得证}', insertText: ' $\\blacksquare$ 证毕。', desc: '证明结束标志' },
      { id: 'qed_text', label: 'Q.E.D.', symbol: '\\text{Q.E.D.}', latex: '\\text{Q.E.D.}', insertText: ' \\text{Q.E.D.}', desc: '拉丁语 Quod Erat Demonstrandum' }
    ]
  }
];

/**
 * MathDerivationDock
 * 基于 Motion for React & UI Motion Atlas 的数学推导语言智能交互坞
 * 
 * @param {Function} onInsertPrompt 插入到口述助手或指令输入框
 * @param {Function} onWriteToBoard 直接抄入画板板书
 * @param {Function} onCopyLatex 复制标准 LaTeX
 * @param {boolean} compact 是否以紧凑模式渲染
 * @param {string} className 附加样式
 */
export default function MathDerivationDock({
  onInsertPrompt = null,
  onWriteToBoard = null,
  onCopyLatex = null,
  compact = false,
  className = ''
}) {
  const [activeTab, setActiveTab] = useState('logic');
  const [copiedId, setCopiedId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const currentCategory = useMemo(() => {
    return DERIVATION_CATEGORIES.find((c) => c.id === activeTab) || DERIVATION_CATEGORIES[0];
  }, [activeTab]);

  const handleAction = (item, actionType = 'insert') => {
    if (actionType === 'board' && onWriteToBoard) {
      onWriteToBoard(item.latex || item.insertText, item.label);
    } else if (actionType === 'copy') {
      const textToCopy = item.latex || item.insertText;
      navigator.clipboard.writeText(textToCopy).catch(() => {});
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1400);
      if (onCopyLatex) onCopyLatex(textToCopy, item.label);
    } else {
      if (onInsertPrompt) {
        onInsertPrompt(item);
      } else if (onWriteToBoard) {
        onWriteToBoard(item.latex || item.insertText, item.label);
      } else {
        navigator.clipboard.writeText(item.latex || item.insertText).catch(() => {});
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 1400);
      }
    }
  };

  return (
    <div className={`flex flex-col rounded-xl bg-surface-container-lowest/95 border border-outline-variant/35 shadow-sm backdrop-blur-md overflow-hidden transition-all ${className}`}>
      {/* 顶栏：分类标签与折叠开关 */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-outline-variant/25 bg-surface-container-low/60 select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[13px]">calculate</span>
          </div>
          <span className="text-[11px] font-bold text-on-surface tracking-tight">数学推导语言</span>
          <span className="hidden sm:inline text-[10px] text-on-surface-variant font-mono">
            (符号 · 设定 · 递进 · 论证)
          </span>
        </div>

        {/* 类别切换胶囊 (带有 layoutId 的平滑水滴滑动) */}
        <div className="flex items-center gap-0.5 bg-surface-container-high/60 p-0.5 rounded-lg">
          {DERIVATION_CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveTab(cat.id);
                  if (!isExpanded) setIsExpanded(true);
                }}
                className={`relative px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title={cat.description}
              >
                {isActive && (
                  <motion.div
                    layoutId="derivationDockTab"
                    className="absolute inset-0 bg-surface-container-lowest rounded-md shadow-2xs border border-primary/20"
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
                  />
                )}
                <span className="relative z-10 material-symbols-outlined text-[12px] opacity-80">{cat.icon}</span>
                <span className="relative z-10">{cat.label}</span>
              </button>
            );
          })}

          {/* 展开/折叠按钮 */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="ml-1 p-0.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition cursor-pointer"
            title={isExpanded ? '折叠推导工具坞' : '展开推导工具坞'}
            aria-label={isExpanded ? '折叠推导工具坞' : '展开推导工具坞'}
          >
            <motion.span
              animate={{ rotate: isExpanded ? 0 : 180 }}
              transition={{ duration: 0.2 }}
              className="material-symbols-outlined text-[15px] block"
            >
              expand_less
            </motion.span>
          </button>
        </div>
      </div>

      {/* 胶囊内容展示区（带有 spring 与 height 动画） */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="derivation-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.12, duration: 0.35 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="p-2 space-y-1.5">
              {/* 分类小提示 */}
              <div className="flex items-center justify-between text-[10px] text-on-surface-variant px-0.5">
                <span>{currentCategory.description}</span>
                <span className="font-mono text-[9px] text-outline">左键填入 · 快速抄入 · 复制</span>
              </div>

              {/* 胶囊卡片流 */}
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1.5 flex-wrap max-h-[120px] overflow-y-auto pr-0.5 select-none"
              >
                {currentCategory.items.map((item) => {
                  const isCopied = copiedId === item.id;
                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ y: -1, scale: 1.015 }}
                      whileTap={{ scale: 0.96 }}
                      className="group inline-flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest hover:border-primary/50 hover:shadow-2xs transition-all overflow-hidden"
                    >
                      {/* 主按钮：填入口述助手或默认插入 */}
                      <button
                        type="button"
                        onClick={() => handleAction(item, 'insert')}
                        className="px-2 py-0.5 flex items-center gap-1.5 text-[11px] text-on-surface hover:text-primary transition cursor-pointer max-w-[240px]"
                        title={`${item.desc} (点击填入提示词/答题框)`}
                      >
                        <span className="px-1 py-0.2 rounded bg-primary/10 text-primary text-[9px] font-sans font-bold">
                          {item.label}
                        </span>
                        <span className="inline-flex items-center text-[11px]">
                          <KatexBadge math={item.symbol || item.latex} />
                        </span>
                      </button>

                      {/* 动作 1：一键抄入画板板书 */}
                      {onWriteToBoard && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(item, 'board');
                          }}
                          className="px-1.5 py-0.5 bg-surface-container-low hover:bg-primary hover:text-white text-on-surface-variant transition border-l border-outline-variant/30 cursor-pointer flex items-center gap-0.5 text-[10px]"
                          title={`一键将「${item.label}」誊写到草稿板书`}
                        >
                          <span className="material-symbols-outlined text-[11px]">edit_note</span>
                          <span className="text-[9px] hidden sm:inline">抄入</span>
                        </button>
                      )}

                      {/* 动作 2：复制 LaTeX 符号 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(item, 'copy');
                        }}
                        className={`px-1.5 py-0.5 text-on-surface-variant hover:text-primary border-l border-outline-variant/30 transition cursor-pointer flex items-center text-[10px] ${
                          isCopied ? 'bg-secondary text-white' : 'hover:bg-surface-container'
                        }`}
                        title="复制标准 LaTeX 表达式"
                      >
                        <span className="material-symbols-outlined text-[11px]">
                          {isCopied ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
