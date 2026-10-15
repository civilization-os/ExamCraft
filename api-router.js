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
    if (currentQ.prompt) currentQ.prompt = currentQ.prompt.trim();
    if (currentQ.analysis) currentQ.analysis = currentQ.analysis.trim();
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
      }
      continue;
    }

    // 1. Title (# ...)
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }

    // 2. Metadata (- 建议时限: 120分钟)
    if (line.match(/^[-*]?\s*(建议时限|时限|时间)[:：]\s*(\d+)/)) {
      const m = line.match(/(\d+)/);
      if (m) duration = parseInt(m[1]);
      continue;
    }

    // 3. Section header (## 一、选择题 ...)
    if (line.match(/^##\s+[一二三四五六七八九十0-9]+[、\.、\s]/) || (line.startsWith('## ') && !line.match(/^##\s+\d+$/))) {
      finishCurrentQ();
      currentSection = line.replace(/^##\s+/, '').trim();
      continue;
    }

    // 4. Question start:
    // Matches:
    // - ### 1 or ### 1. or ### 题 1 or ### 01
    // - ## 1 or ## 1.
    // - 1. or 1、 or (1)
    const qHeaderMatch = line.match(/^(?:###|##)\s*(?:题\s*)?(\d+)[\.、\s]*(.*)$/) ||
                         line.match(/^(\d+)[\.、\s]\s*(.*)$/);

    if (qHeaderMatch) {
      finishCurrentQ();
      const numInt = parseInt(qHeaderMatch[1], 10);
      const numStr = String(numInt).padStart(2, '0');
      const rest = qHeaderMatch[2] ? qHeaderMatch[2].trim() : '';

      const isChoice = currentSection.includes('选择') || rest.includes('选项') || (numInt >= 1 && numInt <= 10 && currentSection.includes('选择'));
      const isBlank = currentSection.includes('填空') || (numInt >= 11 && numInt <= 16 && currentSection.includes('填空'));
      const isSolution = currentSection.includes('解答') || currentSection.includes('证明') || numInt >= 17;

      let score = 5;
      if (isBlank) score = 5;
      else if (isSolution) score = 10;
      else if (currentSection.includes('每小题') || currentSection.includes('分')) {
        const sm = currentSection.match(/每(?:小)?题\s*(\d+)\s*分/);
        if (sm) score = parseInt(sm[1]);
      }

      totalScore += score;
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

    // 5. Answer identifier: **答案** A or **答案: ** A or 答案: A
    const ansMatch = line.match(/(?:\*\*答案[:：\s]*\*\*|答案[:：])\s*(.+?)(?:\*\*|$)/i);
    if (ansMatch) {
      currentQ.standardAnswer = ansMatch[1].trim().replace(/\*/g, '');
      continue;
    }

    // 6. Analysis identifier: **解析** or **证明** or 【解析】
    if (line.match(/(?:\*\*解析[:：\s]*\*\*|【解析】|解析[:：]|\*\*证明[:：\s]*\*\*|【证明】)/)) {
      state = 'analysis';
      const afterTag = line.replace(/(?:\*\*解析[:：\s]*\*\*|【解析】|解析[:：]|\*\*证明[:：\s]*\*\*|【证明】)/, '').trim();
      if (afterTag) currentQ.analysis = afterTag;
      continue;
    }

    // 7. Options: (A) ... or - A. ... or A. ...
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

    // 8. Accumulate content based on current section
    if (state === 'analysis') {
      currentQ.analysis = (currentQ.analysis ? currentQ.analysis + '\n' : '') + rawLine;
    } else {
      currentQ.prompt = (currentQ.prompt ? currentQ.prompt + '\n' : '') + rawLine;
    }
  }

  finishCurrentQ();

  if (totalScore === 0) {
    totalScore = questions.reduce((sum, q) => sum + (q.score || 5), 0) || 100;
  }

  return {
    title,
    duration,
    totalScore,
    questionCount: questions.length,
    questions
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

  const baseline = parseExamMarkdown(markdown);

  if (useAI && currentConfig.apiKey && currentConfig.apiKey.trim()) {
    try {
      const model = createChatModel(currentConfig);
      const prompt = `请将以下试卷的 Markdown 文本解析并规整为符合 ExamCraft 交互规范的试卷结构。
若有未标注分值的题目，请按标准试卷自动补齐分数；若有 LaTeX 数学公式，请保留并规范排版。
用户输入的 Markdown 文本如下：
"""
${markdown}
"""

请直接输出合法 JSON，不要附带多余闲聊，格式如下：
{
  "title": "试卷标题",
  "duration": 120,
  "totalScore": 100,
  "questionCount": 3,
  "questions": [
    {
      "id": 1,
      "num": "01",
      "type": "单项选择题",
      "score": 5,
      "section": "一、选择题",
      "prompt": "题目描述",
      "options": [
        { "key": "A", "text": "选项A内容" },
        { "key": "B", "text": "选项B内容" }
      ],
      "standardAnswer": "A",
      "analysis": "详细解析"
    }
  ]
}`;

      const aiResponse = await model.invoke([
        { role: 'system', content: '你是一位精通微积分与高等数学试卷排版的数据处理专家，请以纯 JSON 形式回复。' },
        { role: 'user', content: prompt }
      ]);

      const cleanJson = aiResponse.content.replace(/```json\n?|\n?```/g, '').trim();
      const aiParsed = JSON.parse(cleanJson);
      return res.json({
        success: true,
        mode: 'ai_enhanced',
        provider: model.providerName,
        data: aiParsed
      });
    } catch (err) {
      console.warn('AI markdown parsing fallback to algorithmic:', err.message);
      return res.json({
        success: true,
        mode: 'algorithmic_fallback',
        warning: `AI 增强解析超时或报错，已启用算法排版: ${err.message}`,
        data: baseline
      });
    }
  }

  return res.json({
    success: true,
    mode: 'algorithmic',
    data: baseline
  });
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
