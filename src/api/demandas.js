import { get, post, patch, remover } from './client.js';
import {
  dataParaApi,
  demandasParaUi,
  minutosDeTempoEstimado,
  prioridadeParaApi,
  statusParaApi,
  TODOS_STATUS_API,
} from './adapters.js';

/**
 * A API esconde concluídas e rejeitadas quando não recebe status.
 * O painel mostra o lote inteiro, então pedimos todos explicitamente.
 */
export async function listarDemandas() {
  const lista = await get(`/demandas?status=${TODOS_STATUS_API.join(',')}`);
  return demandasParaUi(lista);
}

function indicePorNome(lista) {
  return new Map((lista || []).map((item) => [item.nome, item.id]));
}

/**
 * O modal monta um pai por modulação seguido das filhas de cada etapa marcada.
 * O servidor cria a árvore sozinho a partir de `etapasSelecionadas`, respeitando
 * o diagrama e o gate do CADASTRO, então enviamos só o pai com as etapas.
 */
function agruparPorRaiz(lista) {
  const grupos = [];
  for (const demanda of lista) {
    if (!demanda.aguardaId) {
      grupos.push({ raiz: demanda, etapas: [] });
      continue;
    }
    if (!grupos.length) continue;
    grupos[grupos.length - 1].etapas.push(demanda);
  }
  return grupos;
}

export async function criarDemandas(lista, catalog) {
  const tipos = indicePorNome(catalog.atividades);
  const pessoas = indicePorNome(catalog.colaboradores);
  const criadas = [];

  for (const { raiz, etapas } of agruparPorRaiz(lista)) {
    const executoresPorEtapa = {};
    for (const etapa of etapas) {
      const executorId = pessoas.get(etapa.executor);
      if (executorId) executoresPorEtapa[etapa.atividade] = executorId;
    }

    const criada = await post('/demandas', {
      especificacao: raiz.especificacao,
      observacoes: raiz.observacoes || '',
      prioridade: prioridadeParaApi(raiz.prioridade),
      status: statusParaApi(raiz.status),
      tempoEstimadoMin: minutosDeTempoEstimado(raiz.tempoEstimado),
      dataSolicitacao: dataParaApi(raiz.solicitacao),
      tipoAtividadeId: tipos.get(raiz.atividade) || null,
      executorId: pessoas.get(raiz.executor) || null,
      produtoNome: raiz.produto,
      modulacaoNome: raiz.modulacao,
      opcaoIds: raiz.subprocessos || [],
      etapasSelecionadas: etapas.map((etapa) => etapa.atividade),
      executoresPorEtapa,
    });
    criadas.push(criada);
  }

  return criadas;
}

export function iniciarDemanda(serverId) {
  return post(`/demandas/${serverId}/acao`, { action: 'iniciar' });
}

export function pausarDemanda(serverId, motivo) {
  return post(`/demandas/${serverId}/acao`, { action: 'pausar', motivo });
}

export function finalizarDemanda(serverId) {
  return post(`/demandas/${serverId}/acao`, { action: 'finalizar' });
}

export function zerarTempoDemanda(serverId) {
  return post(`/demandas/${serverId}/acao`, { action: 'zerar' });
}

export function atualizarDemandasLote(updates) {
  return patch('/demandas/lote', { updates });
}

export function excluirDemanda(serverId) {
  return remover(`/demandas/${serverId}`);
}

export function lerPainel() {
  return get('/painel');
}
