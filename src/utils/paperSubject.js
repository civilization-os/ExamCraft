// Subject Classification Utilities & Metadata for ExamCraft

export const DEFAULT_SUBJECTS = [
  '408',
  '数学',
  '英语',
  '政治',
  '管理类联考',
  '自命题专业课'
];

export function getCustomSubjects() {
  try {
    const raw = localStorage.getItem('examcraft_custom_subjects');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(s => String(s).trim()).filter(Boolean);
      }
    }
  } catch {}
  return [];
}

export function saveCustomSubjects(subjects) {
  try {
    const clean = Array.from(new Set((subjects || []).map(s => String(s).trim()).filter(Boolean)));
    localStorage.setItem('examcraft_custom_subjects', JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('examcraft-subjects-updated', { detail: clean }));
    return clean;
  } catch {
    return [];
  }
}

export function addCustomSubject(newSubject) {
  const name = String(newSubject || '').trim();
  if (!name || name === '全部科目' || name === '未分类') return getCustomSubjects();
  const current = getCustomSubjects();
  if (!current.includes(name) && !DEFAULT_SUBJECTS.includes(name)) {
    const updated = [...current, name];
    saveCustomSubjects(updated);
    return updated;
  }
  return current;
}

export function removeCustomSubject(subjectToRemove) {
  const name = String(subjectToRemove || '').trim();
  const current = getCustomSubjects();
  const updated = current.filter(s => s !== name);
  saveCustomSubjects(updated);
  return updated;
}

export function inferPaperSubject(paperOrTitle) {
  if (!paperOrTitle) return '未分类';
  if (typeof paperOrTitle === 'object') {
    const explicit = String(paperOrTitle.subject || paperOrTitle.subjectName || paperOrTitle.discipline || '').trim();
    if (explicit && explicit !== '未分类') return explicit;
  }
  const text = typeof paperOrTitle === 'string'
    ? paperOrTitle
    : [paperOrTitle.title, ...(Array.isArray(paperOrTitle.tags) ? paperOrTitle.tags : [])].filter(Boolean).join(' ');

  // 1. 408 / Computer Science
  if (/408|计算机|数据结构|操作系统|组成原理|计组|计网|网络工程|软件工程|算法与数据结构|计算机科学|计算机统考|学科联考/.test(text)) {
    return '408';
  }

  // 2. Mathematics
  if (/数学|高等数学|高数|线性代数|线代|概率论|数一|数二|数三|数学（一）|数学（二）|数学（三）|数学[123一二三]|考研数学|微积分/.test(text)) {
    return '数学';
  }

  // 3. English
  if (/英语|English|英一|英二|考研英语|大学英语|完形填空|英[12一二]|四级|六级|CET/i.test(text)) {
    return '英语';
  }

  // 4. Politics
  if (/政治|思想政治|马原|马克思|毛中特|史纲|思修|考研政治|肖秀荣|形势与政策/.test(text)) {
    return '政治';
  }

  // 5. Management & Economics Joint Exams (199 / 396)
  if (/管综|199|经综|396|管理类联考|经济类联考|逻辑推理|综合能力/.test(text)) {
    return '管理类联考';
  }

  // 6. Common Specialized Subjects
  if (/物理|大学物理|普通物理/.test(text)) return '物理';
  if (/化学|有机化学|无机化学/.test(text)) return '化学';
  if (/生物|生物化学|分子生物/.test(text)) return '生物';
  if (/心理学|312/.test(text)) return '心理学';
  if (/教育学|311/.test(text)) return '教育学';
  if (/法硕|法律硕士|法学综合/.test(text)) return '法硕联考';
  if (/自命题|专业课/.test(text)) return '自命题专业课';

  return '未分类';
}

export function getSubjectBadgeStyle(subject) {
  switch (subject) {
    case '408':
      return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
    case '数学':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
    case '英语':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case '政治':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
    case '管理类联考':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case '自命题专业课':
      return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30';
    case '未分类':
      return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    default:
      return 'bg-primary/10 text-primary border-primary/25';
  }
}
