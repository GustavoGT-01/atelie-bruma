import { TIPOS_CADEIA } from './fluxo-padrao.js';

const STATUS_TRABALHAVEL = new Set(['LIBERADA', 'EM_ANDAMENTO', 'PAUSADO']);
const STATUS_INICIADO = new Set(['EM_ANDAMENTO', 'PAUSADO']);

const ORDEM_CADEIA = new Map(TIPOS_CADEIA.map((nome, i) => [nome, i]));

function produtoKey(d) {
  return d.produto?.id || `__sem__:${d.id}`;
}

function produtoNomeOf(d) {
  return d.produto?.nome || 'Sem produto';
}

function tsSolicitacao(d) {
  if (!d.dataSolicitacao) return Number.MAX_SAFE_INTEGER;
  const t = new Date(d.dataSolicitacao).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

function ordemTipo(d) {
  const op = d.tipoAtividade?.ordemPadrao;
  if (typeof op === 'number' && Number.isFinite(op)) return op;
  const nome = (d.tipoAtividade?.nome || '').toUpperCase().trim();
  if (ORDEM_CADEIA.has(nome)) return ORDEM_CADEIA.get(nome);
  return 999;
}

/** Dentro do produto: tipo → modulação A–Z → codigo DEM. */
export function compararDentroProduto(a, b) {
  const ta = ordemTipo(a) - ordemTipo(b);
  if (ta !== 0) return ta;
  const ma = (a.modulacao?.nome || '').localeCompare(b.modulacao?.nome || '', 'pt-BR', {
    sensitivity: 'base',
  });
  if (ma !== 0) return ma;
  return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true });
}

export function produtoIncompleto(demandas, produtoId) {
  return demandas.some(
    (d) => produtoKey(d) === produtoId && STATUS_TRABALHAVEL.has(d.status)
  );
}

/** Prioridade do produto = menor prioridade entre itens; empate = data mais antiga. */
function scoreProduto(itens) {
  let prioridade = Number.MAX_SAFE_INTEGER;
  let data = Number.MAX_SAFE_INTEGER;
  for (const d of itens) {
    prioridade = Math.min(prioridade, d.prioridade ?? 99);
    data = Math.min(data, tsSolicitacao(d));
  }
  return { prioridade, data };
}

function produtosComItens(demandas) {
  const map = new Map();
  for (const d of demandas) {
    const k = produtoKey(d);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(d);
  }
  return map;
}

/**
 * Produto em foco:
 * 1) fixado (se ainda incompleto)
 * 2) preferido (ex. acabou de finalizar neste produto) se ainda incompleto
 * 3) com EM_ANDAMENTO/PAUSADO
 * 4) senao menor prioridade entre restantes
 */
export function escolherProdutoFoco(demandas, produtoFixadoId, produtoPreferidoId) {
  const porProduto = produtosComItens(demandas);
  if (!porProduto.size) return null;

  if (produtoFixadoId && produtoIncompleto(demandas, produtoFixadoId)) {
    return produtoFixadoId;
  }

  if (produtoPreferidoId && produtoIncompleto(demandas, produtoPreferidoId)) {
    return produtoPreferidoId;
  }

  const iniciados = [];
  for (const [pid, itens] of porProduto) {
    if (itens.some((d) => STATUS_INICIADO.has(d.status))) {
      iniciados.push(pid);
    }
  }

  const candidatos = iniciados.length ? iniciados : [...porProduto.keys()];

  candidatos.sort((a, b) => {
    const sa = scoreProduto(porProduto.get(a));
    const sb = scoreProduto(porProduto.get(b));
    if (sa.prioridade !== sb.prioridade) return sa.prioridade - sb.prioridade;
    if (sa.data !== sb.data) return sa.data - sb.data;
    return a.localeCompare(b);
  });

  return candidatos[0] || null;
}

export function ordenarFilaPainel(demandas, produtoFixadoId, produtoPreferidoId) {
  const trabalhaveis = demandas.filter((d) => STATUS_TRABALHAVEL.has(d.status));
  const porProduto = produtosComItens(trabalhaveis);
  const produtoFocoId = escolherProdutoFoco(
    trabalhaveis,
    produtoFixadoId,
    produtoPreferidoId
  );

  const idsProdutoOrdem = [];
  if (produtoFocoId) idsProdutoOrdem.push(produtoFocoId);

  const restantes = [...porProduto.keys()].filter((k) => k !== produtoFocoId);
  restantes.sort((a, b) => {
    const sa = scoreProduto(porProduto.get(a));
    const sb = scoreProduto(porProduto.get(b));
    if (sa.prioridade !== sb.prioridade) return sa.prioridade - sb.prioridade;
    if (sa.data !== sb.data) return sa.data - sb.data;
    return (porProduto.get(a)[0]?.produto?.nome || a).localeCompare(
      porProduto.get(b)[0]?.produto?.nome || b,
      'pt-BR'
    );
  });
  idsProdutoOrdem.push(...restantes);

  const gruposPorProduto = [];
  const ordenadas = [];

  for (const pid of idsProdutoOrdem) {
    const itens = [...(porProduto.get(pid) || [])].sort(compararDentroProduto);
    gruposPorProduto.push({
      produtoId: pid,
      produtoNome: produtoNomeOf(itens[0]),
      demandas: itens,
    });
    ordenadas.push(...itens);
  }

  // Proxima = primeiro do produto em foco; senao primeiro da fila
  let proximaId = null;
  if (produtoFocoId) {
    const doFoco = ordenadas.filter((d) => produtoKey(d) === produtoFocoId);
    proximaId =
      doFoco.find((d) => d.status === 'EM_ANDAMENTO')?.id ||
      doFoco.find((d) => d.status === 'PAUSADO')?.id ||
      doFoco.find((d) => d.status === 'LIBERADA')?.id ||
      doFoco[0]?.id ||
      null;
  } else {
    proximaId = ordenadas[0]?.id || null;
  }

  const produtoFocoNome = produtoFocoId
    ? gruposPorProduto.find((g) => g.produtoId === produtoFocoId)?.produtoNome || null
    : null;

  return {
    ordenadas,
    produtoFocoId,
    produtoFocoNome,
    proximaId,
    gruposPorProduto,
  };
}

/** Cadeia do produto agrupada por modulacao (ordem de atividade dentro). */
export function cadeiaPorModulacao(demandasDoProduto) {
  const sorted = [...demandasDoProduto].sort(compararDentroProduto);
  const map = new Map();
  for (const d of sorted) {
    const chave = d.modulacao?.id || '__sem__';
    const titulo = d.modulacao?.nome || 'Sem modulação';
    if (!map.has(chave)) map.set(chave, { titulo, itens: [] });
    map.get(chave).itens.push(d);
  }
  return [...map.values()];
}
