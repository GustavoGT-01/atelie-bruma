import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

const COOKIE = 'gd_session';
const MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 7;

export function assertAuthSecret() {
  if (process.env.NODE_ENV === 'production' && !String(process.env.AUTH_SECRET || '').trim()) {
    throw new Error('AUTH_SECRET obrigatório em produção');
  }
}

const secret = () => {
  assertAuthSecret();
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || 'controle-desenvolvimento-lan-secret'
  );
};

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(res, user) {
  const token = await new SignJWT({
    id: user.id,
    nome: user.nome,
    login: user.login,
    papel: user.papel,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret());

  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SEGUNDOS * 1000,
  });
}

export function destroySession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export async function getSession(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

export async function login(res, loginName, senha) {
  const loginNorm = String(loginName || '')
    .trim()
    .toUpperCase();
  if (!loginNorm) return null;
  const user = await prisma.usuario.findUnique({ where: { login: loginNorm } });
  if (!user || !user.ativo) return null;
  const ok = await verifyPassword(senha, user.senhaHash);
  if (!ok) return null;
  await createSession(res, user);
  return user;
}

/** Popula req.session; 401 quando nao ha cookie valido. */
export async function sessionMiddleware(req, res, next) {
  req.session = await getSession(req);
  next();
}

export function requireSession(req, res, next) {
  if (!req.session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/** Somente papel ADMIN. A mensagem muda conforme a rota, como na origem. */
export function requireAdmin(mensagem) {
  return (req, res, next) => {
    if (!req.session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.session.papel !== 'ADMIN') {
      res.status(403).json({ error: mensagem });
      return;
    }
    next();
  };
}

/** Bloqueia apenas EXECUTOR (admin e planejamento passam). */
export function requireEditor(mensagem = 'Sem permissão') {
  return (req, res, next) => {
    if (!req.session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.session.papel === 'EXECUTOR') {
      res.status(403).json({ error: mensagem });
      return;
    }
    next();
  };
}
