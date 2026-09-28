import { get, post, ApiError } from './client.js';

export function entrar(login, senha) {
  return post('/auth/login', { login, senha });
}

export function sair() {
  return post('/auth/logout');
}

/** Devolve null quando não há sessão, em vez de lançar 401. */
export async function lerSessao() {
  try {
    return await get('/auth/sessao');
  } catch (erro) {
    if (erro instanceof ApiError && erro.status === 401) return null;
    throw erro;
  }
}
