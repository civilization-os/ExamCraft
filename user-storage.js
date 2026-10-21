import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USERS_DIR = path.join(DATA_DIR, 'users');
const SECRET_FILE = path.join(DATA_DIR, 'auth-secret.key');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getJwtSecret() {
  if (process.env.EXAMCRAFT_SECRET_KEY && process.env.EXAMCRAFT_SECRET_KEY.trim()) {
    return process.env.EXAMCRAFT_SECRET_KEY.trim();
  }
  ensureDir(DATA_DIR);
  try {
    if (fs.existsSync(SECRET_FILE)) {
      return fs.readFileSync(SECRET_FILE, 'utf8').trim();
    }
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, 'utf8');
    return secret;
  } catch (err) {
    console.warn('[UserStorage] Failed to persist auth-secret.key, using memory secret:', err.message);
    return 'examcraft-default-cluster-secret-key-2026';
  }
}

const JWT_SECRET = getJwtSecret();

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function readJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[UserStorage] Failed to read ${filePath}:`, err.message);
  }
  return defaultValue;
}

function getUserDir(userId) {
  const safeId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
  const dir = path.join(USERS_DIR, safeId);
  ensureDir(dir);
  return dir;
}

function getUserFilePath(userId, fileName) {
  return path.join(getUserDir(userId), fileName);
}

function loadUsers() {
  return readJsonFile(USERS_FILE, []);
}

function saveUsers(users) {
  atomicWriteJson(USERS_FILE, users);
}

export function signToken(payload, expiresInMs = 14 * 24 * 60 * 60 * 1000) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + expiresInMs,
    iat: Date.now()
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '请先登录以访问云端数据' });
  }
  const token = authHeader.slice(7).trim();
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return res.status(401).json({ success: false, error: '登录状态已失效，请重新登录' });
  }
  const users = loadUsers();
  const user = users.find((u) => u.id === decoded.userId);
  if (!user) {
    return res.status(401).json({ success: false, error: '用户账户不存在' });
  }
  req.user = {
    id: user.id,
    username: user.username,
    nickname: user.nickname || user.username,
    avatar: user.avatar || 'scholar',
    targetExam: user.targetExam || '',
    motto: user.motto || '',
    role: user.role,
    roleType: user.roleType || 'teacher',
    email: user.email || ''
  };
  next();
}

export function registerUser(username, password, roleType = 'teacher', email = '') {
  const cleanUsername = String(username || '').trim();
  if (!cleanUsername || cleanUsername.length < 2 || cleanUsername.length > 24) {
    throw new Error('用户名长度需在 2 到 24 个字符之间');
  }
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5@\.\-]+$/.test(cleanUsername)) {
    throw new Error('用户名只允许包含中文、英文字母、数字、下划线及邮箱符号');
  }
  if (!password || password.length < 6) {
    throw new Error('密码长度不能少于 6 位');
  }

  let cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail && cleanUsername.includes('@')) {
    cleanEmail = cleanUsername.toLowerCase();
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('请输入合法的邮箱格式（如 yourname@qq.com）');
  }

  const cleanRoleType = roleType === 'student' ? 'student' : 'teacher';

  const users = loadUsers();
  const lowerName = cleanUsername.toLowerCase();
  const exists = users.find((u) => u.username.toLowerCase() === lowerName);
  if (exists) {
    throw new Error('该用户名已被注册，请直接登录或换一个用户名');
  }

  if (cleanEmail) {
    const emailExists = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    if (emailExists) {
      throw new Error('该安全邮箱已被其他账号绑定，请使用其他邮箱');
    }
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const isFirstUser = users.length === 0;

  const newUser = {
    id: `u_${crypto.randomBytes(6).toString('hex')}`,
    username: cleanUsername,
    email: cleanEmail,
    passwordHash,
    salt,
    role: isFirstUser ? 'admin' : 'user',
    roleType: cleanRoleType,
    createdAt: Date.now()
  };

  users.push(newUser);
  saveUsers(users);

  // Initialize user directory
  getUserDir(newUser.id);

  const token = signToken({
    userId: newUser.id,
    username: newUser.username,
    email: newUser.email,
    role: newUser.role,
    roleType: newUser.roleType
  });
  return {
    token,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      roleType: newUser.roleType,
      createdAt: newUser.createdAt
    }
  };
}

export function authenticateUser(identity, password) {
  const cleanIdentity = String(identity || '').trim().toLowerCase();
  if (!cleanIdentity || !password) {
    throw new Error('请输入用户名/邮箱和密码');
  }

  const users = loadUsers();
  const user = users.find(
    (u) =>
      u.username.toLowerCase() === cleanIdentity ||
      (u.email && u.email.toLowerCase() === cleanIdentity)
  );
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const derived = crypto.scryptSync(password, user.salt, 64).toString('hex');
  const derivedBuf = Buffer.from(derived, 'hex');
  const hashBuf = Buffer.from(user.passwordHash, 'hex');
  if (derivedBuf.length !== hashBuf.length || !crypto.timingSafeEqual(derivedBuf, hashBuf)) {
    throw new Error('用户名或密码错误');
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    email: user.email || '',
    role: user.role,
    roleType: user.roleType || 'teacher'
  });
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname || user.username,
      avatar: user.avatar || 'scholar',
      targetExam: user.targetExam || '',
      motto: user.motto || '',
      email: user.email || '',
      role: user.role,
      roleType: user.roleType || 'teacher',
      createdAt: user.createdAt
    }
  };
}

export function findUserById(userId) {
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname || user.username,
    avatar: user.avatar || 'scholar',
    targetExam: user.targetExam || '',
    motto: user.motto || '',
    email: user.email || '',
    role: user.role,
    roleType: user.roleType || 'teacher',
    createdAt: user.createdAt
  };
}

export function updateUserProfile(userId, { nickname, avatar, targetExam, motto }) {
  const users = loadUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) {
    throw new Error('用户账户不存在');
  }
  const user = users[index];
  if (nickname !== undefined) user.nickname = String(nickname || '').trim().slice(0, 30);
  if (avatar !== undefined) user.avatar = String(avatar || '').trim().slice(0, 50);
  if (targetExam !== undefined) user.targetExam = String(targetExam || '').trim().slice(0, 50);
  if (motto !== undefined) user.motto = String(motto || '').trim().slice(0, 100);
  user.updatedAt = Date.now();
  users[index] = user;
  saveUsers(users);

  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname || user.username,
    avatar: user.avatar || 'scholar',
    targetExam: user.targetExam || '',
    motto: user.motto || '',
    email: user.email || '',
    role: user.role,
    roleType: user.roleType || 'teacher',
    createdAt: user.createdAt
  };
}

export function bindUserEmail(userId, email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('请输入合法的邮箱格式（如 yourname@qq.com）');
  }

  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('用户不存在');

  const exists = users.find((u) => u.id !== userId && u.email && u.email.toLowerCase() === cleanEmail);
  if (exists) {
    throw new Error('该邮箱已被其他账号绑定');
  }

  user.email = cleanEmail;
  user.updatedAt = Date.now();
  saveUsers(users);

  return { success: true, email: cleanEmail };
}

export function changePassword(userId, oldPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('新密码长度不能少于 6 位');
  }
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('用户不存在');

  const derived = crypto.scryptSync(oldPassword, user.salt, 64).toString('hex');
  const derivedBuf = Buffer.from(derived, 'hex');
  const hashBuf = Buffer.from(user.passwordHash, 'hex');
  if (derivedBuf.length !== hashBuf.length || !crypto.timingSafeEqual(derivedBuf, hashBuf)) {
    throw new Error('旧密码不正确');
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  user.passwordHash = crypto.scryptSync(newPassword, newSalt, 64).toString('hex');
  user.salt = newSalt;
  user.updatedAt = Date.now();

  saveUsers(users);
  return true;
}

export function createPasswordResetToken(identity) {
  const clean = String(identity || '').trim().toLowerCase();
  if (!clean) {
    throw new Error('请输入用户名或注册邮箱');
  }

  const users = loadUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === clean || (u.email && u.email.toLowerCase() === clean)
  );

  if (!user) {
    throw new Error('未找到该用户名或注册邮箱对应的账号');
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 分钟有效

  user.resetToken = resetToken;
  user.resetTokenExpires = resetTokenExpires;
  user.resetTokenCreatedAt = Date.now();
  saveUsers(users);

  const resolvedEmail = user.email || (user.username.includes('@') ? user.username : '');

  return {
    user: {
      id: user.id,
      username: user.username,
      email: resolvedEmail,
      hasEmail: Boolean(resolvedEmail),
      role: user.role,
      roleType: user.roleType || 'teacher'
    },
    token: resetToken,
    expiresAt: resetTokenExpires
  };
}

export function verifyPasswordResetToken(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || cleanToken.length < 16) {
    return { valid: false, error: '重置链接无效，请重新发起' };
  }

  const users = loadUsers();
  const user = users.find((u) => u.resetToken === cleanToken);

  if (!user) {
    return { valid: false, error: '重置链接无效或已被使用' };
  }

  if (!user.resetTokenExpires || Date.now() > user.resetTokenExpires) {
    return { valid: false, error: '重置链接已过期（时效15分钟），请重新申请' };
  }

  return {
    valid: true,
    user: {
      id: user.id,
      username: user.username
    }
  };
}

export function resetPasswordWithToken(token, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('新密码长度不能少于 6 位');
  }

  const cleanToken = String(token || '').trim();
  const users = loadUsers();
  const user = users.find((u) => u.resetToken === cleanToken);

  if (!user) {
    throw new Error('重置链接无效或已被使用');
  }

  if (!user.resetTokenExpires || Date.now() > user.resetTokenExpires) {
    throw new Error('重置链接已过期（时效15分钟），请重新申请');
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  user.passwordHash = crypto.scryptSync(newPassword, newSalt, 64).toString('hex');
  user.salt = newSalt;
  delete user.resetToken;
  delete user.resetTokenExpires;
  delete user.resetTokenCreatedAt;
  user.updatedAt = Date.now();

  saveUsers(users);

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    roleType: user.roleType || 'teacher'
  };
}

export function getUserSyncData(userId) {
  const papers = readJsonFile(getUserFilePath(userId, 'papers.json'), []);
  const submissions = readJsonFile(getUserFilePath(userId, 'submissions.json'), []);
  const notebook = readJsonFile(getUserFilePath(userId, 'notebook.json'), { items: [] });
  const subjects = readJsonFile(getUserFilePath(userId, 'subjects.json'), []);
  const examSessions = readJsonFile(getUserFilePath(userId, 'exam_sessions.json'), {});
  return {
    papers,
    submissions,
    notebook,
    subjects,
    examSessions
  };
}

export function getUserExamSessions(userId) {
  const filePath = getUserFilePath(userId, 'exam_sessions.json');
  return readJsonFile(filePath, {});
}

export function getUserExamSession(userId, paperId) {
  if (!paperId) return null;
  const sessions = getUserExamSessions(userId);
  return sessions[paperId] || null;
}

export function saveUserExamSession(userId, session) {
  if (!session || !session.paperId) throw new Error('无效的考试进度数据');
  const filePath = getUserFilePath(userId, 'exam_sessions.json');
  const sessions = readJsonFile(filePath, {});
  const existing = sessions[session.paperId];
  const now = Date.now();

  // A reset is an operation, not a permanent session mode. The client sends a
  // monotonically newer resetVersion; after accepting it we keep the version
  // but never persist the legacy isReset flag.
  const requestedResetVersion = Number(
    session.resetVersion || (session.isReset ? session.updatedAt : 0)
  ) || 0;
  const existingResetVersion = Number(existing?.resetVersion) || 0;
  const appliesReset = requestedResetVersion > existingResetVersion;

  let finalAnswers = session.answers;
  // 服务端智能防空与题目防丢保护：
  // 1. 若云端已有且非明确重置考卷操作，绝不允许空白答案抹杀已填涂答案！
  // 2. 绝不允许由于客户端上报部分切片而截断云端已有的全卷题目骨架！
  if (existing && Array.isArray(existing.answers) && Array.isArray(session.answers) && !appliesReset) {
    const baseList = existing.answers.length >= session.answers.length
      ? existing.answers
      : session.answers;

    const sessionMap = new Map();
    session.answers.forEach((q, idx) => {
      if (!q) return;
      if (q.id) sessionMap.set(String(q.id), q);
      if (q.num !== undefined && q.num !== null && String(q.num).trim() !== '') {
        const rawNum = String(q.num).trim();
        const numVal = Number.parseInt(rawNum.replace(/\D/g, ''), 10);
        sessionMap.set(`num_${rawNum}`, q);
        if (Number.isFinite(numVal) && numVal > 0) {
          sessionMap.set(`num_${numVal}`, q);
          sessionMap.set(`num_${String(numVal).padStart(2, '0')}`, q);
        }
      }
      if (session.answers.length === baseList.length) {
        sessionMap.set(`idx_${idx}`, q);
      }
    });

    finalAnswers = baseList.map((baseQ, idx) => {
      let newQ = null;
      if (baseQ.id && sessionMap.has(String(baseQ.id))) newQ = sessionMap.get(String(baseQ.id));
      if (!newQ && baseQ.num !== undefined && baseQ.num !== null && String(baseQ.num).trim() !== '') {
        const rawNum = String(baseQ.num).trim();
        const numVal = Number.parseInt(rawNum.replace(/\D/g, ''), 10);
        newQ = sessionMap.get(`num_${rawNum}`)
          || (Number.isFinite(numVal) ? (sessionMap.get(`num_${numVal}`) || sessionMap.get(`num_${String(numVal).padStart(2, '0')}`)) : null);
      }
      if (!newQ && session.answers.length === baseList.length) {
        newQ = sessionMap.get(`idx_${idx}`);
      }

      const oldQ = baseQ;
      const newAns = (newQ?.userAnswer || '').trim();
      const oldAns = (oldQ?.userAnswer || '').trim();

      // 若客户端由于切片未上报该题，完整保留云端已有的原题与作答
      if (!newQ) {
        return oldQ;
      }

      const newQExplicitTime = Number(newQ?.updatedAt) || 0;
      const newQTime = newQExplicitTime > 0
        ? newQExplicitTime
        : (newAns ? (Number(session.updatedAt) || now) : 0);

      const oldQExplicitTime = Number(oldQ?.updatedAt) || 0;
      const oldQTime = oldQExplicitTime > 0
        ? oldQExplicitTime
        : (oldAns ? (Number(existing.updatedAt) || 0) : 0);

      // 1. 客户端有作答，云端为空白 -> 采纳客户端
      if (newAns && !oldAns) {
        return {
          ...baseQ,
          userAnswer: newAns,
          aiTranscription: newQ?.aiTranscription || '',
          stepScores: Array.isArray(newQ?.stepScores) ? newQ.stepScores : [],
          status: 'answered',
          updatedAt: newQTime || now
        };
      }

      // 2. 客户端为空白，云端已有作答：
      if (!newAns && oldAns) {
        // 核心铁律：只有客户端明确带有更新的显式题级修改时间戳（用户在此题上主动点击清空/删除），才采纳清空
        if (newQExplicitTime > 0 && newQExplicitTime > oldQTime) {
          return {
            ...baseQ,
            userAnswer: '',
            aiTranscription: '',
            stepScores: [],
            status: 'unanswered',
            updatedAt: newQExplicitTime
          };
        }
        // 否则（例如另一端初次进考场、心跳未填涂、初始模板空白），绝不允许冲毁云端已有答卷！
        return {
          ...baseQ,
          userAnswer: oldAns,
          aiTranscription: oldQ?.aiTranscription || '',
          stepScores: oldQ?.stepScores || [],
          status: 'answered',
          updatedAt: oldQTime
        };
      }

      // 3. 双方皆有作答：时间戳较新者胜出
      if (newAns && oldAns) {
        if (newQTime >= oldQTime) {
          return {
            ...baseQ,
            userAnswer: newAns,
            aiTranscription: newQ?.aiTranscription || '',
            stepScores: (Array.isArray(newQ?.stepScores) && newQ.stepScores.length > 0)
              ? newQ.stepScores
              : (oldQ?.stepScores || []),
            status: 'answered',
            updatedAt: newQTime
          };
        }
        return {
          ...baseQ,
          userAnswer: oldAns,
          aiTranscription: oldQ?.aiTranscription || '',
          stepScores: oldQ?.stepScores || [],
          status: 'answered',
          updatedAt: oldQTime
        };
      }

      // 4. 双方皆为空白
      return {
        ...baseQ,
        userAnswer: '',
        aiTranscription: '',
        stepScores: [],
        status: 'unanswered',
        updatedAt: Math.max(newQExplicitTime, oldQExplicitTime)
      };
    });
  }

  const {
    isReset: _legacyIsReset,
    statusOperation,
    ...sessionWithoutLegacyReset
  } = session;
  const normalized = {
    ...sessionWithoutLegacyReset,
    answers: finalAnswers,
    resetVersion: Math.max(existingResetVersion, requestedResetVersion),
    updatedAt: now
  };

  // 封卷状态权威单向不可逆（Irreversible Seal Priority）：
  // 只要云端已有状态为已封卷，或者本次客户端提交为已封卷，只要没有显式 unseal 或重置，状态锁定为 '已封卷'
  const isTargetSealed = (session.status === '已封卷' || existing?.status === '已封卷')
    && !appliesReset
    && statusOperation !== 'unseal';

  if (isTargetSealed) {
    normalized.status = '已封卷';
    normalized.sealedAt = session.sealedAt || existing?.sealedAt || new Date().toISOString();
  }

  // A late request from another device must not reopen or mutate a sealed
  // attempt. Reopening is only permitted through the explicit action.
  const keepExistingSeal = Boolean(
    existing?.status === '已封卷'
    && !appliesReset
    && statusOperation !== 'unseal'
  );
  if (keepExistingSeal) {
    normalized.answers = existing.answers;
    normalized.markedQuestionKeys = existing.markedQuestionKeys;
    normalized.secondsLeft = existing.secondsLeft;
    normalized.currentQIndex = existing.currentQIndex;
    normalized.status = existing.status;
    normalized.sealedAt = existing.sealedAt;
  }
  sessions[session.paperId] = normalized;
  atomicWriteJson(filePath, sessions);

  // 联动更新 papers.json 中该试卷的封卷状态与倒计时快照，确保跨端列表大厅即时感知
  if (isTargetSealed) {
    try {
      const papersFilePath = getUserFilePath(userId, 'papers.json');
      const userPapers = readJsonFile(papersFilePath, []);
      if (Array.isArray(userPapers)) {
        let paperChanged = false;
        const nextPapers = userPapers.map((p) => {
          if (p.id === session.paperId && p.status !== '已封卷') {
            paperChanged = true;
            return {
              ...p,
              status: '已封卷',
              sealedAt: normalized.sealedAt,
              secondsLeft: normalized.secondsLeft,
              updatedAt: now
            };
          }
          return p;
        });
        if (paperChanged) {
          atomicWriteJson(papersFilePath, nextPapers);
        }
      }
    } catch (e) {
      console.warn('[user-storage] Sync papers.json seal state warning:', e);
    }
  }
  return normalized;
}

export function deleteUserExamSession(userId, paperId) {
  if (!paperId) return false;
  const filePath = getUserFilePath(userId, 'exam_sessions.json');
  const sessions = readJsonFile(filePath, {});
  if (sessions[paperId]) {
    delete sessions[paperId];
    atomicWriteJson(filePath, sessions);
  }
  return true;
}

export function saveUserPaper(userId, paper) {
  if (!paper || !paper.id) throw new Error('无效的试卷数据');
  const filePath = getUserFilePath(userId, 'papers.json');
  const papers = readJsonFile(filePath, []);
  const index = papers.findIndex((p) => p.id === paper.id);
  const now = Date.now();
  const normalized = {
    ...paper,
    updatedAt: now,
    createdAt: paper.createdAt || now
  };
  if (index >= 0) {
    papers[index] = normalized;
  } else {
    papers.unshift(normalized);
  }
  atomicWriteJson(filePath, papers);
  return normalized;
}

export function deleteUserPaper(userId, paperId) {
  const filePath = getUserFilePath(userId, 'papers.json');
  const papers = readJsonFile(filePath, []);
  const nextPapers = papers.filter((p) => p.id !== paperId);
  atomicWriteJson(filePath, nextPapers);
  deleteUserExamSession(userId, paperId);
  return true;
}

export function saveUserSubmission(userId, submission) {
  if (!submission || !submission.id) throw new Error('无效的答卷数据');
  const filePath = getUserFilePath(userId, 'submissions.json');
  const submissions = readJsonFile(filePath, []);
  const index = submissions.findIndex((s) => s.id === submission.id);
  if (index >= 0) {
    submissions[index] = submission;
  } else {
    submissions.unshift(submission);
  }
  atomicWriteJson(filePath, submissions.slice(0, 300));
  return submission;
}

export function saveUserNotebook(userId, notebook) {
  const filePath = getUserFilePath(userId, 'notebook.json');
  const safeNotebook = notebook && typeof notebook === 'object' ? notebook : { items: [] };
  atomicWriteJson(filePath, safeNotebook);
  return safeNotebook;
}

export function saveUserSubjects(userId, subjects) {
  const filePath = getUserFilePath(userId, 'subjects.json');
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  atomicWriteJson(filePath, safeSubjects);
  return safeSubjects;
}

export function migrateUserLocalData(userId, { papers = [], submissions = [], notebook = { items: [] }, subjects = [] }) {
  const userPapersPath = getUserFilePath(userId, 'papers.json');
  const userSubsPath = getUserFilePath(userId, 'submissions.json');
  const userNotebookPath = getUserFilePath(userId, 'notebook.json');
  const userSubjectsPath = getUserFilePath(userId, 'subjects.json');

  // Merge papers
  const existingPapers = readJsonFile(userPapersPath, []);
  const existingPaperIds = new Set(existingPapers.map((p) => p.id));
  const newPapersToAdd = (Array.isArray(papers) ? papers : []).filter((p) => p?.id && !existingPaperIds.has(p.id));
  const mergedPapers = [...newPapersToAdd, ...existingPapers];
  atomicWriteJson(userPapersPath, mergedPapers);

  // Merge submissions
  const existingSubs = readJsonFile(userSubsPath, []);
  const existingSubIds = new Set(existingSubs.map((s) => s.id));
  const newSubsToAdd = (Array.isArray(submissions) ? submissions : []).filter((s) => s?.id && !existingSubIds.has(s.id));
  const mergedSubs = [...newSubsToAdd, ...existingSubs];
  atomicWriteJson(userSubsPath, mergedSubs);

  // Merge notebook
  const existingNotebook = readJsonFile(userNotebookPath, { items: [] });
  const existingNotebookItems = Array.isArray(existingNotebook.items) ? existingNotebook.items : [];
  const existingItemIds = new Set(existingNotebookItems.map((i) => i.id));
  const localItems = Array.isArray(notebook?.items) ? notebook.items : [];
  const newItemsToAdd = localItems.filter((i) => i?.id && !existingItemIds.has(i.id));
  const mergedNotebook = {
    ...existingNotebook,
    items: [...existingNotebookItems, ...newItemsToAdd]
  };
  atomicWriteJson(userNotebookPath, mergedNotebook);

  // Merge subjects
  const existingSubjects = readJsonFile(userSubjectsPath, []);
  const subjectSet = new Set(existingSubjects.map((s) => (typeof s === 'string' ? s : s?.name || s?.id)));
  (Array.isArray(subjects) ? subjects : []).forEach((s) => {
    const key = typeof s === 'string' ? s : s?.name || s?.id;
    if (key && !subjectSet.has(key)) {
      existingSubjects.push(s);
      subjectSet.add(key);
    }
  });
  atomicWriteJson(userSubjectsPath, existingSubjects);

  return {
    migratedPapers: newPapersToAdd.length,
    migratedSubmissions: newSubsToAdd.length,
    migratedNotebookItems: newItemsToAdd.length,
    totalPapers: mergedPapers.length
  };
}

export function getTotalUserCount() {
  return loadUsers().length;
}
