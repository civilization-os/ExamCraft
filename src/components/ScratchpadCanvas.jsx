import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import katex from 'katex';
import SelectMenu from './SelectMenu';
import MathMarkdown from './MathMarkdown';
import MathDerivationDock from './MathDerivationDock';

/**
 * 高性能 KaTeX 内联数学表达式渲染组件
 */
export function KatexInline({ math = '', className = '' }) {
  const html = useMemo(() => {
    if (!math) return '';
    const clean = String(math).replace(/^\$+|\$+$/g, '').trim();
    try {
      return katex.renderToString(clean, {
        displayMode: false,
        throwOnError: false,
        strict: false
      });
    } catch {
      return clean;
    }
  }, [math]);

  if (!html) return null;
  return (
    <span
      className={`inline-flex items-center leading-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

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
  s = s.replace(/\\implies\b|\\Rightarrow\b/g, '⇒');
  s = s.replace(/\\iff\b|\\Leftrightarrow\b/g, '⇔');
  s = s.replace(/\\because\b/g, '∵');
  s = s.replace(/\\therefore\b/g, '∴');
  s = s.replace(/\\(arcsin|arccos|arctan)\b/g, '$1 ');
  s = s.replace(/\\(sin|cos|tan|cot|sec|csc|ln|lg|log|exp)\b/g, '$1 ');
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

const parseMathContentSegments = (rawMath) => {
  const segments = [];
  const matrixPattern = /\\begin\{(pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix)\}([\s\S]*?)\\end\{\1\}/g;
  let lastIndex = 0;
  let match;
  let hasMatrix = false;

  while ((match = matrixPattern.exec(rawMath)) !== null) {
    hasMatrix = true;
    const before = rawMath.slice(lastIndex, match.index);
    if (before.trim()) segments.push(...parseMathContentSegments(before));
    const rows = match[2]
      .replace(/\\hline/g, '')
      .split(/\\\\/)
      .map((row) => row.split('&').map((cell) => formatMathExpression(cell.trim())));
    segments.push({ type: 'matrix', environment: match[1], rows });
    lastIndex = matrixPattern.lastIndex;
  }

  if (hasMatrix) {
    const trailing = rawMath.slice(lastIndex);
    if (trailing.trim()) segments.push(...parseMathContentSegments(trailing));
    return segments;
  }

  const readGroup = (source, openIndex) => {
    if (source[openIndex] !== '{') return null;
    let depth = 0;
    for (let index = openIndex; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) return { value: source.slice(openIndex + 1, index), end: index + 1 };
      }
    }
    return null;
  };

  const fractionSegments = [];
  let plainStart = 0;
  const fractionCommand = /\\(?:dfrac|tfrac|frac)\s*\{/g;
  while ((match = fractionCommand.exec(rawMath)) !== null) {
    const numerator = readGroup(rawMath, fractionCommand.lastIndex - 1);
    if (!numerator) continue;
    let denominatorStart = numerator.end;
    while (/\s/.test(rawMath[denominatorStart] || '')) denominatorStart += 1;
    const denominator = readGroup(rawMath, denominatorStart);
    if (!denominator) continue;

    if (match.index > plainStart) {
      fractionSegments.push({ isMath: true, text: formatMathExpression(rawMath.slice(plainStart, match.index)) });
    }
    fractionSegments.push({
      type: 'fraction',
      numerator: parseMathContentSegments(numerator.value),
      denominator: parseMathContentSegments(denominator.value)
    });
    plainStart = denominator.end;
    fractionCommand.lastIndex = denominator.end;
  }

  if (fractionSegments.length) {
    if (plainStart < rawMath.length) fractionSegments.push({ isMath: true, text: formatMathExpression(rawMath.slice(plainStart)) });
    return fractionSegments;
  }

  return [{ isMath: true, text: formatMathExpression(rawMath) }];
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
    segments.push(...parseMathContentSegments(match[1]));
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    const remaining = line.substring(lastIndex);
    if (/[a-zA-Z]\^[0-9a-zA-Z]|[a-zA-Z]_[0-9a-zA-Z]|\\|√|∫|∑|±|≤|≥/.test(remaining)) {
      segments.push(...parseMathContentSegments(remaining));
    } else {
      segments.push({ isMath: false, text: remaining });
    }
  }

  if (segments.length === 0) {
    if (/[a-zA-Z]\^[0-9a-zA-Z]|[a-zA-Z]_[0-9a-zA-Z]|\\|√|∫|∑|±|≤|≥|=|\+|-|\*|\//.test(line)) {
      segments.push(...parseMathContentSegments(line));
    } else {
      segments.push({ isMath: false, text: line });
    }
  }

  return segments;
};

/**
 * 试题专属核心公式与推演子式高灵敏度提取引擎 (0ms 本地瞬时提取，无网络依赖)
 */
export const extractFormulasFromProblem = (questionData, contextProblem = '') => {
  const chips = [];
  const seenLatex = new Set();

  const addChip = (rawLatex, category = 'core', customLabel = null) => {
    if (!rawLatex) return;
    let clean = String(rawLatex).trim();
    clean = clean.replace(/^\$+|\$+$/g, '').trim();
    if (!clean || clean.length < 2) return;
    if (/^[0-9\.\,\;\:\?\!]+$/.test(clean)) return;

    const normKey = clean.replace(/\s+/g, '');
    if (seenLatex.has(normKey)) return;
    seenLatex.add(normKey);

    const formatted = customLabel || formatMathExpression(clean);
    chips.push({
      id: `chip_local_${chips.length}_${Date.now()}`,
      label: formatted || clean,
      latex: `$${clean}$`,
      category,
      actionPrompt: `帮我写下公式：$${clean}$`
    });
  };

  // 1. 汇集文本池（题干、公式、选项）
  const textPool = [];
  if (contextProblem) textPool.push(contextProblem);
  if (questionData?.prompt) textPool.push(questionData.prompt);
  if (questionData?.mathExpression) textPool.push(questionData.mathExpression);
  if (Array.isArray(questionData?.options)) {
    questionData.options.forEach((opt) => {
      if (opt && opt.text) textPool.push(opt.text);
    });
  }

  // 1. 提取题干中的已知公式（严格白纸黑字已知式，归类为 'core'：题干公式）
  const stemPool = [];
  if (contextProblem) stemPool.push(contextProblem);
  if (questionData?.prompt) stemPool.push(questionData.prompt);
  if (questionData?.mathExpression) stemPool.push(questionData.mathExpression);
  const stemText = stemPool.join('\n');

  // 提取 $...$ 与 $$...$$
  const dollarRegex = /\$\$([\s\S]+?)\$\$|\$([^\$]+?)\$/g;
  let match;
  while ((match = dollarRegex.exec(stemText)) !== null) {
    const raw = match[1] || match[2];
    if (raw) addChip(raw, 'core');
  }

  // 提取 \( ... \) 与 \[ ... \]
  const slashRegex = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
  while ((match = slashRegex.exec(stemText)) !== null) {
    const raw = match[1] || match[2];
    if (raw) addChip(raw, 'core');
  }

  // 提取题干中原样出现的极限自变量趋向（如 x -> 0，原样提取，绝不补充任何题外定理与展开式）
  if (stemText.includes('x \\to 0') || stemText.includes('x\\to 0') || stemText.includes('x -> 0') || stemText.includes('x->0')) {
    addChip('x \\to 0', 'core', '极限趋向 x → 0');
  }

  // 2. 提取选项中的参数与表达式（归类为 'option'：选项参数）
  if (Array.isArray(questionData?.options)) {
    questionData.options.forEach((opt) => {
      if (!opt || !opt.text) return;
      const optStr = String(opt.text).trim();
      let optMatched = false;
      const optDollarRegex = /\$\$([\s\S]+?)\$\$|\$([^\$]+?)\$/g;
      while ((match = optDollarRegex.exec(optStr)) !== null) {
        const raw = match[1] || match[2];
        if (raw) {
          addChip(raw, 'option');
          optMatched = true;
        }
      }
      const optSlashRegex = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
      while ((match = optSlashRegex.exec(optStr)) !== null) {
        const raw = match[1] || match[2];
        if (raw) {
          addChip(raw, 'option');
          optMatched = true;
        }
      }
      // 若选项为纯文本赋值形式（如 A. a = 1/6, b = -1）
      if (!optMatched) {
        const cleanOpt = optStr.replace(/^[A-D][\.\、\:\s]*/, '').trim();
        if (cleanOpt && /[a-zA-Z]\s*=/.test(cleanOpt)) {
          addChip(cleanOpt, 'option');
        }
      }
    });
  }

  // 坚决杜绝任何泰勒展开式、等价无穷小自动联想，100% 局限于试题原文，严守考场学术诚信防作弊！
  return chips;
};

/**
 * 从当前草稿板图元中实时提取已推导成立的已知等式池 (Equivalence Pool)
 */
export const extractBoardEquivalencePool = (boardText = '') => {
  if (!boardText || typeof boardText !== 'string') return [];
  const lines = boardText.split('\n').map((l) => l.trim()).filter(Boolean);
  const equations = [];
  const seen = new Set();

  for (const rawLine of lines) {
    const clauses = rawLine
      .split(/[,，;；]|\b(?:则|即|可得)\b/)
      .map((c) => c.trim())
      .filter(Boolean);

    for (const clause of clauses) {
      const clean = clause
        .replace(/\$/g, '')
        .replace(/\\(?:therefore|because|implies)\s*/g, '')
        .replace(/^(?:令|则|由|可得|即|又因为|因为|所以)\s*/, '')
        .trim();

      const match = clean.match(/^([a-zA-Z0-9'\\^_\s()+\-*]+?)\s*=\s*(.+)$/);
      if (match) {
        const lhs = match[1].trim();
        const rhs = match[2].trim();
        if (lhs && rhs && lhs !== rhs && !seen.has(`${lhs}=${rhs}`)) {
          seen.add(`${lhs}=${rhs}`);
          equations.push({
            id: `board_eq_${equations.length}_${lhs.replace(/[\s\\]/g, '')}`,
            raw: `${lhs} = ${rhs}`,
            lhs,
            rhs,
            key: lhs.replace(/[\s\\(){}^_]/g, '').toLowerCase()
          });
        }
      }
    }
  }
  return equations;
};

/**
 * 智能估算板书演算所需的自适应高度，避免多层分式或行内换行被 Canvas 边缘裁切
 */
export const estimateBoardHeight = (content = '', cardWidth = 520) => {
  if (!content || typeof content !== 'string') return 240;
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return 200;

  let totalHeight = 48; // padding top and bottom
  const charCapacityPerLine = Math.max(20, Math.floor((cardWidth - 40) / 11));

  for (const line of lines) {
    const hasFraction = /\\(?:frac|dfrac|tfrac)\{/.test(line);
    const fractionCount = (line.match(/\\(?:frac|dfrac|tfrac)\{/g) || []).length;
    const hasRoot = /\\sqrt/.test(line);
    const hasMatrix = /\\begin\{/.test(line);

    let baseLineH = 32;
    if (hasMatrix) {
      const rows = (line.match(/\\\\/g) || []).length + 1;
      baseLineH = Math.max(40, rows * 26 + 12);
    } else if (fractionCount > 1) {
      baseLineH = 50;
    } else if (hasFraction) {
      baseLineH = 44;
    } else if (hasRoot) {
      baseLineH = 38;
    }

    const approxLen = line.replace(/\\[a-zA-Z]+/g, 'X').length;
    const wrapLines = Math.max(1, Math.ceil(approxLen / charCapacityPerLine));
    totalHeight += wrapLines * baseLineH + 8;
  }

  return Math.max(240, Math.min(1800, totalHeight));
};

/**
 * 智能提取板书的核心推导结论式（用于卡片折叠时展示核心结论，如 (\arcsin x)' = \frac{1}{\sqrt{1-x^2}} 或最终等式）
 */
export const extractBoardConclusion = (content = '', explicitConclusion = '') => {
  if (explicitConclusion && typeof explicitConclusion === 'string' && explicitConclusion.trim()) {
    return explicitConclusion.trim();
  }
  if (!content || typeof content !== 'string') return '';
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';

  // 1. 寻找初始设项，例如 "设 $y = \arcsin x$"、"令 $t = 2x+1$"、"$y = \arcsin x$"
  let initialSubject = null;
  for (const line of lines) {
    const cleanLine = line.replace(/^\s*(?:设|令|已知|记)\s*/, '').replace(/\$/g, '').trim();
    const initMatch = cleanLine.match(/^([a-zA-Z](?:\([a-zA-Z0-9]+\))?)\s*=\s*(.+)$/);
    if (initMatch && !initialSubject) {
      initialSubject = { varName: initMatch[1].trim(), expr: initMatch[2].trim() };
      break;
    }
  }

  // 2. 从后向前寻找包含 \therefore、∴、或等号的最终结论行
  let finalEq = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    let line = lines[i].trim();
    if (line.includes('\\therefore') || line.includes('∴') || line.includes('=')) {
      line = line
        .replace(/^\$+/, '')
        .trim()
        .replace(/^(?:\\therefore|\\because|∴|∵|所以|由此可得|由此得|可得|故|即)\s*/g, '')
        .replace(/^\$+|\$+$/g, '')
        .trim();
      finalEq = line;
      break;
    }
  }

  if (!finalEq) {
    finalEq = lines[lines.length - 1].replace(/^\$+|\$+$/g, '').trim();
  }

  // 3. 若初始设有 y = \arcsin x，最终式为 y' = \frac{1}{\sqrt{1-x^2}}，可升华组合为 (\arcsin x)' = \frac{1}{\sqrt{1-x^2}}
  if (initialSubject && finalEq) {
    const varPrime = initialSubject.varName + "'";
    if (finalEq.startsWith(varPrime)) {
      const rest = finalEq.slice(varPrime.length).trim();
      return `(${initialSubject.expr})' ${rest}`.trim();
    }
  }

  return finalEq;
};

/**
 * 智能根据板书内容生成贴切的数学标题（若用户未自定义标题，自动根据推演内容命名）
 */
export const generateSmartBoardTitle = (content = '', explicitTitle = '', isCustom = false) => {
  if (isCustom && explicitTitle) return explicitTitle;
  if (explicitTitle && typeof explicitTitle === 'string' && explicitTitle.trim()) {
    const t = explicitTitle.trim();
    return t.startsWith('📝') ? t : `📝 ${t}`;
  }
  if (!content || typeof content !== 'string') return '📝 规范板书演算';

  // 1. 反三角函数系列
  if (/\\(?:arcsin|arccos|arctan)\b/.test(content)) {
    const funcMatch = content.match(/\\(arcsin|arccos|arctan)(?:\s*([xyt]))?/);
    const funcName = funcMatch ? funcMatch[1] : 'arcsin';
    const varName = (funcMatch && funcMatch[2]) ? funcMatch[2] : 'x';
    if (/'|\\cos\b|求导|导数/.test(content)) {
      return `📝 ${funcName}(${varName}) 求导推演`;
    }
    return `📝 反三角函数 ${funcName}(${varName}) 推演`;
  }

  // 2. 积分与级数
  if (/\\int|\\iint/.test(content)) {
    return '📝 积分演算推导';
  }
  if (/\\sum\b/.test(content)) {
    return '📝 级数求和推演';
  }

  // 3. 极限
  if (/\\lim\b/.test(content)) {
    return '📝 极限运算推导';
  }

  // 4. 矩阵与行列式
  if (/\\begin\{(?:pmatrix|bmatrix|vmatrix)\}|\\det\b/.test(content)) {
    return '📝 矩阵/行列式推演';
  }

  // 5. 三角函数
  if (/\\(?:sin|cos|tan)\b/.test(content)) {
    if (/'|求导|导数/.test(content)) {
      return '📝 三角函数求导推演';
    }
    return '📝 三角函数恒等变形';
  }

  // 6. 指数与对数
  if (/\\ln\b|\\exp\b|e\^/.test(content)) {
    return '📝 指数/对数函数推导';
  }

  // 7. 特征值与微分方程
  if (/\\lambda|特征值/.test(content)) {
    return '📝 特征值与特征向量';
  }
  if (/d[ytx]\s*\/\s*d[xyt]/.test(content)) {
    return '📝 微分方程演算';
  }

  // 8. 提取首行等式作为主题（例如令 t = 2x + 1）
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const firstLineEq = lines[0].match(/\$?([a-zA-Z](?:\([a-zA-Z0-9]+\))?\s*=\s*[^$,\n]+)\$?$/);
    if (firstLineEq) {
      const cleanSubject = firstLineEq[1].replace(/\$/g, '').slice(0, 18);
      return `📝 ${cleanSubject} 演算`;
    }
  }

  return '📝 规范数学演算';
};

/**
 * 判定草稿图元类型：属于「1. 画图」还是「2. 写公式」
 */
export const isElementFormula = (elem) => {
  if (!elem) return false;
  if (elem.zone === 'formula') return true;
  if (elem.zone === 'draw') return false;
  if (!elem.actions || elem.actions.length === 0) return false;
  const hasPlot = elem.actions.some((a) => a.type === 'plot');
  const hasAxes = elem.actions.some((a) => a.type === 'axes' || a.type === 'axes3d');
  const hasShape = elem.actions.some((a) => a.type === 'shape' || a.type === 'shape3d' || a.type === 'circle');
  const hasWrite = elem.actions.some((a) => a.type === 'write');
  if (hasWrite && !hasPlot && !hasAxes && !hasShape) return true;
  return false;
};

/**
 * 纯净纸质图元（无生硬外框与白底，墨水直接落在稿纸上，支持整体拖拽、尺寸缩放与橡皮擦除）
 */
/**
 * 智能净化并去重图元列表（自愈机制：合并因重复流式下发产生的堆叠公式卡片，清理冗余图元）
 */
export const sanitizeAndDeduplicateElements = (rawElements = [], containerWidth = 720) => {
  if (!Array.isArray(rawElements) || rawElements.length === 0) return [];

  const writeElements = [];
  const otherElements = [];

  for (const el of rawElements) {
    if (!el || typeof el !== 'object') continue;
    if (isElementFormula(el)) {
      writeElements.push(el);
    } else {
      otherElements.push(el);
    }
  }

  const cleaned = [];

  // 1. 处理公式板书卡片：如果有多个重复或冗余累积的板书卡片，合并为一张规范主板书
  if (writeElements.length > 0) {
    if (writeElements.length === 1) {
      const single = writeElements[0];
      const writeAct = (single.actions || []).find((a) => a.type === 'write');
      const text = writeAct?.content || '';
      const w = Math.max(single.width || 520, 520);
      cleaned.push({
        ...single,
        width: w,
        height: estimateBoardHeight(text, w),
        zone: 'formula'
      });
    } else {
      // 存在多个板书卡片（例如被 bug 轰炸出的 294 项），智能提炼所有唯一推导行
      const allLines = [];
      const seenLineSet = new Set();
      let bestTitle = '';
      let bestConclusion = '';
      let minX = 99999;
      let minY = 99999;
      let maxW = 520;

      for (const we of writeElements) {
        const writeAct = (we.actions || []).find((a) => a.type === 'write');
        const text = writeAct?.content || '';
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (!seenLineSet.has(line)) {
            seenLineSet.add(line);
            allLines.push(line);
          }
        }
        if (we.title && !bestTitle) bestTitle = we.title;
        if (we.conclusion && !bestConclusion) bestConclusion = we.conclusion;
        if (typeof we.x === 'number' && we.x < minX) minX = we.x;
        if (typeof we.y === 'number' && we.y < minY) minY = we.y;
        if (typeof we.width === 'number' && we.width > maxW) maxW = we.width;
      }

      const mergedContent = allLines.join('\n');
      const formulaW = Math.max(maxW, 520, Math.min(680, containerWidth - 40));
      const firstValid = writeElements[0];
      const masterWriteElem = {
        id: firstValid.id || 'elem_master_formula',
        title: bestTitle || generateSmartBoardTitle(mergedContent),
        conclusion: bestConclusion || extractBoardConclusion(mergedContent),
        collapsed: false,
        titleCustom: Boolean(firstValid.titleCustom),
        x: minX !== 99999 ? minX : Math.floor(containerWidth / 2) + 16,
        y: minY !== 99999 ? minY : 56,
        width: formulaW,
        height: estimateBoardHeight(mergedContent, formulaW),
        scale: firstValid.scale || 1.0,
        actions: [{
          type: 'write',
          content: mergedContent,
          title: bestTitle,
          conclusion: bestConclusion,
          color: '#0f172a'
        }],
        zone: 'formula',
        createdAt: firstValid.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      cleaned.push(masterWriteElem);
    }
  }

  // 2. 处理坐标系、函数曲线与几何图形，严格按 ID 与结构签名去重
  const seenIds = new Set();
  const seenSignatures = new Set();

  for (const el of otherElements) {
    if (seenIds.has(el.id)) continue;
    seenIds.add(el.id);

    const sig = `${el.zone || 'draw'}_${(el.actions || []).map((a) => `${a.type}:${a.expr || a.shapeType || ''}`).join(';')}`;
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);

    cleaned.push({
      ...el,
      zone: 'draw'
    });
  }

  return cleaned;
};

function DraggableCanvasElement({
  element,
  tool,
  onUpdatePosition,
  onUpdateSize,
  onDelete,
  onOpenEditor,
  onToggleCollapse,
  onUpdateTitle,
  drawActions
}) {
  const canvasRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, currentX: 0, currentY: 0, moved: false });
  const [isDragging, setIsDragging] = useState(false);

  const resizeStartRef = useRef({ startX: 0, startY: 0, initialW: 0, initialH: 0, currentW: 0, currentH: 0, resizing: false });
  const [isResizing, setIsResizing] = useState(false);
  const [previewSize, setPreviewSize] = useState(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(element.title || '');

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(element.title || '');
    }
  }, [element.title, isEditingTitle]);

  const isMoveTool = tool === 'select';
  const isEraserTool = tool === 'eraser';
  const isWrite = (element.actions || []).some((a) => a.type === 'write');
  const isCollapsed = Boolean(element.collapsed);

  const baseWidth = previewSize?.width || element.width || 520;
  const currentScale = Number(element.scale) > 0 ? Number(element.scale) : 1.0;

  const dynamicHeight = useMemo(() => {
    if (isWrite && isCollapsed) return 64;
    if (!isWrite) return previewSize?.height || element.height || 260;
    const writeContent = element.actions?.find((a) => a.type === 'write')?.content || '';
    const estimatedH = estimateBoardHeight(writeContent, baseWidth);
    return previewSize?.height ? Math.max(previewSize.height, estimatedH) : Math.max(element.height || 260, estimatedH);
  }, [isWrite, isCollapsed, previewSize, element.height, element.actions, baseWidth]);

  useEffect(() => {
    if (canvasRef.current && element.actions) {
      drawActions(canvasRef.current, element.actions, baseWidth, dynamicHeight, currentScale, element);
    }
  }, [element.actions, baseWidth, dynamicHeight, currentScale, drawActions, element]);

  const handleCommitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== element.title) {
      onUpdateTitle?.(element.id, trimmed, true);
    } else if (!trimmed) {
      // 恢复智能自动命名
      onUpdateTitle?.(element.id, '', false);
    }
    setIsEditingTitle(false);
  };

  const handlePointerDown = (e) => {
    // 橡皮擦模式下完全穿透，不拦截事件
    if (isEraserTool) return;
    // 工具按钮与调整手柄需要保留自己的完整 pointer/click 生命周期，不能被图元拖动层捕获。
    if (e.target.closest('button, input, [data-no-drag="true"]')) return;

    const isHandle = e.target.closest('[data-drag-handle="true"]');
    if (!isHandle && !isMoveTool) return;

    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: element.x,
      initialY: element.y,
      currentX: element.x,
      currentY: element.y,
      moved: false
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
    dragStartRef.current.currentX = newX;
    dragStartRef.current.currentY = newY;
    dragStartRef.current.moved = true;
    e.currentTarget.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (dragStartRef.current.moved) {
      onUpdatePosition(element.id, dragStartRef.current.currentX, dragStartRef.current.currentY);
    }
    setIsDragging(false);
  };

  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const curW = element.width || 520;
    const curH = dynamicHeight;
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialW: curW,
      initialH: curH,
      currentW: curW,
      currentH: curH,
      resizing: true
    };
    setIsResizing(true);
  };

  const handleResizePointerMove = (e) => {
    if (!resizeStartRef.current.resizing) return;
    e.stopPropagation();
    const dx = (e.clientX - resizeStartRef.current.startX) / currentScale;
    const dy = (e.clientY - resizeStartRef.current.startY) / currentScale;
    const minW = isWrite ? 380 : 200;
    const maxW = 1100;
    const minH = 120;
    const maxH = 2000;
    const newW = Math.round(Math.max(minW, Math.min(maxW, resizeStartRef.current.initialW + dx)));
    const newH = Math.round(Math.max(minH, Math.min(maxH, resizeStartRef.current.initialH + dy)));
    resizeStartRef.current.currentW = newW;
    resizeStartRef.current.currentH = newH;
    setPreviewSize({ width: newW, height: newH });
  };

  const handleResizePointerUp = (e) => {
    if (!resizeStartRef.current.resizing) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    resizeStartRef.current.resizing = false;
    setIsResizing(false);
    const finalW = resizeStartRef.current.currentW;
    const finalH = resizeStartRef.current.currentH;
    setPreviewSize(null);
    if (finalW !== element.width || finalH !== element.height) {
      onUpdateSize?.(element.id, finalW, finalH, currentScale);
    }
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
        width: `${Math.ceil(baseWidth * currentScale)}px`,
        height: `${Math.ceil(dynamicHeight * currentScale)}px`,
        touchAction: 'none'
      }}
      className={`group select-none transition-[box-shadow,border-color,background-color] duration-150 ${
        isEraserTool
          ? 'pointer-events-none' // 橡皮擦模式完全穿透，绝不挡住擦除
          : isMoveTool
          ? 'cursor-grab active:cursor-grabbing'
          : ''
      } ${
        isDragging || isResizing ? 'shadow-md ring-1 ring-primary/25 z-40' : 'z-20'
      }`}
    >
      {/* 顶部轻量浮动操作手柄（平时完全透明无框，仅在 hover 或移动/拖拽模式下显示） */}
      {!isEraserTool && (
        <div
          data-drag-handle="true"
          className={`absolute -top-8 left-0 right-0 flex items-center justify-between px-2 py-0.5 rounded-lg bg-surface-container-highest/95 backdrop-blur-xs text-[11px] font-medium border border-outline-variant/40 shadow-xs transition-opacity duration-150 cursor-grab active:cursor-grabbing z-30 ${
            isMoveTool || isDragging || isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="按住此处可整体拖动画入图形或板书"
        >
          {/* 左侧：智能动态标题与就地编辑重命名 */}
          <div className="flex items-center gap-1.5 truncate min-w-0 flex-1 mr-1">
            <span className="material-symbols-outlined text-[14px] shrink-0 pointer-events-none text-primary">
              {isWrite ? (isCollapsed ? 'unfold_more' : 'assignment') : 'drag_pan'}
            </span>
            {isEditingTitle ? (
              <input
                data-no-drag="true"
                type="text"
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitTitle();
                  if (e.key === 'Escape') {
                    setTitleDraft(element.title || '');
                    setIsEditingTitle(false);
                  }
                }}
                onBlur={handleCommitTitle}
                className="px-1.5 py-0.2 rounded text-[11px] font-semibold bg-surface-container border border-primary/50 text-on-surface outline-none w-44"
                placeholder="输入板书自定义标题..."
              />
            ) : (
              <div
                className="flex items-center gap-1 min-w-0 group/title cursor-text"
                data-no-drag="true"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                title="双击或点击铅笔可修改标题"
              >
                <span className="truncate font-semibold text-[11px] text-primary">
                  {element.title || (isWrite ? '规范板书' : '草稿图形')}
                </span>
                <button
                  type="button"
                  data-no-drag="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingTitle(true);
                  }}
                  className="opacity-0 group-hover/title:opacity-100 hover:text-primary text-stone-400 p-0.5 rounded transition cursor-pointer"
                  title="重命名标题"
                >
                  <span className="material-symbols-outlined text-[11px]">edit</span>
                </button>
              </div>
            )}
            {currentScale !== 1.0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-primary/10 text-primary font-bold shrink-0">
                {Math.round(currentScale * 100)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {/* 折叠/展开快捷按钮（仅限 write 演算板书） */}
            {isWrite && (
              <button
                type="button"
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse?.(element.id);
                }}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                  isCollapsed
                    ? 'bg-primary text-white shadow-xs hover:bg-primary/90'
                    : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                }`}
                title={isCollapsed ? '展开查看完整分步推演过程' : '折叠板书（仅展示核心推演结论）'}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {isCollapsed ? 'expand_more' : 'expand_less'}
                </span>
                <span>{isCollapsed ? '展开' : '折叠'}</span>
              </button>
            )}

            {/* 比例与字号缩放微调 */}
            <div className="flex items-center bg-surface-container rounded-md p-0.5 border border-outline-variant/30" data-no-drag="true">
              <button
                type="button"
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const nextScale = Math.max(0.7, Number((currentScale - 0.15).toFixed(2)));
                  onUpdateSize?.(element.id, element.width, element.height, nextScale);
                }}
                className="p-0.5 rounded hover:bg-surface-container-high text-stone-600 hover:text-primary transition cursor-pointer"
                title="缩小字号/板书 (Scale -)"
              >
                <span className="material-symbols-outlined text-[13px]">remove</span>
              </button>
              <button
                type="button"
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const nextScale = Math.min(1.8, Number((currentScale + 0.15).toFixed(2)));
                  onUpdateSize?.(element.id, element.width, element.height, nextScale);
                }}
                className="p-0.5 rounded hover:bg-surface-container-high text-stone-600 hover:text-primary transition cursor-pointer"
                title="放大字号/板书 (Scale +)"
              >
                <span className="material-symbols-outlined text-[13px]">add</span>
              </button>
            </div>

            {/* 用户手动打字编辑板书按钮（仅限 write 板书） */}
            {isWrite && (
              <button
                type="button"
                data-no-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEditor?.(element);
                }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white transition cursor-pointer text-[10px] font-semibold"
                title="直接打字修改板书推导与公式"
              >
                <span className="material-symbols-outlined text-[12px]">edit</span>
                <span>编辑</span>
              </button>
            )}

            {/* 擦除/移除按钮 */}
            <button
              type="button"
              data-no-drag="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(element.id);
              }}
              className="p-0.5 rounded hover:bg-error/15 hover:text-error text-outline transition cursor-pointer ml-0.5"
              title="擦除/移除该图元"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* 内部矢量渲染 Canvas（完全透明背景，线条直接落在稿纸上） */}
      <div className="relative w-full h-full overflow-hidden rounded-xl flex items-center justify-center pointer-events-none">
        <canvas ref={canvasRef} className="block w-full h-full bg-transparent" />
      </div>

      {/* 折叠模式下：卡片主体支持一键快速展开 */}
      {isWrite && isCollapsed && (
        <div
          data-no-drag="true"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.(element.id);
          }}
          className="absolute inset-0 bg-transparent hover:bg-primary/[0.04] transition-colors rounded-xl cursor-pointer z-10"
          title="点击展开查看完整推演步骤"
        />
      )}

      {/* 右下角拖拽拉大手柄（支持鼠标/触摸直接拉大拉宽板书，折叠状态下自动隐藏） */}
      {!isEraserTool && !(isWrite && isCollapsed) && (
        <div
          data-no-drag="true"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-surface-container-highest/95 border border-outline-variant/60 shadow-xs flex items-center justify-center cursor-nwse-resize select-none transition-opacity duration-150 z-30 ${
            isResizing || isMoveTool ? 'opacity-100 ring-2 ring-primary/40' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="按住拖拽：调整板书卡片宽高"
        >
          <span className="material-symbols-outlined text-[13px] text-stone-600 rotate-90 pointer-events-none">
            open_in_full
          </span>
        </div>
      )}

      {/* 拖拽调整时的实时尺寸提示浮层 */}
      {isResizing && (
        <div className="absolute -bottom-8 right-0 bg-stone-900/90 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow pointer-events-none z-50">
          {baseWidth} × {dynamicHeight} px
        </div>
      )}
    </div>
  );
}

/**
 * ScratchpadCanvas / Workbench
 * 一体化考场草稿演算工作台
 */
export default function ScratchpadCanvas({
  storageKey = 'examcraft_scratchpad_canvas',
  contextProblem = '',
  questionNum = null,
  questionData = null,
  questionIndex = 0,
  questionCount = 0,
  questionNums = [],
  questionDraftFlags = [],
  modelStatus = null,
  onNavigateQuestion = null,
  onDraftChange = null,
  isMaximized = false,
  onToggleMaximize = null,
  onClose = null,
  opacity = 100,
  onOpacityChange = null,
  onWindowDragStart = null,
  isMoved = false,
  onResetPosition = null
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const prevStorageKeyRef = useRef(storageKey);
  const todayModelTokens = Number(modelStatus?.today?.tokens || 0);
  const todayModelCostKnown = Number(modelStatus?.today?.pricedCalls || 0) > 0;
  const todayModelCost = Number(modelStatus?.today?.estimatedCostCny || 0);
  const modelWallet = modelStatus?.balance?.balances?.find((item) => item.currency === 'CNY')
    || modelStatus?.balance?.balances?.[0];
  const isOfficialDeepSeek = modelStatus?.model?.providerMode === 'deepseek-official';

  // ==================== 快捷公式胶囊 (本题专属提取 + AI 智能提取) ====================
  const [mathChips, setMathChips] = useState(() => {
    return extractFormulasFromProblem(questionData, contextProblem);
  });
  const [isExtractingChips, setIsExtractingChips] = useState(false);
  const chipRequestInFlightRef = useRef(false);
  const [chipFilter, setChipFilter] = useState('all'); // 'all' | 'core' | 'option'

  // 当切换题目或上下文变更时，实时重新本地提取本题的公式胶囊
  useEffect(() => {
    const extracted = extractFormulasFromProblem(questionData, contextProblem);
    setMathChips(extracted);
  }, [storageKey, questionData, contextProblem]);

  const filteredChips = useMemo(() => {
    if (chipFilter === 'all') return mathChips;
    return mathChips.filter((c) => c.category === chipFilter);
  }, [mathChips, chipFilter]);

  // ==================== 画板手绘状态 ====================
  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser' | 'select'
  const temporaryToolRef = useRef(null);
  const [brushColor, setBrushColor] = useState('#0f172a'); // 墨黑
  const [brushSize, setBrushSize] = useState(3); // 2 | 4 | 7
  const [paperPattern, setPaperPattern] = useState('grid'); // 'grid' | 'lined' | 'blank'
  const paperOpacity = Math.max(0.3, Math.min(1, opacity / 100));
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [canRecover, setCanRecover] = useState(() => {
    try { return Boolean(localStorage.getItem(`${storageKey}_recovery`)); } catch { return false; }
  });
  const recoverySnapshotRef = useRef(null);
  const [saveError, setSaveError] = useState(false);
  const saveErrorsRef = useRef({});
  const updateSaveStatus = (slot, hasError) => {
    saveErrorsRef.current[slot] = hasError;
    setSaveError(Object.values(saveErrorsRef.current).some(Boolean));
  };

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // ==================== 画入图元对象状态（支持独立拖拽与自动防重叠布局） ====================
  const [elements, setElements] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_elements`);
      const parsed = saved ? JSON.parse(saved) : [];
      const sanitized = sanitizeAndDeduplicateElements(Array.isArray(parsed) ? parsed : [], 720);
      return sanitized.map((el) => {
        const isWrite = (el.actions || []).some((a) => a.type === 'write');
        if (isWrite && (el.width < 460 || !el.width)) {
          const content = el.actions.find((a) => a.type === 'write')?.content || '';
          const w = 520;
          return {
            ...el,
            width: w,
            height: estimateBoardHeight(content, w)
          };
        }
        return el;
      });
    } catch {
      return [];
    }
  });

  const appliedActionIdsRef = useRef(new Set());
  const lastSavedElementsStrRef = useRef(JSON.stringify(elements));
  const prevElementsStorageKeyRef = useRef(storageKey);

  // 当切换题目或存储 Key 变动时，实时载入该题的专属图元
  useEffect(() => {
    try {
      appliedActionIdsRef.current.clear();
      const saved = localStorage.getItem(`${storageKey}_elements`);
      const parsed = saved ? JSON.parse(saved) : [];
      const sanitized = sanitizeAndDeduplicateElements(Array.isArray(parsed) ? parsed : [], 720);
      const loaded = sanitized.map((el) => {
        const isWrite = (el.actions || []).some((a) => a.type === 'write');
        if (isWrite && (el.width < 460 || !el.width)) {
          const content = el.actions.find((a) => a.type === 'write')?.content || '';
          const w = 520;
          return {
            ...el,
            width: w,
            height: estimateBoardHeight(content, w)
          };
        }
        return el;
      });
      lastSavedElementsStrRef.current = JSON.stringify(loaded);
      prevElementsStorageKeyRef.current = storageKey;
      setElements(loaded);
    } catch {
      lastSavedElementsStrRef.current = '[]';
      prevElementsStorageKeyRef.current = storageKey;
      setElements([]);
    }
  }, [storageKey]);

  useEffect(() => {
    const elementsStr = JSON.stringify(elements);
    // 首次加载或数据未实质改变时，避免重复写入 localStorage 并阻断 onDraftChange 引起的重渲风暴
    if (prevElementsStorageKeyRef.current === storageKey && lastSavedElementsStrRef.current === elementsStr) {
      return;
    }
    prevElementsStorageKeyRef.current = storageKey;
    lastSavedElementsStrRef.current = elementsStr;

    try {
      localStorage.setItem(`${storageKey}_elements`, elementsStr);
      updateSaveStatus('elements', false);
      if (elements.length) onDraftChange?.();
    } catch (e) {
      updateSaveStatus('elements', true);
      console.warn('Elements save error:', e);
    }
  }, [elements, storageKey]);

  // 旧版本把“先画坐标系、再画曲线”存成两个图元；本题只有一个坐标系时自动合并回同一张图。
  useEffect(() => {
    if (elements.length < 2) return;
    const axesElements = elements.filter((element) => (element.actions || []).some((action) => action.type === 'axes' || action.type === 'axes3d'));
    if (axesElements.length !== 1) return;
    const axesElement = axesElements[0];
    const plotElements = elements.filter((element) => element.id !== axesElement.id && !element.detachedFromAxes && (element.actions || []).length > 0 && element.actions.every((action) => action.type === 'plot'));
    if (!plotElements.length) return;

    setElements((previous) => {
      const currentAxes = previous.filter((element) => (element.actions || []).some((action) => action.type === 'axes' || action.type === 'axes3d'));
      if (currentAxes.length !== 1) return previous;
      const target = currentAxes[0];
      const currentPlots = previous.filter((element) => element.id !== target.id && !element.detachedFromAxes && (element.actions || []).length > 0 && element.actions.every((action) => action.type === 'plot'));
      if (!currentPlots.length) return previous;
      const plotActions = currentPlots.flatMap((element) => element.actions || []);
      const lastPlot = plotActions[plotActions.length - 1];
      return previous
        .filter((element) => !currentPlots.some((plotElement) => plotElement.id === element.id))
        .map((element) => element.id === target.id
          ? {
              ...element,
              title: lastPlot?.label ? `📈 坐标系 · ${formatMathExpression(lastPlot.label)}` : '📈 坐标系与函数图像',
              actions: [...(element.actions || []), ...plotActions],
              updatedAt: Date.now()
            }
          : element);
    });
  }, [elements]);


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

  // ==================== Agent Loop 状态 ====================
  const [isAssistantCollapsed, setIsAssistantCollapsed] = useState(false);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState('canvas');
  const [spokenInput, setSpokenInput] = useState('');
  const [activeAuxDrawer, setActiveAuxDrawer] = useState(null); // 'derivation' | 'formulas' | null
  const [showFormulaReference, setShowFormulaReference] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const agentRequestInFlightRef = useRef(false);
  const agentAbortControllerRef = useRef(null);
  const [agentLoopStage, setAgentLoopStage] = useState('');
  const agentChatStorageKey = `${storageKey}_agent_chat_v1`;
  const agentChatScrollRef = useRef(null);

  const [agentChatMessages, setAgentChatMessages] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(agentChatStorageKey) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const [agentMetrics, setAgentMetrics] = useState({
    iteration: 1,
    toolCallsCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    tokenSpeed: 0,
    contextTokens: 0,
    maxContextTokens: 131072,
    isLive: false
  });

  const [expandedThoughts, setExpandedThoughts] = useState({});

  const toggleThoughtExpanded = useCallback((msgId) => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [msgId]: prev[msgId] !== undefined ? !prev[msgId] : false
    }));
  }, []);

  // 当前会话的真实对话轮次（由历史用户问题数量确定，完全由上下文与消息历史驱动，绝无假上限）
  const currentTurnNumber = useMemo(() => {
    const userMsgCount = agentChatMessages.filter((m) => m.role === 'user').length;
    return isAgentRunning ? userMsgCount : Math.max(1, userMsgCount);
  }, [agentChatMessages, isAgentRunning]);

  // 上下文占用真实比例与展示格式化
  const contextRatio = useMemo(() => {
    const used = agentMetrics.contextTokens || agentMetrics.totalTokens || (agentMetrics.inputTokens + agentMetrics.outputTokens) || 0;
    const max = agentMetrics.maxContextTokens || 131072;
    if (!max || used <= 0) return 0;
    return Math.min(100, (used / max) * 100);
  }, [agentMetrics.contextTokens, agentMetrics.totalTokens, agentMetrics.inputTokens, agentMetrics.outputTokens, agentMetrics.maxContextTokens]);

  const displayContextPercent = useMemo(() => {
    if (contextRatio <= 0) return '0%';
    if (contextRatio < 1) return `${contextRatio.toFixed(1)}%`;
    return `${Math.round(contextRatio)}%`;
  }, [contextRatio]);

  // 跨题目切换时从本地持久化同步消息
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(agentChatStorageKey) || '[]');
      setAgentChatMessages(Array.isArray(stored) ? stored : []);
    } catch {}
  }, [agentChatStorageKey]);

  const appendAgentChatMessage = useCallback((message) => {
    setAgentChatMessages((prev) => {
      const updated = [
        ...prev,
        { id: `agent-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now(), ...message }
      ].slice(-40);
      try {
        localStorage.setItem(agentChatStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [agentChatStorageKey]);

  const clearAgentChat = useCallback(() => {
    try { localStorage.removeItem(agentChatStorageKey); } catch {}
    setAgentChatMessages([]);
  }, [agentChatStorageKey]);

  const handleAbortAgentLoop = useCallback(() => {
    if (agentAbortControllerRef.current) {
      agentAbortControllerRef.current.abort();
    }
    agentRequestInFlightRef.current = false;
    setIsAgentRunning(false);
    setAgentLoopStage('');
    setAgentMetrics((prev) => ({ ...prev, isLive: false, tokenSpeed: 0 }));
    setAgentChatMessages((prev) => {
      const updated = prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.role === 'assistant'
          ? { ...msg, isAborted: true, isCompleted: true }
          : msg
      );
      try {
        localStorage.setItem(agentChatStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('已中断草稿纸助手执行', 'info');
  }, [agentChatStorageKey, showToast]);

  useEffect(() => {
    const chat = agentChatScrollRef.current;
    if (chat) chat.scrollTop = chat.scrollHeight;
  }, [agentChatMessages.length, isAgentRunning, agentLoopStage]);


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

    const isKeyChanged = prevStorageKeyRef.current !== storageKey;
    if (isKeyChanged) {
      prevStorageKeyRef.current = storageKey;
      tempImgData = null; // 切换题目时不复用上一题的画布内存
    } else if (canvas.width > 0 && canvas.height > 0) {
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

  // 当 storageKey 变更时，重载该题的专属画布墨水
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const savedDataUrl = localStorage.getItem(storageKey);
    if (savedDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = savedDataUrl;
      setHistory([savedDataUrl]);
      setHistoryStep(0);
    } else {
      setHistory([]);
      setHistoryStep(-1);
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
      updateSaveStatus('canvas', false);
    } catch (e) {
      updateSaveStatus('canvas', true);
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

  const handleRecoverClear = () => {
    let snapshot = recoverySnapshotRef.current;
    if (!snapshot) {
      try { snapshot = JSON.parse(localStorage.getItem(`${storageKey}_recovery`) || 'null'); } catch {}
    }
    if (!snapshot) return;
    setElements(snapshot.elements || []);
    if (snapshot.canvasDataUrl) restoreFromDataUrl(snapshot.canvasDataUrl);
    recoverySnapshotRef.current = null;
    try { localStorage.removeItem(`${storageKey}_recovery`); } catch {}
    setCanRecover(false);
    showToast('已恢复清空前的草稿', 'success');
    onDraftChange?.();
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

  const undoActionRef = useRef(handleUndo);
  const redoActionRef = useRef(handleRedo);
  undoActionRef.current = handleUndo;
  redoActionRef.current = handleRedo;

  useEffect(() => {
    const isTextEntry = (target) => target instanceof HTMLElement && (
      target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    );
    const onKeyDown = (event) => {
      if (isTextEntry(event.target)) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoActionRef.current();
        else undoActionRef.current();
        return;
      }
      if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoActionRef.current();
        return;
      }
      if (command || event.altKey) return;
      if (event.key.toLowerCase() === 'x' && !event.repeat) {
        setTool((currentTool) => currentTool === 'eraser' ? 'brush' : 'eraser');
      } else if (event.key.toLowerCase() === 'e' && !event.repeat) {
        temporaryToolRef.current = tool;
        setTool('eraser');
      } else if (event.key.toLowerCase() === 'b') {
        setTool('brush');
      } else if (event.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    const onKeyUp = (event) => {
      if (event.key.toLowerCase() === 'e' && temporaryToolRef.current) {
        setTool(temporaryToolRef.current);
        temporaryToolRef.current = null;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [tool, isFocusMode]);

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
        const snapshot = {
          canvasDataUrl: canvas?.toDataURL('image/png') || null,
          elements
        };
        recoverySnapshotRef.current = snapshot;
        try {
          localStorage.setItem(`${storageKey}_recovery`, JSON.stringify(snapshot));
        } catch (e) {
          console.warn('Scratchpad recovery save error:', e);
          showToast('无法创建恢复备份，草稿未清空。请检查浏览器存储空间后重试。', 'warn');
          return;
        }
        setCanRecover(true);
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
        onDraftChange?.();
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
      const s = Number(el.scale) > 0 ? Number(el.scale) : 1.0;
      const isWrite = (el.actions || []).some((a) => a.type === 'write');
      const isCollapsed = Boolean(el.collapsed);
      const dynamicH = isWrite
        ? (isCollapsed ? 64 : Math.max(el.height || 260, estimateBoardHeight(el.actions.find((a) => a.type === 'write')?.content || '', el.width || 520)))
        : (el.height || 260);
      drawActionsOnCanvas(tempCanvas, el.actions, el.width, dynamicH, s, el);
      expCtx.drawImage(tempCanvas, el.x * dpr, el.y * dpr, Math.ceil(el.width * s) * dpr, Math.ceil(dynamicH * s) * dpr);
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

  // 橡皮擦对画入图形的碰撞擦除检测 (Object / Stroke Eraser)
  const checkEraserCollision = (point) => {
    if (tool !== 'eraser' || elements.length === 0) return;
    const pad = brushSize * 5;

    const hit = elements.find((el) => {
      return (
        point.x >= el.x - pad &&
        point.x <= el.x + el.width + pad &&
        point.y >= el.y - pad &&
        point.y <= el.y + el.height + pad
      );
    });

    if (hit) {
      setElements((prev) => prev.filter((el) => el.id !== hit.id));
      showToast(`已擦除草稿图形：${hit.title}`, 'info');
    }
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
      checkEraserCollision(pos);
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
      checkEraserCollision(currentPoint);
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
    onDraftChange?.();
  };

  // ==================== 智能 Canvas 绘图与矢量渲染核心 ====================
  // 在指定尺寸的 canvas 内部精准居中绘制各项动作（支持自适应居中与高保真矢量排版）
  const drawActionsOnCanvas = useCallback((canvas, actions, width, height, scale = 1.0, element = null) => {
    if (!canvas || !actions || actions.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const s = Math.max(0.6, Math.min(2.0, Number(scale) || 1.0));

    const writeAct = actions.find((a) => a.type === 'write');
    const isCollapsed = Boolean(element?.collapsed);

    // 针对数学板书推导演算，折叠模式下使用紧凑高度（64px），展开模式下智能保障充足高度
    const dynamicMinHeight = writeAct ? (isCollapsed ? 64 : estimateBoardHeight(writeAct.content, width)) : height;
    const effectiveHeight = Math.max(height, dynamicMinHeight);

    const pixelW = Math.ceil(width * s);
    const pixelH = Math.ceil(effectiveHeight * s);

    canvas.width = pixelW * dpr;
    canvas.height = pixelH * dpr;
    canvas.style.width = `${pixelW}px`;
    canvas.style.height = `${pixelH}px`;

    ctx.save();
    ctx.scale(dpr * s, dpr * s);
    ctx.clearRect(0, 0, width, effectiveHeight);

    // 折叠模式下：绘制紧凑精致的高保真结论胶囊卡片
    if (isCollapsed && writeAct) {
      const cardX = 4;
      const cardY = 4;
      const cardW = width - 8;
      const cardH = effectiveHeight - 8;
      const radius = 10;

      // 1. 底框背景
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardX, cardY, cardW, cardH, radius);
      } else {
        ctx.rect(cardX, cardY, cardW, cardH);
      }
      ctx.fill();
      ctx.stroke();

      // 2. 左侧推演结论微标
      ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
      const badgeText = '✨ 推演结论';
      const badgeW = ctx.measureText(badgeText).width + 12;
      const badgeH = 22;
      const badgeX = cardX + 10;
      const badgeY = cardY + (cardH - badgeH) / 2;

      ctx.fillStyle = '#dbeafe';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();

      ctx.fillStyle = '#1d4ed8';
      ctx.fillText(badgeText, badgeX + 6, badgeY + 15);

      // 3. 核心数学结论公式渲染
      const conclusionStr = element?.conclusion || extractBoardConclusion(writeAct.content);
      const conclusionFormatted = formatMathExpression(conclusionStr || '推导完成');

      ctx.font = 'italic 700 16px "KaTeX_Math", "Cambria Math", "Times New Roman", serif';
      ctx.fillStyle = '#0f172a';
      const textX = badgeX + badgeW + 10;
      const textY = cardY + cardH / 2 + 5;
      ctx.fillText(conclusionFormatted, textX, textY);

      // 4. 右侧步数与展开提示
      const stepCount = (writeAct.content || '').split('\n').filter(Boolean).length;
      const hintText = `共 ${stepCount} 步推导 ▾`;
      ctx.font = '500 11px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#64748b';
      const hintW = ctx.measureText(hintText).width;
      const availableSpace = cardW - (textX + ctx.measureText(conclusionFormatted).width + 10);
      if (availableSpace > hintW + 16) {
        ctx.fillText(hintText, cardX + cardW - hintW - 12, textY);
      }

      ctx.restore();
      return;
    }

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
          let lineHeight = 28;
          const maxWidth = width - 24;

          const fractionPartText = (parts) => parts.map((part) => {
            if (part.type === 'fraction') {
              return `(${fractionPartText(part.numerator)})/(${fractionPartText(part.denominator)})`;
            }
            return part.text || '';
          }).join('');

          segments.forEach((seg) => {
            if (seg.type === 'fraction') {
              ctx.font = 'italic 700 16px "KaTeX_Math", "Cambria Math", "Times New Roman", serif';
              ctx.fillStyle = '#1d4ed8';
              const numerator = fractionPartText(seg.numerator);
              const denominator = fractionPartText(seg.denominator);
              const fractionWidth = Math.max(24, ctx.measureText(numerator).width, ctx.measureText(denominator).width) + 12;
              if (startX + fractionWidth > maxWidth && startX > 16) {
                startX = 16;
                textCursorY += lineHeight;
                lineHeight = 28;
              }
              ctx.textAlign = 'center';
              ctx.fillText(numerator, startX + fractionWidth / 2, textCursorY - 9);
              ctx.beginPath();
              ctx.lineWidth = 1.25;
              ctx.strokeStyle = '#1d4ed8';
              ctx.moveTo(startX + 3, textCursorY - 2);
              ctx.lineTo(startX + fractionWidth - 3, textCursorY - 2);
              ctx.stroke();
              ctx.fillText(denominator, startX + fractionWidth / 2, textCursorY + 15);
              ctx.textAlign = 'left';
              startX += fractionWidth + 5;
              lineHeight = Math.max(lineHeight, 37);
              return;
            }

            if (seg.type === 'matrix') {
              ctx.font = 'italic 700 16px "KaTeX_Math", "Cambria Math", "Times New Roman", serif';
              ctx.fillStyle = '#1d4ed8';
              const rows = seg.rows.filter((row) => row.some((cell) => cell));
              const columnCount = Math.max(1, ...rows.map((row) => row.length));
              const columnWidths = Array.from({ length: columnCount }, (_, column) => Math.max(
                28,
                ...rows.map((row) => ctx.measureText(row[column] || '').width + 12)
              ));
              const matrixBodyWidth = columnWidths.reduce((sum, cellWidth) => sum + cellWidth, 0);
              const fence = ({ pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], matrix: ['', ''] })[seg.environment] || ['', ''];
              const fenceWidth = fence[0] ? 20 : 0;
              const matrixWidth = matrixBodyWidth + fenceWidth;
              if (startX + matrixWidth > maxWidth && startX > 16) {
                startX = 16;
                textCursorY += lineHeight;
                lineHeight = 28;
              }

              const top = textCursorY - 18;
              const matrixHeight = Math.max(24, rows.length * 24);
              let columnX = startX + (fence[0] ? fenceWidth / 2 : 0);
              rows.forEach((row, rowIndex) => {
                let cellX = columnX;
                row.forEach((cell, columnIndex) => {
                  const cellWidth = columnWidths[columnIndex] || 28;
                  ctx.fillText(cell, cellX + (cellWidth - ctx.measureText(cell).width) / 2, textCursorY + rowIndex * 24);
                  cellX += cellWidth;
                });
              });

              const drawFence = (character, x) => {
                if (!character) return;
                ctx.save();
                ctx.translate(x, top);
                ctx.scale(1, matrixHeight / 20);
                ctx.fillText(character, 0, 16);
                ctx.restore();
              };
              drawFence(fence[0], startX);
              drawFence(fence[1], startX + matrixWidth - 10);
              startX += matrixWidth + 8;
              lineHeight = Math.max(lineHeight, rows.length * 24 + 4);
              return;
            }

            if (seg.isMath) {
              ctx.font = 'italic 700 16px "KaTeX_Math", "Cambria Math", "Times New Roman", serif';
              ctx.fillStyle = '#1d4ed8';
            } else {
              ctx.font = '600 15px "KaTeX_Main", "STKaiti", "KaiTi", "Microsoft YaHei", sans-serif';
              ctx.fillStyle = act.color || '#0f172a';
            }

            const chars = seg.isMath
              ? (seg.text.split(/(\s+|[=+\-×÷≤≥≠≈<>]+|[()])/).filter(Boolean))
              : (seg.text.match(/[a-zA-Z0-9_.'"-]+|[\u4e00-\u9fa5]|[\s\S]/g) || []);

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

          textCursorY += lineHeight;
        });
        textCursorY += 8;

      } else if (act.type === 'axes3d') {
        // 三维直角坐标系：x、y 轴斜向展开，z 轴竖直向上。
        ctx.strokeStyle = act.color || '#334155';
        ctx.fillStyle = act.color || '#334155';
        ctx.lineWidth = 1.9;
        ctx.lineCap = 'round';
        ctx.font = 'italic bold 15px "KaTeX_Math", serif';

        const length = Math.min(width * 0.27, height * 0.27, 76);
        const originX = cx;
        const originY = cy + 10;
        const axes3d = [
          { dx: length * 0.9, dy: length * 0.48, label: act.xLabel || 'x', lx: 7, ly: 13 },
          { dx: -length * 0.9, dy: length * 0.48, label: act.yLabel || 'y', lx: -16, ly: 13 },
          { dx: 0, dy: -length, label: act.zLabel || 'z', lx: -4, ly: -9 }
        ];

        axes3d.forEach(({ dx, dy, label, lx, ly }) => {
          const endpointX = originX + dx;
          const endpointY = originY + dy;
          ctx.beginPath();
          ctx.moveTo(originX - dx * 0.62, originY - dy * 0.62);
          ctx.lineTo(endpointX, endpointY);
          ctx.stroke();
          const angle = Math.atan2(dy, dx);
          const headLength = 8;
          const spread = Math.PI / 7;
          ctx.beginPath();
          ctx.moveTo(endpointX, endpointY);
          ctx.lineTo(endpointX - headLength * Math.cos(angle - spread), endpointY - headLength * Math.sin(angle - spread));
          ctx.moveTo(endpointX, endpointY);
          ctx.lineTo(endpointX - headLength * Math.cos(angle + spread), endpointY - headLength * Math.sin(angle + spread));
          ctx.stroke();
          ctx.fillText(label, endpointX + lx, endpointY + ly);
        });

        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('O', originX - 15, originY + 17);

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
          ctx.fillText(formattedLabel, Math.max(12, cx - axisLen + 10), Math.max(20, cy - axisLen + 20));
        }

      } else if (act.type === 'shape3d') {
        // 在等轴测投影中绘制三维平面圆（椭圆投影）或正方形（平行四边形投影）。
        const planeBases = {
          xy: [[0.9, 0.48], [-0.9, 0.48]],
          xz: [[0.9, 0.48], [0, -1]],
          yz: [[-0.9, 0.48], [0, -1]]
        };
        const [uBasis, vBasis] = planeBases[act.plane] || planeBases.xy;
        const size = Math.min(width, height) * 0.2;
        const ux = uBasis[0] * size;
        const uy = uBasis[1] * size;
        const vx = vBasis[0] * size;
        const vy = vBasis[1] * size;
        ctx.strokeStyle = act.color || '#1d4ed8';
        ctx.fillStyle = act.color || '#1d4ed8';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (act.shapeType === 'circle') {
          ctx.beginPath();
          for (let index = 0; index <= 96; index += 1) {
            const angle = (index / 96) * Math.PI * 2;
            const px = cx + ux * Math.cos(angle) + vx * Math.sin(angle);
            const py = cy + uy * Math.cos(angle) + vy * Math.sin(angle);
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = 'italic bold 15px "KaTeX_Math", "Times New Roman", serif';
          ctx.fillText(act.labels?.[0] || 'O', cx - 16, cy + 16);
        } else if (act.shapeType === 'square') {
          const points = [
            [cx - (ux + vx) / 2, cy - (uy + vy) / 2],
            [cx + (ux - vx) / 2, cy + (uy - vy) / 2],
            [cx + (ux + vx) / 2, cy + (uy + vy) / 2],
            [cx + (-ux + vx) / 2, cy + (-uy + vy) / 2]
          ];
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
          points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
          ctx.closePath();
          ctx.stroke();
        }
      } else if (
        act.type === 'circle' ||
        (act.type === 'shape' && (
          act.shapeType === 'circle' ||
          act.shapeType === 'round' ||
          act.shape === 'circle' ||
          String(act.shapeType || '').includes('圆')
        ))
      ) {
        // 4.1 绘制标准考场几何圆（包含实心圆心点 O 与带端点的半径射线 r）
        ctx.strokeStyle = act.color || '#047857';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const r = Math.min(width, height) * 0.32; // 饱满居中的半径（约 65px）

        // 1. 绘制圆周
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 绘制圆心实心小黑点
        ctx.fillStyle = act.color || '#047857';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        // 3. 绘制半径线段（斜向上 30° 角，优雅引向圆周）
        const angle = -Math.PI / 6;
        const edgeX = cx + r * Math.cos(angle);
        const edgeY = cy + r * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(edgeX, edgeY);
        ctx.stroke();

        // 4. 半径与圆周交点端点
        ctx.beginPath();
        ctx.arc(edgeX, edgeY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 5. 标注圆心 O（圆心点左下侧）
        ctx.fillStyle = '#0f172a';
        ctx.font = 'italic bold 15px "KaTeX_Math", "Times New Roman", serif';
        ctx.fillText(act.labels?.[0] || 'O', cx - 18, cy + 18);

        // 6. 标注半径 r（线段斜上方居中）
        const midX = (cx + edgeX) / 2;
        const midY = (cy + edgeY) / 2;
        ctx.fillStyle = act.color || '#047857';
        ctx.font = 'italic 700 16px "KaTeX_Math", "Cambria Math", serif';
        ctx.fillText(act.labels?.[1] || 'r', midX - 6, midY - 8);

      } else if (act.type === 'shape') {
        // 4.2 绘制其他几何图形（三角形、直角三角形）
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

  // 智能寻找不重叠的空闲槽位坐标（精准分区：1是画图区，2是写公式区，彻底解决重叠冲突）
  const findNextAvailablePosition = useCallback((elemWidth, elemHeight, zone = 'draw') => {
    const container = containerRef.current;
    const containerW = container ? container.clientWidth : 900;
    const containerH = container ? container.clientHeight : 600;
    const pad = 16;
    const headerOffset = 48; // 给顶部区域标识留出空间

    const midX = Math.floor(containerW / 2);
    const isFormula = zone === 'formula';

    // 1. 分区坐标范围约束：
    // 画图区 (1. 画图)：[18, midX - 16]
    // 写公式区 (2. 写公式)：[midX + 16, containerW - 18]
    const zoneStartX = isFormula ? midX + 16 : 18;
    const zoneEndX = isFormula ? containerW - 18 : midX - 16;
    const availableZoneW = Math.max(zoneEndX - zoneStartX, 100);

    // 找出当前属于该分区的全部已有元素
    const zoneElements = elements.filter((el) => {
      const elIsFormula = isElementFormula(el);
      return isFormula ? elIsFormula : !elIsFormula;
    });

    if (zoneElements.length === 0) {
      return { x: zoneStartX, y: headerOffset + 8 };
    }

    // 2. 纵向堆叠：找到当前分区所有元素的最大底部
    let maxBottom = headerOffset;
    zoneElements.forEach((el) => {
      if (el.y + el.height > maxBottom) {
        maxBottom = el.y + el.height;
      }
    });

    const candidateY = maxBottom + pad;
    if (candidateY + elemHeight <= containerH + 600) {
      return { x: zoneStartX, y: candidateY };
    }

    // 3. 纵向自然向下排列（草稿纸支持垂直滚动，绝不循环取模造成覆盖重叠）
    return {
      x: zoneStartX,
      y: maxBottom + pad
    };
  }, [elements]);

  // 一键规整两大部分（1是画图区，2是写公式区），彻底消除重叠冲突！
  const handleTidyAllElements = useCallback(() => {
    const container = containerRef.current;
    const containerW = container ? container.clientWidth : 900;
    const midX = Math.floor(containerW / 2);
    const headerOffset = 48;
    const pad = 16;

    let drawY = headerOffset;
    let formulaY = headerOffset;

    const cleanList = sanitizeAndDeduplicateElements(elements, containerW);
    const newElements = cleanList.map((el) => {
      const isFormula = isElementFormula(el);
      if (isFormula) {
        const x = midX + 16;
        const y = formulaY;
        const w = Math.min(el.width, containerW - midX - 36);
        formulaY += el.height + pad;
        return { ...el, x, y, width: w, zone: 'formula' };
      } else {
        const x = 18;
        const y = drawY;
        const w = Math.min(el.width, midX - 36);
        drawY += el.height + pad;
        return { ...el, x, y, width: w, zone: 'draw' };
      }
    });

    setElements(newElements);
    showToast('✨ 已将草稿纸一键规整：左侧画图，右侧写公式，彻底消除重叠！', 'success');
  }, [elements, showToast]);

  // 更新图元坐标
  const handleUpdateElementPosition = useCallback((id, x, y) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, x, y } : el))
    );
  }, []);

  // 更新图元尺寸与缩放系数（支持拖拽调整宽高与比例缩放）
  const handleUpdateElementSize = useCallback((id, width, height, scale) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;
        const updated = { ...el };
        if (width !== undefined && width !== null) updated.width = Math.round(width);
        if (height !== undefined && height !== null) updated.height = Math.round(height);
        if (scale !== undefined && scale !== null) updated.scale = Number(Number(scale).toFixed(2));
        updated.updatedAt = Date.now();
        return updated;
      })
    );
  }, []);

  // 切换图元折叠/展开状态
  const handleToggleCollapseElement = useCallback((id) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, collapsed: !el.collapsed, updatedAt: Date.now() } : el))
    );
  }, []);

  // 更新图元标题（若用户主动输入/编辑，则标记为 titleCustom: true，AI 后续不再自动覆盖）
  const handleUpdateElementTitle = useCallback((id, newTitle, isCustom = true) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;
        const writeAct = (el.actions || []).find((a) => a.type === 'write');
        const fallbackTitle = writeAct ? generateSmartBoardTitle(writeAct.content) : (el.title || '📝 规范板书演算');
        const finalTitle = newTitle && newTitle.trim() ? (newTitle.trim().startsWith('📝') ? newTitle.trim() : `📝 ${newTitle.trim()}`) : fallbackTitle;
        return {
          ...el,
          title: finalTitle,
          titleCustom: isCustom && Boolean(newTitle && newTitle.trim()),
          updatedAt: Date.now()
        };
      })
    );
  }, []);

  // 用户手动直接编辑板书模态框状态与处理器
  const [editingBoardElement, setEditingBoardElement] = useState(null);
  const [editingBoardText, setEditingBoardText] = useState('');

  const handleOpenBoardEditor = useCallback((element) => {
    const writeAct = (element.actions || []).find((a) => a.type === 'write');
    setEditingBoardElement(element);
    setEditingBoardText(writeAct?.content || '');
  }, []);

  const handleSaveEditedBoard = useCallback(() => {
    if (!editingBoardElement) return;
    const newContent = editingBoardText.trim();
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== editingBoardElement.id) return el;
        const writeIndex = (el.actions || []).findIndex((a) => a.type === 'write');
        const updatedActions = writeIndex >= 0
          ? el.actions.map((a, i) => (i === writeIndex ? { ...a, content: newContent } : a))
          : [{ type: 'write', content: newContent }, ...(el.actions || [])];
        const effectiveW = el.width || 520;
        const newHeight = estimateBoardHeight(newContent, effectiveW);
        const smartTitle = el.titleCustom ? el.title : generateSmartBoardTitle(newContent);
        const smartConclusion = extractBoardConclusion(newContent);
        return {
          ...el,
          title: smartTitle,
          conclusion: smartConclusion,
          actions: updatedActions,
          height: newHeight,
          updatedAt: Date.now()
        };
      })
    );
    showToast('已保存手动修改的板书，Agent 下一步将基于最新板书进行推导', 'success');
    setEditingBoardElement(null);
  }, [editingBoardElement, editingBoardText, showToast]);

  // 删除单个画入图元
  const handleDeleteElement = useCallback((id) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    showToast('已移除该草稿图元', 'info');
  }, [showToast]);

  // AI 智能提取当前试题核心公式与展开通式
  const handleAiExtractChips = async () => {
    if (chipRequestInFlightRef.current) return;
    chipRequestInFlightRef.current = true;
    setIsExtractingChips(true);
    showToast('AI 正在深度解析本题题干与数学结构...', 'info');
    try {
      const res = await fetch('/api/model/extract-math-chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: questionData?.prompt || contextProblem,
          mathExpression: questionData?.mathExpression || '',
          options: questionData?.options || [],
          num: questionNum
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.chips) && data.chips.length > 0) {
        setMathChips((prev) => {
          const existingKeys = new Set(prev.map((c) => c.latex.replace(/[\$\s]/g, '')));
          const newAiChips = data.chips.filter((c) => !existingKeys.has(c.latex.replace(/[\$\s]/g, '')));
          return [...prev, ...newAiChips];
        });
        showToast(`✨ AI 成功提取 ${data.chips.length} 个关键推演式！`, 'success');
      } else {
        showToast('已提取出当前题目的全部关键公式', 'info');
      }
    } catch (err) {
      showToast(`AI 提取失败: ${err.message}`, 'warn');
    } finally {
      chipRequestInFlightRef.current = false;
      setIsExtractingChips(false);
    }
  };

  // 一键快捷抄入草稿纸（自动入驻 2. 写公式区，绝不与左侧图形重叠）
  const handleQuickWriteToBoard = useCallback((latexContent, labelText) => {
    const cleanText = latexContent.startsWith('$') ? latexContent : `$${latexContent}$`;
    const acts = [{ type: 'write', content: cleanText, color: brushColor || '#0f172a' }];

    const containerW = containerRef.current?.clientWidth || 700;
    const midX = Math.floor(containerW / 2);
    const elemWidth = Math.min(340, Math.max(220, containerW - midX - 36));
    const lines = cleanText.split('\n');
    const elemHeight = Math.max(90, Math.min(260, lines.length * 32 + 55));
    const pos = findNextAvailablePosition(elemWidth, elemHeight, 'formula');

    const newElem = {
      id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: labelText ? `📝 公式: ${labelText}` : '📝 本题公式抄录',
      x: pos.x,
      y: pos.y,
      width: elemWidth,
      height: elemHeight,
      actions: acts,
      zone: 'formula',
      createdAt: Date.now()
    };

    setElements((prev) => [...prev, newElem]);

    showToast(`已将「${labelText || cleanText}」抄入【2. 写公式区】！`, 'success');
  }, [brushColor, findNextAvailablePosition, showToast]);

  // 点击胶囊快速追加到口述指令框
  const handleAppendSpokenPrompt = (chip) => {
    const textToAdd = chip.insertText || chip.latex || chip.label;
    setSpokenInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return `请写推导：${textToAdd}`;
      }
      return `${trimmed} ${textToAdd}`;
    });
    showToast(`已填入推导语言：「${chip.label || textToAdd}」`, 'info');
  };

  // ==================== 画板图元动作增量应用器 ====================
  const applyCanvasActions = useCallback((incomingActions) => {
    if (!Array.isArray(incomingActions) || !incomingActions.length) return;

    // 0. 幂等消费防重：通过 actionId 或内容指纹过滤已消费的动作
    const unappliedActions = incomingActions.filter((a) => {
      const sig = a.actionId || a.id || `${a.type}_${a.targetElementId || ''}_${(a.content || '').slice(0, 40)}_${a.expr || ''}_${a.shapeType || ''}`;
      if (appliedActionIdsRef.current.has(sig)) return false;
      appliedActionIdsRef.current.add(sig);
      return true;
    });
    if (!unappliedActions.length) return;

    // 1. 处理 update_element、delete_element 与 clear_board
    const editActions = unappliedActions.filter((a) => a.type === 'update_element' || a.type === 'delete_element' || a.type === 'clear_board');
    if (editActions.length) {
      setElements((previous) => {
        let next = [...previous];
        for (const edit of editActions) {
          if (edit.type === 'clear_board') {
            next = [];
            continue;
          }
          const targetIndex = next.findIndex((el) => el.id === edit.targetElementId);
          if (targetIndex < 0) continue;
          const target = next[targetIndex];
          if (edit.type === 'delete_element') {
            next = next.filter((el) => el.id !== target.id);
            continue;
          }

          const hasWidth = Number(edit.width) > 0;
          const hasHeight = Number(edit.height) > 0;
          const hasScale = Number(edit.scale) > 0;
          const targetScale = hasScale ? Number(Number(edit.scale).toFixed(2)) : (target.scale || 1.0);
          const operation = ['append', 'replace', 'consolidate'].includes(edit.operation) ? edit.operation : 'append';
          const isWriteElement = (target.actions || []).some((a) => a.type === 'write');

          if (isWriteElement && typeof edit.content === 'string' && edit.content.trim()) {
            const existingWrite = target.actions.find((a) => a.type === 'write');
            const oldContent = String(existingWrite?.content || '');
            let content = edit.content.trim();
            if (operation === 'append') {
              const existingLines = new Set(oldContent.split('\n').map((l) => l.trim()).filter(Boolean));
              const newLines = content.split('\n').map((l) => l.trim()).filter((l) => l && !existingLines.has(l));
              if (!newLines.length && !hasWidth && !hasScale) continue;
              content = newLines.length ? [oldContent.trim(), ...newLines].filter(Boolean).join('\n') : oldContent;
            }

            const writeIndex = target.actions.findIndex((a) => a.type === 'write');
            const updatedActions = target.actions.map((a, i) => (i === writeIndex ? { ...a, content } : a));
            const formulaBoardW = hasWidth
              ? Number(edit.width)
              : Math.max(target.width || 380, 520, Math.min(700, (containerRef.current?.clientWidth || 700) - 40));
            const newHeight = hasHeight ? Number(edit.height) : estimateBoardHeight(content, formulaBoardW);
            const smartTitle = target.titleCustom ? target.title : generateSmartBoardTitle(content, edit.title);
            const smartConclusion = extractBoardConclusion(content, edit.conclusion);

            next[targetIndex] = {
              ...target,
              title: smartTitle,
              conclusion: smartConclusion,
              width: formulaBoardW,
              height: newHeight,
              scale: targetScale,
              actions: updatedActions,
              updatedAt: Date.now()
            };
          } else if (Array.isArray(edit.actions) && edit.actions.length) {
            const editableTypes = new Set(['write', 'axes', 'axes3d', 'plot', 'shape', 'shape3d', 'circle']);
            const safeActions = edit.actions.filter((a) => editableTypes.has(a?.type));
            if (!safeActions.length) continue;

            let newTitle = typeof edit.title === 'string' ? edit.title.slice(0, 100) : target.title;
            if (operation === 'append' && safeActions.some((a) => a.type === 'plot') && !edit.title) {
              const allPlotLabels = [...(target.actions || []), ...safeActions]
                .filter((a) => a.type === 'plot')
                .map((a) => formatMathExpression(a.label || a.expr || ''))
                .filter(Boolean);
              if (allPlotLabels.length) {
                newTitle = `📈 坐标系 · ${allPlotLabels.join(' & ')}`;
              }
            }

            next[targetIndex] = {
              ...target,
              title: newTitle,
              width: hasWidth ? Number(edit.width) : target.width,
              height: hasHeight ? Number(edit.height) : target.height,
              scale: targetScale,
              actions: operation === 'append' ? [...(target.actions || []), ...safeActions] : safeActions,
              updatedAt: Date.now()
            };
          } else if (hasWidth || hasScale || hasHeight) {
            const newW = hasWidth ? Number(edit.width) : (target.width || 520);
            const writeAction = (target.actions || []).find((a) => a.type === 'write');
            const newH = hasHeight
              ? Number(edit.height)
              : (writeAction ? estimateBoardHeight(writeAction.content, newW) : target.height);
            next[targetIndex] = {
              ...target,
              width: newW,
              height: newH,
              scale: targetScale,
              updatedAt: Date.now()
            };
          }
        }
        return next;
      });
    }

    // 2. 处理新建图元
    const actionsToCreate = unappliedActions.filter((a) => a.type !== 'update_element' && a.type !== 'delete_element' && a.type !== 'clear_board');
    if (!actionsToCreate.length) return;

    let elemActs = actionsToCreate;
    if (elemActs.some((a) => a.type === 'plot') && !elemActs.some((a) => a.type === 'axes' || a.type === 'axes3d')) {
      elemActs = [{ type: 'axes', xLabel: 'x', yLabel: 'y' }, ...elemActs];
    }

    const hasPlot = elemActs.some((a) => a.type === 'plot');
    const hasAxes = elemActs.some((a) => a.type === 'axes' || a.type === 'axes3d');
    const has3DAxes = elemActs.some((a) => a.type === 'axes3d');
    const hasShape = elemActs.some((a) => a.type === 'shape' || a.type === 'shape3d');
    const hasWrite = elemActs.some((a) => a.type === 'write');
    const isCircleAct = elemActs.some(
      (a) => a.type === 'circle' || (a.type === 'shape' && (a.shapeType === 'circle' || String(a.shapeType || '').includes('圆')))
    );
    const isDraw = hasPlot || hasAxes || hasShape || isCircleAct;

    // 【关键分支 A】：公式板书写入与合并（绝不重复建卡片）
    if (hasWrite && !isDraw) {
      setElements((previous) => {
        const existingWrite = previous.find((el) => (el.actions || []).some((a) => a.type === 'write'));
        const writeAct = elemActs.find((a) => a.type === 'write');
        const contentToAdd = (writeAct?.content || '').trim();

        if (existingWrite) {
          // 增量合并至现有主板书
          return previous.map((el) => {
            if (el.id !== existingWrite.id) return el;
            const oldWrite = (el.actions || []).find((a) => a.type === 'write');
            const oldContent = String(oldWrite?.content || '');
            const newLines = contentToAdd.split('\n').map((l) => l.trim()).filter(Boolean);
            const existingLines = new Set(oldContent.split('\n').map((l) => l.trim()).filter(Boolean));
            const appendLines = newLines.filter((l) => !existingLines.has(l));
            const merged = [oldContent.trim(), ...appendLines].filter(Boolean).join('\n');
            const updatedActions = (el.actions || []).map((a) => (a.type === 'write' ? { ...a, content: merged } : a));
            const formulaBoardW = Math.max(el.width || 380, 520, Math.min(700, (containerRef.current?.clientWidth || 700) - 40));
            const newHeight = estimateBoardHeight(merged, formulaBoardW);
            const smartTitle = el.titleCustom ? el.title : generateSmartBoardTitle(merged, writeAct?.title);
            const smartConclusion = extractBoardConclusion(merged, writeAct?.conclusion);
            return {
              ...el,
              title: smartTitle,
              conclusion: smartConclusion,
              width: formulaBoardW,
              height: newHeight,
              actions: updatedActions,
              updatedAt: Date.now()
            };
          });
        } else {
          // 当前画布无板书，创建唯一的主板书卡片
          const containerW = containerRef.current?.clientWidth || 700;
          const formulaBoardW = Math.max(480, Math.min(700, containerW - 40));
          const pos = findNextAvailablePosition(formulaBoardW, estimateBoardHeight(contentToAdd, formulaBoardW), 'formula');
          const newId = writeAct?.id || `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const smartTitle = generateSmartBoardTitle(contentToAdd, writeAct?.title);
          const smartConclusion = extractBoardConclusion(contentToAdd, writeAct?.conclusion);

          const newElem = {
            id: newId,
            title: smartTitle,
            conclusion: smartConclusion,
            collapsed: false,
            titleCustom: false,
            x: pos.x,
            y: pos.y,
            width: formulaBoardW,
            height: estimateBoardHeight(contentToAdd, formulaBoardW),
            actions: elemActs,
            zone: 'formula',
            createdAt: Date.now()
          };
          return [...previous, newElem];
        }
      });
      return; // 🔴 核心守卫：处理完板书后立即返回，绝不穿透至下方新建图元逻辑！
    }

    // 【关键分支 B】：几何与坐标系画图（画图区防重与创建）
    const targetZone = 'draw';
    const containerW = containerRef.current?.clientWidth || 700;
    const midX = Math.floor(containerW / 2);
    const maxZoneW = Math.max(200, midX - 36);

    let elemTitle = '草稿演算图元';
    let elemWidth = Math.min(320, maxZoneW);
    let elemHeight = 270;

    if (isCircleAct) {
      elemTitle = '⭕ 几何图形: 圆 O 与半径 r';
      elemWidth = Math.min(270, maxZoneW);
      elemHeight = 250;
    } else if (hasPlot) {
      const plotAct = elemActs.find((a) => a.type === 'plot');
      const labelStr = formatMathExpression(plotAct?.label || plotAct?.expr || '');
      elemTitle = `📈 函数图像: ${labelStr || 'y = x²'}`;
      elemWidth = Math.min(310, maxZoneW);
      elemHeight = 270;
    } else if (has3DAxes) {
      elemTitle = '📐 三维坐标系';
      elemWidth = Math.min(320, maxZoneW);
      elemHeight = 290;
    } else if (hasAxes) {
      elemTitle = '📈 直角坐标系';
      elemWidth = Math.min(300, maxZoneW);
      elemHeight = 270;
    } else if (hasShape) {
      const shapeAct = elemActs.find((a) => a.type === 'shape');
      const shapeNameMap = { right_triangle: '直角三角形', circle: '圆形与半径', triangle: '三角形' };
      elemTitle = `📐 几何图形: ${shapeNameMap[shapeAct?.shapeType] || '几何图形'}`;
      elemWidth = Math.min(270, maxZoneW);
      elemHeight = 240;
    }

    const pos = findNextAvailablePosition(elemWidth, elemHeight, targetZone);
    const firstAct = elemActs[0];
    const newElemId = firstAct?.id || `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    setElements((previous) => {
      // 若已存在相同 ID 的图形图元，就地更新它，避免重复叠加
      const existingIdx = previous.findIndex((el) => el.id === newElemId);
      if (existingIdx !== -1) {
        return previous.map((el, i) => (i === existingIdx ? { ...el, actions: elemActs, updatedAt: Date.now() } : el));
      }
      const newElem = {
        id: newElemId,
        title: elemTitle,
        conclusion: '',
        collapsed: false,
        titleCustom: false,
        x: pos.x,
        y: pos.y,
        width: elemWidth,
        height: elemHeight,
        actions: elemActs,
        zone: targetZone,
        createdAt: Date.now()
      };
      return [...previous, newElem];
    });
  }, [findNextAvailablePosition]);

  // ==================== 核心 Agent Loop 执行逻辑 (流式与中断) ====================
  const handleTriggerAgentLoop = async (customPrompt = '') => {
    if (agentRequestInFlightRef.current) return;
    const textToRun = (customPrompt || spokenInput).trim();
    if (!textToRun) {
      showToast('请先输入或点击快捷指令选择要画的图或写的字', 'warn');
      return;
    }

    let priorConversation = [];
    try {
      const stored = JSON.parse(localStorage.getItem(agentChatStorageKey) || '[]');
      if (Array.isArray(stored)) {
        priorConversation = stored
          .filter((message) => ['user', 'assistant'].includes(message?.role) && typeof message?.content === 'string')
          .slice(-6)
          .map(({ role, content }) => ({ role, content }));
      }
    } catch {}

    const userMsgId = `msg_user_${Date.now()}`;
    const assistantMsgId = `msg_agent_${Date.now()}`;

    appendAgentChatMessage({ id: userMsgId, role: 'user', content: textToRun });
    setSpokenInput('');

    agentRequestInFlightRef.current = true;
    setIsAgentRunning(true);
    setAgentLoopStage('THINK · 正在连接 Agent Loop 思考…');
    setAgentMetrics((prev) => ({ ...prev, isLive: true }));

    const abortController = new AbortController();
    agentAbortControllerRef.current = abortController;

    // 预置 assistant 占位消息
    setAgentChatMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        reasoningContent: '',
        toolCalls: [],
        metrics: null,
        isCompleted: false,
        isThinkingExpanded: true
      }
    ]);

    try {
      const response = await fetch('/api/model/scratchpad-agent-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spokenText: textToRun,
          contextProblem,
          currentBoardElements: elements.slice(-30).map((element) => ({
            id: element.id,
            title: element.title,
            conclusion: element.conclusion,
            width: element.width,
            height: element.height,
            actions: (element.actions || []).slice(0, 8).map((action) => ({
              type: action.type,
              content: typeof action.content === 'string' ? action.content.slice(0, 1800) : undefined,
              label: typeof action.label === 'string' ? action.label.slice(0, 180) : undefined,
              expr: typeof action.expr === 'string' ? action.expr.slice(0, 180) : undefined,
              shapeType: action.shapeType,
              plane: action.plane,
              color: action.color,
              labels: action.labels,
              points: Array.isArray(action.points) ? action.points.slice(0, 8) : undefined
            }))
          })),
          recentConversation: priorConversation,
          assistantTone: (() => {
            try { return localStorage.getItem('examcraft_scratchpad_agent_tone') || 'supportive'; }
            catch { return 'supportive'; }
          })()
        }),
        signal: abortController.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`连接流式循环端点失败 (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamEndedNormally = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            streamEndedNormally = true;
            break;
          }

          try {
            const event = JSON.parse(dataStr);

            if (event.metrics) {
              setAgentMetrics({
                iteration: event.metrics.iteration || 1,
                toolCallsCount: event.metrics.toolCallsCount || 0,
                inputTokens: event.metrics.inputTokens || 0,
                outputTokens: event.metrics.outputTokens || 0,
                totalTokens: event.metrics.totalTokens || 0,
                tokenSpeed: event.metrics.tokenSpeed || 0,
                contextTokens: event.metrics.contextTokens || 0,
                maxContextTokens: event.metrics.maxContextTokens || 131072,
                isLive: true
              });
            }

            if (event.canvasActions?.length) {
              applyCanvasActions(event.canvasActions);
            }

            if (event.type === 'iteration-start') {
              setAgentLoopStage(event.iteration > 1 ? `THINK · 第 ${event.iteration} 步推理中…` : 'THINK · 正在深度思考…');
            } else if (event.type === 'reasoning-delta') {
              setAgentLoopStage('THINK · 正在深度思考…');
              setAgentChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, reasoningContent: (m.reasoningContent || '') + event.delta }
                    : m
                )
              );
            } else if (event.type === 'text-delta') {
              setAgentLoopStage('WRITE · 正在整理板书回答…');
              setAgentChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: (m.content || '') + event.delta }
                    : m
                )
              );
            } else if (event.type === 'tool-call-start') {
              const toolName = event.toolCall?.name || 'tool';
              setAgentLoopStage(`TOOL · 正在调用「${toolName}」…`);
              setAgentChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        toolCalls: [
                          ...(m.toolCalls || []),
                          { id: event.toolCall.id, name: toolName, status: 'executing' }
                        ]
                      }
                    : m
                )
              );
            } else if (event.type === 'tool-result') {
              setAgentChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        toolCalls: (m.toolCalls || []).map((tc) =>
                          tc.id === event.toolCallId || tc.name === event.toolName
                            ? { ...tc, status: 'done', result: event.result }
                            : tc
                        )
                      }
                    : m
                )
              );
            } else if (event.type === 'completed') {
              setAgentChatMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        isCompleted: true,
                        isThinkingExpanded: false,
                        metrics: event.metrics || m.metrics
                      }
                    : m
                );
                try {
                  localStorage.setItem(agentChatStorageKey, JSON.stringify(updated.slice(-40)));
                } catch {}
                return updated;
              });
              showToast('Agent Loop 思考与画板操作已全部完成！', 'success');
            } else if (event.type === 'aborted') {
              setAgentChatMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, isAborted: true, isCompleted: true }
                    : m
                );
                try {
                  localStorage.setItem(agentChatStorageKey, JSON.stringify(updated.slice(-40)));
                } catch {}
                return updated;
              });
            } else if (event.type === 'error') {
              const errorText = typeof event.error === 'object' && event.error !== null
                ? (event.error.message || JSON.stringify(event.error))
                : String(event.error || '模型异常');
              setAgentChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, isCompleted: true, content: `执行提示: ${errorText}` }
                    : m
                )
              );
            }
          } catch (e) {
            console.warn('[scratchpad] 解析 SSE 块失败:', e);
          }
        }

        if (streamEndedNormally) break;
      }

      // 兜底：如果流读完了但未收到 completed 事件，强制将消息置为 completed 避免一直转圈
      setAgentChatMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === assistantMsgId && !m.isCompleted
            ? {
                ...m,
                isCompleted: true,
                isThinkingExpanded: false,
                content: m.content || (m.reasoningContent ? '已完成思考与分析。' : '执行完成。')
              }
            : m
        );
        try {
          localStorage.setItem(agentChatStorageKey, JSON.stringify(updated.slice(-40)));
        } catch {}
        return updated;
      });

      setAgentMetrics((prev) => ({ ...prev, isLive: false, tokenSpeed: 0 }));
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        showToast('已中断执行', 'info');
      } else {
        console.warn('[scratchpad] 流式接口异常:', err.message);
        setAgentChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, isCompleted: true, content: `连接异常: ${err.message}` }
              : m
          )
        );
        showToast(`Agent 执行提示: ${err.message}`, 'warn');
      }
    } finally {
      agentRequestInFlightRef.current = false;
      setIsAgentRunning(false);
      setAgentLoopStage('');
      setAgentMetrics((prev) => ({ ...prev, isLive: false }));
    }
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl border border-outline-variant/30">
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

      {/* 用户直接编辑草稿板书模态框 */}
      {editingBoardElement && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest border border-outline-variant/60 shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90%]">
            {/* 模态框顶部 */}
            <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[17px]">edit_note</span>
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-on-surface">直接编辑规范板书演算</h4>
                  <p className="text-[10px] text-on-surface-variant">修改后画布即时重绘，后续 Agent Loop 将强制先阅读此最新板书（先读后写规则）</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBoardElement(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition cursor-pointer"
                title="关闭"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* 模态框主体 */}
            <div className="p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-[11px] font-medium text-stone-600">板书内容 (支持 LaTeX 与分步换行)：</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { label: '分式', code: '\\frac{1}{u}' },
                    { label: '根号', code: '\\sqrt{x}' },
                    { label: '所以', code: '\\therefore' },
                    { label: '因为', code: '\\because' },
                    { label: '求导', code: "y'" },
                    { label: 'sin', code: '\\sin y' },
                    { label: 'cos', code: '\\cos y' }
                  ].map((snippet) => (
                    <button
                      key={snippet.label}
                      type="button"
                      onClick={() => setEditingBoardText((prev) => (prev ? prev + ' ' + snippet.code : snippet.code))}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-container border border-outline-variant/30 hover:bg-primary/10 hover:text-primary transition cursor-pointer"
                      title={`插入 ${snippet.code}`}
                    >
                      {snippet.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={editingBoardText}
                onChange={(e) => setEditingBoardText(e.target.value)}
                rows={8}
                placeholder="例如：&#10;令 $y = \arcsin x$，则 $\sin y = x$&#10;$\therefore \cos y \cdot y' = 1$&#10;$\therefore y' = \frac{1}{\cos y}$"
                className="w-full p-3 font-mono text-[13px] leading-relaxed rounded-xl border border-outline-variant/50 bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-hidden resize-y min-h-[140px]"
              />

              {/* 实时渲染效果预览 */}
              {editingBoardText.trim() && (
                <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-surface-container-low/50 border border-outline-variant/30 max-h-[140px] overflow-y-auto">
                  <div className="text-[10px] font-semibold text-outline">实时公式渲染预览：</div>
                  {editingBoardText.split('\n').filter(Boolean).map((line, idx) => (
                    <div key={idx} className="text-[13px] font-serif text-primary flex items-center gap-1.5 py-0.5">
                      <span className="text-[10px] text-outline font-mono select-none">{idx + 1}.</span>
                      {/\$([^\$]+)\$/.test(line) ? (
                        <span>
                          {line.split(/(\$[^\$]+\$)/).map((part, pIdx) => {
                            if (part.startsWith('$') && part.endsWith('$')) {
                              return <KatexInline key={pIdx} math={part.slice(1, -1)} />;
                            }
                            return <span key={pIdx} className="font-sans text-stone-700 text-[12px]">{part}</span>;
                          })}
                        </span>
                      ) : (
                        <KatexInline math={line} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[11px] text-stone-500 bg-surface-container-low/60 rounded-lg p-2.5 flex items-start gap-2 border border-outline-variant/20">
                <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">verified_user</span>
                <div className="leading-normal">
                  <strong>先读后写规则保障：</strong>您在此处手动修正或补充的内容，将作为当前草稿纸的【唯一真实事实】同步至 Agent。Agent 在执行下一步前必须先阅读此内容，绝不推翻您的手动修改。
                </div>
              </div>
            </div>

            {/* 模态框底部按钮 */}
            <div className="px-4 py-2.5 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditingBoardText('')}
                className="px-2.5 py-1 text-[11px] text-outline hover:text-error transition cursor-pointer"
              >
                清空内容
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBoardElement(null)}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-[12px] font-medium text-stone-700 hover:bg-surface-container transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedBoard}
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 shadow-xs transition cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  <span>保存并同步草稿</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 顶部主工作台控制工具栏（支持自由拖拽移动整个草稿纸窗口；双击切换最大化） */}
      <div
        className={`flex items-center justify-between gap-1.5 px-3 py-2 border-b border-surface-container shrink-0 flex-wrap text-[12px] bg-surface-container-low/50 select-none ${
          !isMaximized ? 'cursor-move' : ''
        }`}
        onMouseDown={onWindowDragStart}
        onDoubleClick={onToggleMaximize}
        title={!isMaximized ? "按住顶部工具栏可自由拖动草稿纸；双击可最大化/还原" : "双击可还原便签窗口"}
      >
        {/* 左区：画板与考场学术诚信防线标志 */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 text-primary font-bold ${
              !isMaximized ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            title={!isMaximized ? "按住拖拽草稿纸移动位置" : ""}
          >
            {!isMaximized && (
              <span className="material-symbols-outlined text-[17px] text-primary/70 hover:text-primary transition">
                drag_indicator
              </span>
            )}
            <span className="material-symbols-outlined text-[19px]">draw</span>
            <span className="text-[13px] font-sans">
              {questionNum ? `第 ${questionNum} 题 · 专属草稿纸` : '草稿演算工作台'}
            </span>
          </div>

          {questionCount > 1 && (
            <SelectMenu
              ariaLabel="切换草稿题目"
              value={questionIndex}
              onChange={(index) => onNavigateQuestion?.(Number(index))}
              options={questionNums.map((number, index) => ({
                value: index,
                label: `第 ${number} 题${questionDraftFlags[index] ? ' · 有草稿' : ''}`
              }))}
              className="max-w-[150px]"
              dataNoDrag
              buttonClassName="inline-flex max-w-[150px] items-center justify-between gap-1 rounded-md border border-outline-variant/40 bg-surface-container-lowest px-1.5 py-1 text-left text-[11px] text-on-surface hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              menuClassName="left-0 right-auto"
            />
          )}

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-sans font-medium ${saveError ? 'bg-error/10 text-error border-error/20' : 'bg-primary/10 text-primary border-primary/20'}`} data-no-drag role="status" aria-live="polite">
            <span className={`w-1.5 h-1.5 rounded-full ${saveError ? 'bg-error' : 'bg-primary'}`}></span>
            <span>{saveError ? '保存失败，请检查浏览器空间' : '已自动保存到本机'}</span>
          </span>

          <div className="hidden xl:flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container/30 border border-secondary/20 text-secondary text-[11px] font-medium font-sans" data-no-drag>
            <span className="material-symbols-outlined text-[13px]">shield</span>
            <span>铁律：AI 帮画帮写不帮算，只能局限于您说出的内容</span>
          </div>
        </div>

        {/* 中区：手绘画笔/橡皮/粗细/颜色/背景底纹 */}
        <div className="flex items-center gap-1.5 flex-wrap" data-no-drag>
          {/* 画笔 / 橡皮 / 拖动整体 */}
          <div className="flex items-center bg-surface-container-lowest p-0.5 rounded-lg border border-outline-variant/30">
            <button
              type="button"
              onClick={() => setTool('brush')}
              aria-pressed={tool === 'brush'}
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
              aria-pressed={tool === 'eraser'}
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
              aria-pressed={tool === 'select'}
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
                  aria-label={`画笔颜色：${c.name}`}
                  aria-pressed={brushColor === c.color}
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
                aria-pressed={paperPattern === p.id}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  paperPattern === p.id ? 'bg-surface-container-high text-primary font-semibold' : 'text-on-surface-variant'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {canRecover && (
            <button
              type="button"
              onClick={handleRecoverClear}
              className="px-2 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 text-[11px] font-medium"
              data-no-drag
            >
              恢复清空前草稿
            </button>
          )}

          {/* 撤销 / 重做 / 导出 / 清空手绘 */}
          <details className="relative" data-no-drag onDoubleClick={(e) => e.stopPropagation()}>
            <summary className="list-none px-2 py-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:text-primary cursor-pointer text-[11px] font-medium">更多</summary>
            <div className="absolute right-0 top-full z-30 mt-1 flex items-center gap-1 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-1.5 shadow-xl">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyStep <= 0}
              aria-label="撤销上一步笔迹"
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer disabled:opacity-30"
              title="撤销上一步笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">undo</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1}
              aria-label="重做下一步笔迹"
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer disabled:opacity-30"
              title="重做下一步笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">redo</span>
            </button>
            <button
              type="button"
              onClick={handleTidyAllElements}
              disabled={elements.length === 0}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-primary transition flex items-center gap-1 cursor-pointer disabled:opacity-30"
              title="一键将草稿图元智能规整为：左侧画图，右侧写公式，彻底消除重叠"
            >
              <span className="material-symbols-outlined text-[14px] text-primary">auto_fix_normal</span>
              <span>规整</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              aria-label="导出草稿纸图片"
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition cursor-pointer"
              title="导出手绘草稿为图片"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
            </button>
            <button
              type="button"
              onClick={handleClearCanvasClick}
              aria-label="清空草稿纸画布"
              className="p-1 rounded text-outline hover:text-error hover:bg-surface-container transition cursor-pointer"
              title="清空当前手绘笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            </button>
            </div>
          </details>
        </div>

        {/* 右区：侧栏收放、透明度调节、复位、全屏与关闭控制 */}
        <div className="flex items-center gap-1.5 flex-wrap" data-no-drag>
          {/* 透明度调节控制器 */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-[11px] shadow-2xs"
            title="调节草稿纸透视透明度（30% ~ 100%），方便透过草稿纸查看下方试卷与题目；点击图标快速切换预设"
          >
            <button
              type="button"
              onClick={() => onOpacityChange && onOpacityChange(opacity === 100 ? 75 : opacity <= 50 ? 100 : 50)}
              aria-label="切换常用纸面透明度"
              className="p-0.5 hover:text-primary transition cursor-pointer flex items-center"
              title="点击快速切换常用透明度预设 (100% / 75% / 50%)"
            >
              <span className={`material-symbols-outlined text-[15px] ${opacity < 100 ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                opacity
              </span>
            </button>
            <label htmlFor="scratchpad-opacity" className="text-[10px] text-on-surface-variant font-medium hidden sm:inline">纸面透明度</label>
            <input
              id="scratchpad-opacity"
              type="range"
              min="30"
              max="100"
              step="5"
              value={opacity}
              onChange={(e) => onOpacityChange && onOpacityChange(Number(e.target.value))}
              aria-label="纸面透明度"
              className="w-12 sm:w-16 h-1.5 accent-primary cursor-pointer"
            />
            <span className="font-mono text-[10px] font-bold text-primary w-7 text-right" aria-live="polite">
              {opacity}%
            </span>
          </div>

          {/* 当窗口被移动后，显示一键复位到默认位置按钮 */}
          {isMoved && !isMaximized && onResetPosition && (
            <button
              type="button"
              onClick={onResetPosition}
              aria-label="恢复草稿纸默认位置"
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition cursor-pointer flex items-center"
              title="复位草稿纸到右下角默认位置"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAssistantCollapsed(!isAssistantCollapsed)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 cursor-pointer border ${
              !isAssistantCollapsed
                ? 'bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant/30'
            }`}
            title={isAssistantCollapsed ? '展开草稿纸聊天助手' : '收起草稿纸聊天助手以扩充手绘区域'}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isAssistantCollapsed ? 'splitscreen_left' : 'splitscreen'}
            </span>
            <span className="hidden md:inline">{isAssistantCollapsed ? '展开助手' : '收起助手'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFocusMode((value) => !value)}
            aria-pressed={isFocusMode}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition border ${isFocusMode ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container text-on-surface-variant border-outline-variant/30'}`}
            title={isFocusMode ? '退出专注模式（Esc）' : '隐藏聊天助手，专注手写'}
          >
            {isFocusMode ? '退出专注' : '专注书写'}
          </button>

          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              aria-label={isMaximized ? '还原草稿纸窗口' : '最大化草稿纸窗口'}
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
              aria-label="收起草稿纸"
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition cursor-pointer"
              title="收起草稿纸"
            >
              <span className="material-symbols-outlined text-[17px]">close</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-b border-outline-variant/20 bg-surface-container-low/40 p-1.5 lg:hidden" data-no-drag>
        <button type="button" onClick={() => setMobileWorkspaceTab('canvas')} aria-pressed={mobileWorkspaceTab === 'canvas'} className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${mobileWorkspaceTab === 'canvas' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container'}`}>
          <span className="material-symbols-outlined text-[16px]">draw</span>手绘草稿
        </button>
        <button type="button" onClick={() => { setMobileWorkspaceTab('assistant'); setIsAssistantCollapsed(false); setIsFocusMode(false); }} aria-pressed={mobileWorkspaceTab === 'assistant'} className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${mobileWorkspaceTab === 'assistant' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container'}`}>
          <span className="material-symbols-outlined text-[16px]">edit_note</span>聊天助手
        </button>
      </div>

      {/* 主体工作区：桌面并排显示，手机端通过顶部切换手绘与助手 */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full h-full p-2 gap-2 overflow-y-auto lg:overflow-hidden">
        {/* 左侧：手绘涂鸦主画板 */}
        <div
          ref={containerRef}
          className={`relative h-[min(48dvh,440px)] min-h-[220px] max-h-[440px] lg:h-full lg:min-h-0 lg:max-h-none rounded-[3px] border border-[#e8e2d4] overflow-hidden touch-none shadow-sm transition-all duration-200 ${mobileWorkspaceTab === 'canvas' ? '' : 'hidden lg:block'} ${
            tool === 'select' ? 'cursor-grab' : 'cursor-crosshair'
          } ${
            isAssistantCollapsed ? 'w-full' : 'flex-1 min-w-0 lg:min-w-[320px]'
          }`}
          style={{
            backgroundColor: `rgba(255, 254, 248, ${paperOpacity})`,
            backgroundImage:
              paperPattern === 'grid'
                ? `linear-gradient(to right, rgba(125, 145, 166, ${0.11 * paperOpacity}) 1px, transparent 1px), linear-gradient(to bottom, rgba(125, 145, 166, ${0.11 * paperOpacity}) 1px, transparent 1px), radial-gradient(ellipse at 18% 12%, rgba(190, 166, 119, 0.045), transparent 70%)`
                : paperPattern === 'lined'
                ? `linear-gradient(to bottom, transparent 27px, rgba(125, 145, 166, ${0.17 * paperOpacity}) 28px), linear-gradient(to right, transparent 47px, rgba(196, 112, 102, ${0.16 * paperOpacity}) 48px, transparent 49px), radial-gradient(ellipse at 18% 12%, rgba(190, 166, 119, 0.045), transparent 70%)`
                : 'radial-gradient(ellipse at 18% 12%, rgba(190, 166, 119, 0.045), transparent 70%)',
            backgroundSize: paperPattern === 'grid' ? '28px 28px, 28px 28px, 100% 100%' : paperPattern === 'lined' ? '100% 28px, 100% 100%, 100% 100%' : '100% 100%'
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
              tool={tool}
              onUpdatePosition={handleUpdateElementPosition}
              onUpdateSize={handleUpdateElementSize}
              onDelete={handleDeleteElement}
              onOpenEditor={handleOpenBoardEditor}
              onToggleCollapse={handleToggleCollapseElement}
              onUpdateTitle={handleUpdateElementTitle}
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
            <div className="absolute bottom-2.5 right-3 pointer-events-none text-[10px] text-stone-600/75 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary">drag_pan</span>
              <span>按住图元顶部手柄或使用【拖动】工具，可任意挪动画入内容</span>
            </div>
          )}
        </div>

        {/* 右侧：一体化公式板书与 Agent Loop 帮画/帮写协作区 */}
        {!isAssistantCollapsed && !isFocusMode && (
          <div className={`w-full lg:w-[420px] xl:w-[460px] h-[min(54dvh,480px)] min-h-[260px] lg:h-full flex flex-col gap-2 shrink-0 min-h-0 animate-in fade-in duration-150 ${mobileWorkspaceTab === 'assistant' ? '' : 'hidden lg:flex'}`}>
            {/* 模块 1：Agent Loop 口述帮画 & 帮写工作区 */}
            <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden px-1">
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-outline-variant/15">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-tight tracking-wide text-on-surface">草稿纸助手</div>
                    <div className="mt-0.5 truncate text-[10px] leading-tight text-on-surface-variant">只按你的指令画写，不推导答案</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {modelStatus?.success && (
                    <div
                      className="hidden sm:inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant/25 bg-surface-container-low px-1.5 font-label-mono text-[9px] text-on-surface-variant"
                      title={`本机今日用量：${todayModelTokens.toLocaleString()} tokens；费用估算 ${todayModelCostKnown ? `¥${todayModelCost.toFixed(4)}` : '暂无单价'}${isOfficialDeepSeek ? `；DeepSeek 钱包 ${modelWallet ? `${modelWallet.currency === 'CNY' ? '¥' : '$'}${modelWallet.totalBalance.toFixed(2)}` : '暂不可用'}` : ''}`}
                      aria-label={`AI 今日 ${todayModelTokens.toLocaleString()} tokens，费用估算 ${todayModelCostKnown ? `¥${todayModelCost.toFixed(4)}` : '暂无单价'}`}
                    >
                      <span className="material-symbols-outlined text-[12px] text-primary">token</span>
                      <span>{todayModelTokens.toLocaleString()}</span>
                      <span className="text-outline-variant">·</span>
                      <span>{todayModelCostKnown ? `¥${todayModelCost.toFixed(4)}` : '¥—'}</span>
                      {isOfficialDeepSeek && (
                        <>
                          <span className="text-outline-variant">·</span>
                          <span className="material-symbols-outlined text-[12px] text-secondary">account_balance_wallet</span>
                          <span>{modelWallet ? `${modelWallet.currency === 'CNY' ? '¥' : '$'}${modelWallet.totalBalance.toFixed(2)}` : '—'}</span>
                        </>
                      )}
                    </div>
                  )}
                  {isAgentRunning && <span className="inline-flex items-center gap-1 text-[10px] text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />处理中</span>}
                  <button type="button" onClick={clearAgentChat} disabled={!agentChatMessages.length || isAgentRunning} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] text-on-surface-variant/75 transition hover:bg-error/5 hover:text-error disabled:opacity-35" title="清空本题对话记录；不会清除草稿纸上的笔迹和图形">
                    <span className="material-symbols-outlined text-[14px]">delete_sweep</span><span>清空</span>
                  </button>
                </div>
              </div>

              {/* 辅助工具快捷药丸栏：极简轻量，彻底释放纵向对话视口 */}
              <div className="flex items-center justify-between gap-1.5 py-1 px-0.5 border-b border-outline-variant/15">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* 药丸 A：数学推导语言坞 (因为所以/设令/推出/QED) */}
                  <button
                    type="button"
                    onClick={() => setActiveAuxDrawer((prev) => (prev === 'derivation' ? null : 'derivation'))}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-medium transition-all duration-200 cursor-pointer border ${
                      activeAuxDrawer === 'derivation'
                        ? 'bg-primary text-on-primary border-primary shadow-2xs'
                        : 'bg-surface-container-lowest/90 hover:bg-surface-container text-on-surface border-outline-variant/30'
                    }`}
                    title="展开/收起数学推导语言智能工具坞（因为所以、设令假设、推出、充要与QED）"
                  >
                    <span className="material-symbols-outlined text-[13px]">calculate</span>
                    <span>推导语言</span>
                    <span className={`material-symbols-outlined text-[13px] transition-transform duration-200 ${activeAuxDrawer === 'derivation' ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>

                  {/* 药丸 B：题干公式快捷参考 */}
                  <button
                    type="button"
                    onClick={() => setActiveAuxDrawer((prev) => (prev === 'formulas' ? null : 'formulas'))}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-medium transition-all duration-200 cursor-pointer border ${
                      activeAuxDrawer === 'formulas'
                        ? 'bg-primary text-on-primary border-primary shadow-2xs'
                        : 'bg-surface-container-lowest/90 hover:bg-surface-container text-on-surface border-outline-variant/30'
                    }`}
                    title="展开/收起本题已知公式与选项参数快捷参考"
                  >
                    <span className="material-symbols-outlined text-[13px]">functions</span>
                    <span>题目公式</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                      activeAuxDrawer === 'formulas' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    }`}>
                      {mathChips.length}
                    </span>
                    <span className={`material-symbols-outlined text-[13px] transition-transform duration-200 ${activeAuxDrawer === 'formulas' ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[9.5px] text-outline font-mono">
                  {elements.length > 0 && <span>画板 {elements.length} 项</span>}
                </div>
              </div>

              {/* 丝滑抽屉展开区 (AnimatePresence + Spring 物理弹簧过渡) */}
              <AnimatePresence mode="wait">
                {activeAuxDrawer === 'derivation' && (
                  <motion.div
                    key="derivation-dock"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', bounce: 0.12, duration: 0.28 }}
                    className="overflow-hidden border-b border-outline-variant/20 bg-surface-container-lowest/70 rounded-xl p-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between pb-1 px-1 text-[10px] text-outline border-b border-outline-variant/15 mb-1">
                      <span className="font-semibold text-on-surface flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-primary">calculate</span>
                        推导语言与量词符号
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveAuxDrawer(null)}
                        className="text-outline hover:text-on-surface transition p-0.5 rounded cursor-pointer"
                        title="收起推导工具坞"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    </div>
                    <MathDerivationDock
                      onInsertPrompt={handleAppendSpokenPrompt}
                      onWriteToBoard={(latex, label) => handleQuickWriteToBoard(latex, label)}
                      onCopyLatex={(latex, label) => showToast(`已复制「${label}」LaTeX 符号`, 'info')}
                    />
                  </motion.div>
                )}

                {activeAuxDrawer === 'formulas' && (
                  <motion.div
                    key="formulas-dock"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', bounce: 0.12, duration: 0.28 }}
                    className="overflow-hidden border-b border-outline-variant/20 bg-surface-container-lowest/70 rounded-xl p-2 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1 flex-wrap pb-1 border-b border-outline-variant/15">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-[14px] text-primary">functions</span>
                        <span>第 {questionNum || '当前'} 题公式快捷输入</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-mono bg-primary/10 text-primary font-bold">
                          {mathChips.length}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {mathChips.length > 3 && (
                          <div className="flex items-center gap-0.5 text-[9.5px] bg-surface-container p-0.5 rounded-md">
                            {[
                              { id: 'all', label: '全部' },
                              { id: 'core', label: '题干' },
                              { id: 'option', label: '选项' }
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setChipFilter(tab.id)}
                                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                                  chipFilter === tab.id
                                    ? 'bg-surface-container-lowest text-primary font-bold shadow-2xs'
                                    : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleAiExtractChips}
                          disabled={isExtractingChips || isAgentRunning}
                          className="px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium border border-primary/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                          title="由 AI 解析本题题干，原样提取题干中出现的已知式与选项参数（严守防作弊，严禁提供题外定理）"
                        >
                          <span className={`material-symbols-outlined text-[12px] ${isExtractingChips ? 'animate-spin' : ''}`}>
                            {isExtractingChips ? 'sync' : 'auto_awesome'}
                          </span>
                          <span>{isExtractingChips ? '提取中...' : 'AI 提取已知式'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveAuxDrawer(null)}
                          className="text-outline hover:text-on-surface transition p-0.5 rounded cursor-pointer ml-1"
                          title="收起公式参考"
                        >
                          <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                      </div>
                    </div>

                    {/* 公式快捷胶囊列表 */}
                    <div className="flex items-center gap-1.5 flex-wrap max-h-[110px] overflow-y-auto pr-0.5 select-none">
                      {filteredChips.length === 0 ? (
                        <div className="text-[10.5px] text-outline py-1 px-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">info</span>
                          <span>题干未检测到公式，可点击右上角「AI 提取已知式」</span>
                        </div>
                      ) : (
                        filteredChips.map((chip) => {
                          const isAi = chip.id?.startsWith('chip_ai');
                          const isOption = chip.category === 'option';
                          const isCore = chip.category === 'core';
                          return (
                            <div
                              key={chip.id}
                              className={`group/chip inline-flex items-center rounded-lg border text-[10.5px] transition shadow-2xs overflow-hidden ${
                                isAi
                                  ? 'border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20'
                                  : isOption
                                  ? 'border-blue-300/60 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20'
                                  : 'border-outline-variant/40 bg-surface-container-lowest hover:border-primary/50'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleAppendSpokenPrompt(chip)}
                                disabled={isAgentRunning}
                                className="px-2 py-0.5 flex items-center gap-1 font-mono text-[10.5px] text-on-surface hover:text-primary transition cursor-pointer truncate max-w-[210px]"
                                title={`左键填入指令框：${chip.latex}`}
                              >
                                {isAi && (
                                  <span className="text-[9px] px-1 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 font-sans font-bold">
                                    AI
                                  </span>
                                )}
                                {isOption && !isAi && (
                                  <span className="text-[9px] px-1 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-sans font-bold">
                                    选项
                                  </span>
                                )}
                                {isCore && !isAi && (
                                  <span className="text-[9px] px-1 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-sans font-bold">
                                    题干
                                  </span>
                                )}
                                <span className="truncate inline-flex items-center">
                                  {chip.latex ? <KatexInline math={chip.latex} /> : formatMathExpression(chip.label)}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickWriteToBoard(chip.latex, chip.label);
                                }}
                                disabled={isAgentRunning}
                                className="px-1.5 py-0.5 bg-surface-container/60 hover:bg-primary hover:text-white text-on-surface-variant transition border-l border-outline-variant/30 cursor-pointer flex items-center gap-0.5 text-[9.5px]"
                                title={`一键将「${chip.label || chip.latex}」抄入草稿画板与板书`}
                              >
                                <span className="material-symbols-outlined text-[11px]">edit_note</span>
                                <span className="hidden sm:inline">抄入</span>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 中部对话流视口：开阔明朗，拥有主要纵向空间 */}
              <div ref={agentChatScrollRef} role="log" aria-live="polite" aria-label="草稿纸助手对话" className="flex-1 min-h-[90px] overflow-y-auto px-1 py-1.5 space-y-2.5 select-text">
                {agentChatMessages.length === 0 ? (
                  <div className="h-full min-h-[140px] flex flex-col items-center justify-center gap-2 text-center px-3 py-4">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs">
                      <span className="material-symbols-outlined text-[22px]">draw</span>
                    </div>
                    <div>
                      <div className="text-[12.5px] font-semibold text-on-surface">草稿纸助教就绪</div>
                      <div className="mt-1 text-[10.5px] leading-relaxed text-on-surface-variant max-w-[280px]">
                        基于真实 Agent Loop 执行引擎：按步思考，自主调用查阅、誊写板书、绘制曲线等工具。
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1.5 mt-1.5">
                      {[
                        { label: '📐 画坐标系', prompt: '帮我画一个标准的直角坐标系' },
                        { label: '📈 画抛物线', prompt: '画一个直角坐标系并绘制二次函数 y=x^2 抛物线' },
                        { label: '📝 誊写公式', prompt: '帮我把公式规范写到草稿纸上：' }
                      ].map((suggestion) => (
                        <button
                          key={suggestion.label}
                          type="button"
                          onClick={() => setSpokenInput(suggestion.prompt)}
                          disabled={isAgentRunning}
                          className="rounded-full border border-primary/20 bg-surface-container-lowest/90 px-2.5 py-1 text-[10px] text-primary hover:bg-primary/10 transition-all duration-150 disabled:opacity-40 shadow-2xs cursor-pointer"
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  agentChatMessages.map((message) => {
                    const hasThoughtOrTools = Boolean(message.reasoningContent || (message.toolCalls && message.toolCalls.length > 0));
                    const isThoughtExpanded = expandedThoughts[message.id] !== undefined
                      ? expandedThoughts[message.id]
                      : false;

                    return (
                      <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[94%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed break-words select-text shadow-2xs ${
                          message.role === 'user'
                            ? 'bg-primary text-on-primary rounded-br-xs shadow-sm'
                            : message.status === 'blocked'
                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded-bl-xs'
                            : message.status === 'error'
                            ? 'bg-error/10 text-error border border-error/20 rounded-bl-xs'
                            : 'bg-surface-container-lowest text-on-surface rounded-bl-xs border border-outline-variant/25'
                        }`}>
                          {message.role !== 'user' && (
                            <div className="flex items-center justify-between text-[10px] font-semibold text-on-surface-variant mb-1 pb-1 border-b border-outline-variant/15">
                              <div className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px] text-primary">draw</span>
                                <span>{message.status === 'blocked' ? '安全提示' : message.status === 'error' ? '执行未完成' : '草稿纸助教'}</span>
                              </div>
                              {message.metrics && (() => {
                                const toolsCount = message.toolCalls?.length ?? message.metrics.toolCallsCount ?? 0;
                                const totalTok = message.metrics.totalTokens || (message.metrics.inputTokens + message.metrics.outputTokens) || 0;
                                return (
                                  <span className="text-[9px] text-outline font-normal font-mono flex items-center gap-1">
                                    <span>{toolsCount > 0 ? `${toolsCount} 次工具调用` : '直接回复'}</span>
                                    <span>·</span>
                                    <span>共 {totalTok} tok</span>
                                  </span>
                                );
                              })()}
                            </div>
                          )}

                          {/* 思考过程与工具调用过程 (可收缩淡色文字，带 Spring 动效) */}
                          {message.role !== 'user' && hasThoughtOrTools && (
                            <div className="mb-2 rounded-xl border border-outline-variant/25 bg-surface-container-low/40 overflow-hidden text-[10px]">
                              <button
                                type="button"
                                onClick={() => toggleThoughtExpanded(message.id)}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-surface-container-high/40 transition cursor-pointer text-on-surface-variant font-medium select-none"
                                title="点击折叠或展开深度思考与工具调用过程"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`material-symbols-outlined text-[13px] ${!message.isCompleted ? 'text-primary animate-pulse' : 'text-outline'}`}>
                                    psychology
                                  </span>
                                  <span className="truncate">
                                    {!message.isCompleted
                                      ? '深度思考与工具调用中…'
                                      : `深度思考过程${message.toolCalls?.length ? ` · 调用了 ${message.toolCalls.length} 项工具` : ''}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[9.5px] text-outline shrink-0">
                                  {!message.isCompleted && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-ping mr-1" />
                                  )}
                                  <span
                                    className="material-symbols-outlined text-[13px] transition-transform duration-200"
                                    style={{ transform: isThoughtExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                  >
                                    expand_more
                                  </span>
                                </div>
                              </button>

                              {isThoughtExpanded && (
                                <div className="px-2.5 pb-2 pt-1 border-t border-outline-variant/15 space-y-1.5">
                                  {/* 工具调用药丸徽标 */}
                                  {message.toolCalls && message.toolCalls.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {message.toolCalls.map((tc, idx) => {
                                        const isExecuting = tc.status === 'executing';
                                        const toolLabelMap = {
                                          read_scratchpad: '查阅画板',
                                          write_math_derivation: '誊写板书',
                                          draw_geometry_or_plot: '绘制图表',
                                          update_or_substitute: '等量代换',
                                          delete_or_clear: '擦除清空'
                                        };
                                        const label = toolLabelMap[tc.name] || tc.name;
                                        return (
                                          <span
                                            key={tc.id || idx}
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] border ${
                                              isExecuting
                                                ? 'bg-primary/10 border-primary/30 text-primary animate-pulse'
                                                : 'bg-surface-container-high/60 border-outline-variant/30 text-on-surface-variant'
                                            }`}
                                            title={tc.result ? (typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result)) : tc.name}
                                          >
                                            <span className="material-symbols-outlined text-[10px]">
                                              {isExecuting ? 'sync' : 'build'}
                                            </span>
                                            <span>{label}</span>
                                            {isExecuting && <span className="animate-spin text-[8px]">◌</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* 淡色思考内容流 */}
                                  {message.reasoningContent && (
                                    <div className="font-mono text-on-surface-variant/75 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap select-text pr-1 text-[9.5px] bg-surface-container-lowest/60 p-2 rounded-lg border border-outline-variant/15">
                                      {message.reasoningContent}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 正式回答内容 (支持 Markdown & KaTeX 数学公式渲染) */}
                          {message.role === 'user' ? (
                            <div className="text-[11px] leading-relaxed whitespace-pre-wrap">{message.content}</div>
                          ) : (
                            <div className="space-y-1">
                              {message.content ? (
                                <MathMarkdown content={message.content} className="text-[11px] leading-relaxed select-text" />
                              ) : (
                                !message.isCompleted && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/70 italic py-0.5">
                                    <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                                    <span>正在整理最终板书与答复…</span>
                                  </div>
                                )
                              )}
                              {message.isAborted && (
                                <div className="inline-flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  <span className="material-symbols-outlined text-[11px]">cancel</span>
                                  <span>已由用户中断回答</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 模块 3：一体化 AI Command Deck 底座 (输入框 + 内嵌状态栏 + 操作栏浑然一体) */}
              <div className="relative rounded-2xl border border-outline-variant/35 bg-surface-container-lowest/90 backdrop-blur-xs p-2 shadow-xs focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all duration-200 flex flex-col gap-1.5">
                {/* 顶层：极简舒适的输入文本框 */}
                <div className="relative">
                  <label htmlFor="scratchpad-ai-prompt" className="sr-only">草稿纸 AI 帮画或帮写指令</label>
                  <textarea
                    id="scratchpad-ai-prompt"
                    value={spokenInput}
                    onChange={(e) => setSpokenInput(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && isAgentRunning) {
                        event.preventDefault();
                        handleAbortAgentLoop();
                      } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        if (!isAgentRunning) {
                          handleTriggerAgentLoop();
                        }
                      }
                    }}
                    placeholder={isAgentRunning ? "草稿纸助教正在执行中… 按 Esc 或点击下方停止按钮可打断" : "聊聊天，或告诉我画什么、誊写什么… Enter 发送，Shift+Enter 换行"}
                    rows={2}
                    className="w-full bg-transparent text-[11.5px] text-on-surface placeholder:text-outline/70 focus:outline-none resize-none leading-relaxed pr-6"
                  />
                  {spokenInput && !isAgentRunning && (
                    <button
                      type="button"
                      onClick={() => setSpokenInput('')}
                      className="absolute top-0 right-0 p-0.5 rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition cursor-pointer"
                      title="清空当前输入框"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  )}
                </div>

                {/* 中层：内嵌式 Status Bar 监控指示带 */}
                <div className="relative overflow-hidden flex items-center justify-between px-2.5 py-1 rounded-lg bg-surface-container-low/75 border border-outline-variant/20 text-[9.5px] text-on-surface-variant font-mono select-none gap-2">
                  {/* 当大模型说话或思考中时的顶部流光动效进度条 */}
                  {agentMetrics.isLive && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden bg-primary/20">
                      <div className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                    </div>
                  )}

                  {/* 状态、真实对话轮次与本轮工具调用次数 */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                      agentMetrics.isLive
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-outline/40'
                    }`} />
                    <span className="font-semibold text-on-surface text-[9px]">
                      {agentMetrics.isLive
                        ? (agentLoopStage ? agentLoopStage.split(' · ')[0] : '思考回复中')
                        : '就绪'}
                    </span>
                    <span className="text-outline-variant/60">·</span>
                    <span className="text-outline">第</span>
                    <span className="font-semibold text-primary">{currentTurnNumber}</span>
                    <span className="text-outline">轮</span>
                    <span className="text-outline-variant/60">·</span>
                    <span className="text-outline">调用:</span>
                    <span className="font-medium text-on-surface">{agentMetrics.toolCallsCount || 0}</span>
                    <span className="text-outline">次</span>
                  </div>

                  {/* Token 消耗、速度与上下文真实进度条 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-0.5" title={`Token 消耗: 本轮总计 ${agentMetrics.totalTokens || (agentMetrics.inputTokens + agentMetrics.outputTokens)} (输入: ${agentMetrics.inputTokens} / 输出: ${agentMetrics.outputTokens})`}>
                      <span className="text-outline">消耗:</span>
                      <span className="font-medium text-on-surface">
                        {agentMetrics.totalTokens || (agentMetrics.inputTokens + agentMetrics.outputTokens)}
                      </span>
                    </div>

                    <span className="text-outline-variant/60">·</span>

                    <div className="flex items-center gap-0.5" title="输出速度 (Tokens / 秒)">
                      <span className="text-outline">速度:</span>
                      <span className={`font-medium ${agentMetrics.tokenSpeed > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-on-surface'}`}>
                        {agentMetrics.tokenSpeed || 0}
                      </span>
                      <span className="text-[8.5px] text-outline">tok/s</span>
                    </div>

                    <span className="text-outline-variant/60">·</span>

                    <div
                      className="flex items-center gap-1.5"
                      title={`当前上下文占用: ${agentMetrics.contextTokens || agentMetrics.totalTokens || agentMetrics.inputTokens || 0} / ${agentMetrics.maxContextTokens || 131072} Tokens (${displayContextPercent})`}
                    >
                      <span className="text-outline">上下文:</span>
                      <div className="w-12 h-1.5 bg-outline-variant/25 rounded-full overflow-hidden flex items-center p-[0.5px]">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            contextRatio > 80 ? 'bg-error' : contextRatio > 50 ? 'bg-amber-500' : 'bg-primary'
                          } ${agentMetrics.isLive ? 'animate-pulse' : ''}`}
                          style={{ width: `${Math.max(contextRatio > 0 ? 5 : 0, contextRatio)}%` }}
                        />
                      </div>
                      <span className="font-medium text-on-surface">{displayContextPercent}</span>
                    </div>
                  </div>
                </div>

                {/* 底层：辅助提示与操作主按钮 */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-outline truncate max-w-[200px]" title={isAgentRunning ? agentLoopStage : '只操作草稿纸，不填写答题区'}>
                    {isAgentRunning ? (agentLoopStage || 'Agent Loop 思考并操作中…') : '只操作草稿纸，不代答答题区'}
                  </span>

                  {isAgentRunning ? (
                    <button
                      type="button"
                      onClick={handleAbortAgentLoop}
                      className="px-3 py-1 rounded-xl bg-error hover:bg-error/90 text-white text-[11px] font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer shadow-xs shrink-0 animate-pulse"
                      title="立即中断当前思考与画板操作"
                    >
                      <span className="material-symbols-outlined text-[13px]">stop_circle</span>
                      <span>停止执行</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTriggerAgentLoop()}
                      disabled={!spokenInput.trim()}
                      className="px-3.5 py-1 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer disabled:opacity-40 shadow-xs shrink-0"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        auto_fix_high
                      </span>
                      <span>发送并操作草稿纸</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
