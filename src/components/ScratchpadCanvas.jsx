import React, { useRef, useEffect, useState, useCallback } from 'react';
import MathMarkdown from './MathMarkdown';

/**
 * 数学公式 Unicode 转换与上下标符号美化映射器
 * 将 LaTeX 粗糙表达（如 $t = x^{2}$, y = x^2, \int, \frac 等）转换为高保真数学矢量字符
 */
const supMap = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
  'T': 'ᵀ', 'U': 'ᵁ', 'W': 'ᵂ',
  '*': '﹡'
};

const subMap = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ'
};

/**
 * 数学公式 Unicode 转换与上下标符号美化映射器
 * 将 LaTeX 粗糙表达（如 $t = x^{2}$, y = x^2, \int, \frac 等）转换为高保真数学矢量字符
 */
const formatMathExpression = (str) => {
  if (!str) return '';
  let s = String(str).replace(/\$/g, '').trim();

  // 1. 函数名与分式/开方
  s = s.replace(/\\(sin|cos|tan|cot|sec|csc|ln|lg|log|exp|lim|max|min|det|deg)\b/g, '$1');
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, (_, root, val) => {
    const rootSup = root.split('').map((c) => supMap[c] || c).join('');
    return `${rootSup}√(${val})`;
  });
  s = s.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  s = s.replace(/\\sqrt/g, '√');

  // 2. 积分与级数求和
  s = s.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, (_, sub, sup) => {
    const subStr = sub.split('').map((c) => subMap[c] || c).join('');
    const supStr = sup.split('').map((c) => supMap[c] || c).join('');
    return `∫${subStr}${supStr} `;
  });
  s = s.replace(/\\int/g, '∫');
  s = s.replace(/\\iint/g, '∬');
  s = s.replace(/\\sum/g, '∑');
  s = s.replace(/\\prod/g, '∏');

  // 3. 运算符与几何/逻辑符号
  s = s.replace(/\\pm/g, '±');
  s = s.replace(/\\mp/g, '∓');
  s = s.replace(/\\times/g, '×');
  s = s.replace(/\\div/g, '÷');
  s = s.replace(/\\cdot/g, '·');
  s = s.replace(/\\le|\\leq/g, '≤');
  s = s.replace(/\\ge|\\geq/g, '≥');
  s = s.replace(/\\neq|\\ne/g, '≠');
  s = s.replace(/\\approx/g, '≈');
  s = s.replace(/\\equiv/g, '≡');
  s = s.replace(/\\to|\\rightarrow/g, '→');
  s = s.replace(/\\leftarrow/g, '←');
  s = s.replace(/\\Rightarrow/g, '⇒');
  s = s.replace(/\\Leftrightarrow|\\iff/g, '⇔');
  s = s.replace(/\\infty/g, '∞');
  s = s.replace(/\\in\b/g, '∈');
  s = s.replace(/\\notin\b/g, '∉');
  s = s.replace(/\\subset\b/g, '⊂');
  s = s.replace(/\\subseteq\b/g, '⊆');
  s = s.replace(/\\cup\b/g, '∪');
  s = s.replace(/\\cap\b/g, '∩');
  s = s.replace(/\\forall\b/g, '∀');
  s = s.replace(/\\exists\b/g, '∃');
  s = s.replace(/\\partial\b/g, '∂');
  s = s.replace(/\\nabla\b/g, '∇');
  s = s.replace(/\\perp\b/g, '⊥');
  s = s.replace(/\\parallel\b/g, '∥');
  s = s.replace(/\\angle\b/g, '∠');
  s = s.replace(/\\triangle\b/g, '△');
  s = s.replace(/\\degree|\^\\circ/g, '°');

  // 4. 希腊字母 (小写)
  s = s.replace(/\\alpha\b/g, 'α');
  s = s.replace(/\\beta\b/g, 'β');
  s = s.replace(/\\gamma\b/g, 'γ');
  s = s.replace(/\\delta\b/g, 'δ');
  s = s.replace(/\\epsilon\b|\\varepsilon\b/g, 'ε');
  s = s.replace(/\\zeta\b/g, 'ζ');
  s = s.replace(/\\eta\b/g, 'η');
  s = s.replace(/\\theta\b/g, 'θ');
  s = s.replace(/\\iota\b/g, 'ι');
  s = s.replace(/\\kappa\b/g, 'κ');
  s = s.replace(/\\lambda\b/g, 'λ');
  s = s.replace(/\\mu\b/g, 'μ');
  s = s.replace(/\\nu\b/g, 'ν');
  s = s.replace(/\\xi\b/g, 'ξ');
  s = s.replace(/\\pi\b/g, 'π');
  s = s.replace(/\\rho\b/g, 'ρ');
  s = s.replace(/\\sigma\b/g, 'σ');
  s = s.replace(/\\tau\b/g, 'τ');
  s = s.replace(/\\upsilon\b/g, 'υ');
  s = s.replace(/\\phi\b|\\varphi\b/g, 'φ');
  s = s.replace(/\\chi\b/g, 'χ');
  s = s.replace(/\\psi\b/g, 'ψ');
  s = s.replace(/\\omega\b/g, 'ω');

  // 希腊字母 (大写)
  s = s.replace(/\\Delta\b/g, 'Δ');
  s = s.replace(/\\Gamma\b/g, 'Γ');
  s = s.replace(/\\Theta\b/g, 'Θ');
  s = s.replace(/\\Lambda\b/g, 'Λ');
  s = s.replace(/\\Xi\b/g, 'Ξ');
  s = s.replace(/\\Pi\b/g, 'Π');
  s = s.replace(/\\Sigma\b/g, 'Σ');
  s = s.replace(/\\Phi\b/g, 'Φ');
  s = s.replace(/\\Psi\b/g, 'Ψ');
  s = s.replace(/\\Omega\b/g, 'Ω');

  // 5. 上标转换: ^{...} 和 ^char
  s = s.replace(/\^\{([^}]+)\}/g, (_, exp) => {
    return exp.split('').map((c) => supMap[c] || c).join('');
  });
  s = s.replace(/\^([0-9a-zA-Z+-])/g, (_, exp) => supMap[exp] || `^${exp}`);

  // 6. 下标转换: _{...} 和 _char
  s = s.replace(/_\{([^}]+)\}/g, (_, sub) => {
    return sub.split('').map((c) => subMap[c] || c).join('');
  });
  s = s.replace(/_([0-9a-zA-Z+-])/g, (_, sub) => subMap[sub] || `_${sub}`);

  // 7. 清理残留 LaTeX 控制词与分组括号
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\([a-zA-Z]+)/g, '$1');
  s = s.replace(/[{}]/g, '');

  return s;
};

// 分割混合普通文本与 $数学公式$ 的段落
const parseMixedTextSegments = (rawLine) => {
  let line = String(rawLine || '').trim();
  if (!line) return [];

  // 清理 Markdown 粗体/斜体/标题/项目符号
  line = line.replace(/^#+\s*/, '');
  line = line.replace(/\*\*(.*?)\*\*/g, '$1');
  line = line.replace(/\*(.*?)\*/g, '$1');
  line = line.replace(/^[-*+]\s+/, '• ');

  // 统一 LaTeX 括号形式: \[...\] -> $$...$$, \(...\) -> $...$
  line = line.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  line = line.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // 统一将连续的 $$ 转为单个 $ 处理
  line = line.replace(/\$\$([^\$]+)\$\$/g, '$$$1$$');

  const segments = [];
  const regex = /\$([^\$]+)\$/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const normalPart = line.substring(lastIndex, match.index);
      if (normalPart) {
        segments.push({ isMath: false, text: normalPart });
      }
    }
    const mathContent = formatMathExpression(match[1]);
    if (mathContent) {
      segments.push({ isMath: true, text: mathContent });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    const remaining = line.substring(lastIndex);
    if (/[a-zA-Z]\^[0-9a-zA-Z]|[a-zA-Z]_[0-9a-zA-Z]|\\|√|∫|∑|±|≤|≥/.test(remaining)) {
      segments.push({ isMath: true, text: formatMathExpression(remaining) });
    } else {
      segments.push({ isMath: false, text: remaining });
    }
  }

  if (segments.length === 0) {
    if (/[a-zA-Z]\^[0-9a-zA-Z]|[a-zA-Z]_[0-9a-zA-Z]|\\|√|∫|∑|±|≤|≥|=|\+|-|\*|\//.test(line)) {
      segments.push({ isMath: true, text: formatMathExpression(line) });
    } else {
      segments.push({ isMath: false, text: line });
    }
  }

  return segments;
};

/**
 * 可自由拖拽与独立管理的草稿图元卡片
 * 支持整体拖动、坐标重绘、独立删除
 */
function DraggableCanvasElement({
  element,
  isActiveToolMove,
  onUpdatePosition,
  onDelete,
  drawActions
}) {
  const canvasRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (canvasRef.current && element.actions) {
      drawActions(canvasRef.current, element.actions, element.width, element.height);
    }
  }, [element.actions, element.width, element.height, drawActions]);

  const handlePointerDown = (e) => {
    const isHandle = e.target.closest('[data-drag-handle="true"]');
    if (!isHandle && !isActiveToolMove) return;

    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: element.x,
      initialY: element.y
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.stopPropagation();

    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    const newX = Math.max(10, dragStartRef.current.initialX + dx);
    const newY = Math.max(10, dragStartRef.current.initialY + dy);

    onUpdatePosition(element.id, newX, newY);
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        transform: `translate3d(${element.x}px, ${element.y}px, 0)`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        touchAction: 'none'
      }}
      className={`group rounded-xl border select-none transition-shadow duration-150 ${
        isDragging
          ? 'shadow-2xl ring-2 ring-primary border-primary bg-surface-container-lowest z-40'
          : 'shadow-xs hover:shadow-md border-outline-variant/60 bg-surface-container-lowest/90 hover:border-primary/50 z-20'
      }`}
    >
      {/* 顶部轻量浮动操作手柄条 */}
      <div
        data-drag-handle="true"
        className={`flex items-center justify-between px-2.5 py-1 rounded-t-xl border-b border-outline-variant/30 text-[11px] font-medium transition cursor-grab active:cursor-grabbing ${
          isDragging
            ? 'bg-primary/10 text-primary'
            : 'bg-surface-container-low/80 group-hover:bg-surface-container text-on-surface-variant group-hover:text-on-surface'
        }`}
        title="按住此栏可整体拖动该图元到草稿纸任意位置"
      >
        <div className="flex items-center gap-1.5 truncate pointer-events-none">
          <span className="material-symbols-outlined text-[15px] text-primary">drag_indicator</span>
          <span className="truncate font-semibold text-[11px]">{element.title || '画入草稿整体'}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-outline hidden sm:inline select-none pointer-events-none">可拖拽</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
            className="p-0.5 rounded hover:bg-error/10 hover:text-error text-outline transition cursor-pointer"
            title="移除该画入图元"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      </div>

      {/* 内部矢量渲染 Canvas */}
      <div className="relative w-full h-[calc(100%-28px)] overflow-hidden rounded-b-xl flex items-center justify-center pointer-events-none">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
}

/**
 * ScratchpadCanvas / Workbench
 * 一体化考场草稿演算工作台
 */
export default function ScratchpadCanvas({
  storageKey = 'examcraft_scratchpad_canvas',
  textStorageKey = 'examcraft_scratchpad_text',
  contextProblem = '',
  isMaximized = false,
  onToggleMaximize = null,
  onClose = null
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // ==================== 画板手绘状态 ====================
  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser' | 'select'
  const [brushColor, setBrushColor] = useState('#0f172a'); // 墨黑
  const [brushSize, setBrushSize] = useState(3); // 2 | 4 | 7
  const [paperPattern, setPaperPattern] = useState('grid'); // 'grid' | 'lined' | 'blank'

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // ==================== 画入图元对象状态（支持独立拖拽与自动防重叠布局） ====================
  const [elements, setElements] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_elements`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_elements`, JSON.stringify(elements));
    } catch (e) {
      console.warn('Elements save error:', e);
    }
  }, [elements, storageKey]);

  // ==================== 文本与板书笔记状态 ====================
  const [boardText, setBoardText] = useState(() => {
    try {
      return localStorage.getItem(textStorageKey) || '';
    } catch {
      return '';
    }
  });
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false); // 在小窗时可折叠右侧板书栏

  // ==================== Agent Loop 状态 ====================
  const [spokenInput, setSpokenInput] = useState('');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentLoopStage, setAgentLoopStage] = useState('');
  const [agentMessage, setAgentMessage] = useState('');

  // ==================== 统一 UI 弹窗与 Toast 状态 ====================
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '确认',
    confirmType: 'danger',
    onConfirm: () => {}
  });

  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'info'
  });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3500);
  }, []);

  // 保存文本到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(textStorageKey, boardText);
    } catch (e) {
      console.warn('Text save error:', e);
    }
  }, [boardText, textStorageKey]);

  // ==================== 画板尺寸自适应与高分辨率适配 ====================
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;

    let tempImgData = null;
    const ctx = canvas.getContext('2d');
    if (canvas.width > 0 && canvas.height > 0) {
      tempImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tempImgData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tempImgData.width;
      tempCanvas.height = tempImgData.height;
      tempCanvas.getContext('2d').putImageData(tempImgData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
    } else {
      const savedDataUrl = localStorage.getItem(storageKey);
      if (savedDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          saveToHistory();
        };
        img.src = savedDataUrl;
      } else {
        saveToHistory();
      }
    }
  }, [storageKey]);

  useEffect(() => {
    resizeCanvas();
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeCanvas]);

  // 保存手绘画布快照到撤销栈
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push(dataUrl);
      if (newHistory.length > 20) newHistory.shift();
      return newHistory;
    });
    setHistoryStep((prev) => Math.min(prev + 1, 19));

    try {
      localStorage.setItem(storageKey, dataUrl);
    } catch (e) {
      console.warn('Canvas save error:', e);
    }
  }, [historyStep, storageKey]);

  // 恢复历史笔画
  const restoreFromDataUrl = (dataUrl) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.drawImage(img, 0, 0, width, height);
      try {
        localStorage.setItem(storageKey, dataUrl);
      } catch (e) {
        console.warn(e);
      }
    };
    img.src = dataUrl;
  };

  // 撤销
  const handleUndo = () => {
    if (historyStep > 0) {
      const nextStep = historyStep - 1;
      setHistoryStep(nextStep);
      restoreFromDataUrl(history[nextStep]);
    }
  };

  // 重做
  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      restoreFromDataUrl(history[nextStep]);
    }
  };

  // 清空手绘与画入图元（统一内嵌 UI）
  const handleClearCanvasClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: '清空草稿纸画布',
      message: elements.length > 0
        ? '确定要清空画布吗？这将会同时清空当前的所有手绘笔迹以及已画入的函数图表与几何图元。'
        : '确定要清空当前画布上的所有手绘笔迹吗？清空后将无法恢复。',
      confirmText: '确认清空',
      confirmType: 'danger',
      onConfirm: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
          saveToHistory();
        }
        setElements([]);
        showToast('画板笔迹与画入图元已全部清空', 'info');
      }
    });
  };

  // 清空板书（统一内嵌 UI）
  const handleClearNotesClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: '清空公式笔记',
      message: '确定要清空右侧的文本与公式草稿内容吗？',
      confirmText: '清空笔记',
      confirmType: 'danger',
      onConfirm: () => {
        setBoardText('');
        showToast('公式草稿笔记已清空', 'info');
      }
    });
  };

  // 导出图片（自动将手绘笔迹与各可拖拽图元合成一张完整草稿图片）
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    // 1. 底色
    expCtx.fillStyle = '#fafaf9';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // 2. 底层手绘笔画
    expCtx.drawImage(canvas, 0, 0);

    // 3. 合成各个可拖拽整体图元
    elements.forEach((el) => {
      const tempCanvas = document.createElement('canvas');
      drawActionsOnCanvas(tempCanvas, el.actions, el.width, el.height);
      expCtx.drawImage(tempCanvas, el.x * dpr, el.y * dpr, el.width * dpr, el.height * dpr);
    });

    const link = document.createElement('a');
    link.download = `考场草稿手绘_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    showToast('草稿手绘图已导出保存（包含画入图形与板书）', 'success');
  };

  // 手绘坐标计算
  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // 手绘事件
  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getPointerPos(e);
    lastPointRef.current = pos;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (brushSize * (tool === 'eraser' ? 4 : 1)) / 2, 0, Math.PI * 2);
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = brushColor;
      ctx.fill();
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const currentPoint = getPointerPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    const midX = (lastPointRef.current.x + currentPoint.x) / 2;
    const midY = (lastPointRef.current.y + currentPoint.y) / 2;
    ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 5;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
    }

    ctx.stroke();
    lastPointRef.current = currentPoint;
  };

  const handlePointerUp = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveToHistory();
  };

  // ==================== 智能 Canvas 绘图与矢量渲染核心 ====================
  // 在指定尺寸的 canvas 内部精准居中绘制各项动作（支持自适应居中与高保真矢量排版）
  const drawActionsOnCanvas = useCallback((canvas, actions, width, height) => {
    if (!canvas || !actions || actions.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2 + 8;
    const scaleX = Math.min(26, width / 12);
    const scaleY = Math.min(26, height / 12);
    const axisLen = Math.min(width * 0.42, height * 0.42, 120);

    let textCursorY = 32;

    actions.forEach((act) => {
      if (act.type === 'write' && act.content) {
        // 1. 手写工整板书与高保真数学公式
        const lines = act.content.split('\n');
        lines.forEach((line) => {
          if (!line.trim()) {
            textCursorY += 14;
            return;
          }

          const segments = parseMixedTextSegments(line);
          let startX = 16;
          const maxWidth = width - 24;

          segments.forEach((seg) => {
            if (seg.isMath) {
              ctx.font = 'italic 700 16px "KaTeX_Math", "Cambria Math", "Times New Roman", serif';
              ctx.fillStyle = '#1d4ed8';
            } else {
              ctx.font = '600 15px "KaTeX_Main", "STKaiti", "KaiTi", "Microsoft YaHei", sans-serif';
              ctx.fillStyle = act.color || '#0f172a';
            }

            const chars = seg.isMath
              ? (seg.text.split(/(\s+|[=+\-×÷≤≥≠≈<>]+|[()])/).filter(Boolean))
              : seg.text.split('');

            for (let i = 0; i < chars.length; i++) {
              const piece = chars[i];
              const pieceWidth = ctx.measureText(piece).width;
              if (startX + pieceWidth > maxWidth) {
                startX = 16;
                textCursorY += 26;
              }
              ctx.fillText(piece, startX, textCursorY);
              startX += pieceWidth;
            }
            startX += seg.isMath ? 4 : 2;
          });

          textCursorY += 28;
        });
        textCursorY += 8;

      } else if (act.type === 'axes') {
        // 2. 绘制直角坐标系
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';

        // X 轴
        ctx.beginPath();
        ctx.moveTo(cx - axisLen, cy);
        ctx.lineTo(cx + axisLen, cy);
        ctx.lineTo(cx + axisLen - 8, cy - 5);
        ctx.moveTo(cx + axisLen, cy);
        ctx.lineTo(cx + axisLen - 8, cy + 5);
        ctx.stroke();

        // Y 轴
        ctx.beginPath();
        ctx.moveTo(cx, cy + axisLen);
        ctx.lineTo(cx, cy - axisLen);
        ctx.lineTo(cx - 5, cy - axisLen + 8);
        ctx.moveTo(cx, cy - axisLen);
        ctx.lineTo(cx + 5, cy - axisLen + 8);
        ctx.stroke();

        // 标签 O, x, y
        ctx.fillStyle = '#334155';
        ctx.font = 'italic bold 15px "KaTeX_Math", serif';
        ctx.fillText(act.xLabel || 'x', cx + axisLen + 6, cy + 4);
        ctx.fillText(act.yLabel || 'y', cx - 6, cy - axisLen - 8);
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('O', cx - 14, cy + 14);

      } else if (act.type === 'plot') {
        // 3. 绘制函数图像曲线
        ctx.strokeStyle = act.color || '#1d4ed8';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';

        ctx.beginPath();
        let isFirst = true;

        const evalFn = (x) => {
          const expr = (act.expr || 'x^2').toLowerCase().replace(/\s+/g, '');
          if (expr.includes('sin')) return Math.sin(x);
          if (expr.includes('cos')) return Math.cos(x);
          if (expr.includes('tan')) return Math.abs(Math.cos(x)) > 0.08 ? Math.tan(x) : NaN;
          if (expr.includes('ln') || expr.includes('log')) return x > 0.05 ? Math.log(x) : NaN;
          if (expr.includes('exp') || expr.includes('e^x')) return Math.exp(x);
          if (expr.includes('sqrt')) return x >= 0 ? Math.sqrt(x) : NaN;
          if (expr.includes('1/x')) return Math.abs(x) > 0.05 ? 1 / x : NaN;
          if (expr.includes('-x^2') || expr.includes('-x²')) return -Math.pow(x, 2);
          if (expr.includes('x^3') || expr.includes('x³')) return Math.pow(x, 3);
          if (expr.includes('x^2') || expr.includes('x²')) return Math.pow(x, 2);
          if (expr.includes('2x+1') || expr.includes('2*x+1')) return 2 * x + 1;
          if (expr.includes('2x-1') || expr.includes('2*x-1')) return 2 * x - 1;
          if (expr.includes('2x') || expr.includes('2*x')) return 2 * x;
          if (expr.includes('-x')) return -x;
          if (expr === 'x' || expr === 'y=x') return x;
          try {
            const safeExpr = expr.replace(/y=/, '').replace(/\^/g, '**').replace(/(\d)x/g, '$1*x');
            const val = Function('x', `"use strict"; return (${safeExpr})`)(x);
            return typeof val === 'number' && !isNaN(val) ? val : Math.pow(x, 2);
          } catch {
            return Math.pow(x, 2);
          }
        };

        for (let x = -3.5; x <= 3.5; x += 0.08) {
          const y = evalFn(x);
          if (!isNaN(y) && isFinite(y)) {
            const canvasX = cx + x * scaleX;
            const canvasY = cy - y * scaleY;
            if (canvasY >= cy - axisLen && canvasY <= cy + axisLen && canvasX >= cx - axisLen && canvasX <= cx + axisLen) {
              if (isFirst) {
                ctx.moveTo(canvasX, canvasY);
                isFirst = false;
              } else {
                ctx.lineTo(canvasX, canvasY);
              }
            } else {
              isFirst = true;
            }
          } else {
            isFirst = true;
          }
        }
        ctx.stroke();

        if (act.label) {
          const formattedLabel = formatMathExpression(act.label);
          ctx.fillStyle = act.color || '#1d4ed8';
          ctx.font = 'italic 700 15px "KaTeX_Math", "Cambria Math", "Times New Roman", serif';
          ctx.fillText(formattedLabel, cx + 45, cy - 60);
        }

      } else if (act.type === 'shape') {
        // 4. 绘制几何图形
        ctx.strokeStyle = act.color || '#047857';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const originX = cx - 55;
        const originY = cy - 40;

        if (act.shapeType === 'right_triangle') {
          ctx.beginPath();
          ctx.moveTo(originX, originY + 90);
          ctx.lineTo(originX + 120, originY + 90);
          ctx.lineTo(originX, originY);
          ctx.closePath();
          ctx.stroke();

          // 直角标
          ctx.beginPath();
          ctx.moveTo(originX, originY + 76);
          ctx.lineTo(originX + 14, originY + 76);
          ctx.lineTo(originX + 14, originY + 90);
          ctx.stroke();

          ctx.fillStyle = act.color || '#047857';
          ctx.font = 'bold 14px serif';
          ctx.fillText(act.labels?.[0] || 'A', originX - 16, originY);
          ctx.fillText(act.labels?.[1] || 'C', originX - 16, originY + 105);
          ctx.fillText(act.labels?.[2] || 'B', originX + 125, originY + 105);

        } else if (act.shapeType === 'circle') {
          const r = 45;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + r, cy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = act.color || '#047857';
          ctx.font = 'bold 13px serif';
          ctx.fillText('O', cx - 12, cy - 4);
          ctx.fillText('r', cx + 18, cy - 6);
        } else {
          // 一般三角形
          ctx.beginPath();
          ctx.moveTo(cx, originY);
          ctx.lineTo(originX + 120, originY + 85);
          ctx.lineTo(originX - 10, originY + 85);
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = act.color || '#047857';
          ctx.font = 'bold 14px serif';
          ctx.fillText(act.labels?.[0] || 'A', cx - 5, originY - 8);
          ctx.fillText(act.labels?.[1] || 'B', originX - 22, originY + 98);
          ctx.fillText(act.labels?.[2] || 'C', originX + 125, originY + 98);
        }

      } else if (act.type === 'line') {
        // 5. 辅助线 / 切线
        ctx.strokeStyle = act.color || '#b91c1c';
        ctx.lineWidth = 1.8;
        if (act.lineType === 'dashed') ctx.setLineDash([5, 5]);
        const lx1 = cx - 70;
        const ly1 = cy + 30;
        const lx2 = cx + 70;
        const ly2 = cy - 40;
        ctx.beginPath();
        ctx.moveTo(lx1, ly1);
        ctx.lineTo(lx2, ly2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (act.label) {
          ctx.fillStyle = act.color || '#b91c1c';
          ctx.font = '12px sans-serif';
          ctx.fillText(act.label, (lx1 + lx2) / 2 + 5, (ly1 + ly2) / 2 - 8);
        }
      }
    });

    ctx.restore();
  }, []);

  // 智能寻找不重叠的空闲槽位坐标（充分利用大草稿纸横纵向空间）
  const findNextAvailablePosition = useCallback((elemWidth, elemHeight) => {
    const container = containerRef.current;
    const containerW = container ? container.clientWidth : 900;
    const containerH = container ? container.clientHeight : 600;
    const pad = 24;
    const startX = 30;
    const startY = 30;

    if (!elements || elements.length === 0) {
      return { x: startX, y: startY };
    }

    // 1. 尝试紧随最后一个元素右侧水平排布
    const last = elements[elements.length - 1];
    const rightCandidateX = last.x + last.width + pad;
    const rightCandidateY = last.y;

    if (rightCandidateX + elemWidth <= containerW - pad) {
      const collides = elements.some((el) => {
        return (
          rightCandidateX < el.x + el.width &&
          rightCandidateX + elemWidth > el.x &&
          rightCandidateY < el.y + el.height &&
          rightCandidateY + elemHeight > el.y
        );
      });
      if (!collides) {
        return { x: rightCandidateX, y: rightCandidateY };
      }
    }

    // 2. 水平排不下，换行到下一排：找到当前所有元素的最大底部
    let maxBottom = 0;
    elements.forEach((el) => {
      if (el.y + el.height > maxBottom) {
        maxBottom = el.y + el.height;
      }
    });

    const nextRowY = maxBottom + pad;
    if (nextRowY + elemHeight <= containerH + 300) {
      return { x: startX, y: nextRowY };
    }

    // 3. 兜底微偏移排列
    return {
      x: Math.min((last.x + 36) % Math.max(containerW - elemWidth - pad, 100) + startX, containerW - elemWidth - pad),
      y: (last.y + 36) % Math.max(containerH - elemHeight - pad, 100) + startY
    };
  }, [elements]);

  // 更新图元坐标
  const handleUpdateElementPosition = useCallback((id, x, y) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, x, y } : el))
    );
  }, []);

  // 删除单个画入图元
  const handleDeleteElement = useCallback((id) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    showToast('已移除该草稿图元', 'info');
  }, []);

  // ==================== 核心 Agent Loop 执行逻辑 ====================
  const handleTriggerAgentLoop = async (customPrompt = '') => {
    const textToRun = (customPrompt || spokenInput).trim();
    if (!textToRun) {
      showToast('请先输入或点击快捷指令选择要画的图或写的字', 'warn');
      return;
    }

    setIsAgentRunning(true);
    setAgentLoopStage('Loop 1 · 诚信纪律审计中...');
    setAgentMessage('');

    try {
      await new Promise((r) => setTimeout(r, 200));
      setAgentLoopStage('Loop 2 · 编译 Canvas 绘图与手写指令...');

      const res = await fetch('/api/model/scratchpad-agent-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spokenText: textToRun,
          contextProblem: contextProblem,
          currentBoardContent: boardText
        })
      });

      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Agent Loop 执行失败', 'warn');
        return;
      }

      setAgentLoopStage('Loop 3 · 正在画板上执行画图与书写...');
      const agentData = data.agentData;

      if (!agentData.audit.passed) {
        setAgentMessage(`⚠️ ${agentData.audit.reason}：只能帮画/帮写您说出的内容，严禁代算代答！`);
        showToast('检测到计算诱导，已触碰考场防作弊纪律红线', 'warn');
      } else {
        // 1. 将 AI 画入内容编译为一个独立、可自由拖拽、自动防重叠的草稿图元！
        if (agentData.canvasActions && agentData.canvasActions.length > 0) {
          const acts = agentData.canvasActions;
          let elemTitle = '草稿演算图元';
          let elemWidth = 320;
          let elemHeight = 270;

          const hasPlot = acts.some(a => a.type === 'plot');
          const hasAxes = acts.some(a => a.type === 'axes');
          const hasShape = acts.some(a => a.type === 'shape');
          const hasWrite = acts.some(a => a.type === 'write');

          if (hasPlot) {
            const plotAct = acts.find(a => a.type === 'plot');
            const labelStr = formatMathExpression(plotAct?.label || plotAct?.expr || '');
            elemTitle = `📈 函数图像: ${labelStr || 'y = x²'}`;
            elemWidth = 320;
            elemHeight = 280;
          } else if (hasAxes) {
            elemTitle = '📈 直角坐标系';
            elemWidth = 320;
            elemHeight = 280;
          } else if (hasShape) {
            const shapeAct = acts.find(a => a.type === 'shape');
            const shapeNameMap = {
              right_triangle: '直角三角形',
              circle: '圆形与半径',
              triangle: '三角形'
            };
            elemTitle = `📐 几何图形: ${shapeNameMap[shapeAct?.shapeType] || '几何图形'}`;
            elemWidth = 280;
            elemHeight = 250;
          } else if (hasWrite) {
            const writeAct = acts.find(a => a.type === 'write');
            const lineCount = (writeAct?.content || '').split('\n').length;
            elemTitle = '📝 规范板书演算';
            elemWidth = Math.min(360, (containerRef.current?.clientWidth || 700) - 60);
            elemHeight = Math.max(130, Math.min(360, lineCount * 32 + 55));
          }

          // 智能防重叠排版寻址
          const pos = findNextAvailablePosition(elemWidth, elemHeight);

          const newElem = {
            id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title: elemTitle,
            x: pos.x,
            y: pos.y,
            width: elemWidth,
            height: elemHeight,
            actions: acts,
            createdAt: Date.now()
          };

          setElements((prev) => [...prev, newElem]);
        }

        // 2. 同步追加到右侧规范板书笔记（过滤闲聊元话语，只留纯正板书）
        const cleanScribe = (agentData.scribeResult || '')
          .replace(/^(?:口述|考生)?(?:需求|指令|输入)[：:]\s*.*?\n+/gi, '')
          .replace(/^(?:规范|正式)?(?:草稿|板书)(?:记录)?[：:]\s*/gi, '')
          .trim();

        if (cleanScribe) {
          const newBoardText = boardText
            ? `${boardText}\n\n${cleanScribe}`
            : cleanScribe;
          setBoardText(newBoardText);
        }

        setSpokenInput('');
        setAgentMessage('✨ AI 已在画板上完成画图与手写板书（未作多余代算）');
        showToast('AI 已在草稿板上为您完成画图与写字！', 'success');
      }
    } catch (err) {
      showToast(`Agent Loop 异常: ${err.message}`, 'warn');
    } finally {
      setIsAgentRunning(false);
      setAgentLoopStage('');
    }
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-surface-container-lowest rounded-2xl">
      {/* 统一 Toast 顶部提示条 */}
      {toast.show && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-60 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium shadow-lg flex items-center gap-1.5 backdrop-blur-md border ${
              toast.type === 'success'
                ? 'bg-primary text-on-primary border-primary/20'
                : toast.type === 'warn'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-on-surface text-surface border-outline-variant/30'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'warn' ? 'warning' : 'info'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* 统一自定义 Confirm 确认弹窗（约束在草稿工作台内部，居中显示且绝不被遮挡） */}
      {confirmDialog.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-outline-variant/40 space-y-3 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-error">
              <span className="material-symbols-outlined text-[24px]">warning_amber</span>
              <h4 className="font-semibold text-on-surface text-[16px]">{confirmDialog.title}</h4>
            </div>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-medium transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`px-3.5 py-1.5 rounded-lg text-white text-[12px] font-semibold transition cursor-pointer shadow-xs ${
                  confirmDialog.confirmType === 'danger'
                    ? 'bg-error hover:bg-error/90'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部主工作台控制工具栏 */}
      <div className="flex items-center justify-between gap-1.5 px-3 py-2 border-b border-surface-container shrink-0 flex-wrap text-[12px] bg-surface-container-low/40">
        {/* 左区：画板与考场学术诚信防线标志 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-primary font-bold">
            <span className="material-symbols-outlined text-[19px]">draw</span>
            <span className="text-[13px]">草稿演算工作台</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container/30 border border-secondary/20 text-secondary text-[11px] font-medium">
            <span className="material-symbols-outlined text-[13px]">shield</span>
            <span>铁律：AI 帮画帮写不帮算，只能局限于您说出的内容</span>
          </div>
        </div>

        {/* 中区：手绘画笔/橡皮/粗细/颜色/背景底纹 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 画笔 / 橡皮 / 拖动整体 */}
          <div className="flex items-center bg-surface-container-lowest p-0.5 rounded-lg border border-outline-variant/30">
            <button
              type="button"
              onClick={() => setTool('brush')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                tool === 'brush' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="手绘笔（在画布空白处涂鸦、演算）"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              <span className="text-[11px]">笔</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                tool === 'eraser' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="橡皮擦（擦除手绘笔迹）"
            >
              <span className="material-symbols-outlined text-[14px]">ink_eraser</span>
              <span className="text-[11px]">擦</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('select')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                tool === 'select' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="拖动整体（可直接点击并移动任意画入的坐标系、图形与公式）"
            >
              <span className="material-symbols-outlined text-[14px]">pan_tool</span>
              <span className="text-[11px]">拖动</span>
            </button>
          </div>

          {/* 粗细 */}
          <div className="flex items-center gap-1 bg-surface-container-lowest p-0.5 rounded-lg border border-outline-variant/30">
            {[
              { size: 2, label: '细', dot: 'w-1 h-1' },
              { size: 4, label: '中', dot: 'w-2 h-2' },
              { size: 7, label: '粗', dot: 'w-3 h-3' }
            ].map((item) => (
              <button
                key={item.size}
                type="button"
                onClick={() => setBrushSize(item.size)}
                className={`p-1 rounded flex items-center justify-center transition cursor-pointer ${
                  brushSize === item.size ? 'bg-surface-container-high ring-1 ring-primary' : 'hover:bg-surface-container'
                }`}
                title={`粗细: ${item.label}`}
              >
                <div
                  className={`rounded-full ${item.dot}`}
                  style={{ backgroundColor: tool === 'eraser' ? '#64748b' : brushColor }}
                />
              </button>
            ))}
          </div>

          {/* 调色盘 */}
          {tool === 'brush' && (
            <div className="flex items-center gap-1 bg-surface-container-lowest px-1.5 py-0.5 rounded-lg border border-outline-variant/30">
              {[
                { color: '#0f172a', name: '墨黑' },
                { color: '#1d4ed8', name: '考场蓝' },
                { color: '#b91c1c', name: '红' },
                { color: '#047857', name: '绿' }
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setBrushColor(c.color)}
                  className={`w-3.5 h-3.5 rounded-full transition cursor-pointer ${
                    brushColor === c.color ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          {/* 稿纸底纹 */}
          <div className="flex items-center bg-surface-container-lowest p-0.5 rounded-lg border border-outline-variant/30">
            {[
              { id: 'grid', label: '方格' },
              { id: 'lined', label: '横线' },
              { id: 'blank', label: '白纸' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaperPattern(p.id)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  paperPattern === p.id ? 'bg-surface-container-high text-primary font-semibold' : 'text-on-surface-variant'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 撤销 / 重做 / 导出 / 清空手绘 */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyStep <= 0}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer disabled:opacity-30"
              title="撤销上一步笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">undo</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer disabled:opacity-30"
              title="重做下一步笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">redo</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition cursor-pointer"
              title="导出手绘草稿为图片"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
            </button>
            <button
              type="button"
              onClick={handleClearCanvasClick}
              className="p-1 rounded text-outline hover:text-error hover:bg-surface-container transition cursor-pointer"
              title="清空当前手绘笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            </button>
          </div>
        </div>

        {/* 右区：侧栏收放、全屏与关闭控制 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsNotesCollapsed(!isNotesCollapsed)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 cursor-pointer border ${
              !isNotesCollapsed
                ? 'bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant/30'
            }`}
            title={isNotesCollapsed ? '展开右侧公式与 Agent 帮写板书' : '收起右侧板书栏以扩充手绘区域'}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isNotesCollapsed ? 'splitscreen_left' : 'splitscreen'}
            </span>
            <span>{isNotesCollapsed ? '展开板书栏' : '收起板书'}</span>
          </button>

          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer"
              title={isMaximized ? '还原为便签窗口' : '放大为全屏大工作台'}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isMaximized ? 'close_fullscreen' : 'open_in_full'}
              </span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition cursor-pointer"
              title="收起草稿纸"
            >
              <span className="material-symbols-outlined text-[17px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* 主体工作区：手绘画布 与 公式板书 一体同屏并存 */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full h-full p-2 gap-2">
        {/* 左侧：手绘涂鸦主画板 */}
        <div
          ref={containerRef}
          className={`relative h-full rounded-xl border border-outline-variant/40 overflow-hidden touch-none shadow-inner transition-all duration-200 ${
            tool === 'select' ? 'cursor-grab' : 'cursor-crosshair'
          } ${
            isNotesCollapsed ? 'w-full' : 'flex-1 min-w-[320px]'
          }`}
          style={{
            backgroundColor: '#fafaf9',
            backgroundImage:
              paperPattern === 'grid'
                ? 'linear-gradient(to right, rgba(148, 163, 184, 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.22) 1px, transparent 1px)'
                : paperPattern === 'lined'
                ? 'linear-gradient(to bottom, transparent calc(28px - 1px), rgba(148, 163, 184, 0.28) calc(28px - 1px))'
                : 'none',
            backgroundSize: paperPattern === 'grid' ? '24px 24px' : paperPattern === 'lined' ? '100% 28px' : 'auto'
          }}
        >
          {/* 底层手绘涂鸦 Canvas */}
          <canvas
            ref={canvasRef}
            onPointerDown={tool !== 'select' ? handlePointerDown : undefined}
            onPointerMove={tool !== 'select' ? handlePointerMove : undefined}
            onPointerUp={tool !== 'select' ? handlePointerUp : undefined}
            onPointerCancel={tool !== 'select' ? handlePointerUp : undefined}
            className={`absolute inset-0 block w-full h-full touch-none ${
              tool === 'select' ? 'pointer-events-none' : ''
            }`}
          />

          {/* 上层浮动可拖拽图元层（支持按住手柄或拖动工具任意挪动位置，彻底解决重叠） */}
          {elements.map((el) => (
            <DraggableCanvasElement
              key={el.id}
              element={el}
              isActiveToolMove={tool === 'select'}
              onUpdatePosition={handleUpdateElementPosition}
              onDelete={handleDeleteElement}
              drawActions={drawActionsOnCanvas}
            />
          ))}

          {history.length <= 1 && elements.length === 0 && (
            <div className="absolute bottom-3 left-3 pointer-events-none text-[11px] text-outline/60 flex items-center gap-1 font-mono">
              <span className="material-symbols-outlined text-[14px]">gesture</span>
              <span>手绘画板：支持鼠标/触控笔涂鸦，右侧可让 AI 帮画坐标系、函数图与板书（自动排版防重叠、支持整体自由拖动）</span>
            </div>
          )}

          {elements.length > 0 && (
            <div className="absolute bottom-2.5 right-3 pointer-events-none text-[11px] bg-surface-container-lowest/85 backdrop-blur-xs px-2.5 py-1 rounded-full border border-outline-variant/30 text-on-surface-variant flex items-center gap-1.5 shadow-xs">
              <span className="material-symbols-outlined text-[14px] text-primary">drag_pan</span>
              <span>按住图元顶部手柄或使用【拖动】工具，可任意挪动画入内容</span>
            </div>
          )}
        </div>

        {/* 右侧：一体化公式板书与 Agent Loop 帮画/帮写协作区 */}
        {!isNotesCollapsed && (
          <div className="w-full lg:w-[420px] xl:w-[460px] h-full flex flex-col gap-2 shrink-0 animate-in fade-in duration-150">
            {/* 模块 1：Agent Loop 口述帮画 & 帮写工作区 */}
            <div className="bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between text-[12px] font-medium text-on-surface">
                <div className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                  <span>AI 帮画图 & 帮写板书 (Agent Loop)</span>
                </div>
                <span className="text-[10px] text-outline">
                  只能帮画/写您说的 · 严禁帮算
                </span>
              </div>

              {/* 快捷画图 & 常用板书指令胶囊 */}
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { label: '📈 直角坐标系', prompt: '帮我画一个标准的直角坐标系' },
                  { label: '抛物线 y=x²', prompt: '画一个直角坐标系并绘制二次函数 y=x^2 抛物线' },
                  { label: '正弦 y=sin(x)', prompt: '画一个直角坐标系并绘制正弦波 y=sin(x)' },
                  { label: '📐 直角三角形', prompt: '画一个直角三角形 ABC，角 C 为直角' },
                  { label: '⭕ 画圆与半径', prompt: '画一个圆并标出圆心 O 和半径 r' }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setSpokenInput(item.prompt);
                      handleTriggerAgentLoop(item.prompt);
                    }}
                    disabled={isAgentRunning}
                    className="px-2 py-0.5 rounded-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-[10px] font-medium border border-outline-variant/30 transition cursor-pointer disabled:opacity-40"
                    title={`点击快捷执行：${item.prompt}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 口述/需求输入框 */}
              <div className="relative">
                <textarea
                  value={spokenInput}
                  onChange={(e) => setSpokenInput(e.target.value)}
                  placeholder="说出或输入您要画的图或写的字，例如：
“画一个坐标系并在上面画 y = x^2”
“帮我把设项：设 u = ln(x+1) 写入画板”
（AI 将严格按您所说在画板上作画/写字，绝不替您算答案）"
                  disabled={isAgentRunning}
                  rows={2}
                  className="w-full p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/40 text-[12px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                />
              </div>

              {/* Agent 触发按钮与状态 */}
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <div className="flex items-center gap-1 text-[11px]">
                  {isAgentRunning ? (
                    <span className="text-primary font-mono animate-pulse flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                      <span>{agentLoopStage}</span>
                    </span>
                  ) : agentMessage ? (
                    <span className="text-secondary text-[11px] truncate max-w-[210px]" title={agentMessage}>
                      {agentMessage}
                    </span>
                  ) : (
                    <span className="text-outline text-[11px]">随时下达画图或写字指令</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleTriggerAgentLoop()}
                  disabled={isAgentRunning || !spokenInput.trim()}
                  className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  <span className={`material-symbols-outlined text-[13px] ${isAgentRunning ? 'animate-spin' : ''}`}>
                    {isAgentRunning ? 'progress_activity' : 'auto_fix_high'}
                  </span>
                  <span>{isAgentRunning ? '执行绘制中...' : '⚡ AI 帮画 / 帮写'}</span>
                </button>
              </div>
            </div>

            {/* 模块 2：规范板书与 KaTeX 预览 */}
            <div className="flex-1 min-h-0 bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30 flex flex-col gap-1.5 overflow-hidden">
              <div className="flex items-center justify-between pb-1 border-b border-surface-container shrink-0 text-[12px]">
                <div className="flex items-center gap-1.5 text-on-surface font-medium">
                  <span className="material-symbols-outlined text-[15px] text-secondary">menu_book</span>
                  <span>板书备份与 KaTeX 公式</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleClearNotesClick}
                    className="text-outline hover:text-error text-[11px] px-1.5 py-0.5 rounded hover:bg-surface-container transition cursor-pointer"
                    title="清空板书"
                  >
                    清空板书
                  </button>
                </div>
              </div>

              {/* 板书内容展示与编辑 */}
              <div className="flex-1 min-h-0 grid grid-cols-1 gap-2 overflow-hidden">
                <textarea
                  value={boardText}
                  onChange={(e) => setBoardText(e.target.value)}
                  placeholder="AI 整理的公式板书文本同步备份于此，亦可在此自由记录..."
                  className="h-20 w-full p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-[12px] font-mono text-on-surface focus:outline-none resize-none leading-relaxed shrink-0"
                />

                <div className="flex-1 overflow-y-auto p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-[13px] leading-relaxed text-on-surface">
                  {boardText.trim() ? (
                    <MathMarkdown content={boardText} />
                  ) : (
                    <div className="text-outline text-center py-6 text-[12px]">
                      在上方输入指令让 AI 在左侧画图/写字，右侧将同步呈现高保真 KaTeX 公式
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-1 border-t border-surface-container flex items-center justify-between shrink-0 text-[11px] text-outline font-mono">
                <span>{boardText.length} 字符</span>
                <span>草稿演算专享 · 不计入卷面</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
