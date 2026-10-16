import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createChatModel, validateModelConfig } from '@civilization/model-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'examcraft-config.json');

export const apiRouter = express.Router();

function loadSavedConfig() {
  let fileCfg = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      fileCfg = JSON.parse(raw) || {};
    }
  } catch (e) {
    console.error('Failed to read config file:', e.message);
  }

  // Environment variables fallback for Docker / Container / Production deployments
  const envApiKey = process.env.MODEL_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || '';
  const envModelName = process.env.MODEL_NAME || '';
  const envBaseURL = process.env.MODEL_BASE_URL || process.env.OPENAI_BASE_URL || '';
  const envCategory = process.env.MODEL_CATEGORY || '';
  const envProtocol = process.env.MODEL_PROTOCOL || '';

  return {
    category: fileCfg.category || envCategory || (envBaseURL ? 'protocol' : 'official'),
    vendor: fileCfg.vendor || 'gemini',
    protocol: fileCfg.protocol || envProtocol || 'openai-compatible',
    modelName: fileCfg.modelName || envModelName || 'deepseek-chat',
    baseURL: fileCfg.baseURL || envBaseURL || 'https://api.deepseek.com/v1',
    apiKey: fileCfg.apiKey || envApiKey || '',
    temperature: typeof fileCfg.temperature === 'number' ? fileCfg.temperature : 0.7,
    timeoutMs: typeof fileCfg.timeoutMs === 'number' ? fileCfg.timeoutMs : 30000,
    maxRetries: typeof fileCfg.maxRetries === 'number' ? fileCfg.maxRetries : 2
  };
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

let currentConfig = loadSavedConfig();

function maskKey(key) {
  if (!key || key.length < 8) return key ? '******' : '';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

function extractJsonFromAiResponse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}

  let clean = text.replace(/```json\s*|```\s*$/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {}

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

// Safety sanitizer to 100% guarantee prompt never contains answer or proof
export function sanitizeQuestion(q) {
  if (!q) return q;
  if (!q.prompt) q.prompt = '';

  // 1. Clean HTML details if leaked into prompt
  const detailsMatch = q.prompt.match(/<details>[\s\S]*?<\/details>/i);
  if (detailsMatch) {
    const rawDetails = detailsMatch[0];
    const cleanAnalysis = rawDetails.replace(/<\/?details>|<\/?summary>/gi, '').trim();
    q.analysis = q.analysis ? cleanAnalysis + '\n\n' + q.analysis : cleanAnalysis;
    q.prompt = q.prompt.replace(/<details>[\s\S]*?<\/details>/gi, '').trim();
  }

  // 2. Clean blockquote answers like > **答案**：D
  const quoteAnsMatch = q.prompt.match(/>?\s*(?:\*\*答案[:：\s]*\*\*|答案[:：]|【答案】)\s*([A-D0-9a-z\u4e00-\u9fa5]+)/i);
  if (quoteAnsMatch) {
    if (!q.standardAnswer) q.standardAnswer = quoteAnsMatch[1].trim().replace(/\*/g, '');
    q.prompt = q.prompt.replace(/>?\s*(?:\*\*答案[:：\s]*\*\*|答案[:：]|【答案】)\s*([A-D0-9a-z\u4e00-\u9fa5]+)/gi, '').trim();
  }

  // 3. Remove leading question numbers in prompt (e.g. **1.**, 1.)
  q.prompt = q.prompt.replace(/^\*\*?\d+[\.、\s]*\*\*?\s*/, '').trim();

  // Pattern for solution/proof headers that should NEVER be in prompt
  const splitPattern = /(?:\n\s*|\A\s*)(?:\*\*解[:：\s]*\*\*|【解】|解[:：]|\*\*证明[:：\s]*\*\*|【证明】|证明[:：]|\*\*（\d+）(?:证明|解)[:：\s]*\*\*|\*\*\((\d+)\)(?:证明|解)[:：\s]*\*\*|\*\*解析[:：\s]*\*\*|【解析】|解析[:：]|\*\*答案精解\*\*)/;
  
  const match = q.prompt.search(splitPattern);
  if (match !== -1) {
    const cleanPrompt = q.prompt.slice(0, match).trim();
    const leakedAnalysis = q.prompt.slice(match).trim();
    q.prompt = cleanPrompt;
    if (leakedAnalysis) {
      q.analysis = q.analysis ? leakedAnalysis + '\n\n' + q.analysis : leakedAnalysis;
    }
  }

  // Remove score declarations from prompt like （本题满分 10 分）
  q.prompt = q.prompt.replace(/^[（\(]本题满分\s*`?(\d+)`?\s*分[）\)]\s*/gm, '').trim();

  if (q.analysis) {
    q.analysis = q.analysis.replace(/<\/?details>|<\/?summary>/gi, '').trim();
  }
  if (q.standardAnswer) q.standardAnswer = q.standardAnswer.trim().replace(/\*/g, '');

  const numVal = parseInt(String(q.num || q.id).replace(/\D/g, ''), 10);
  if (!isNaN(numVal)) {
    q.num = String(numVal).padStart(2, '0');
    if (!q.id) q.id = numVal;
  }

  return q;
}

// Universal Passage-Aware Exam Slicer
// Supports Chinese exams (Math, Science, Politics) and English / Multilingual long-text papers with reading passages
export function sliceMarkdownIntoQuestionBlocks(mdText) {
  const lines = mdText.split('\n');
  const blocks = [];
  let currentSection = '通用试题';
  let currentPassageTitle = '';
  let currentPassage = '';
  let passageBuffer = [];
  let isCollectingPassage = false;
  let inDetails = false;

  const flushPassage = () => {
    if (passageBuffer.length > 0) {
      const candidate = passageBuffer.join('\n').trim();
      if (candidate && !candidate.match(/^`?\d+~\d+`?\s*小题/) && !candidate.match(/^每(?:小)?题\s*\d+\s*分/)) {
        currentPassage = candidate;
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
      }
      continue;
    }

    if (line.includes('<details>')) inDetails = true;

    // Section header (## ...)
    if (!inDetails && (line.match(/^##\s+[一二三四五六七八九十0-9]+[、\.、\s]/) || line.match(/^##\s+(?:Section|Part|第一部分|第二部分|第三部分|第四部分)/i)) && !line.match(/^##\s*\d+$/)) {
      flushPassage();
      currentSection = line.replace(/^##\s+/, '').trim();
      currentPassage = '';
      currentPassageTitle = '';
      isCollectingPassage = true;
      continue;
    }

    // Passage header (### Text 1, #### Text 1, etc.)
    const passageMatch = !inDetails && line.match(/^#{2,4}\s*(Text\s*\d+|Passage\s*[A-D0-9]+|篇章\s*[A-D0-9]+|[A-D]篇)/i);
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
    let rest = '';

    if (!inDetails) {
      const mBold = line.match(/^\*\*(\d+)[\.、\s]*\*\*\s*(.*)$/);
      const mHash = line.match(/^(?:###|##)\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/);
      const mNum = line.match(/^(\d+)[\.、]\s+([^\d%].*)$/);

      if (mBold) {
        isQHeader = true;
        qNum = parseInt(mBold[1], 10);
        rest = mBold[2];
      } else if (mHash && !passageMatch) {
        isQHeader = true;
        qNum = parseInt(mHash[1], 10);
        rest = mHash[2];
      } else if (mNum && !line.includes('%') && !isCollectingPassage && blocks.length > 0) {
        const candidateNum = parseInt(mNum[1], 10);
        const lastNum = blocks[blocks.length - 1].qNum || 0;
        if (candidateNum === lastNum + 1) {
          isQHeader = true;
          qNum = candidateNum;
          rest = mNum[2];
        }
      }
    }

    if (isQHeader && qNum >= 1 && qNum <= 150) {
      flushPassage();
      isCollectingPassage = false;
      blocks.push({
        qNum,
        section: currentSection,
        passageTitle: currentPassageTitle,
        passage: currentPassage,
        lines: [rawLine]
      });
      continue;
    }

    if (blocks.length > 0 && !isCollectingPassage) {
      blocks[blocks.length - 1].lines.push(rawLine);
    } else {
      passageBuffer.push(rawLine);
    }

    if (line.includes('</details>')) inDetails = false;
  }

  flushPassage();

  return {
    blocks: blocks.map(b => ({
      ...b,
      text: b.lines.join('\n')
    }))
  };
}

// Advanced robust parser for Chinese national exams & course markdown papers
export function parseExamMarkdown(mdText) {
  const lines = mdText.split('\n');
  let title = '《Markdown 智能生成测评卷》';
  let duration = 120;
  let totalScore = 0;
  const questions = [];

  let currentSection = '通用试题';
  let currentPassage = '';
  let currentPassageTitle = '';
  let passageBuffer = [];
  let isCollectingPassage = false;
  let inDetails = false;
  let currentQ = null;
  let state = 'prompt'; // 'prompt' | 'options' | 'analysis'

  const flushPassage = () => {
    if (passageBuffer.length > 0) {
      const candidate = passageBuffer.join('\n').trim();
      if (candidate && !candidate.match(/^`?\d+~\d+`?\s*小题/) && !candidate.match(/^每(?:小)?题\s*\d+\s*分/)) {
        currentPassage = candidate;
      }
      passageBuffer = [];
    }
  };

  const finishCurrentQ = () => {
    if (!currentQ) return;
    sanitizeQuestion(currentQ);
    if (!currentQ.standardAnswer && currentQ.analysis) {
      const matchChoice = currentQ.analysis.match(/故选\s*[*_]*([A-D])[*_]*/i) ||
                          currentQ.analysis.match(/选\s*[*_]*([A-D])[*_]*/i);
      if (matchChoice) {
        currentQ.standardAnswer = matchChoice[1].toUpperCase();
      }
    }
    if (!currentQ.standardAnswer && (currentQ.type.includes('解答') || currentQ.type.includes('证明') || currentQ.type.includes('计算') || currentQ.type.includes('写作') || currentQ.type.includes('翻译'))) {
      currentQ.standardAnswer = '详见分步解答与参考范文';
    }
    questions.push(currentQ);
    currentQ = null;
    state = 'prompt';
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (currentQ && state === 'analysis' && currentQ.analysis) {
        currentQ.analysis += '\n\n';
      } else if (currentQ && state === 'prompt' && currentQ.prompt) {
        currentQ.prompt += '\n\n';
      } else if (isCollectingPassage && passageBuffer.length > 0) {
        passageBuffer.push('');
      }
      continue;
    }

    if (line.includes('<details>')) {
      inDetails = true;
      state = 'analysis';
      continue;
    }
    if (line.includes('</details>')) {
      inDetails = false;
      continue;
    }

    // 1. Title (# ...)
    if (line.startsWith('# ') && !line.startsWith('### ')) {
      title = line.replace(/^#\s+/, '').trim();
      if (title.includes('数学') && (title.includes('硕士') || title.includes('考研') || title.includes('统考'))) {
        duration = 180;
      } else if (title.includes('英语') && (title.includes('硕士') || title.includes('考研'))) {
        duration = 180;
      }
      continue;
    }

    // 2. Metadata (- 建议时限: 120分钟)
    if (line.match(/^[-*]?\s*(建议时限|时限|时间)[:：]\s*(\d+)/)) {
      const m = line.match(/(\d+)/);
      if (m) duration = parseInt(m[1]);
      continue;
    }

    // 3. Section header (## 一、选择题 ... or ## Section I ...)
    if (!inDetails && (line.match(/^##\s+[一二三四五六七八九十0-9]+[、\.、\s]/) || line.match(/^##\s+(?:Section|Part|第一部分|第二部分|第三部分|第四部分)/i)) && !line.match(/^##\s*\d+$/)) {
      finishCurrentQ();
      flushPassage();
      currentSection = line.replace(/^##\s+/, '').trim();
      currentPassage = '';
      currentPassageTitle = '';
      isCollectingPassage = true;
      continue;
    }

    // 4. Passage header (#### Text 1, #### Passage A, etc.)
    const passageMatch = !inDetails && line.match(/^#{2,4}\s*(Text\s*\d+|Passage\s*[A-D0-9]+|篇章\s*[A-D0-9]+|[A-D]篇)/i);
    if (passageMatch) {
      finishCurrentQ();
      flushPassage();
      currentPassageTitle = passageMatch[1].trim();
      currentPassage = '';
      isCollectingPassage = true;
      passageBuffer.push(rawLine);
      continue;
    }

    // 5. Section description (e.g. `1~10` 小题，每小题 `5` 分，共 `50` 分...)
    if (line.match(/^`?\d+~\d+`?\s*小题/) || line.match(/小题.*每小题.*分/)) {
      continue;
    }

    // 6. Question start:
    let isQHeader = false;
    let qNum = null;
    let rest = '';

    if (!inDetails) {
      const mBold = line.match(/^\*\*(\d+)[\.、\s]*\*\*\s*(.*)$/);
      const mHash = line.match(/^(?:###|##)\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/);
      const mNum = line.match(/^(\d+)[\.、]\s+([^\d%].*)$/);

      if (mBold) {
        isQHeader = true;
        qNum = parseInt(mBold[1], 10);
        rest = mBold[2];
      } else if (mHash && !passageMatch) {
        isQHeader = true;
        qNum = parseInt(mHash[1], 10);
        rest = mHash[2];
      } else if (mNum && !line.includes('%') && !isCollectingPassage && questions.length > 0) {
        const candidateNum = parseInt(mNum[1], 10);
        const lastNum = questions[questions.length - 1].id || 0;
        if (candidateNum === lastNum + 1) {
          isQHeader = true;
          qNum = candidateNum;
          rest = mNum[2];
        }
      }
    }

    if (isQHeader && qNum >= 1 && qNum <= 150) {
      finishCurrentQ();
      flushPassage();
      isCollectingPassage = false;

      const isChoice = currentSection.includes('选择') || currentSection.includes('Use of English') || currentSection.includes('Reading') || (qNum >= 1 && qNum <= 40);
      const isBlank = currentSection.includes('填空') || (qNum >= 11 && qNum <= 16 && currentSection.includes('填空'));
      const isWriting = currentSection.includes('Writing') || qNum >= 47;
      const isTrans = currentSection.includes('Translation') || qNum === 46;
      const isSolution = currentSection.includes('解答') || currentSection.includes('证明') || currentSection.includes('计算') || isWriting || isTrans;

      let score = 5;
      if (currentSection.includes('Use of English') || (qNum >= 1 && qNum <= 20)) {
        score = 0.5;
      } else if (currentSection.includes('Reading') || (qNum >= 21 && qNum <= 45)) {
        score = 2;
      } else if (qNum === 46) {
        score = 15;
      } else if (qNum === 47) {
        score = 10;
      } else if (qNum === 48) {
        score = 15;
      } else if (isBlank) {
        score = 5;
      } else if (isSolution) {
        score = 10;
      }

      currentQ = {
        id: qNum,
        num: String(qNum).padStart(2, '0'),
        type: isChoice ? '单项选择题' : isWriting ? '写作题' : isTrans ? '英译汉翻译' : isBlank ? '填空题' : '综合计算与解答题',
        score: score,
        section: currentSection,
        passage: currentPassage || undefined,
        passageTitle: currentPassageTitle || undefined,
        prompt: rest,
        options: isChoice ? [] : undefined,
        userAnswer: '',
        standardAnswer: '',
        analysis: '',
        status: 'unanswered'
      };
      state = 'prompt';
      continue;
    }

    if (!currentQ) {
      if (isCollectingPassage) {
        passageBuffer.push(rawLine);
      }
      continue;
    }

    // 7. Score declaration inside question body: （本题满分 10 分）
    const scoreMatch = line.match(/^[（\(]本题满分\s*`?(\d+)`?\s*分[）\)]/) ||
                       line.match(/^[（\(](\d+)\s*分[）\)]/);
    if (scoreMatch && state === 'prompt') {
      currentQ.score = parseInt(scoreMatch[1], 10);
      continue;
    }

    // 8. Analysis & Solution identifier
    const isAnalysisTag = line.match(/^(?:\*\*解析[:：\s]*\*\*|【解析】|解析[:：]|\*\*证明[:：\s]*\*\*|【证明】|证明[:：]|\*\*解[:：\s]*\*\*|【解】|解[:：]|\*\*[（\(]\d+[）\)](?:证明|解)[:：\s]*\*\*|\*\*答案精解\*\*)/);
    if (isAnalysisTag) {
      state = 'analysis';
      currentQ.analysis = (currentQ.analysis ? currentQ.analysis + '\n' : '') + rawLine;
      continue;
    }

    // 9. Answer identifier (including > **答案**：D)
    const ansMatch = line.match(/^(?:>|\s)*(?:\*\*答案[:：\s]*\*\*|答案[:：]|【答案】)\s*([A-D0-9a-z\u4e00-\u9fa5]+)/i);
    if (ansMatch) {
      currentQ.standardAnswer = ansMatch[1].trim().replace(/\*/g, '');
      continue;
    }

    // 10. Options
    if (currentQ.options && state === 'prompt') {
      const optMatch = line.match(/^[-*]?\s*(?:\(?([A-D])\)[\.、:：\s]?|([A-D])[\.、:：\s])\s*(.*)$/i);
      if (optMatch) {
        const key = (optMatch[1] || optMatch[2]).toUpperCase();
        currentQ.options.push({
          key,
          text: optMatch[3].trim()
        });
        continue;
      }
    }

    // 11. Accumulate content based on current state
    if (state === 'analysis') {
      currentQ.analysis = (currentQ.analysis ? currentQ.analysis + '\n' : '') + rawLine;
    } else {
      currentQ.prompt = (currentQ.prompt ? currentQ.prompt + '\n' : '') + rawLine;
    }
  }

  finishCurrentQ();

  totalScore = questions.reduce((sum, q) => sum + (q.score || 5), 0) || 100;
  if (totalScore >= 145 && totalScore <= 150) totalScore = 150;

  return {
    title,
    duration,
    totalScore,
    questionCount: questions.length,
    questions
  };
}

function extractJsonArray(text) {
  if (!text) return null;
  try {
    const val = JSON.parse(text);
    if (Array.isArray(val)) return val;
    if (val && Array.isArray(val.questions)) return val.questions;
  } catch {}

  const clean = text.replace(/```json\s*|```\s*$/g, '').trim();
  try {
    const val = JSON.parse(clean);
    if (Array.isArray(val)) return val;
    if (val && Array.isArray(val.questions)) return val.questions;
  } catch {}

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      const val = JSON.parse(text.slice(firstBracket, lastBracket + 1));
      if (Array.isArray(val)) return val;
    } catch {}
  }
  return null;
}

// Parallel chunked AI parser for full exams (Multilingual & Long-text passage-aware)
export async function parseExamWithAiBatches(mdText, config) {
  const baseline = parseExamMarkdown(mdText);
  if (!config.apiKey || !config.apiKey.trim()) {
    return baseline;
  }

  const model = createChatModel(config);
  const { blocks } = sliceMarkdownIntoQuestionBlocks(mdText);

  if (!blocks || blocks.length === 0) {
    return baseline;
  }

  // Group blocks into passage-aware batches:
  // Questions that share the same passage (e.g. English Text 1, Cloze) are kept together (max 5 questions per batch)
  const batches = [];
  let currentBatch = [];
  let currentBatchPassage = null;

  for (const block of blocks) {
    const isSamePassage = block.passage === currentBatchPassage;
    const isBatchFull = currentBatch.length >= (block.passage ? 5 : 4);

    if (currentBatch.length > 0 && (!isSamePassage || isBatchFull)) {
      batches.push({
        passage: currentBatchPassage,
        passageTitle: currentBatch[0].passageTitle,
        blocks: currentBatch
      });
      currentBatch = [];
    }

    currentBatch.push(block);
    currentBatchPassage = block.passage;
  }

  if (currentBatch.length > 0) {
    batches.push({
      passage: currentBatchPassage,
      passageTitle: currentBatch[0].passageTitle,
      blocks: currentBatch
    });
  }

  const batchPromises = batches.map(async (b, batchIdx) => {
    const passageSnippet = b.passage
      ? `【关联阅读篇章 / 材料】：\n${b.passageTitle ? '### ' + b.passageTitle + '\n' : ''}${b.passage}\n\n`
      : '';
    const questionsSnippet = b.blocks.map(blk => blk.text).join('\n\n');

    const prompt = `你是一位精通中国考研统考、高校期末考试与国家外语/数学测试命题规范的高校专家。
请将以下试题切片内容解析为结构化 JSON 数组。

【排版与格式纪律】：
1. prompt 字段必须且只能包含纯题目描述（含公式 LaTeX），严禁将“解：”、“证明：”或任何换元、计算步骤放入 prompt 中！
2. 若大题内部有小问（如 1. 证明... 2. 求矩阵...），这些属于题干要求，必须保留在 prompt 中，绝对不能拆分成独立的考题！
3. 若存在关联阅读篇章/材料，请在各题目中保留或提取 passage 字段。
4. 每道题的分值（如“（本题满分 10 分）”或“每小题2分”）提取为数值存入 score 字段，并从 prompt 中彻底清除该说明。
5. standardAnswer 存放标准答案或精简结果；选择题为选项字母（如 A），填空题为结果，解答题为最终化简结果（若为长证明或写作可填“详见证明与分步解答/参考范文”）。
6. analysis 字段必须完整包含所有证明步骤、推导或答案解析（数学保持 LaTeX 格式）。

待解析内容：
${passageSnippet}【试题部分】：
${questionsSnippet}

直接输出合法 JSON 数组，格式样例：
[
  {
    "id": 1,
    "num": "01",
    "type": "单项选择题",
    "score": 5,
    "section": "一、选择题",
    "passage": "关联阅读材料文本（若有）",
    "prompt": "题目描述",
    "options": [
      { "key": "A", "text": "选项A" },
      { "key": "B", "text": "选项B" }
    ],
    "standardAnswer": "A",
    "analysis": "分步解析"
  }
]`;

    try {
      const res = await model.invoke([
        { role: 'system', content: '你是一位精通考试命题与排版的大模型专家，直接返回合法 JSON 数组，严禁在 prompt 中泄露解答。' },
        { role: 'user', content: prompt }
      ]);
      const parsed = extractJsonArray(res.content);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(q => {
          if (!q.passage && b.passage) q.passage = b.passage;
          if (!q.passageTitle && b.passageTitle) q.passageTitle = b.passageTitle;
          return sanitizeQuestion(q);
        });
      }
    } catch (err) {
      console.warn(`[AI Batch ${batchIdx + 1} Error]:`, err.message);
    }

    // Fallback for this batch to baseline questions
    const qNums = b.blocks.map(blk => blk.qNum);
    const fallbackSlice = baseline.questions.filter(q => qNums.includes(q.id));
    return fallbackSlice.map(sanitizeQuestion);
  });

  const batchResults = await Promise.all(batchPromises);
  const allQuestions = [];
  batchResults.forEach(qs => {
    if (Array.isArray(qs)) {
      allQuestions.push(...qs);
    }
  });

  // Sort by question number
  allQuestions.sort((a, b) => {
    const numA = parseInt(String(a.num || a.id).replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(String(b.num || b.id).replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  // Ensure 2-digit padding and valid sequential ids
  allQuestions.forEach((q, idx) => {
    const numVal = parseInt(String(q.num || q.id || idx + 1).replace(/\D/g, ''), 10) || (idx + 1);
    q.num = String(numVal).padStart(2, '0');
    q.id = numVal;
  });

  const totalScore = allQuestions.reduce((sum, q) => sum + (q.score || 5), 0) || baseline.totalScore;

  return {
    title: baseline.title,
    duration: baseline.duration,
    totalScore: totalScore >= 145 && totalScore <= 150 ? 150 : totalScore,
    questionCount: allQuestions.length,
    questions: allQuestions
  };
}

// GET /api/model/config
apiRouter.get('/model/config', (req, res) => {
  res.json({
    success: true,
    config: {
      ...currentConfig,
      apiKeyMasked: maskKey(currentConfig.apiKey),
      hasApiKey: !!(currentConfig.apiKey && currentConfig.apiKey.trim().length > 0)
    }
  });
});

// POST /api/model/config
apiRouter.post('/model/config', (req, res) => {
  try {
    const newConfig = req.body;
    if (newConfig.apiKey && newConfig.apiKey.includes('••••••••')) {
      newConfig.apiKey = currentConfig.apiKey;
    }
    const validated = validateModelConfig(newConfig);
    currentConfig = validated;
    saveConfig(currentConfig);

    res.json({
      success: true,
      message: '模型与 API Key 配置保存成功',
      config: {
        ...currentConfig,
        apiKeyMasked: maskKey(currentConfig.apiKey),
        hasApiKey: !!(currentConfig.apiKey && currentConfig.apiKey.trim().length > 0)
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `配置校验失败: ${err.message}`
    });
  }
});

// POST /api/model/test
apiRouter.post('/model/test', async (req, res) => {
  const startTime = Date.now();
  try {
    const configToTest = req.body?.modelName ? req.body : currentConfig;
    if (configToTest.apiKey && configToTest.apiKey.includes('••••••••')) {
      configToTest.apiKey = currentConfig.apiKey;
    }

    if (!configToTest.apiKey || !configToTest.apiKey.trim()) {
      return res.status(400).json({
        success: false,
        error: 'API Key 为空，请先输入有效的 API Key 再进行测试。'
      });
    }

    const validated = validateModelConfig(configToTest);
    const model = createChatModel(validated);

    const response = await model.invoke([
      {
        role: 'user',
        content: '这是一个用于连接测试的极简指令，请回复一句简短的确认，包含字样：“ExamCraft 连接就绪”。'
      }
    ]);

    const latencyMs = Date.now() - startTime;
    res.json({
      success: true,
      provider: model.providerName,
      latencyMs,
      reply: response.content,
      modelName: validated.modelName
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error('Model test error:', err);
    res.status(500).json({
      success: false,
      latencyMs,
      error: `模型连接测试失败: ${err.message}`
    });
  }
});

// POST /api/model/parse-chunk
// 接收前端切片后的单批/单篇章试题，每次仅解析 3~5 道试题，彻底杜绝大请求体与 Token 溢出
apiRouter.post('/model/parse-chunk', async (req, res) => {
  const { chunk, useAI } = req.body;
  if (!chunk || !chunk.rawQuestionsText) {
    return res.status(400).json({ success: false, error: '切片试题内容不能为空' });
  }

  const { section, passageTitle, passage, rawQuestionsText } = chunk;

  // 1. 如果启用了 AI 并且有 API key
  if (useAI && currentConfig.apiKey && currentConfig.apiKey.trim()) {
    try {
      const model = createChatModel(currentConfig);
      const passageSnippet = passage
        ? `【关联阅读篇章 / 材料】：\n${passageTitle ? '### ' + passageTitle + '\n' : ''}${passage}\n\n`
        : '';

      const prompt = `你是一位精通中国国家考研、高考与高校期末命题规范的高校命题专家。
请将以下【试题切片】精确解析为结构化 JSON 数组。

【排版纪律】：
1. prompt 字段必须且只能包含纯题目描述（含公式 LaTeX），严禁将“解：”、“证明：”或任何解答推导混入 prompt！
2. 若题目中含有（本题满分 X 分）或类似分值说明，必须将其数值提取至 score 字段，并从 prompt 中彻底清除！
3. 若存在关联篇章，请保留 passage 字段。
4. standardAnswer 存放标准答案或精炼结论；选择题填字母（如 A），填空题填结果，长解答题写“详见分步解答与证明”。
5. analysis 字段必须完整包含解答推导过程与 LaTeX 格式。

待解析切片：
${passageSnippet}【试题内容】：
${rawQuestionsText}

请直接输出合法 JSON 数组：
[
  {
    "id": 1,
    "num": "01",
    "type": "单项选择题",
    "score": 5,
    "section": "${section || '通用试题'}",
    "passage": ${passage ? JSON.stringify(passage) : 'undefined'},
    "passageTitle": ${passageTitle ? JSON.stringify(passageTitle) : 'undefined'},
    "prompt": "题干描述",
    "options": [
      { "key": "A", "text": "选项A" },
      { "key": "B", "text": "选项B" }
    ],
    "standardAnswer": "A",
    "analysis": "分步解析"
  }
]`;

      const response = await model.invoke([
        { role: 'system', content: '你是一位精通试卷结构化的大模型命题专家，必须返回纯合法 JSON 数组。' },
        { role: 'user', content: prompt }
      ]);

      const parsed = extractJsonArray(response.content);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = parsed.map(q => {
          if (!q.passage && passage) q.passage = passage;
          if (!q.passageTitle && passageTitle) q.passageTitle = passageTitle;
          if (!q.section && section) q.section = section;
          return sanitizeQuestion(q);
        });
        return res.json({
          success: true,
          mode: 'ai_enhanced',
          questions: sanitized
        });
      }
    } catch (err) {
      console.warn('[parse-chunk AI error fallback]:', err.message);
    }
  }

  // 2. 算法降级解析单切片
  const fakeDoc = `# 临时\n## ${section || '试题'}\n${passage ? (passageTitle ? '#### ' + passageTitle + '\n' : '') + passage + '\n' : ''}${rawQuestionsText}`;
  const baseline = parseExamMarkdown(fakeDoc);
  return res.json({
    success: true,
    mode: 'algorithmic',
    questions: (baseline.questions || []).map(sanitizeQuestion)
  });
});

// POST /api/model/parse-markdown
apiRouter.post('/model/parse-markdown', async (req, res) => {
  const { markdown, useAI } = req.body;
  if (!markdown || !markdown.trim()) {
    return res.status(400).json({ success: false, error: 'Markdown 文本内容不能为空' });
  }

  if (useAI && currentConfig.apiKey && currentConfig.apiKey.trim()) {
    try {
      const data = await parseExamWithAiBatches(markdown, currentConfig);
      return res.json({
        success: true,
        mode: 'ai_enhanced',
        provider: currentConfig.category || 'ai',
        modelName: currentConfig.modelName,
        data
      });
    } catch (err) {
      console.warn('AI markdown parsing fallback to algorithmic:', err.message);
      const baseline = parseExamMarkdown(markdown);
      return res.json({
        success: true,
        mode: 'algorithmic_fallback',
        warning: `AI 增强解析超时或异常: ${err.message}`,
        data: baseline
      });
    }
  }

  const baseline = parseExamMarkdown(markdown);
  return res.json({
    success: true,
    mode: 'algorithmic',
    data: baseline
  });
});

// POST /api/model/ai-import-paper
// 深度使用 model_core 大模型全面介入分析任意非标准文档、PDF文本、Word或杂乱题卷
apiRouter.post('/model/ai-import-paper', async (req, res) => {
  const { rawContent, fileName, duration, totalScore } = req.body;

  if (!rawContent || !rawContent.trim()) {
    return res.status(400).json({ success: false, error: '导入的试卷文本内容不能为空' });
  }

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在「系统设置」中配置有效的 API Key（例如 DeepSeek 或 Gemini）后再使用 AI 导入功能。'
    });
  }

  try {
    const parsed = await parseExamWithAiBatches(rawContent, currentConfig);
    if (!parsed || !parsed.questions || parsed.questions.length === 0) {
      throw new Error('AI 未能从输入文本中解析出有效的试卷题目');
    }

    const paperId = 'imported-' + Date.now();
    const paper = {
      id: paperId,
      title: parsed.title || fileName?.replace(/\.[^/.]+$/, '') || 'AI 导入解析试卷',
      source: `AI 深度导入解析 (${currentConfig.modelName})`,
      sourceType: 'ai-imported',
      date: '刚刚',
      questionCount: parsed.questions.length,
      totalScore: parsed.totalScore || 100,
      duration: parsed.duration || 120,
      difficulty: (() => {
        const titleLower = (parsed.title || fileName || '').toLowerCase();
        const solCount = parsed.questions.filter(q => q.type.includes('解答') || q.type.includes('证明') || q.type.includes('计算')).length;
        if ((titleLower.includes('数学') || titleLower.includes('高数')) && (titleLower.includes('考研') || solCount >= 4)) return 5;
        if (titleLower.includes('英语') && titleLower.includes('英语一')) return 5;
        if (titleLower.includes('英语') && titleLower.includes('英语二')) return 4;
        if (titleLower.includes('期末') || titleLower.includes('单元')) return 3;
        return solCount >= 3 ? 4 : 3;
      })(),
      tags: ['#AI导入', '#model_core', '#全真规整'],
      status: '未作答 (AI解析完毕)',
      typeBreakdown: {
        choices: parsed.questions.filter(q => q.type.includes('选择')).length,
        blanks: parsed.questions.filter(q => q.type.includes('填空')).length,
        solutions: parsed.questions.filter(q => q.type.includes('解答') || q.type.includes('计算') || q.type.includes('证明')).length
      },
      markdown: rawContent,
      questions: parsed.questions
    };

    res.json({
      success: true,
      paper,
      provider: currentConfig.category || 'ai',
      modelName: currentConfig.modelName
    });
  } catch (err) {
    console.error('ai-import-paper error:', err);
    res.status(500).json({
      success: false,
      error: `AI 试卷导入解析失败: ${err.message}`
    });
  }
});

// POST /api/model/ai-import-mistake
// 深度使用 model_core 大模型分析错因、定位考纲并规范排版
apiRouter.post('/model/ai-import-mistake', async (req, res) => {
  const { rawContent, folderTitle } = req.body;
  if (!rawContent || !rawContent.trim()) {
    return res.status(400).json({ success: false, error: '错题内容不能为空' });
  }

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在「系统设置」中配置有效的 API Key'
    });
  }

  try {
    const model = createChatModel(currentConfig);
    const prompt = `你是一位高等数学考研与高校名师，专门负责错题诊断与知识点深度归因。
用户输入了一道错题的草稿或笔记（所属题集：${folderTitle || '典型错题集'}）：
"""
${rawContent}
"""

请对该错题进行深度 AI 解析，提取：
1. 题目题干与核心公式（转为规范 LaTeX）。
2. 考生错因自核剖析（分析典型的思维误区或计算疏漏）。
3. 关联的考纲核心知识点。
4. 考生的典型错解与标准答案。
5. AI 命题组深度归因解析与提分建议。

请直接返回合法 JSON，格式如下：
{
  "title": "错题简述标题",
  "type": "综合计算与解答题",
  "score": 10,
  "myDeduction": "-4",
  "formula": "核心数学公式或方程（LaTeX）",
  "errorReason": "典型错因自核分析",
  "weakPoint": "关联知识点考纲",
  "userWrongAnswer": "考生典型错解",
  "standardAnswer": "标准解答与结果（包含 LaTeX）",
  "aiInsight": "AI 命题组深度归因解析与针对性提分建议"
}`;

    const response = await model.invoke([
      { role: 'system', content: '你是一位精通数学错题剖析的名师，必须返回纯合法 JSON。' },
      { role: 'user', content: prompt }
    ]);

    const parsed = extractJsonFromAiResponse(response.content);
    if (!parsed) {
      throw new Error('AI 未能返回合法的错题解析数据');
    }

    const mistakeItem = {
      id: 'mistake-' + Date.now(),
      num: '错题 ' + Math.floor(Math.random() * 90 + 10),
      title: parsed.title || '高等数学典型易错题',
      type: parsed.type || '综合计算与解答题',
      score: parsed.score || 10,
      myDeduction: parsed.myDeduction || '-4',
      formula: parsed.formula || '',
      errorReason: parsed.errorReason || '典型错因归因分析',
      weakPoint: parsed.weakPoint || '考纲重点概念',
      userWrongAnswer: parsed.userWrongAnswer || '草稿推导未化简',
      standardAnswer: parsed.standardAnswer || '详见标准证明步骤',
      aiInsight: parsed.aiInsight || '建议加强该考点的变式练习',
      source: `AI 智能导入录入 (${currentConfig.modelName})`
    };

    res.json({
      success: true,
      mistake: mistakeItem,
      provider: model.providerName,
      modelName: currentConfig.modelName
    });
  } catch (err) {
    console.error('ai-import-mistake error:', err);
    res.status(500).json({
      success: false,
      error: `AI 错题解析失败: ${err.message}`
    });
  }
});

// POST /api/model/generate-paper
apiRouter.post('/model/generate-paper', async (req, res) => {
  const { title, subject, totalScore, duration, difficulty, choicesCount, blanksCount, solutionsCount } = req.body;

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在「系统设置」中配置有效的 API Key'
    });
  }

  try {
    const model = createChatModel(currentConfig);
    const prompt = `你是一位中国高校国家统考与期末考试命题专家。请为试卷《${title || '高等数学阶段测试'}》生成试题大纲与部分样题。
要求：
- 学科/主题: ${subject || '高等数学与微积分'}
- 难度等级: ${difficulty || '进阶拓展'}
- 总分设定: ${totalScore || 100} 分，考试时长: ${duration || 120} 分钟
- 题型包含: 单选题 ${choicesCount || 8} 题，填空题 ${blanksCount || 5} 题，综合解答题 ${solutionsCount || 4} 题。
请生成一份高质量命题方案，包含至少 1 道高质量综合计算大题（带 LaTeX 公式及详细分步得分标准）。
请使用 JSON 格式直接返回，不要添加多余标记，数据格式为：
{
  "title": "${title}",
  "totalScore": ${totalScore},
  "highlightQuestion": {
    "num": "16",
    "type": "综合计算与解答题",
    "score": 10,
    "prompt": "题目描述",
    "mathExpression": "数学公式LaTeX",
    "standardAnswer": "标准解答",
    "stepScores": [
      { "step": "步骤描述", "score": "+3分" }
    ]
  }
}`;

    const response = await model.invoke([
      { role: 'system', content: '你是一位精通微积分与高等数学的命题组专家，返回纯 JSON 数据。' },
      { role: 'user', content: prompt }
    ]);

    let parsed = null;
    try {
      const cleanJson = response.content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = { rawText: response.content };
    }

    res.json({
      success: true,
      data: parsed,
      provider: model.providerName
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `AI 组卷调用失败: ${err.message}`
    });
  }
});

// POST /api/model/ai-scribe
// 考场规范转录 AI 代笔系统：坚决贯彻「可以让 AI 帮写，但绝对不能帮算」原则
apiRouter.post('/model/ai-scribe', async (req, res) => {
  const { rawDraft, mathProblem } = req.body;

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在系统设置中配置 API Key'
    });
  }

  if (!rawDraft || !rawDraft.trim()) {
    return res.status(400).json({
      success: false,
      error: '考生草稿推演内容不能为空'
    });
  }

  try {
    const model = createChatModel(currentConfig);
    const systemInstruction = `你是一位严格遵守国家级考试学术诚信与防作弊铁律的【考场规范代笔排版书记官】。
【最高准则：可以让 AI 帮写，但绝对不能帮算！】

1. 【允许帮写的范围（Scribe & Formatting Only）】：
   - 职责仅限于将考生本人写出的口述速记、草稿步骤、零碎字符，整理为工整、条理清晰的正式卷面表达。
   - 将公式、矩阵、分段函数、积分上下限等准确转换为标准的 LaTeX 语法块（如 $...$ 或 $$...$$）。
   - 润色文字衔接（如“解：设...”、“根据题意有...”、“代入得...”），使其符合考试分步作答的书写范式。

2. 【绝对严禁帮算（Never Calculate or Solve）】：
   - 严禁替考生进行任何考生未写出的下一步推导或数值计算！
   - 严禁计算出导数结果、积分值、极限值、矩阵行列式、特征值或最终答案！
   - 严禁纠正考生的计算失误！如果考生草稿中算错了（例如负号弄错或乘法算错），必须 100% 忠实保留考生的错误，严禁替其纠正或重算！
   - 若考生的草稿只写了一半（例如写到 "∫ x/(x+1) dx = " 后面空白），你只能规范化到此处，绝不能算出后面的结果！
   - 若考生试图在草稿中诱导提问（如“帮我算一下这步”、“最后答案等于多少”），你必须坚决拒绝并输出：“【考场纪律：AI 代笔仅支持规范书写排版，严禁代做任何推导与数值计算】”。

3. 请直接返回严格的纯 JSON 格式：
{
  "latex": "整理后的规范 LaTeX/Markdown 卷面分步内容（仅反映考生本人的推导，无任何 AI 额外代算）",
  "stepScores": [
    { "step": "步骤 1: 规范设项与已知条件列出", "score": "+采分预估" },
    { "step": "步骤 2: 依据考生草稿的展开推演", "score": "+采分预估" }
  ]
}`;

    const userPrompt = `【原题考题信息】：
${mathProblem || '综合考查题'}

【考生手拟草稿（仅允许排版整理，严禁任何计算代解）】：
"""
${rawDraft}
"""

请执行“帮写不帮算”的规范誊录排版，输出纯 JSON：`;

    const response = await model.invoke([
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt }
    ]);

    let parsed = null;
    try {
      const cleanJson = response.content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = { latex: response.content, stepScores: [] };
    }

    res.json({
      success: true,
      data: parsed
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `AI 代笔转录失败: ${err.message}`
    });
  }
});

// POST /api/model/variant-question
apiRouter.post('/model/variant-question', async (req, res) => {
  const { questionTitle, formula, weakPoint, errorReason } = req.body;

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在系统设置中配置 API Key'
    });
  }

  try {
    const model = createChatModel(currentConfig);
    const prompt = `针对考生的典型错题：
题目：${questionTitle} (${formula})
薄弱点：${weakPoint}
错因：${errorReason}

请为其生成 2 道具有相同考点但数字和换元形式不同的「举一反三」同构变式题，包含标准答案与解析要点。
请返回 JSON:
{
  "variants": [
    { "title": "变式题 1", "prompt": "...", "formula": "...", "standardAnswer": "...", "keyPoint": "..." },
    { "title": "变式题 2", "prompt": "...", "formula": "...", "standardAnswer": "...", "keyPoint": "..." }
  ]
}`;

    const response = await model.invoke([
      { role: 'user', content: prompt }
    ]);

    let parsed = null;
    try {
      const cleanJson = response.content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = { rawText: response.content };
    }

    res.json({
      success: true,
      data: parsed
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `变式题生成失败: ${err.message}`
    });
  }
});

// POST /api/model/scratchpad-assist
// 考场便签草稿纸 AI 辅助写入系统（严格限制防作弊与防代答计算）
apiRouter.post('/model/scratchpad-assist', async (req, res) => {
  const { text, action, customInstruction } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, error: '草稿纸内容不能为空' });
  }

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在系统设置中配置有效的 API Key'
    });
  }

  const cheatKeywords = [
    '帮我算', '求答案', '答案是什么', '计算结果', '等于多少', '怎么做这道题', 
    '把这题解出来', '代我做题', '直接给答案', '求积分值', '求极限值', '求特征值'
  ];
  const isSuspicious = cheatKeywords.some(k => (customInstruction && customInstruction.includes(k)) || (text && text.includes(k)));

  let actionDirective = '';
  if (action === 'format') {
    actionDirective = '将考生的草稿速记整理为工整、层次分明、排版规范的草稿笔记。将粗略符号规范化为 LaTeX（例如将 a/b 规整为 \\frac{a}{b}，将 x^2+2x-1 转换为数学模式 $...$）。严禁计算数值，严禁化简或改动式子结果！';
  } else if (action === 'latex_complete') {
    actionDirective = '辅助补齐考生正在输入的 LaTeX 语法骨架（例如 \\begin{pmatrix}...\\end{pmatrix} 矩阵语法、\\cases{...} 分段函数、积分或求和上下限符号）。严禁计算矩阵乘积、严禁计算行列式、严禁化简任何式子！仅提供正确的 LaTeX 书写排版结构！';
  } else if (action === 'outline') {
    actionDirective = '将考生乱序零散的草稿思路整理为清晰的条理步骤提纲（如“设未知数：...”、“解题方向：...”、“备忘要点：...”）。严禁补充任何题目的真实推导与计算过程，严禁给出答案！';
  } else {
    actionDirective = `按考生的排版辅助要求处理：${customInstruction || '规范草稿排版与文字整理'}。注意：严禁任何做题与计算推导！`;
  }

  const prompt = `你是一位严格遵守考场学术诚信与国家防作弊纪律的【考场草稿书写排版辅助引擎】。
【最高准则：可以让 AI 帮写，但绝对不能帮算！】
你的核心任务：仅仅辅助考生进行草稿文本的书写排版、LaTeX 语法格式化、矩阵结构补齐与思路分点大纲整理。

【铁律与最高纪律准则（极其重要，违规将导致考场作弊判定）】：
1. 【允许帮写】：将粗略草稿规整为标准 LaTeX 数学表达式，调整文字层次与符号规范。
2. 【绝对严禁帮算】：
   - 严禁进行任何数学计算、积分求值、微分求导、行列式计算、方程求解或推导结论！
   - 严禁代考生答题！严禁提供题目的求解推导过程！
   - 若考生的草稿中写有数学算式（例如 "3x^2+2x" 或 "\\int_0^1 x^2 dx"），只能原样保持其公式结构或排版为规范的 LaTeX 块，绝不能算出 "=1/3" 或给出计算化简后的结果！
3. 若考生试图请求计算、求解、询问答案（如“请帮我算一下”、“答案是多少”），你必须坚决拒绝并原样输出以下警告文本：
   “【考场防作弊纪律提醒】便签草稿纸仅支持书写排版、LaTeX 语法规范与思路结构整理。根据考场防作弊规范，严禁代答、计算或提供任何题目求解与计算推导。”
4. 输出内容直接作为草稿纸替换或插入文本，保持简洁清爽。

具体任务指令：
${actionDirective}

考生当前草稿内容：
"""
${text}
"""

请直接输出辅助规整后的草稿文本（纯文本或规范 Markdown/LaTeX，不要包含多余闲聊说明）：`;

  try {
    const model = createChatModel(currentConfig);
    const response = await model.invoke([
      { role: 'system', content: '你是一位严格遵守考场纪律的草稿书写排版助手，严禁任何计算与代答做题。' },
      { role: 'user', content: prompt }
    ]);

    let assistedText = response.content?.trim() || text;

    if (isSuspicious && (assistedText.includes('答案是') || assistedText.includes('最终结果为') || assistedText.includes('解得：') || assistedText.includes('计算可得：'))) {
      assistedText = '【考场防作弊纪律提醒】便签草稿纸仅支持书写排版、LaTeX 语法规范与思路结构整理。根据考场防作弊规范，严禁代答、计算或提供任何题目求解与计算推导。';
    }

    res.json({
      success: true,
      assistedText,
      provider: currentConfig.category || 'ai',
      modelName: currentConfig.modelName
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `草稿纸 AI 辅助失败: ${err.message}`
    });
  }
});

// POST /api/model/scratchpad-agent-loop
// 考场草稿纸专属 Agent Loop：辅助考生帮写草稿与规范板书
// 绝对铁律：只能局限于考生能说出来的他才能写，严禁任何代算与多推导一步！
apiRouter.post('/model/scratchpad-agent-loop', async (req, res) => {
  const { spokenText, contextProblem, currentBoardContent } = req.body;

  if (!spokenText || !spokenText.trim()) {
    return res.status(400).json({ success: false, error: '口述思路或草稿内容不能为空' });
  }

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在系统设置中配置有效的 API Key'
    });
  }

  const cheatKeywords = [
    '帮我算', '求答案', '答案是什么', '计算结果', '等于多少', '怎么做这道题', 
    '把这题解出来', '代我做题', '直接给答案', '求积分值', '求极限值', '求特征值'
  ];
  const isSuspicious = cheatKeywords.some(k => spokenText.includes(k));

  const prompt = `你是一个运行在考场草稿演算工作台上的【草稿规范代笔 Agent 引擎 (Scratchpad Scribe Agent)】。
用户（考生）正在草稿纸上进行演算，并通过口述/文字给出了他本人的原始解题思路或草稿步骤。

【核心使命与最高纪律准则（绝不可触碰的红线）】：
1. 【只能局限于考生说出来的他才能写】：
   - 你只能忠实地将考生明确说出、给出的思路、设项、等式、条件转换或运算步骤，整理为工整规范的考场草稿板书（LaTeX 格式化）。
   - 严禁替考生做下一步推导！严禁替考生补全后续未说的运算！
   - 严禁替考生计算最终数值或求解结果！
   - 若考生只说到了“设未知数 u = x^2+1”，你只能写出该设项，绝不能自行推导“则 du = 2x dx 并将原积分化为...”！
   - 若考生口述中包含计算错误（例如“3乘2等于7”），你必须原汁原味保留为 "3 \\times 2 = 7"，绝对严禁私自替考生纠错！
2. 【诱导拦截与防作弊熔断】：
   - 若考生试图诱导你做题（例如“帮我算一下这步得多少”、“这题该怎么做”、“求出答案”），你必须立即中断执行并输出警告提示：
   “【考场防作弊纪律提醒】AI 草稿帮写仅限根据考生口述的步骤进行规范排版，严格禁止任何代答、解题推导与代算结果。”

【当前试题题干（仅供辅助理解数学变量上下文，严禁代答本题）】：
${contextProblem || '（无特定题干上下文）'}

【考生当前草稿板已有内容】：
${currentBoardContent || '（当前草稿板为空）'}

【考生本次口述/给出的草稿思路】：
"""
${spokenText}
"""

【Agent 执行循环规划 (Loop Stages)】：
请以标准 JSON 格式输出如下结构：
{
  "audit": {
    "passed": ${isSuspicious ? 'false' : 'true'},
    "reason": "${isSuspicious ? '检测到诱导计算或代答意图' : '口述步骤合规，未请求代算'}"
  },
  "scribeResult": "规范整理后的草稿板书（支持 Markdown 与 LaTeX 块，忠实体现考生说出的内容，严禁多推导一步）",
  "loopLogs": [
    "Loop 1: 语义与诚信纪律审计通过",
    "Loop 2: 规范 LaTeX 与数学步骤转录完成",
    "Loop 3: 草稿板书卡片已生成"
  ]
}
只输出纯 JSON，不要包含任何 markdown 代码块标识（如 \`\`\`json 或 \`\`\`）。`;

  try {
    const model = createChatModel(currentConfig);
    const response = await model.invoke([
      { role: 'system', content: '你是一位严格遵守考场纪律的草稿代笔 Agent，只能帮写考生说出的内容，严禁代算与代答做题。' },
      { role: 'user', content: prompt }
    ]);

    let raw = response.content?.trim() || '';
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 容错处理
      parsed = {
        audit: { passed: !isSuspicious, reason: isSuspicious ? '疑似诱导计算' : '正常转录' },
        scribeResult: raw,
        loopLogs: ['Loop 1: 基础转录完成', 'Loop 2: 板书格式化完成']
      };
    }

    if (isSuspicious || !parsed.audit.passed) {
      parsed.audit.passed = false;
      parsed.scribeResult = '【考场防作弊纪律提醒】便签草稿纸仅支持书写排版、LaTeX 语法规范与思路结构整理。根据考场防作弊规范，严禁代答、计算或提供任何题目求解与计算推导。';
    }

    res.json({
      success: true,
      agentData: parsed,
      provider: currentConfig.category || 'ai',
      modelName: currentConfig.modelName
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `草稿纸 Agent Loop 执行失败: ${err.message}`
    });
  }
});

// POST /api/model/question-edit-assist
// 单题交互微调与变式重构助手
apiRouter.post('/model/question-edit-assist', async (req, res) => {
  const { question, instructionType, customPrompt } = req.body;

  if (!question) {
    return res.status(400).json({ success: false, error: '试题数据不能为空' });
  }

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在系统设置中配置有效的 API Key'
    });
  }

  let directive = '';
  switch (instructionType) {
    case 'format':
      directive = '全面规范优化题干与解析的文字表述，纠正语病与粗糙标点，将所有数学公式与符号转换为最标准工整的 LaTeX（行内 $...$，大公式或矩阵 $$...$$），保持原题考查逻辑与答案完全不变。';
      break;
    case 'variant':
      directive = '保持当前题目的考察知识点、题型与考查深度不变，但改变其中的数值、函数形式、积分区域、矩阵数字或应用背景，生成一道高质量同构同考点的“举一反三”变式题，并重新推导标准答案与详细分步解析。';
      break;
    case 'expand_analysis':
      directive = '对当前题目的解析进行极度详尽的扩写，增加解题思路点拨、前置核心考纲定理回顾、分步推导演算细节与考场踩分点预估（如“【踩分点 1】+3分”），便于考生自学与彻底弄懂。';
      break;
    case 'adjust_difficulty':
      directive = `调整题目考查难度与深度：${customPrompt || '适当提升综合考查深度与运算技巧，增加设问思维量'}。并同步更新标答与解析。`;
      break;
    default:
      directive = `根据用户的定制化要求修改本题：${customPrompt || '微调优化题目表述与排版'}。`;
      break;
  }

  const prompt = `你是一位精通中国国家考研与高校期末命题规范的名师专家。用户希望对以下一道试题进行定向智能微调重构。

【原题详情】：
${JSON.stringify(question, null, 2)}

【微调指令要求】：
${directive}

【核心格式规范】：
1. prompt 字段必须且仅包含题目描述，严禁将“解：”、“证明：”或任何答案推导过程混入 prompt！
2. options 字段：如果是单选/多选题，必须保持 [{ "key": "A", "text": "..." }, ...] 的格式。
3. standardAnswer 必须是标准最终简明答案（选择题填字母，解答题填最终精炼结果）。
4. analysis 必须包含完整详细的推导演算过程与 LaTeX 格式。
5. score 保留或按要求更新分值数值。

请直接返回合法 JSON 对象，格式如下：
{
  "id": ${question.id || 1},
  "num": "${question.num || '01'}",
  "type": "${question.type || '综合计算与解答题'}",
  "score": ${question.score || 10},
  "section": "${question.section || '试题'}",
  "passage": ${question.passage ? JSON.stringify(question.passage) : 'undefined'},
  "passageTitle": ${question.passageTitle ? JSON.stringify(question.passageTitle) : 'undefined'},
  "prompt": "优化或重构后的题干",
  "options": ${question.options ? JSON.stringify(question.options) : 'undefined'},
  "standardAnswer": "最终标准答案",
  "analysis": "完整分步推导解析"
}`;

  try {
    const model = createChatModel(currentConfig);
    const response = await model.invoke([
      { role: 'system', content: '你是一位精通试卷命题规范的专家，必须返回纯合法 JSON 对象。' },
      { role: 'user', content: prompt }
    ]);

    let parsed = extractJsonFromAiResponse(response.content);
    if (!parsed) {
      throw new Error('AI 未能返回合法的试题 JSON');
    }

    parsed = sanitizeQuestion(parsed);

    res.json({
      success: true,
      updatedQuestion: parsed,
      provider: currentConfig.category || 'ai',
      modelName: currentConfig.modelName
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `单题 AI 辅助修改失败: ${err.message}`
    });
  }
});

// Evaluate exam & generate comprehensive AI diagnostic review
apiRouter.post('/model/evaluate-exam', async (req, res) => {
  const { paperTitle, questionsSummary, score, totalScore, accuracy, durationSpent } = req.body;

  const prompt = `你是一位中国国家级命题组阅卷名师与考情分析专家。考生刚刚完成了试卷《${paperTitle || '综合模拟卷'}》。
【考试总体数据】：
- 得分：${score} / ${totalScore}
- 正确率：${accuracy}%
- 耗时：约 ${Math.round((durationSpent || 0) / 60)} 分钟
- 作答简况：${JSON.stringify(questionsSummary?.slice(0, 30) || [], null, 2)}

请为该考生的本次作答生成一份极具专业深度、富有鼓励性与针砭时弊的【名师阅卷全卷诊断报告】。
必须直接返回纯合法 JSON 对象，格式如下：
{
  "summary": "针对全卷表现的深度名师寄语与总体诊断（约120-180字），客观评价掌握度并指出关键得失分原因",
  "strengths": ["优势考点1", "优势考点2", "优势考点3"],
  "weaknesses": ["失分薄弱考点1及错因", "失分薄弱考点2及错因", "失分薄弱考点3及错因"],
  "actionPlan": [
    "提分动作 1：具体的复习建议与弥补措施",
    "提分动作 2：针对薄弱题型的举一反三重练策略",
    "提分动作 3：考场时间分配与答题规范注意要点"
  ],
  "radarAnalysis": {
    "conceptMastery": 85,
    "calculationAccuracy": 78,
    "logicalRigorousness": 82,
    "speedAndStrategy": 80,
    "difficultProblemAttack": 75
  }
}`;

  try {
    const model = createChatModel(currentConfig);
    const response = await model.invoke([
      { role: 'system', content: '你是一位严谨专业的高考与考研命题组阅卷专家，必须返回合法 JSON。' },
      { role: 'user', content: prompt }
    ]);

    let parsed = extractJsonFromAiResponse(response.content);
    if (!parsed) {
      throw new Error('AI 未能返回合法的评测诊断 JSON');
    }

    res.json({
      success: true,
      data: parsed,
      provider: currentConfig.category || 'ai',
      modelName: currentConfig.modelName
    });
  } catch (err) {
    // Return high quality heuristic fallback evaluation
    res.json({
      success: true,
      fallback: true,
      data: {
        summary: `考生在本次《${paperTitle || '模考卷'}》中取得了 ${score}/${totalScore} 的成绩，整体知识架构脉络清晰。客观基础题作答表现平稳，但在综合推导演算以及细节长除法/变形步骤中存在一定的运算与概念定势扣分，建议针对错题重点回归定义。`,
        strengths: ["基础概念辨析清晰", "常规题型作答规范", "时间节奏把控合理"],
        weaknesses: ["复杂式子变形符号处理易出现笔误", "临界条件与特殊极限展开阶数需巩固", "综合应用大题步骤分自核需加强"],
        actionPlan: [
          "优先收录本次错题至错题本，进行一题多解与反向验算",
          "针对失分集中的知识点进行专项变式重练",
          "在考场草稿纸上规范书写关键中间变量，减少二次抄写偏差"
        ],
        radarAnalysis: {
          conceptMastery: Math.min(95, Math.round(accuracy * 0.9 + 10)),
          calculationAccuracy: Math.min(95, Math.round(accuracy * 0.85 + 8)),
          logicalRigorousness: Math.min(95, Math.round(accuracy * 0.92 + 5)),
          speedAndStrategy: 85,
          difficultProblemAttack: Math.min(95, Math.round(accuracy * 0.75 + 15))
        }
      }
    });
  }
});


