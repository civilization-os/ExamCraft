const QUESTION_TYPE_STYLES = [
  { match: /多项选择|多选/, color: 'bg-violet-100 text-violet-800 border-violet-200' },
  { match: /单项选择|单选|选择题/, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { match: /完形|cloze/i, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { match: /阅读|reading/i, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { match: /新题型|信息匹配|排序题/, color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { match: /填空/, color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { match: /翻译|英译汉|汉译英|translation/i, color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { match: /写作|作文|writing/i, color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { match: /分析题|论述题|材料题/, color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { match: /综合应用|应用题|解答|计算|证明|主观/, color: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
];

export function getQuestionTypeClass(type) {
  const style = QUESTION_TYPE_STYLES.find(({ match }) => match.test(String(type || '')));
  return style?.color || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function stripAnswerMaterial(prompt = '') {
  const text = String(prompt || '');
  const answerStart = /(?:^|\n|\s{2,})(?:>\s*)?(?:\*{1,2})?\s*(?:标准答案|参考答案|答案|答)\s*(?:\*{1,2})?\s*[:：]/im;
  const solutionStart = /(?:^|\n|\s{2,})(?:>\s*)?(?:\*{1,2})?\s*(?:解析|解答|证明|答案解析)\s*(?:\*{1,2})?\s*[:：]/im;
  const answerMatch = answerStart.exec(text);
  const solutionMatch = solutionStart.exec(text);
  const cutAt = Math.min(...[answerMatch?.index, solutionMatch?.index].filter((index) => index !== undefined));
  return Number.isFinite(cutAt) ? text.slice(0, cutAt).trim() : text.trim();
}

const hasChoiceOptions = (question) => {
  if (Array.isArray(question?.options) && question.options.length >= 2) return true;
  return /(?:^|\n)\s*(?:[-*]\s*)?(?:A|B|C|D|Ｅ|Ｆ)[\.、．\s:：]/m.test(question?.prompt || '');
};

export function normalizeQuestionType(question, examTitle = '') {
  if (!question) return '综合计算与解答题';
  const rawType = String(question.type || '').trim();
  const section = String(question.section || '').trim();
  const title = `${examTitle} ${section}`;
  const num = Number.parseInt(String(question.num || question.id || '').replace(/\D/g, ''), 10);
  const prompt = String(question.prompt || '');
  const hasOptions = hasChoiceOptions(question);
  const blankCue = /_{2,}|＿{2,}|…{2,}|\.{4,}|\(\s{2,}\)|（\s{2,}）|填入.*?空|空格|横线处/.test(prompt);

  // 1. If original rawType is already a specific meaningful type, preserve it
  if (rawType && !/^(?:选择题|客观题|试题|考题|题目)$/.test(rawType)) {
    // If it says choice but has no options, don't force choice unless explicitly stated
    if (/选择/.test(rawType) && !hasOptions && !blankCue) {
      // Keep going to inference
    } else {
      return rawType;
    }
  }

  // 2. If section has explicit cues, trust section
  if (/选择/.test(section) && hasOptions) return /多选/.test(section) ? '多项选择题' : '单项选择题';
  if (/填空/.test(section) || blankCue || /填空/.test(rawType)) return '填空题';
  if (/解答|计算|证明|综合/.test(section)) return '综合解答题';
  if (/分析|论述|材料/.test(section)) return '分析题';

  // 3. If options exist, distinguish choice types
  if (hasOptions) {
    if (/英语|English/i.test(title) && num >= 1 && num <= 20) return '完形填空';
    if (/英语|English/i.test(title) && num >= 21 && num <= 40) return '阅读理解';
    if (/英语|English/i.test(title) && num >= 41 && num <= 45) return '英语新题型';
    if (/政治/.test(title) && num >= 17 && num <= 33) return '多项选择题';
    return /多项选择|多选/.test(rawType) ? '多项选择题' : '单项选择题';
  }

  // 4. Standard exam structures by discipline (only when not choice)
  if (/408|计算机/.test(title)) {
    if (num >= 41) return '综合应用题';
  }
  if (/数学/.test(title)) {
    if (num >= 11 && num <= 16) return '填空题';
    if (num >= 17) return '解答题';
  }
  if (/政治/.test(title)) {
    if (num >= 34) return '分析题';
  }
  if (/英语|English/i.test(title)) {
    if (num === 46) return '英译汉翻译';
    if (num >= 47) return '写作题';
  }

  if (rawType && !/^(?:选择题|客观题|试题|考题)$/.test(rawType)) return rawType;
  if (/分析|论述|材料/.test(title)) return '分析题';
  return '综合解答题';
}

export function getQuestionInputKind(question) {
  const type = String(question?.type || '');
  if (Array.isArray(question?.options) && question.options.length > 0) return 'choice';
  if (/选择/.test(type)) return 'choice';
  if (/填空/.test(type)) return 'blank';
  return 'written';
}

export function isPseudoPassage(text) {
  if (!text || typeof text !== 'string') return true;
  const clean = text.trim().replace(/[\s\r\n\t]+/g, '');
  if (!clean) return true;

  // 1. High-confidence exam instruction keywords (if text is under 180 chars)
  const instructionKeywords = [
    '符合题意要求',
    '符合题目要求',
    '符合试题要求',
    '符合题意的一项',
    '符合题目要求的一项',
    '四个选项中',
    '每小题给出的四个选项',
    '下列每题给出的',
    '下列各题给出的',
    '在每小题给出的',
    '只有一个选项',
    '有一个选项',
    '只有一项是符合',
    '只有一项符合',
    '选出符合题意',
    '选出最符合',
    '答题卡',
    '答题区域内作答',
    '超出答题区域',
    '草稿纸上答题无效',
    '在草稿纸、试卷上答题无效',
    '试卷上作答无效',
    '考试时间',
    '试卷满分',
    '本大题共',
    '本大题分值',
    '本卷共',
    '请将答案写在',
    '请考生按要求作答',
    '考生务必将自己的',
    '准考证号填写',
  ];

  if (clean.length < 180 && instructionKeywords.some(kw => clean.includes(kw))) {
    return true;
  }

  // 2. Starts with typical exam instruction patterns
  if (/^(?:下列每(?:小)?题|在每小题给出的|只有一个选项|有一个选项|本(?:大)?题共|每(?:小)?题\s*\d+\s*分|共\s*\d+\s*分|请将答案|考试时间\s*\d+|在试卷上作答无效|考生务必)/.test(clean)) {
    return true;
  }

  // 3. Question numbering / score summary boilerplate (e.g. `1~40小题，每小题2分，共80分`)
  if (/^`?\d+[~～\-—]\d+`?(?:题|小题)?(?:[，,、\s]*每(?:小)?题\s*\d+\s*分)?(?:[，,、\s]*共\s*\d+\s*分)?(?:[。\.])?$/.test(clean)) {
    return true;
  }

  // 4. Short strings (< 40 chars) ending with or containing general choice cues
  if (clean.length < 40 && /(?:符合题[意目]|选项中|选择题|共\s*\d+\s*分|每小题\s*\d+\s*分)/.test(clean)) {
    return true;
  }

  return false;
}

export function healQuestionOptions(q) {
  if (!q) return q;
  let res = { ...q };

  // Strip pseudo-passages that are actually exam directions/instructions
  if (res.passage && isPseudoPassage(res.passage)) {
    delete res.passage;
    delete res.passageTitle;
    delete res.passageGroupId;
  }

  // Extract options from prompt if options array is missing or incomplete (< 2)
  if ((!Array.isArray(res.options) || res.options.length < 2) && typeof res.prompt === 'string') {
    const inlineOptRegex = /(?:^|\n|\s{2,}|[;；])(?:[\(（\[]([A-H])[\)）\]][\.、．:：\s]?|([A-H])[\.、．:：])/g;
    const matches = [];
    let m;
    while ((m = inlineOptRegex.exec(res.prompt)) !== null) {
      const key = (m[1] || m[2]).toUpperCase();
      matches.push({ key, index: m.index, matchLen: m[0].length });
    }
    if (matches.length >= 2 && matches[0].key === 'A' && matches[1].key === 'B') {
      const promptCut = matches[0].index;
      const extractedOptions = [];
      for (let i = 0; i < matches.length; i++) {
        const cur = matches[i];
        const textStart = cur.index + cur.matchLen;
        const textEnd = i + 1 < matches.length ? matches[i + 1].index : res.prompt.length;
        const optText = res.prompt.substring(textStart, textEnd).trim().replace(/^[\.、．:：\s]+/, '').trim();
        extractedOptions.push({ key: cur.key, text: optText });
      }
      if (extractedOptions.length >= 2) {
        res.options = extractedOptions;
        res.prompt = res.prompt.slice(0, promptCut).trim();
      }
    }
  }

  if (Array.isArray(res.options) && res.options.length > 0) {
    const healedOptions = [];
    const inlineOptRegex = /(?:^|\s+|[;；])(?:[\(（\[]([A-H])[\)）\]][\.、．:：\s]?|([A-H])[\.、．:：])/g;
    for (const opt of res.options) {
      if (typeof opt === 'string') {
        const matches = [];
        let m;
        inlineOptRegex.lastIndex = 0;
        while ((m = inlineOptRegex.exec(opt)) !== null) {
          matches.push({ key: (m[1] || m[2]).toUpperCase(), index: m.index, matchLen: m[0].length });
        }
        if (matches.length > 1) {
          for (let i = 0; i < matches.length; i++) {
            const cur = matches[i];
            const textStart = cur.index + cur.matchLen;
            const textEnd = i + 1 < matches.length ? matches[i + 1].index : opt.length;
            healedOptions.push({ key: cur.key, text: opt.substring(textStart, textEnd).trim().replace(/^[\.、．:：\s]+/, '').trim() });
          }
        } else {
          healedOptions.push({ key: String.fromCharCode(65 + healedOptions.length), text: opt.trim() });
        }
        continue;
      }
      const optionText = typeof opt?.text === 'string' ? opt.text : typeof opt?.content === 'string' ? opt.content : '';
      inlineOptRegex.lastIndex = 0;
      if (opt && optionText && inlineOptRegex.test(optionText)) {
        const trimmed = optionText.trim();
        const hasLeadingKey = /^(?:[\(（\[]?[A-H][\)）\]]?[\.、．:：\s])/.test(trimmed);
        const full = hasLeadingKey ? trimmed : `${opt.key || 'A'}、 ${trimmed}`;
        const matches = [];
        let m;
        inlineOptRegex.lastIndex = 0;
        while ((m = inlineOptRegex.exec(full)) !== null) {
          const key = (m[1] || m[2]).toUpperCase();
          matches.push({ key, index: m.index, matchLen: m[0].length });
        }
        if (matches.length > 1) {
          for (let i = 0; i < matches.length; i++) {
            const cur = matches[i];
            const textStart = cur.index + cur.matchLen;
            const textEnd = i + 1 < matches.length ? matches[i + 1].index : full.length;
            let text = full.substring(textStart, textEnd).trim().replace(/^([\.、．:：\s]+)/, '').trim();
            healedOptions.push({ key: cur.key, text });
          }
          continue;
        }
      }
      if (opt && typeof opt.text === 'string') {
        const cleanText = opt.text.replace(/^([\.、．:：\s]+)/, '').trim();
        healedOptions.push({ ...opt, text: cleanText });
      } else if (opt && typeof opt.content === 'string') {
        healedOptions.push({ ...opt, text: opt.content.replace(/^([\.、．:：\s]+)/, '').trim() });
      } else {
        healedOptions.push(opt);
      }
    }
    const seen = new Set();
    const finalOptions = healedOptions.filter(o => {
      if (!o || !o.key) return false;
      const k = String(o.key).toUpperCase();
      if (seen.has(k)) return false;
      seen.add(k);
      o.key = k;
      return true;
    });
    res.options = finalOptions;
  }
  return res;
}

export const healQuestion = healQuestionOptions;

export function deduplicateQuestions(questions = [], examTitle = '') {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const map = new Map();
  const usedIds = new Set();

  for (const rawQ of questions) {
    if (!rawQ) continue;
    const q = healQuestionOptions(rawQ);
    let num = null;
    if (q.num !== undefined && q.num !== null && String(q.num).trim() !== '') {
      const parsed = Number.parseInt(String(q.num).replace(/\D/g, ''), 10);
      if (Number.isFinite(parsed) && parsed > 0) num = parsed;
    }
    if (num === null && q.id) {
      const match = /(?:^|[_\-qQ题])(\d+)(?:$|[_\-])/.exec(String(q.id));
      if (match) {
        const parsed = Number.parseInt(match[1], 10);
        if (Number.isFinite(parsed) && parsed > 0) num = parsed;
      }
    }
    const key = num !== null ? num : (q.id || `q_${map.size + 1}`);
    const assignedId = (q.id && !usedIds.has(String(q.id))) ? q.id : `q_${key}`;
    usedIds.add(String(assignedId));

    if (!map.has(key)) {
      map.set(key, {
        ...q,
        id: assignedId,
        num: String(key).padStart(2, '0'),
        type: normalizeQuestionType(q, examTitle)
      });
    } else {
      const existing = map.get(key);

      // Score comparison to see which question object is more complete/authoritative
      const scoreCandidate = (cand) => {
        let score = 0;
        if (cand.options && Array.isArray(cand.options) && cand.options.length >= 2) score += 50;
        if (cand.prompt && cand.prompt.length > 20) score += Math.min(30, cand.prompt.length / 5);
        if (cand.standardAnswer) score += 10;
        if (cand.analysis && cand.analysis.length > 10) score += 10;
        if (cand.section && !cand.section.includes('临时') && !cand.section.includes('通用')) score += 5;
        const numVal = Number.parseInt(String(cand.num || cand.id || '').replace(/\D/g, ''), 10);
        const t = String(cand.type || '');
        if (numVal <= 40 && /选择/.test(t)) score += 20;
        if (numVal >= 41 && /综合|解答|应用/.test(t)) score += 20;
        return score;
      };

      const existingScore = scoreCandidate(existing);
      const newScore = scoreCandidate(q);

      const base = newScore > existingScore ? { ...q } : { ...existing };
      const secondary = newScore > existingScore ? existing : q;

      // Merge secondary fields into base if missing in base
      if ((!base.options || base.options.length < 2) && secondary.options?.length >= 2) {
        base.options = secondary.options;
        base.type = secondary.type;
      }
      if (!base.standardAnswer && secondary.standardAnswer) {
        base.standardAnswer = secondary.standardAnswer;
      }
      if (!base.analysis && secondary.analysis) {
        base.analysis = secondary.analysis;
      } else if (secondary.analysis && base.analysis && !base.analysis.includes(secondary.analysis.slice(0, 30))) {
        base.analysis = `${base.analysis}\n\n${secondary.analysis}`;
      }
      if ((!base.passage || isPseudoPassage(base.passage)) && secondary.passage && !isPseudoPassage(secondary.passage)) {
        base.passage = secondary.passage;
        base.passageTitle = secondary.passageTitle;
      }
      if (!base.prompt || base.prompt.length < 15) {
        base.prompt = secondary.prompt || base.prompt;
      }

      base.id = key;
      base.num = String(key).padStart(2, '0');
      base.type = normalizeQuestionType(base, examTitle);
      map.set(key, base);
    }
  }

  const result = Array.from(map.values());
  result.sort((a, b) => {
    const numA = parseInt(String(a.num || a.id).replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(String(b.num || b.id).replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
  return result;
}



