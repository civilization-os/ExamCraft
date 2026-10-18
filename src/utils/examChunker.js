import { isPseudoPassage } from './questionTypes.js';
import { inferPaperSubject } from './paperSubject.js';

// Client-side Passage-Aware Exam Chunker
// Breaks long exams (English reading passages, big math papers) into lightweight chunks
// Prevents HTTP 413 (Payload Too Large) and LLM context/output token overflows.

export function extractExamMeta(mdText) {
  const lines = mdText.split('\n');
  let title = '《智能生成与规整测评卷》';
  let duration = 120;
  let totalScore = 100;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ') && !line.startsWith('### ')) {
      title = line.replace(/^#\s+/, '').trim();
      if (/408|计算机/.test(title)) {
        duration = 180;
        totalScore = 150;
      } else if (title.includes('数学') && (title.includes('硕士') || title.includes('考研') || title.includes('统考'))) {
        duration = 180;
        totalScore = 150;
      } else if (title.includes('英语') && (title.includes('硕士') || title.includes('考研'))) {
        duration = 180;
        totalScore = 100;
      }
    }
    if (line.match(/^[-*]?\s*(建议时限|时限|时间)[:：]\s*(\d+)/)) {
      const m = line.match(/(\d+)/);
      if (m) duration = parseInt(m[1], 10);
    }
    if (line.match(/^[-*]?\s*(设定总分|总分|满分)[:：]\s*(\d+)/)) {
      const m = line.match(/(\d+)/);
      if (m) totalScore = parseInt(m[1], 10);
    }
  }

  const subject = inferPaperSubject(title);
  return { title, duration, totalScore, subject };
}

export function sliceMarkdownIntoChunks(mdText) {
  const lines = mdText.split('\n');
  const questionBlocks = [];
  let currentSection = '通用试题';
  let currentPassageTitle = '';
  let currentPassage = '';
  let passageBuffer = [];
  let isCollectingPassage = false;
  let inDetails = false;
  let isHeaderReset = true;

  const flushPassage = () => {
    if (passageBuffer.length > 0) {
      const candidate = passageBuffer.join('\n').trim();
      const cleaned = candidate
        .replace(/^\*{0,2}Directions:?\*{0,2}\s*/i, '')
        .replace(/^(?:Read the following|请阅读|阅读下列)[\s\S]*?(?:\(\d+\s*points?\)|（\d+分）|共\s*\d+\s*分[）\)])\s*/i, '')
        .trim();
      const textToUse = cleaned || candidate;
      if (textToUse && !isPseudoPassage(textToUse)) {
        currentPassage = textToUse;
      }
      passageBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (isCollectingPassage && passageBuffer.length > 0) {
        passageBuffer.push('');
      } else if (questionBlocks.length > 0) {
        questionBlocks[questionBlocks.length - 1].lines.push(rawLine);
      }
      continue;
    }

    if (line.includes('<details>')) inDetails = true;

    // Section header (## ... or plain 一、单项选择题 ...)
    const sectionMatch = !inDetails && (
      line.match(/^##\s+[一二三四五六七八九十0-9]+[、\.、\s]/) ||
      line.match(/^##\s+(?:Section|Part|第一部分|第二部分|第三部分|第四部分)/i) ||
      line.match(/^[一二三四五六七八九十]+[、\.．\s]+(?:单项|多项|选择|填空|综合|解答|简答|计算|证明|阅读|完形|应用)/)
    );
    if (sectionMatch && !line.match(/^##\s*\d+$/)) {
      flushPassage();
      currentSection = line.replace(/^##\s+/, '').trim();
      currentPassage = '';
      currentPassageTitle = '';
      const isCloze = /Use of English|完形|Cloze|英语知识运用/i.test(currentSection);
      if (isCloze) {
        isCollectingPassage = true;
        currentPassageTitle = '完形填空短文 (Use of English)';
      } else {
        isCollectingPassage = false;
      }
      isHeaderReset = true;
      continue;
    }

    // Passage header (### Text 1, #### Text 1, plain Text 1, **Text 1**, 【Text 1】, etc.)
    const passageMatch = !inDetails && (
      line.match(/^#{2,4}\s*(Text\s*\d+|Passage\s*[A-D0-9]+|篇章\s*[A-D0-9]+|[A-D]篇|阅读理解\s*[A-D0-9]*|完形填空(?:\s*[A-D0-9]*)?|Cloze(?:\s+Test)?\s*[A-D0-9]*|阅读材料|材料[一二三四\d]+)/i) ||
      line.match(/^\*{0,2}(?:【\s*)?(Text\s*\d+|Passage\s*[A-D0-9]+|篇章\s*[A-D0-9]+|[A-D]篇|阅读材料\s*[A-D0-9]*|完形填空(?:\s*[A-D0-9]*)?|Cloze(?:\s+Test)?\s*[A-D0-9]*)(?:\s*】)?\*{0,2}\s*$/i)
    );
    if (passageMatch) {
      flushPassage();
      currentPassageTitle = (passageMatch[1] || '阅读材料').trim();
      currentPassage = '';
      isCollectingPassage = true;
      isHeaderReset = true;
      passageBuffer.push(rawLine);
      continue;
    }

    // Question start (Robust detection for **1.**, ### 1, 1., etc.):
    let isQHeader = false;
    let qNum = null;

    if (!inDetails) {
      // 1. Bold numbers like **1.**, **21.**, **48.**, **1**
      const mBold = line.match(/^\*\*(\d+)[\.、．\s]*\*\*\s*(.*)$/);
      // 2. Hash headers like ### 1, ## 21
      const mHash = line.match(/^(?:###|##)\s*(?:题\s*)?(\d+)[\.、．\s]*(.*)$/);
      // 3. Chinese question numbering: 第 1 题, 第1题
      const mCnNum = line.match(/^第\s*(\d+)\s*题[\.．、：:\s]*(.*)$/);
      // 4. Plain numbered questions (1. , 1、 , 1． ; excludes sub-questions like (1) or decimals like 3.14)
      const mNum = line.match(/^(\d+)[\.．、]\s*(.*)$/);

      if (mBold) {
        isQHeader = true;
        qNum = parseInt(mBold[1], 10);
      } else if (mHash && !passageMatch) {
        isQHeader = true;
        qNum = parseInt(mHash[1], 10);
      } else if (mCnNum) {
        isQHeader = true;
        qNum = parseInt(mCnNum[1], 10);
      } else if (mNum && !line.includes('%') && !line.match(/^\d+[\.．]\d+/)) {
        const candidateNum = parseInt(mNum[1], 10);
        const lastNum = questionBlocks.length ? (questionBlocks[questionBlocks.length - 1].qNum || 0) : 0;
        if (candidateNum >= 1 && candidateNum <= 150) {
          if (isHeaderReset || questionBlocks.length === 0) {
            isQHeader = true;
            qNum = candidateNum;
          } else if (candidateNum > lastNum) {
            isQHeader = true;
            qNum = candidateNum;
          } else if (candidateNum === 1) {
            isQHeader = true;
            qNum = candidateNum;
          }
        }
      }
    }

    if (isQHeader && qNum >= 1 && qNum <= 150) {
      flushPassage();
      isCollectingPassage = false;
      isHeaderReset = false;
      const validPassage = currentPassage && !isPseudoPassage(currentPassage) ? currentPassage : '';
      const validPassageTitle = validPassage ? (currentPassageTitle || '阅读材料') : '';
      questionBlocks.push({
        qNum,
        section: currentSection,
        passageTitle: validPassageTitle,
        passage: validPassage,
        lines: [rawLine]
      });
      continue;
    }

    if (questionBlocks.length > 0 && !isCollectingPassage) {
      questionBlocks[questionBlocks.length - 1].lines.push(rawLine);
    } else {
      passageBuffer.push(rawLine);
    }

    if (line.includes('</details>')) inDetails = false;
  }

  flushPassage();

  if (questionBlocks.length === 0) {
    // Unstructured sources (especially text extracted from PDFs) still need bounded
    // requests. Keep line boundaries where possible so the model can parse each slice.
    const maxChars = 5200;
    const chunks = [];
    let buffer = [];
    let bufferLength = 0;
    const flush = () => {
      const text = buffer.join('\n').trim();
      if (!text) return;
      chunks.push({
        chunkIndex: chunks.length,
        section: currentSection,
        passageTitle: '',
        passage: '',
        rawQuestionsText: text,
        qNums: [],
        summary: chunks.length ? `未结构化文本（第 ${chunks.length + 1} 批）` : '未结构化文本（第 1 批）'
      });
      buffer = [];
      bufferLength = 0;
    };

    for (const rawLine of lines) {
      if (bufferLength && bufferLength + rawLine.length + 1 > maxChars) flush();
      if (rawLine.length <= maxChars) {
        buffer.push(rawLine);
        bufferLength += rawLine.length + 1;
        continue;
      }
      for (let offset = 0; offset < rawLine.length; offset += maxChars) {
        const part = rawLine.slice(offset, offset + maxChars);
        if (bufferLength && bufferLength + part.length > maxChars) flush();
        buffer.push(part);
        bufferLength += part.length;
        if (offset + maxChars < rawLine.length) flush();
      }
    }
    flush();
    return chunks.length ? chunks : [{
      chunkIndex: 0,
      section: currentSection,
      passageTitle: '',
      passage: '',
      rawQuestionsText: mdText,
      qNums: [],
      summary: '全文解析'
    }];
  }

  // Group into lightweight passage-aware chunks (max 4~5 questions per chunk)
  const chunks = [];
  let currentGroup = [];
  let currentPassageRef = null;

  for (const block of questionBlocks) {
    const isSamePassage = block.passage === currentPassageRef;
    const isFull = currentGroup.length >= (block.passage ? 5 : 4);

    if (currentGroup.length > 0 && (!isSamePassage || isFull)) {
      const firstQ = currentGroup[0].qNum || 1;
      const lastQ = currentGroup[currentGroup.length - 1].qNum || firstQ;
      const passTitle = currentGroup[0].passageTitle ? ` [${currentGroup[0].passageTitle}]` : '';

      chunks.push({
        chunkIndex: chunks.length,
        section: currentGroup[0].section,
        passageTitle: currentGroup[0].passageTitle,
        passage: currentPassageRef,
        rawQuestionsText: currentGroup.map(b => b.lines.join('\n')).join('\n\n'),
        qNums: currentGroup.map(b => b.qNum),
        summary: `${currentGroup[0].section}${passTitle} (第 ${firstQ}~${lastQ} 题)`
      });
      currentGroup = [];
    }

    currentGroup.push(block);
    currentPassageRef = block.passage;
  }

  if (currentGroup.length > 0) {
    const firstQ = currentGroup[0].qNum || 1;
    const lastQ = currentGroup[currentGroup.length - 1].qNum || firstQ;
    const passTitle = currentGroup[0].passageTitle ? ` [${currentGroup[0].passageTitle}]` : '';

    chunks.push({
      chunkIndex: chunks.length,
      section: currentGroup[0].section,
      passageTitle: currentGroup[0].passageTitle,
      passage: currentPassageRef,
      rawQuestionsText: currentGroup.map(b => b.lines.join('\n')).join('\n\n'),
      qNums: currentGroup.map(b => b.qNum),
      summary: `${currentGroup[0].section}${passTitle} (第 ${firstQ}~${lastQ} 题)`
    });
  }

  return chunks;
}
