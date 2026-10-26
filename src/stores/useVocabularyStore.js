import { create } from 'zustand';

const STORAGE_KEY_VOCAB = 'examcraft_vocab_data';
const STORAGE_KEY_FOLDERS = 'examcraft_vocab_folders';

export const INITIAL_FOLDERS = [
  {
    id: 'folder-default',
    name: '默认生词本',
    count: 428,
    isDefault: true,
    createdAt: '2026-10-01'
  },
  {
    id: 'folder-2024-en1',
    name: '2024英语一 强化冲刺',
    count: 94,
    isDefault: false,
    createdAt: '2026-10-15'
  }
];

export const INITIAL_WORDS = [
  {
    id: 'vocab-ephemeral',
    word: 'ephemeral',
    phoneticUk: "/ɪ'fem.ər.əl/",
    phoneticUs: "/ə'fem.ər.əl/",
    pos: 'adj.',
    definition: '短暂的，转瞬即逝的；朝生暮死的',
    examFrequency: 5,
    examFrequencyCount: 8,
    examSource: '2021真题源词',
    folderId: 'folder-default',
    tags: ['kaoyan_core', 'ebbinghaus_due', 'ai_extracted'],
    contextSlice: {
      source: '考研英语一 2021 阅读理解 Text 2',
      difficulty: 3,
      sentence: "Fame on digital platforms has become notoriously ephemeral, where today's algorithmic darling can be entirely forgotten by next week's trending cycle.",
      highlightWord: 'ephemeral',
      translation: '数字平台上的名声已变得出了名地转瞬即逝，今日被算法青睐的宠儿在下周的流行热潮中就可能被彻底遗忘。'
    },
    morphologyMnemonic: {
      title: 'DeepSeek 构词与联想记忆',
      analysis: '词根剖析: epi- (在...之上/只持续) + hemer- (日、天，如 hemerocallis 萱草花/一日百合) + -al (形容词后缀) → 字面含义“只存活一天的” → 引申为短暂的。'
    },
    synonymsComparison: {
      title: '考研同义替换高频辨析',
      items: [
        'transient: 多指暂住的、旅居的或匆匆即逝的状态。',
        'fleeting: 偏感性修辞，强调时光飞逝 (e.g. fleeting glimpse)。',
        'evanescent: 逐渐消散、若有若无的 (文学性高频)。'
      ]
    },
    ebbinghausStage: 1, // 1: 1天后, 2: 3天后, 3: 7天后, 4: 14天后 (已掌握)
    mastered: false,
    reviewCount: 2,
    lastReviewedAt: '2026-10-25'
  },
  {
    id: 'vocab-paradoxical',
    word: 'paradoxical',
    phoneticUk: "/ˌpær.əˈdɒk.sɪ.kəl/",
    phoneticUs: "/ˌper.əˈdɑːk.sɪ.kəl/",
    pos: 'adj.',
    definition: '自相矛盾的；似非而是的，荒谬而真实的',
    examFrequency: 5,
    examFrequencyCount: 9,
    examSource: '2022真题源词',
    folderId: 'folder-default',
    tags: ['kaoyan_core', 'ebbinghaus_due'],
    contextSlice: {
      source: '考研英语一 2022 阅读理解 Text 1',
      difficulty: 4,
      sentence: "It seems paradoxical that while hyper-connectivity was promised to liberate remote workers, it has instead entrenched an expectation of perpetual availability.",
      highlightWord: 'paradoxical',
      translation: '看起来自相矛盾的是：高度互联原本许诺让远程工作者获得解放，结果反而固化了一种时刻待命的严苛预期。'
    },
    morphologyMnemonic: {
      title: 'DeepSeek 构词与联想记忆',
      analysis: '词根剖析: para- (相反、偏离) + dox (观点、思想，同 orthodox 正统的) + -ical → 偏离常理但蕴含深意的主张 → 自相矛盾的。'
    },
    synonymsComparison: {
      title: '考研同义替换高频辨析',
      items: [
        'contradictory: 逻辑上互不相容、正反对立的。',
        'inconsistent: 前后不一致的、缺乏连贯性的。',
        'oxymoronic: 修辞学上的矛盾修饰法 (如 deafening silence)。'
      ]
    },
    ebbinghausStage: 1,
    mastered: false,
    reviewCount: 3,
    lastReviewedAt: '2026-10-25'
  },
  {
    id: 'vocab-vulnerable',
    word: 'vulnerable',
    phoneticUk: "/ˈvʌl.nər.ə.bəl/",
    phoneticUs: "/ˈvʌl.nɚ.ə.bəl/",
    pos: 'adj.',
    definition: '易受伤害的，脆弱的；有弱点的',
    examFrequency: 5,
    examFrequencyCount: 11,
    examSource: '2020真题源词',
    folderId: 'folder-default',
    tags: ['kaoyan_core', 'ebbinghaus_due', 'ai_extracted'],
    contextSlice: {
      source: '考研英语一 2020 完形填空',
      difficulty: 3,
      sentence: "Aging infrastructure leaves metropolitan transport grids exceptionally vulnerable to extreme meteorological disruptions.",
      highlightWord: 'vulnerable',
      translation: '日益老化的基础设施让大都市的交通网络在极端气象灾害面前显得格外脆弱脆弱。'
    },
    morphologyMnemonic: {
      title: 'DeepSeek 构词与联想记忆',
      analysis: '词根剖析: vulner- (伤口，来自拉丁语 vulnus) + -able (能够被...的) → 容易被砍伤打伤的 → 脆弱易损的。'
    },
    synonymsComparison: {
      title: '考研同义替换高频辨析',
      items: [
        'fragile: 物理结构上易碎、易折断的 (如 porcelain)。',
        'susceptible: 对疾病、诱惑或外界心理影响极度敏感脆弱的。',
        'precarious: 根基不稳、充满不确定性危险的 (生计/局势)。'
      ]
    },
    ebbinghausStage: 1,
    mastered: false,
    reviewCount: 4,
    lastReviewedAt: '2026-10-24'
  },
  {
    id: 'vocab-ambiguity',
    word: 'ambiguity',
    phoneticUk: "/ˌæm.bɪˈɡjuː.ə.ti/",
    phoneticUs: "/ˌæm.bəˈɡjuː.ə.t̬i/",
    pos: 'n.',
    definition: '模棱两可，含糊不清；不明确的词语或表达',
    examFrequency: 4,
    examFrequencyCount: 7,
    examSource: '2019真题源词',
    folderId: 'folder-default',
    tags: ['kaoyan_core'],
    contextSlice: {
      source: '考研英语一 2019 阅读理解 Text 3',
      difficulty: 4,
      sentence: "Legislative deliberate ambiguity allows regulatory agencies leeway to tailor nuanced policies without requiring repeated statutory rewrites.",
      highlightWord: 'ambiguity',
      translation: '立法层面上蓄意的模棱两可，使监管机构有裁量空间来制定因时制宜的精细政策，而无需频繁修改法律条文。'
    },
    morphologyMnemonic: {
      title: 'DeepSeek 构词与联想记忆',
      analysis: '词根剖析: ambi- (两边，同 ambidextrous 双手灵巧的) + agere (驱动、引申为含义流向) + -ity (名词后缀) → 指向两边的歧义 → 模棱两可。'
    },
    synonymsComparison: {
      title: '考研同义替换高频辨析',
      items: [
        'obscurity: 因深奥、难懂或黑暗而导致的不清晰。',
        'equivocation: 存心使用含糊字眼以误导他人的辞令。',
        'vagueness: 缺乏细节、轮廓笼统不分明。'
      ]
    },
    ebbinghausStage: 3,
    mastered: false,
    reviewCount: 5,
    lastReviewedAt: '2026-10-20'
  },
  {
    id: 'vocab-pragmatic',
    word: 'pragmatic',
    phoneticUk: "/præɡˈmæt.ɪk/",
    phoneticUs: "/præɡˈmæt̬.ɪk/",
    pos: 'adj.',
    definition: '务实的，讲求实效的，重实用而非理论的',
    examFrequency: 4,
    examFrequencyCount: 6,
    examSource: '2023真题源词',
    folderId: 'folder-default',
    tags: ['kaoyan_core', 'mastered'],
    contextSlice: {
      source: '考研英语一 2023 翻译题 Text',
      difficulty: 3,
      sentence: "Scientific pioneers often strike a pragmatic compromise between pure theoretical elegance and engineering feasibility.",
      highlightWord: 'pragmatic',
      translation: '科学先驱者往往在纯粹的理论优美性与工程可行性之间达成务实的妥协。'
    },
    morphologyMnemonic: {
      title: 'DeepSeek 构词与联想记忆',
      analysis: '词根剖析: pragma (希腊语行为、做事实践，同 practice) + -atic → 关注实际操作结果的 → 实用主义的、务实的。'
    },
    synonymsComparison: {
      title: '考研同义替换高频辨析',
      items: [
        'utilitarian: 功利主义的，强调效用最大化的。',
        'empirical: 基于实际观察与实验而非先验推理的。',
        'feasible: 方案在技术或资源上行得通的。'
      ]
    },
    ebbinghausStage: 4,
    mastered: true,
    reviewCount: 7,
    lastReviewedAt: '2026-10-18'
  },
  {
    id: 'vocab-ubiquitous',
    word: 'ubiquitous',
    phoneticUk: "/juːˈbɪk.wɪ.təs/",
    phoneticUs: "/juːˈbɪk.wə.t̬əs/",
    pos: 'adj.',
    definition: '无所不在的，普遍存在的',
    examFrequency: 5,
    examFrequencyCount: 10,
    examSource: '2024真题源词',
    folderId: 'folder-default',
    tags: ['kaoyan_core', 'ebbinghaus_due'],
    contextSlice: {
      source: '考研英语一 2024 新题型',
      difficulty: 3,
      sentence: "Microplastics have turned into a ubiquitous contaminant, detected everywhere from arctic glaciers to deep-sea abyssal trenches.",
      highlightWord: 'ubiquitous',
      translation: '微塑料已演变为一种无所不在的污染物，从北极冰川到万米深海海沟均检测出其踪迹。'
    },
    morphologyMnemonic: {
      title: 'DeepSeek 构词与联想记忆',
      analysis: '词根剖析: ubi (拉丁语何处、到处) + -que (每一个) + -ous (形容词后缀) → 到处都有的 → 无所不在的。'
    },
    synonymsComparison: {
      title: '考研同义替换高频辨析',
      items: [
        'omnipresent: 带有神学神圣色彩的“无处不在”。',
        'pervasive: 具渗透性、蔓延扩散于各角落的 (如 pervasive influence)。',
        'prevalent: 某时期或群体中极为流行盛行的。'
      ]
    },
    ebbinghausStage: 1,
    mastered: false,
    reviewCount: 2,
    lastReviewedAt: '2026-10-25'
  }
];

function readStoredVocab() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VOCAB);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_WORDS;
}

function readStoredFolders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FOLDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_FOLDERS;
}

export const useVocabularyStore = create((set, get) => ({
  words: readStoredVocab(),
  folders: readStoredFolders(),
  activeFolderId: 'folder-default',
  activeCategory: 'all', // 'all', 'ebbinghaus_due', 'kaoyan_core', 'ai_extracted', 'mastered'
  currentIndex: 0,
  isReviewMode: false,
  studyStats: {
    todayReviewed: 36,
    dailyGoal: 50,
    retentionRate: 88.4
  },

  setActiveFolder: (folderId) => {
    set({ activeFolderId: folderId, currentIndex: 0 });
  },

  setActiveCategory: (cat) => {
    set({ activeCategory: cat, currentIndex: 0 });
  },

  setCurrentIndex: (idx) => {
    set({ currentIndex: idx });
  },

  nextCard: () => {
    const { currentIndex, getFilteredWords } = get();
    const list = getFilteredWords();
    if (list.length === 0) return;
    set({ currentIndex: (currentIndex + 1) % list.length });
  },

  prevCard: () => {
    const { currentIndex, getFilteredWords } = get();
    const list = getFilteredWords();
    if (list.length === 0) return;
    set({ currentIndex: (currentIndex - 1 + list.length) % list.length });
  },

  // 艾宾浩斯 4 级反馈评分
  // 1: 完全忘记 (1天后复现)
  // 2: 模糊犹豫 (3天后巩固)
  // 3: 基本掌握 (7天后检验)
  // 4: 轻松秒杀 (14天后归档/掌握)
  rateWord: (wordId, ratingLevel) => {
    const { words, studyStats, nextCard } = get();
    const nowStr = new Date().toISOString().split('T')[0];

    const updated = words.map((w) => {
      if (w.id !== wordId) return w;

      let nextStage = ratingLevel;
      let isMastered = ratingLevel === 4;
      let tags = Array.isArray(w.tags) ? [...w.tags] : [];

      if (isMastered) {
        if (!tags.includes('mastered')) tags.push('mastered');
        tags = tags.filter((t) => t !== 'ebbinghaus_due');
      } else {
        tags = tags.filter((t) => t !== 'mastered');
        if (!tags.includes('ebbinghaus_due')) tags.push('ebbinghaus_due');
      }

      return {
        ...w,
        ebbinghausStage: nextStage,
        mastered: isMastered,
        reviewCount: (w.reviewCount || 0) + 1,
        lastReviewedAt: nowStr,
        tags
      };
    });

    const newStats = {
      ...studyStats,
      todayReviewed: studyStats.todayReviewed + 1
    };

    set({ words: updated, studyStats: newStats });
    try {
      localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(updated));
    } catch {}

    // 自动切到下一张
    nextCard();
  },

  addFolder: (name) => {
    if (!name || !name.trim()) return;
    const { folders } = get();
    const newFolder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      count: 0,
      isDefault: false,
      createdAt: new Date().toISOString().split('T')[0]
    };
    const nextFolders = [...folders, newFolder];
    set({ folders: nextFolders, activeFolderId: newFolder.id });
    try {
      localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(nextFolders));
    } catch {}
  },

  addWords: (newWordsList, targetFolderId) => {
    if (!Array.isArray(newWordsList) || newWordsList.length === 0) return;
    const { words, folders, activeFolderId } = get();
    const destFolder = targetFolderId || activeFolderId || 'folder-default';

    const prepared = newWordsList.map((item, idx) => ({
      id: `vocab-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      word: item.word || '',
      phoneticUk: item.phoneticUk || item.phonetic || '',
      phoneticUs: item.phoneticUs || item.phonetic || '',
      pos: item.pos || 'n.',
      definition: item.definition || '',
      examFrequency: item.examFrequency || 4,
      examFrequencyCount: item.examFrequencyCount || 5,
      examSource: item.examSource || 'AI智能提取',
      folderId: destFolder,
      tags: ['kaoyan_core', 'ebbinghaus_due', 'ai_extracted'],
      contextSlice: item.contextSlice || {
        source: '真题切片与语境例句',
        difficulty: 3,
        sentence: item.sentence || '',
        highlightWord: item.word || '',
        translation: item.translation || ''
      },
      morphologyMnemonic: item.morphologyMnemonic || {
        title: 'DeepSeek 构词与联想记忆',
        analysis: item.mnemonic || '词根构词分析与自然联想拓展。'
      },
      synonymsComparison: item.synonymsComparison || {
        title: '考研同义替换高频辨析',
        items: Array.isArray(item.synonyms) ? item.synonyms : ['近义词替换分析整理中']
      },
      ebbinghausStage: 1,
      mastered: false,
      reviewCount: 0,
      lastReviewedAt: null
    }));

    const nextWords = [...words, ...prepared];
    // 更新 folder count
    const nextFolders = folders.map((f) => {
      if (f.id === destFolder) {
        return { ...f, count: f.count + prepared.length };
      }
      return f;
    });

    set({ words: nextWords, folders: nextFolders });
    try {
      localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(nextWords));
      localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(nextFolders));
    } catch {}
  },

  getFilteredWords: () => {
    const { words, activeFolderId, activeCategory } = get();
    return words.filter((w) => {
      // 文件夹过滤
      if (activeFolderId && w.folderId !== activeFolderId) {
        // 如果是默认生词本，显示全部或属于默认的
        if (activeFolderId !== 'folder-default' && w.folderId !== activeFolderId) return false;
      }

      // 体系分类过滤
      if (activeCategory === 'ebbinghaus_due') {
        return w.tags?.includes('ebbinghaus_due') && !w.mastered;
      }
      if (activeCategory === 'kaoyan_core') {
        return w.tags?.includes('kaoyan_core');
      }
      if (activeCategory === 'ai_extracted') {
        return w.tags?.includes('ai_extracted');
      }
      if (activeCategory === 'mastered') {
        return w.mastered || w.tags?.includes('mastered');
      }
      return true;
    });
  },

  getCategoryCounts: () => {
    const { words, activeFolderId } = get();
    const folderWords = words.filter((w) => {
      if (activeFolderId === 'folder-default') return true;
      return w.folderId === activeFolderId;
    });

    return {
      all: folderWords.length,
      ebbinghaus_due: folderWords.filter((w) => w.tags?.includes('ebbinghaus_due') && !w.mastered).length,
      kaoyan_core: folderWords.filter((w) => w.tags?.includes('kaoyan_core')).length,
      ai_extracted: folderWords.filter((w) => w.tags?.includes('ai_extracted')).length,
      mastered: folderWords.filter((w) => w.mastered || w.tags?.includes('mastered')).length
    };
  }
}));
