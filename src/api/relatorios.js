import { baixarArquivo, enviarArquivo, get, post, remover } from './client.js';

function salvar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

/** Prévia: o servidor lê a aba Desenvolvimento e devolve as linhas no escopo. */
export async function lerPlanilha(arquivo) {
  const previa = await enviarArquivo('/import/xlsx', arquivo, 'PUT');
  return {
    aceitas: previa.linhas || [],
    ignoradas: previa.foraEscopo || 0,
    cortou: false,
  };
}

export function importarPlanilha(arquivo) {
  return enviarArquivo('/import/xlsx', arquivo, 'POST');
}

export async function baixarPlanilha() {
  const { blob, nome } = await baixarArquivo(
    '/export/xlsx',
    'DEMANDA_DESENVOLVIMENTO_export.xlsx'
  );
  salvar(blob, nome);
}

export function listarBackups() {
  return get('/backups');
}

export function criarBackup() {
  return post('/backups');
}

export function restaurarBackup(id) {
  return post(`/backups/${id}/restaurar`);
}

export function excluirBackup(id) {
  return remover(`/backups/${id}`);
}
