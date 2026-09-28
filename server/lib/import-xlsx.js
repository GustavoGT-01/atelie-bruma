import { prisma } from './prisma.js';

/** Atividades importáveis nesta etapa — isoladas no fluxograma. */
export const ATIVIDADES_ISOLADAS_IMPORT = [
  'TI',
  'GERENCIA',
  'DOCUMENTAÇÃO PARA TERCEIROS',
];

export function normalizeAtividadeNome(raw) {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nome canônico no banco (com acento onde o sistema usa). */
export function canonicalAtividadeIsolada(raw) {
  const n = normalizeAtividadeNome(raw);
  if (n === 'TI') return 'TI';
  if (n === 'GERENCIA') return 'GERENCIA';
  if (
    n === 'DOCUMENTACAO PARA TERCEIROS' ||
    n === 'DOCUMENTACAO P TERCEIROS' ||
    n === 'DOC PARA TERCEIROS' ||
    n === 'DOC P TERCEIROS'
  ) {
    return 'DOCUMENTAÇÃO PARA TERCEIROS';
  }
  return null;
}

export function isAtividadeIsoladaImportavel(raw) {
  return canonicalAtividadeIsolada(raw) != null;
}

export function excelDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    const utc = Math.round((v - 25569) * 86400 * 1000);
    return new Date(utc);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function cellText(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v && 'result' in v) {
    return String(v.result ?? '');
  }
  if (typeof v === 'object' && v && 'text' in v) {
    return String(v.text);
  }
  if (typeof v === 'object' && v && 'richText' in v) {
    return (v.richText || []).map((r) => r.text).join('');
  }
  return String(v).trim();
}

export function slugLogin(nome) {
  return (
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 24) || 'USER'
  );
}

export function parseDesenvolvimentoSheet(ws) {
  const rows = [];
  const max = ws.rowCount || 500;
  for (let r = 6; r <= max; r++) {
    const executor = cellText(ws.getCell(r, 2));
    const atividadeRaw = cellText(ws.getCell(r, 3));
    const produto = cellText(ws.getCell(r, 4));
    const espec = cellText(ws.getCell(r, 5));
    if (!espec && !atividadeRaw) continue;

    const atividade = canonicalAtividadeIsolada(atividadeRaw);
    const prioridadeRaw = Number(ws.getCell(r, 8).value || 3);
    const conferidaRaw = ws.getCell(r, 12).value;
    const conferida =
      conferidaRaw === true ||
      conferidaRaw === 1 ||
      String(conferidaRaw).toLowerCase() === 'true';

    rows.push({
      row: r,
      executor,
      atividadeRaw,
      atividade,
      produto,
      especificacao: espec || atividadeRaw || 'Sem especificação',
      observacoes: cellText(ws.getCell(r, 7)) || '',
      prioridade: Number.isFinite(prioridadeRaw) ? prioridadeRaw : 3,
      dataSolicitacao: excelDate(ws.getCell(r, 6).value),
      dataConclusao: excelDate(ws.getCell(r, 9).value),
      conferida,
      inScope: atividade != null,
    });
  }
  return rows;
}

/** Garante tipo ativo sem criar/alterar sucessores do diagrama. */
export async function ensureTipoIsolado(nome) {
  const existing = await prisma.tipoAtividade.findUnique({
    where: { nome },
  });
  if (existing) {
    if (!existing.ativo) {
      return prisma.tipoAtividade.update({
        where: { id: existing.id },
        data: { ativo: true },
      });
    }
    return existing;
  }
  const last = await prisma.tipoAtividade.findFirst({
    orderBy: { ordemPadrao: 'desc' },
    select: { ordemPadrao: true },
  });
  return prisma.tipoAtividade.create({
    data: {
      nome,
      ativo: true,
      ordemPadrao: (last?.ordemPadrao ?? 0) + 1,
      tempoEstimadoMin: 60,
      temOpcoesListagem: false,
      preRequisitos: '[]',
    },
  });
}
