const BASE = '/api';

export class ApiError extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function ler(resposta) {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

async function pedir(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    credentials: 'include',
    ...opcoes,
  });
  const corpo = await ler(resposta);
  if (!resposta.ok) {
    const mensagem =
      (corpo && typeof corpo === 'object' && corpo.error) ||
      (typeof corpo === 'string' && corpo) ||
      'Falha na comunicação com o servidor.';
    throw new ApiError(mensagem, resposta.status);
  }
  return corpo;
}

export function get(caminho) {
  return pedir(caminho);
}

export function post(caminho, corpo) {
  return pedir(caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  });
}

export function patch(caminho, corpo) {
  return pedir(caminho, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  });
}

export function put(caminho, corpo) {
  return pedir(caminho, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  });
}

export function remover(caminho) {
  return pedir(caminho, { method: 'DELETE' });
}

/** Upload multipart. `metodo` distingue prévia (PUT) de importação (POST). */
export function enviarArquivo(caminho, arquivo, metodo = 'POST') {
  const dados = new FormData();
  dados.append('file', arquivo);
  return pedir(caminho, { method: metodo, body: dados });
}

/** Download binário: devolve o Blob e o nome sugerido pelo servidor. */
export async function baixarArquivo(caminho, nomePadrao) {
  const resposta = await fetch(`${BASE}${caminho}`, { credentials: 'include' });
  if (!resposta.ok) {
    const corpo = await ler(resposta);
    const mensagem =
      (corpo && typeof corpo === 'object' && corpo.error) ||
      'Falha ao gerar o arquivo.';
    throw new ApiError(mensagem, resposta.status);
  }
  const disposicao = resposta.headers.get('Content-Disposition') || '';
  const casado = /filename="?([^";]+)"?/.exec(disposicao);
  return { blob: await resposta.blob(), nome: casado?.[1] || nomePadrao };
}
