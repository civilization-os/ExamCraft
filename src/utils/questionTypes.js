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
  const title = `${examTitle} ${question.section || ''}`;
  const num = Number.parseInt(String(question.num || question.id || '').replace(/\D/g, ''), 10);
  const prompt = String(question.prompt || '');
  const hasOptions = hasChoiceOptions(question);
  const blankCue = /_{2,}|＿{2,}|…{2,}|\.{4,}|\(\s{2,}\)|（\s{2,}）|填入.*?空|空格|横线处/.test(prompt);

  // Never infer choice solely from a low question number. Explicit options win;
  // otherwise use discipline-specific exam structure and visible blank markers.
  if (hasOptions) {
    if (/英语|English/i.test(title) && num >= 1 && num <= 20) return '完形填空';
    if (/英语|English/i.test(title) && num >= 21 && num <= 40) return '阅读理解';
    if (/英语|English/i.test(title) && num >= 41 && num <= 45) return '英语新题型';
    if (/政治/.test(title) && num >= 17 && num <= 33) return '多项选择题';
    return /多项选择|多选/.test(rawType) ? '多项选择题' : '单项选择题';
  }
  if (/数学/.test(title) && num >= 11 && num <= 16) return '填空题';
  if (blankCue || /填空/.test(rawType)) return '填空题';

  if (/英语|English/i.test(title) && num >= 21 && num <= 40) return '阅读理解';
  if (/英语|English/i.test(title) && num >= 41 && num <= 45) return '英语新题型';
  if (/英语|English/i.test(title) && num === 46) return '英译汉翻译';
  if (/英语|English/i.test(title) && num >= 47) return '写作题';
  if (/政治/.test(title) && num >= 34) return '分析题';
  if (/408|计算机/.test(title) && num >= 41) return '综合应用题';

  if (rawType && !/^(?:选择题|客观题|试题|考题)$/.test(rawType)) return rawType;
  if (/分析|论述|材料/.test(title)) return '分析题';
  if (/选择/.test(title)) return '单项选择题';
  return rawType || '综合计算与解答题';
}

export function getQuestionInputKind(question) {
  const type = String(question?.type || '');
  if (Array.isArray(question?.options) && question.options.length > 0) return 'choice';
  if (/选择/.test(type)) return 'choice';
  if (/填空/.test(type)) return 'blank';
  return 'written';
}
