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
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read config file:', e.message);
  }
  return {
    category: 'official',
    vendor: 'gemini',
    modelName: 'gemini-2.5-flash',
    apiKey: '',
    temperature: 0.7,
    timeoutMs: 30000,
    maxRetries: 2
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

  // Pattern for solution/proof headers that should NEVER be in prompt
  const splitPattern = /(?:\n\s*|\A\s*)(?:\*\*解[:：\s]*\*\*|【解】|解[:：]|\*\*证明[:：\s]*\*\*|【证明】|证明[:：]|\*\*（\d+）(?:证明|解)[:：\s]*\*\*|\*\*\((\d+)\)(?:证明|解)[:：\s]*\*\*|\*\*解析[:：\s]*\*\*|【解析】|解析[:：])/;
  
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

  // If answer leaked in prompt
  const ansMatch = q.prompt.match(/(?:\*\*答案[:：\s]*\*\*|答案[:：]|【答案】)\s*(.+?)(?:\*\*|$)/);
  if (ansMatch) {
    if (!q.standardAnswer) q.standardAnswer = ansMatch[1].trim().replace(/\*/g, '');
    q.prompt = q.prompt.replace(/(?:\*\*答案[:：\s]*\*\*|答案[:：]|【答案】)\s*(.+?)(?:\*\*|$)/g, '').trim();
  }

  if (q.analysis) q.analysis = q.analysis.trim();
  if (q.standardAnswer) q.standardAnswer = q.standardAnswer.trim().replace(/\*/g, '');

  const numVal = parseInt(String(q.num || q.id).replace(/\D/g, ''), 10);
  if (!isNaN(numVal)) {
    q.num = String(numVal).padStart(2, '0');
    if (!q.id) q.id = numVal;
  }

  return q;
}

// Slice exam markdown into raw question text blocks
export function sliceMarkdownIntoQuestionBlocks(mdText) {
  const lines = mdText.split('\n');
  const blocks = [];
  let headerLines = [];
  let currentBlock = null;
  const hasMarkdownQuestionHeaders = lines.some(l => l.trim().match(/^###\s*(?:题\s*)?\d+/));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let isQHeader = false;
    if (hasMarkdownQuestionHeaders) {
      isQHeader = !!line.match(/^###\s*(?:题\s*)?\d+/);
    } else {
      isQHeader = !!line.match(/^(?:###|##)\s*(?:题\s*)?\d+/) || !!line.match(/^\d+[\.、\s]\s*\S+/);
    }

    if (isQHeader) {
      if (currentBlock) {
        blocks.push(currentBlock.join('\n'));
      }
      currentBlock = [lines[i]];
    } else if (currentBlock) {
      if (line.match(/^##\s+[一二三四五六七八九十0-9]+[、\.、\s]/)) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = null;
        headerLines.push(lines[i]);
      } else {
        currentBlock.push(lines[i]);
      }
    } else {
      headerLines.push(lines[i]);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock.join('\n'));
  }

  return { headerText: headerLines.join('\n'), blocks };
}

// Advanced robust parser for Chinese national exams & course markdown papers
export function parseExamMarkdown(mdText) {
  const lines = mdText.split('\n');
  let title = '《Markdown 智能生成测评卷》';
  let duration = 120;
  let totalScore = 0;
  const questions = [];

  let currentSection = '通用试题';
  let currentQ = null;
  let state = 'prompt'; // 'prompt' | 'options' | 'analysis'

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
    if (!currentQ.standardAnswer && (currentQ.type.includes('解答') || currentQ.type.includes('证明') || currentQ.type.includes('计算'))) {
      currentQ.standardAnswer = '详见分步解答与证明';
    }
    questions.push(currentQ);
    currentQ = null;
    state = 'prompt';
  };

  const hasMarkdownQuestionHeaders = lines.some(l => l.trim().match(/^###\s*(?:题\s*)?\d+/));

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (currentQ && state === 'analysis' && currentQ.analysis) {
        currentQ.analysis += '\n\n';
      } else if (currentQ && state === 'prompt' && currentQ.prompt) {
        currentQ.prompt += '\n\n';
      }
      continue;
    }

    // 1. Title (# ...)
    if (line.startsWith('# ') && !line.startsWith('### ')) {
      title = line.replace(/^#\s+/, '').trim();
      if (title.includes('数学') && (title.includes('硕士') || title.includes('考研') || title.includes('统考'))) {
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

    // 3. Section header (## 一、选择题 ...)
    if (line.match(/^##\s+[一二三四五六七八九十0-9]+[、\.、\s]/) || (line.startsWith('## ') && !line.match(/^##\s*\d+$/))) {
      finishCurrentQ();
      currentSection = line.replace(/^##\s+/, '').trim();
      continue;
    }

    // 4. Section description (e.g. `1~10` 小题，每小题 `5` 分，共 `50` 分...)
    if (line.match(/^`?\d+~\d+`?\s*小题/) || line.match(/小题.*每小题.*分/)) {
      continue;
    }

    // 5. Question start:
    let qHeaderMatch = null;
    if (hasMarkdownQuestionHeaders) {
      qHeaderMatch = line.match(/^###\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/) ||
                     line.match(/^##\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/);
    } else {
      qHeaderMatch = line.match(/^(?:###|##)\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/) ||
                     line.match(/^(\d+)[\.、\s]\s*(.*)$/);
    }

    if (qHeaderMatch) {
      finishCurrentQ();
      const numInt = parseInt(qHeaderMatch[1], 10);
      const numStr = String(numInt).padStart(2, '0');
      const rest = qHeaderMatch[2] ? qHeaderMatch[2].trim() : '';

      const isChoice = currentSection.includes('选择') || rest.includes('选项') || (numInt >= 1 && numInt <= 10 && currentSection.includes('选择'));
      const isBlank = currentSection.includes('填空') || (numInt >= 11 && numInt <= 16 && currentSection.includes('填空'));
      const isSolution = currentSection.includes('解答') || currentSection.includes('证明') || currentSection.includes('计算') || numInt >= 17;

      let score = 5;
      if (isBlank) score = 5;
      else if (isSolution) score = 10;
      else if (currentSection.includes('每小题') || currentSection.includes('分')) {
        const sm = currentSection.match(/每(?:小)?题\s*(\d+)\s*分/);
        if (sm) score = parseInt(sm[1]);
      }

      currentQ = {
        id: numInt,
        num: numStr,
        type: isChoice ? '单项选择题' : isBlank ? '填空题' : '综合计算与解答题',
        score: score,
        section: currentSection,
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

    if (!currentQ) continue;

    // 6. Score declaration inside question body: （本题满分 10 分）
    const scoreMatch = line.match(/^[（\(]本题满分\s*`?(\d+)`?\s*分[）\)]/) ||
                       line.match(/^[（\(](\d+)\s*分[）\)]/);
    if (scoreMatch && state === 'prompt') {
      currentQ.score = parseInt(scoreMatch[1], 10);
      continue;
    }

    // 7. Analysis & Solution identifier
    const isAnalysisTag = line.match(/^(?:\*\*解析[:：\s]*\*\*|【解析】|解析[:：]|\*\*证明[:：\s]*\*\*|【证明】|证明[:：]|\*\*解[:：\s]*\*\*|【解】|解[:：]|\*\*[（\(]\d+[）\)](?:证明|解)[:：\s]*\*\*)/);
    if (isAnalysisTag) {
      state = 'analysis';
      currentQ.analysis = (currentQ.analysis ? currentQ.analysis + '\n' : '') + rawLine;
      continue;
    }

    // 8. Answer identifier
    const ansMatch = line.match(/^(?:\*\*答案[:：\s]*\*\*|答案[:：]|【答案】)\s*(.+?)(?:\*\*|$)/i);
    if (ansMatch) {
      currentQ.standardAnswer = ansMatch[1].trim().replace(/\*/g, '');
      continue;
    }

    // 9. Options
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

    // 10. Accumulate content based on current state
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

// Parallel chunked AI parser for full exams
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

  // Create batches of 3-5 blocks each
  const batchSize = 4;
  const batches = [];
  for (let i = 0; i < blocks.length; i += batchSize) {
    batches.push({
      index: Math.floor(i / batchSize) + 1,
      startIndex: i,
      text: blocks.slice(i, i + batchSize).join('\n\n')
    });
  }

  const batchPromises = batches.map(async (b) => {
    const prompt = `你是一位精通中国考研数学命题规范的高校专家。请将以下试题切片内容解析为结构化 JSON 数组。
【极其严格的排版与格式纪律】：
1. prompt 字段必须且只能包含纯题目描述（含公式 LaTeX），严禁将“解：”、“证明：”或任何换元、计算步骤放入 prompt 中！
2. 若大题内部有小问（如 1. 证明... 2. 求矩阵...），这些属于题干要求，必须保留在 prompt 中，绝对不能拆分成独立的考题！
3. 每道题的分值（如“（本题满分 10 分）”）提取为数值存入 score 字段，并从 prompt 中彻底清除该说明。
4. standardAnswer 存放标准答案或精简结果；选择题为字母，填空题为结果，解答题为最终化简结果（若为长证明可填“详见证明与分步解答”）。
5. analysis 字段必须完整包含所有证明步骤、微分方程求解、极坐标积分等详细推导，保持 LaTeX 格式。

待解析题目内容：
${b.text}

直接输出合法 JSON 数组，格式样例：
[
  {
    "id": 1,
    "num": "01",
    "type": "单项选择题",
    "score": 5,
    "section": "一、选择题",
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
        { role: 'system', content: '你是一位精通微积分与高等数学试卷排版的大模型专家，直接返回合法 JSON 数组，严禁在 prompt 中泄露解答。' },
        { role: 'user', content: prompt }
      ]);
      const parsed = extractJsonArray(res.content);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(sanitizeQuestion);
      }
    } catch (err) {
      console.warn(`[AI Batch ${b.index} Error]:`, err.message);
    }

    // Fallback for this batch to baseline questions
    const fallbackSlice = baseline.questions.slice(b.startIndex, b.startIndex + batchSize);
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
      difficulty: 4,
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
apiRouter.post('/model/ai-scribe', async (req, res) => {
  const { rawDraft, mathProblem } = req.body;

  if (!currentConfig.apiKey || !currentConfig.apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: '请先在系统设置中配置 API Key'
    });
  }

  try {
    const model = createChatModel(currentConfig);
    const prompt = `请作为考场规范转录 AI 代笔系统，将考生的口述演录与速记草稿整理为规范的 LaTeX 数学分步卷面，并给出踩分点自核预估。
原题：${mathProblem || '求不定积分 ∫ x² ln(x+1) dx'}
考生草稿：
${rawDraft}

注意：严禁修改考生的推导逻辑与可能存在的计算错误，原样规整其思路并排印为整洁的 LaTeX 块。
请直接输出 JSON:
{
  "latex": "整理后的 LaTeX 多行推导",
  "stepScores": [
    { "step": "步骤 1: ...", "score": "+3分" },
    { "step": "步骤 2: ...", "score": "+3分" }
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

  const prompt = `你是一位严格遵守考场国家防作弊纪律的【考场草稿书写辅助引擎】。
你的核心任务：仅仅辅助考生进行草稿文本的书写排版、LaTeX 语法格式化、矩阵结构补齐与思路分点大纲整理。

【铁律与最高纪律准则（极其重要，违规将导致考场作弊判定）】：
1. 严禁进行任何数学计算、积分求值、微分求导计算、行列式计算、方程求解或给出任何最终数值答案！
2. 严禁代考生答题！严禁提供题目的标准解答或提示求解过程！
3. 若考生的草稿中写有数学算式（例如 "3x^2+2x" 或 "\\int_0^1 x^2 dx"），只能原样保持其公式结构或排版为规范的 LaTeX 块，绝不能算出 "=1/3" 或给出计算化简后的结果！
4. 若考生试图请求计算、求解、询问答案（如“请帮我算一下”、“答案是多少”），你必须坚决拒绝并原样输出以下警告文本：
   “【考场防作弊纪律提醒】便签草稿纸仅支持书写排版、LaTeX 语法规范与思路结构整理。根据考场防作弊规范，严禁代答、计算或提供任何题目求解与计算推导。”
5. 输出内容直接作为草稿纸替换或插入文本，保持简洁清爽。

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

