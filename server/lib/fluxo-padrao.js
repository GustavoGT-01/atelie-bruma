/** Fluxo padrao da cadeia produtiva — defaults de fabrica + snapshot no banco. */

export const TIPOS_CADEIA = [
  '3D ESTRUTURAL',
  'RECORTES',
  'LISTAGEM',
  'MODELAGEM',
  'ENCAIXE',
  'CADASTRO',
  'CONFERENCIA',
  'TABELA',
  'FICHA TECNICA',
];

/**
 * Sucessores diretos (fabrica).
 * CADASTRO nao entra como sucessor de LISTAGEM/3D — so pelo gate de pre-requisitos.
 */
export const LINKS_FLUXO = [
  ['3D ESTRUTURAL', ['RECORTES', 'LISTAGEM', 'MODELAGEM']],
  ['MODELAGEM', ['ENCAIXE']],
  ['CADASTRO', ['CONFERENCIA']],
  ['CONFERENCIA', ['TABELA']],
  ['TABELA', ['FICHA TECNICA']],
];

/** Pre-requisitos AND (fabrica). */
export const PRE_REQUISITOS_PADRAO = {
  CADASTRO: ['RECORTES', 'ENCAIXE', 'LISTAGEM'],
};

/** Cores padrao por atividade (KPIs / diagrama / fila). */
export const CORES_PADRAO = {
  '3D ESTRUTURAL': '#3B82F6',
  RECORTES: '#F59E0B',
  LISTAGEM: '#10B981',
  MODELAGEM: '#8B5CF6',
  ENCAIXE: '#EC4899',
  CADASTRO: '#06B6D4',
  CONFERENCIA: '#F97316',
  TABELA: '#84CC16',
  'FICHA TECNICA': '#EAB308',
};

export const COR_ATIVIDADE_FALLBACK = '#A3A3A3';

export function corAtividade(nomeOuCor, corCampo) {
  if (corCampo && /^#[0-9A-Fa-f]{6}$/.test(corCampo)) return corCampo;
  if (nomeOuCor && /^#[0-9A-Fa-f]{6}$/.test(nomeOuCor)) return nomeOuCor;
  const nome = (nomeOuCor || '').toUpperCase().trim();
  return CORES_PADRAO[nome] || COR_ATIVIDADE_FALLBACK;
}

/** Normaliza input de cor (#RGB / #RRGGBB / rgb) para #RRGGBB. */
export function normalizeCorHex(raw, fallback = COR_ATIVIDADE_FALLBACK) {
  const s = String(raw || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`.toUpperCase();
  return fallback;
}

export function snapshotFabrica() {
  return {
    links: LINKS_FLUXO.map(([o, ds]) => [o, [...ds]]),
    preRequisitos: { ...PRE_REQUISITOS_PADRAO },
  };
}

export function parseFluxoPadraoJson(raw) {
  if (!raw || !String(raw).trim()) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const linksRaw = Array.isArray(obj.links) ? obj.links : [];
    const links = [];
    for (const row of linksRaw) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const origem = String(row[0] || '')
        .toUpperCase()
        .trim();
      const destinos = Array.isArray(row[1])
        ? row[1].map((d) => String(d || '').toUpperCase().trim()).filter(Boolean)
        : [];
      if (origem) links.push([origem, destinos]);
    }
    const pre = {};
    const preObj =
      obj.preRequisitos && typeof obj.preRequisitos === 'object'
        ? obj.preRequisitos
        : {};
    for (const [k, v] of Object.entries(preObj)) {
      const nome = String(k).toUpperCase().trim();
      if (!nome) continue;
      pre[nome] = Array.isArray(v)
        ? v.map((x) => String(x).toUpperCase().trim()).filter(Boolean)
        : [];
    }
    return {
      links,
      preRequisitos: pre,
      atualizadoEm: obj.atualizadoEm ? String(obj.atualizadoEm) : undefined,
    };
  } catch {
    return null;
  }
}

export function serializeFluxoPadrao(snap) {
  return JSON.stringify({
    links: snap.links,
    preRequisitos: snap.preRequisitos,
    atualizadoEm: snap.atualizadoEm || new Date().toISOString(),
  });
}
