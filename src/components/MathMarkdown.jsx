import React from 'react';
import katex from 'katex';

/**
 * MathMarkdown Component
 * Robust LaTeX & Markdown renderer with placeholder-based extraction:
 * - Block formulas ($$...$$)
 * - Standalone matrices (\\begin{pmatrix} ... \\end{pmatrix}, etc.)
 * - Inline math ($...$)
 * - Callouts (::: info ... :::)
 * - Bold (**text**), inline code (`code`), links, clean typography
 */
export default function MathMarkdown({ content, className = '' }) {
  if (!content) return null;

  const renderContent = (rawText) => {
    let str = String(rawText);

    const mathBlocks = [];
    const mathInlines = [];

    // 1. Extract existing display math: $$...$$
    str = str.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
      const idx = mathBlocks.length;
      mathBlocks.push(math.trim());
      return `@@@DISPLAY_MATH_${idx}@@@`;
    });

    // 2. Any standalone matrix/aligned/cases environment that was NOT inside $$...$$
    str = str.replace(/\\begin\{(pmatrix|bmatrix|vmatrix|Vmatrix|matrix|aligned|cases)\}([\s\S]*?)\\end\{\1\}/g, (match) => {
      const idx = mathBlocks.length;
      mathBlocks.push(match.trim());
      return `@@@DISPLAY_MATH_${idx}@@@`;
    });

    // 3. Extract inline math: $...$
    str = str.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
      const idx = mathInlines.length;
      mathInlines.push(math.trim());
      return `@@@INLINE_MATH_${idx}@@@`;
    });

    // 4. Callout blocks ::: info :bulb:Title ... :::
    str = str.replace(/:::\s*([a-zA-Z0-9_-]+)\s*([^\n]*)\n([\s\S]*?):::/g, (match, type, title, body) => {
      return `<div class="my-3 p-3.5 rounded-xl bg-surface-container-high border border-primary/20 text-body-sm shadow-xs">
        <div class="font-semibold text-primary mb-1 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[17px]">info</span>
          <span>${title.replace(/:[a-zA-Z0-9_-]+:/g, '').trim() || '知识点深度讲解'}</span>
        </div>
        <div class="text-on-surface-variant leading-relaxed">${body.trim()}</div>
      </div>`;
    });

    // 5. Bold: **text**
    str = str.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-on-surface">$1</strong>');

    // 6. Inline code: `code`
    str = str.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-xs text-primary font-medium">$1</code>');

    // 7. Links: [text](url)
    str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-primary hover:underline font-medium">$1</a>');

    // 8. Line breaks & paragraph spacing
    str = str.replace(/\n\n/g, '<div class="h-2"></div>');
    str = str.replace(/\n/g, '<br/>');

    // 9. Restore display math with KaTeX
    str = str.replace(/@@@DISPLAY_MATH_(\d+)@@@/g, (match, idx) => {
      const math = mathBlocks[Number(idx)];
      try {
        const rendered = katex.renderToString(math, {
          displayMode: true,
          throwOnError: false
        });
        return `<div class="my-3 overflow-x-auto text-center py-1.5 font-serif">${rendered}</div>`;
      } catch (e) {
        return `<div class="text-error font-mono text-sm py-1">[公式渲染异常: ${e.message}]</div>`;
      }
    });

    // 10. Restore inline math with KaTeX
    str = str.replace(/@@@INLINE_MATH_(\d+)@@@/g, (match, idx) => {
      const math = mathInlines[Number(idx)];
      try {
        return katex.renderToString(math, {
          displayMode: false,
          throwOnError: false
        });
      } catch (e) {
        return `<span class="text-error font-mono text-xs">[公式异常]</span>`;
      }
    });

    return str;
  };

  return (
    <div
      className={`math-markdown leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderContent(content) }}
    />
  );
}
