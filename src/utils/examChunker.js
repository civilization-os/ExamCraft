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
      if (title.includes('数学') && (title.includes('硕士') || title.includes('考研') || title.includes('统考'))) {
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

  return { title, duration, totalScore };
}

export function sliceMarkdownIntoChunks(mdText) {
  const lines = mdText.split('\n');
  const questionBlocks = [];
  let currentSection = '通用试题';
  let currentPassageTitle = '';
  let currentPassage = '';
  let passageBuffer = [];
  let isCollectingPassage = false;

  const flushPassage = () => {
    if (passageBuffer.length > 0) {
      const candidate = passageBuffer.join('\n').trim();
      if (candidate && !candidate.match(/^`?\d+~\d+`?\s*小题/) && !candidate.match(/^每(?:小)?题\s*\d+\s*分/)) {
        currentPassage = candidate;
      }
      passageBuffer = [];
    }
  };

  const hasMarkdownQuestionHeaders = lines.some(l => l.trim().match(/^###\s*(?:题\s*)?\d+/));

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (isCollectingPassage && passageBuffer.length > 0) {
        passageBuffer.push('');
      }
      continue;
    }

    // Section header (## ...)
    if ((line.match(/^##\s+[一二三四五六七八九十0-9]+[、\.、\s]/) || line.match(/^##\s+(?:Section|Part|第一部分|第二部分|第三部分|第四部分)/i)) && !line.match(/^##\s*\d+$/)) {
      flushPassage();
      currentSection = line.replace(/^##\s+/, '').trim();
      currentPassage = '';
      currentPassageTitle = '';
      isCollectingPassage = true;
      continue;
    }

    // Passage header (#### Text 1, #### Passage A, #### 阅读材料, etc.)
    const passageMatch = line.match(/^#{3,4}\s*(Text\s*\d+|Passage\s*[A-D0-9]+|篇章\s*[A-D0-9]+|[A-D]篇|阅读理解\s*[A-D0-9]*)/i);
    if (passageMatch) {
      flushPassage();
      currentPassageTitle = passageMatch[1].trim();
      currentPassage = '';
      isCollectingPassage = true;
      passageBuffer.push(rawLine);
      continue;
    }

    // Question start:
    let isQHeader = false;
    let qNum = null;

    if (hasMarkdownQuestionHeaders) {
      const m = line.match(/^###\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/) ||
                line.match(/^##\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/);
      if (m) {
        isQHeader = true;
        qNum = parseInt(m[1], 10);
      }
    } else {
      const m = line.match(/^(?:###|##)\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/) ||
                line.match(/^(\d+)[\.、\s]\s*(.*)$/);
      if (m) {
        isQHeader = true;
        qNum = parseInt(m[1], 10);
      }
    }

    if (isQHeader) {
      flushPassage();
      isCollectingPassage = false;
      questionBlocks.push({
        qNum,
        section: currentSection,
        passageTitle: currentPassageTitle,
        passage: currentPassage,
        lines: [rawLine]
      });
      continue;
    }

    if (questionBlocks.length > 0 && !isCollectingPassage) {
      questionBlocks[questionBlocks.length - 1].lines.push(rawLine);
    } else {
      passageBuffer.push(rawLine);
    }
  }

  flushPassage();

  if (questionBlocks.length === 0) {
    // If no distinct questions found, wrap whole text as single fallback chunk
    return [{
      chunkIndex: 0,
      section: currentSection,
      passageTitle: '',
      passage: '',
      rawQuestionsText: mdText,
      qNums: [1],
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
