/**
 * English Lexicon & Selection Utilities for ExamCraft
 * 提供考研英语高频核心词汇 0ms 极速匹配、音标发音、词形还原与长难句语境智能捕获
 */

export const KAOYAN_CORE_LEXICON = {
  // 考研英语常考重难点词与短语 (覆盖真题高频核心)
  vulnerable: { uk: '/ˈvʌlnərəbl/', us: '/ˈvʌlnərəbl/', pos: 'adj.', def: '易受伤害的，脆弱的；易受攻击的', freq: 5 },
  susceptible: { uk: '/səˈseptəbl/', us: '/səˈseptəbl/', pos: 'adj.', def: '易受影响的，易动感情的；过敏的', freq: 5 },
  deteriorate: { uk: '/dɪˈtɪəriəreɪt/', us: '/dɪˈtɪriəreɪt/', pos: 'v.', def: '恶化，变坏，衰退', freq: 5 },
  inevitable: { uk: '/ɪnˈevɪtəbl/', us: '/ɪnˈevɪtəbl/', pos: 'adj.', def: '不可避免的，必然发生的', freq: 5 },
  fundamental: { uk: '/ˌfʌndəˈmentl/', us: '/ˌfʌndəˈmentl/', pos: 'adj./n.', def: '根本的，基础的；基本原则', freq: 4 },
  profound: { uk: '/prəˈfaʊnd/', us: '/prəˈfaʊnd/', pos: 'adj.', def: '深远的，深刻的；渊博的', freq: 5 },
  manifest: { uk: '/ˈmænɪfest/', us: '/ˈmænɪfest/', pos: 'v./adj.', def: '表明，显现；显然的，明显的', freq: 4 },
  ambiguous: { uk: '/æmˈbɪɡjuəs/', us: '/æmˈbɪɡjuəs/', pos: 'adj.', def: '模棱两可的，含糊不清的', freq: 4 },
  undermine: { uk: '/ˌʌndəˈmaɪn/', us: '/ˌʌndərˈmaɪn/', pos: 'v.', def: '暗中破坏，逐渐削弱；侵蚀基础', freq: 5 },
  compromise: { uk: '/ˈkɒmprəmaɪz/', us: '/ˈkɑːmprəmaɪz/', pos: 'v./n.', def: '妥协，折衷；危害，损害', freq: 5 },
  comprehensive: { uk: '/ˌkɒmprɪˈhensɪv/', us: '/ˌkɑːmprɪˈhensɪv/', pos: 'adj.', def: '全面的，综合性的；详尽的', freq: 4 },
  prevalent: { uk: '/ˈprevələnt/', us: '/ˈprevələnt/', pos: 'adj.', def: '流行的，盛行的，普遍存在的', freq: 4 },
  perspective: { uk: '/pəˈspektɪv/', us: '/pərˈspektɪv/', pos: 'n.', def: '视角，观点；透视法；远景', freq: 5 },
  diminish: { uk: '/dɪˈmɪnɪʃ/', us: '/dɪˈmɪnɪʃ/', pos: 'v.', def: '减少，缩减，降低重要性', freq: 4 },
  distort: { uk: '/dɪˈstɔːt/', us: '/dɪˈstɔːrt/', pos: 'v.', def: '扭曲，歪曲；变形，曲解', freq: 4 },
  allocate: { uk: '/ˈæləkeɪt/', us: '/ˈæləkeɪt/', pos: 'v.', def: '分配，分派，划拨', freq: 4 },
  advocate: { uk: '/ˈædvəkeɪt/', us: '/ˈædvəkeɪt/', pos: 'v./n.', def: '提倡，主张；拥护者，辩护律师', freq: 5 },
  paradox: { uk: '/ˈpærədɒks/', us: '/ˈpærədɑːks/', pos: 'n.', def: '悖论，反论；矛盾的人或事', freq: 4 },
  skeptical: { uk: '/ˈskeptɪkl/', us: '/ˈskeptɪkl/', pos: 'adj.', def: '怀疑的，持怀疑态度的', freq: 4 },
  skepticism: { uk: '/ˈskeptɪsɪzəm/', us: '/ˈskeptɪsɪzəm/', pos: 'n.', def: '怀疑论，怀疑态度', freq: 4 },
  constitute: { uk: '/ˈkɒnstɪtjuːt/', us: '/ˈkɑːnstɪtuːt/', pos: 'v.', def: '构成，组成；设立，任命', freq: 4 },
  eliminate: { uk: '/ɪˈlɪmɪneɪt/', us: '/ɪˈlɪmɪneɪt/', pos: 'v.', def: '消除，淘汰，剔除', freq: 4 },
  controversial: { uk: '/ˌkɒntrəˈvɜːʃl/', us: '/ˌkɑːntrəˈvɜːrʃl/', pos: 'adj.', def: '有争议的，引起争论的', freq: 4 },
  reinforce: { uk: '/ˌriːɪnˈfɔːs/', us: '/ˌriːɪnˈfɔːrs/', pos: 'v.', def: '加强，强化；增援', freq: 4 },
  superficial: { uk: '/ˌsuːpəˈfɪʃl/', us: '/ˌsuːpərˈfɪʃl/', pos: 'adj.', def: '表面的，肤浅的；浅薄的', freq: 4 },
  autonomous: { uk: '/ɔːˈtɒnəməs/', us: '/ɔːˈtɑːnəməs/', pos: 'adj.', def: '自治的；自主的，独立存在的', freq: 4 },
  substantial: { uk: '/səbˈstænʃl/', us: '/səbˈstænʃl/', pos: 'adj.', def: '大量的，实质的；坚固的', freq: 4 },
  counterpart: { uk: '/ˈkaʊntəpɑːt/', us: '/ˈkaʊntərpɑːrt/', pos: 'n.', def: '对应的人或物，相对应者', freq: 4 },
  precedent: { uk: '/ˈpresɪdənt/', us: '/ˈpresɪdənt/', pos: 'n./adj.', def: '先例，前例；在先的', freq: 4 },
  indispensable: { uk: '/ˌɪndɪˈspensəbl/', us: '/ˌɪndɪˈspensəbl/', pos: 'adj.', def: '必不可少的，不可或缺的', freq: 5 },
  subtle: { uk: '/ˈsʌtl/', us: '/ˈsʌtl/', pos: 'adj.', def: '微妙的，敏锐的；难以捉摸的', freq: 4 },
  arbitrary: { uk: '/ˈɑːbɪtrəri/', us: '/ˈɑːrbətreri/', pos: 'adj.', def: '任意的，专断的，武断的', freq: 4 },
  plausible: { uk: '/ˈplɔːzəbl/', us: '/ˈplɔːzəbl/', pos: 'adj.', def: '看似有理的；貌似真实的', freq: 4 },
  pragmatic: { uk: '/præɡˈmætɪk/', us: '/præɡˈmætɪk/', pos: 'adj.', def: '务实的，讲究实效的，实用主义的', freq: 4 },
  lucrative: { uk: '/ˈluːkrətɪv/', us: '/ˈluːkrətɪv/', pos: 'adj.', def: '获利丰厚的，赚钱的', freq: 4 },
  spontaneous: { uk: '/spɒnˈteɪniəs/', us: '/spɑːnˈteɪniəs/', pos: 'adj.', def: '自发的，无意识的；自然的', freq: 4 },
  rigorous: { uk: '/ˈrɪɡərəs/', us: '/ˈrɪɡərəs/', pos: 'adj.', def: '严密的，严谨的；严厉的', freq: 4 },
  conspicuous: { uk: '/kənˈspɪkjuəs/', us: '/kənˈspɪkjuəs/', pos: 'adj.', def: '显眼的，引人注目的', freq: 4 },
  intricate: { uk: '/ˈɪntrɪkət/', us: '/ˈɪntrɪkət/', pos: 'adj.', def: '错综复杂的，精致细密的', freq: 4 },
  homogeneous: { uk: '/ˌhɒməˈdʒiːniəs/', us: '/ˌhoʊməˈdʒiːniəs/', pos: 'adj.', def: '同种类的，同质的', freq: 4 },
  heterogeneous: { uk: '/ˌhetərəˈdʒiːniəs/', us: '/ˌhetərəˈdʒiːniəs/', pos: 'adj.', def: '由不同成分构成的，异质的', freq: 4 },
  pervasive: { uk: '/pəˈveɪsɪv/', us: '/pərˈveɪsɪv/', pos: 'adj.', def: '普遍渗透的，弥漫的，无处不在的', freq: 4 },
  stagnant: { uk: '/ˈstæɡnənt/', us: '/ˈstæɡnənt/', pos: 'adj.', def: '停滞的，不流动的；迟钝的', freq: 4 },
  tenacious: { uk: '/təˈneɪʃəs/', us: '/təˈneɪʃəs/', pos: 'adj.', def: '顽强的，固执的；紧握不放的', freq: 4 },
  ubiquitous: { uk: '/juːˈbɪkwɪtəs/', us: '/juːˈbɪkwɪtəs/', pos: 'adj.', def: '无所不在的，普遍存在的', freq: 4 },
  scrutinize: { uk: '/ˈskruːtənaɪz/', us: '/ˈskruːtənaɪz/', pos: 'v.', def: '仔细检查，认真审查', freq: 4 },
  scrutiny: { uk: '/ˈskruːtəni/', us: '/ˈskruːtəni/', pos: 'n.', def: '精密审查，仔细观察', freq: 4 },
  discrepancy: { uk: '/dɪˈskrepənsi/', us: '/dɪˈskrepənsi/', pos: 'n.', def: '不一致，差异，出入', freq: 4 },
  resilient: { uk: '/rɪˈzɪliənt/', us: '/rɪˈzɪliənt/', pos: 'adj.', def: '能复原的，有适应力的，韧性强的', freq: 5 },
  resilience: { uk: '/rɪˈzɪliəns/', us: '/rɪˈzɪliəns/', pos: 'n.', def: '复原力，恢复力，韧性', freq: 5 },
  dilemma: { uk: '/dɪˈlemə/', us: '/daɪˈlemə/', pos: 'n.', def: '困境，进退两难之境', freq: 4 },
  preliminary: { uk: '/prɪˈlɪmɪnəri/', us: '/prɪˈlɪmɪneri/', pos: 'adj./n.', def: '初步的，预备的；预备措施', freq: 4 },
  proponent: { uk: '/prəˈpəʊnənt/', us: '/prəˈpoʊnənt/', pos: 'n.', def: '支持者，拥护者，提倡者', freq: 4 },
  opponent: { uk: '/əˈpəʊnənt/', us: '/əˈpoʊnənt/', pos: 'n.', def: '对手，竞争者；反对者', freq: 4 },
  explicit: { uk: '/ɪkˈsplɪsɪt/', us: '/ɪkˈsplɪsɪt/', pos: 'adj.', def: '清楚明确的，直截了当的', freq: 4 },
  implicit: { uk: '/ɪmˈplɪsɪt/', us: '/ɪmˈplɪsɪt/', pos: 'adj.', def: '含蓄的，不言明的；内含的', freq: 4 },
  feasible: { uk: '/ˈfiːzəbl/', us: '/ˈfiːzəbl/', pos: 'adj.', def: '可行的，行得通的', freq: 4 },
  redundant: { uk: '/rɪˈdʌndənt/', us: '/rɪˈdʌndənt/', pos: 'adj.', def: '多余的，累赘的；被解雇的', freq: 4 },
  unprecedented: { uk: '/ʌnˈpresɪdentɪd/', us: '/ʌnˈpresɪdentɪd/', pos: 'adj.', def: '前所未有的，空前的', freq: 5 },
  legitimate: { uk: '/lɪˈdʒɪtɪmət/', us: '/lɪˈdʒɪtɪmət/', pos: 'adj./v.', def: '合法的，正当的；使合法化', freq: 4 },
  reluctance: { uk: '/rɪˈlʌktəns/', us: '/rɪˈlʌktəns/', pos: 'n.', def: '不情愿，勉强', freq: 4 },
  reluctant: { uk: '/rɪˈlʌktənt/', us: '/rɪˈlʌktənt/', pos: 'adj.', def: '不情愿的，勉强的', freq: 4 },
  coherent: { uk: '/kəʊˈhɪərənt/', us: '/koʊˈhɪrənt/', pos: 'adj.', def: '连贯的，条理清晰的；一致的', freq: 4 },
  perceive: { uk: '/pəˈsiːv/', us: '/pərˈsiːv/', pos: 'v.', def: '察觉，感知；理解为，看待', freq: 4 },
  perception: { uk: '/pəˈsepʃn/', us: '/pərˈsepʃn/', pos: 'n.', def: '感知，知觉；看法，洞察力', freq: 5 },
  compensate: { uk: '/ˈkɒmpenseɪt/', us: '/ˈkɑːmpenseɪt/', pos: 'v.', def: '补偿，弥补；赔偿', freq: 4 },
  speculate: { uk: '/ˈspekjuleɪt/', us: '/ˈspekjuleɪt/', pos: 'v.', def: '推测，推断；投机', freq: 4 },
  speculation: { uk: '/ˌspekjuˈleɪʃn/', us: '/ˌspekjuˈleɪʃn/', pos: 'n.', def: '推测，猜测；投机买卖', freq: 4 },
  incline: { uk: '/ɪnˈklaɪn/', us: '/ɪnˈklaɪn/', pos: 'v./n.', def: '倾斜；倾向于，赞同；斜坡', freq: 4 },
  inclination: { uk: '/ˌɪnklɪˈneɪʃn/', us: '/ˌɪnklɪˈneɪʃn/', pos: 'n.', def: '倾向，偏好；意愿', freq: 4 },
  compatible: { uk: '/kəmˈpætəbl/', us: '/kəmˈpætəbl/', pos: 'adj.', def: '兼容的，协调的，能共存的', freq: 4 },
  incompatible: { uk: '/ˌɪnkəmˈpætəbl/', us: '/ˌɪnkəmˈpætəbl/', pos: 'adj.', def: '不相容的，不能协调的', freq: 4 },
  paradigm: { uk: '/ˈpærədaɪm/', us: '/ˈpærədaɪm/', pos: 'n.', def: '范例，典范，典型范式', freq: 5 },
  subsidize: { uk: '/ˈsʌbsɪdaɪz/', us: '/ˈsʌbsədaɪz/', pos: 'v.', def: '资助，补贴', freq: 4 },
  subsidy: { uk: '/ˈsʌbsədi/', us: '/ˈsʌbsədi/', pos: 'n.', def: '补贴，津贴，补助金', freq: 4 },
  surpass: { uk: '/səˈpɑːs/', us: '/sərˈpæs/', pos: 'v.', def: '超越，胜过，优于', freq: 4 },
  volatile: { uk: '/ˈvɒlətaɪl/', us: '/ˈvɑːlətl/', pos: 'adj.', def: '易挥发的；不稳定的，反复无常的', freq: 4 },
  volatility: { uk: '/ˌvɒləˈtɪləti/', us: '/ˌvɑːləˈtɪləti/', pos: 'n.', def: '挥发性；波动性，易变性', freq: 4 },
  induce: { uk: '/ɪnˈdjuːs/', us: '/ɪnˈduːs/', pos: 'v.', def: '引起，导致；诱导，劝导', freq: 4 },
  derive: { uk: '/dɪˈraɪv/', us: '/dɪˈraɪv/', pos: 'v.', def: '源自，获得；派生出', freq: 4 },
  depict: { uk: '/dɪˈpɪkt/', us: '/dɪˈpɪkt/', pos: 'v.', def: '描绘，描画，描述', freq: 4 },
  preclude: { uk: '/prɪˈkluːd/', us: '/prɪˈkluːd/', pos: 'v.', def: '排除，妨碍，阻止', freq: 4 },
  concur: { uk: '/kənˈkɜː/', us: '/kənˈkɜːr/', pos: 'v.', def: '同意，赞成；同时发生', freq: 4 },
  constrain: { uk: '/kənˈstreɪn/', us: '/kənˈstreɪn/', pos: 'v.', def: '束缚，限制；强迫', freq: 4 },
  constraint: { uk: '/kənˈstreɪnt/', us: '/kənˈstreɪnt/', pos: 'n.', def: '束缚，限制，管束', freq: 4 },
  reconcile: { uk: '/ˈrekənsaɪl/', us: '/ˈrekənsaɪl/', pos: 'v.', def: '使和解，使协调；顺从于', freq: 4 },
  fluctuate: { uk: '/ˈflʌktʃueɪt/', us: '/ˈflʌktʃueɪt/', pos: 'v.', def: '波动，变动，起伏不平', freq: 4 },
  fluctuation: { uk: '/ˌflʌktʃuˈeɪʃn/', us: '/ˌflʌktʃuˈeɪʃn/', pos: 'n.', def: '波动，起伏，变化', freq: 4 }
};

/**
 * 清洗选区文本：
 * 1. 归一化各种印刷体弯单引号（’ ‘ ` 等）为标准撇号 '；
 * 2. 剥离两端标点符号与空格；
 * 3. 兼容复合词（state-of-the-art）与所有格/缩写（people's, don't）。
 */
export function cleanSelectedWord(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // 统一将各种印刷体弯单引号、反引号归一化为标准的 ASCII 直单引号 '
  const normalized = raw.trim()
    .replace(/[\u2018\u2019\u201A\u201B\u2032`´]/g, "'");

  // 剥离两端标点符号（保留词中连字符和撇号，如 state-of-the-art, children's）
  let cleaned = normalized
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
    .replace(/\s+/g, ' ');

  // 仅允许字母、空格、连字符与单撇号
  if (!/^[a-zA-Z\s\-']{2,50}$/.test(cleaned)) {
    return '';
  }
  return cleaned;
}

/**
 * 智能词形还原：将所有格、复数、过去式等转换为词元原形
 */
export function getWordBaseForm(word) {
  if (!word) return '';
  const lower = word.toLowerCase().trim().replace(/[\u2018\u2019\u201A\u201B\u2032`´]/g, "'");
  // 1. 去除所有格 's 或 s'
  if (lower.endsWith("'s")) return lower.slice(0, -2);
  if (lower.endsWith("s'")) return lower.slice(0, -1);
  return lower;
}

/**
 * 极速词典匹配与查询（支持所有格与简易词形还原）
 */
export function lookupWordInLexicon(word) {
  if (!word) return null;
  const lower = word.toLowerCase().trim().replace(/[\u2018\u2019\u201A\u201B\u2032`´]/g, "'");
  
  // 1. 直查原词
  if (KAOYAN_CORE_LEXICON[lower]) {
    const item = KAOYAN_CORE_LEXICON[lower];
    return {
      word: lower,
      phoneticUk: item.uk,
      phoneticUs: item.us,
      pos: item.pos,
      definition: item.def,
      examFrequency: item.freq || 4,
      isCore: true
    };
  }

  // 2. 词形还原回退 (优先剥离所有格 's, 其次复数 -s/-es, 时态 -ed/-ing/-ly)
  const baseFromApostrophe = getWordBaseForm(lower);
  const variants = [
    baseFromApostrophe !== lower ? baseFromApostrophe : null,
    lower.replace(/s$/, ''),
    lower.replace(/es$/, ''),
    lower.replace(/ed$/, ''),
    lower.replace(/ing$/, ''),
    lower.replace(/ly$/, '')
  ].filter(Boolean);

  for (const v of variants) {
    if (v && v.length >= 2 && KAOYAN_CORE_LEXICON[v]) {
      const item = KAOYAN_CORE_LEXICON[v];
      const isPossessive = lower.endsWith("'s") || lower.endsWith("s'");
      return {
        word: lower,
        originalBase: v,
        phoneticUk: item.uk,
        phoneticUs: item.us,
        pos: isPossessive ? `${item.pos} (所有格)` : item.pos,
        definition: isPossessive ? `${item.def}（所有格：...的）` : item.def,
        examFrequency: item.freq || 4,
        isCore: true
      };
    }
  }

  // 3. 兜底通用数据
  return {
    word: lower,
    originalBase: baseFromApostrophe !== lower ? baseFromApostrophe : lower,
    phoneticUk: `/${lower}/`,
    phoneticUs: `/${lower}/`,
    pos: lower.endsWith("'s") ? '名词所有格' : '考研词汇',
    definition: lower.endsWith("'s")
      ? `${baseFromApostrophe} 的所有格形式`
      : '考研真题关键核心词，点击标记收录生词本深度解析',
    examFrequency: 3,
    isCore: false
  };
}

/**
 * 递归向上查找包含选区的最近块级容器，并精准切分捕获长难句
 */
export function extractContextSentenceFromSelection(selection, targetWord) {
  if (!selection || selection.rangeCount === 0) return '';
  try {
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    
    // 如果是文本节点，取父节点
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    // 向上寻找最近的块级段落或文章容器
    const blockTags = new Set(['P', 'ARTICLE', 'SECTION', 'BLOCKQUOTE', 'LI', 'DIV']);
    let current = container;
    let bestBlock = container;
    let depth = 0;
    while (current && depth < 6) {
      if (current.tagName && blockTags.has(current.tagName.toUpperCase())) {
        bestBlock = current;
        // 如果是段落或者专门的篇章容器，优先直接选用
        if (current.tagName === 'P' || current.classList?.contains('exam-english-passage')) {
          break;
        }
      }
      current = current.parentElement;
      depth += 1;
    }

    const fullText = (bestBlock?.innerText || bestBlock?.textContent || '').trim();
    if (!fullText) return '';

    // 按照英文句末标点 [.?!] 切分自然句
    const sentences = fullText.split(/(?<=[.?!;])\s+|\n+/);
    const searchTarget = (targetWord || '').toLowerCase();

    // 优先匹配包含完整单词的句子
    if (searchTarget) {
      const matched = sentences.find((s) => {
        const lowerS = s.toLowerCase();
        // 词边界匹配
        const regex = new RegExp(`\\b${searchTarget}\\b`, 'i');
        return regex.test(lowerS) || lowerS.includes(searchTarget);
      });
      if (matched && matched.trim().length >= 15) {
        return matched.trim().slice(0, 300);
      }
    }

    // 兜底返回截取片断
    return fullText.slice(0, 240);
  } catch (e) {
    console.warn('Failed to extract context sentence:', e);
    return '';
  }
}
