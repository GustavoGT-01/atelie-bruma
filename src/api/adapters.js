/**
 * Traduz o dialeto do servidor (herdado do sistema de origem) para o formato
 * que as telas já consomem, e de volta. Status, prioridade, tempo e dependência
 * mudam de nome entre os dois lados.
 */

export const STATUS_PARA_UI = {
  PENDENTE_APROVACAO: 'Aguardando aprovação',
  REJEITADA: 'Rejeitada',
  AGUARDANDO: 'Aguardando',
  PENDENTE: 'Aguardando',
  LIBERADA: 'Liberada',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADO: 'Pausado',
  CONCLUIDA: 'Concluída',
};

export const STATUS_PARA_API = {
  'Aguardando aprovação': 'PENDENTE_APROVACAO',
  Rejeitada: 'REJEITADA',
  Aguardando: 'AGUARDANDO',
  Liberada: 'LIBERADA',
  'Em andamento': 'EM_ANDAMENTO',
  Pausado: 'PAUSADO',
  Concluída: 'CONCLUIDA',
};

/** Todos os status: o painel mostra concluídas, a API esconde por padrão. */
export const TODOS_STATUS_API = [
  'PENDENTE_APROVACAO',
  'AGUARDANDO',
  'PENDENTE',
  'LIBERADA',
  'EM_ANDAMENTO',
  'PAUSADO',
  'CONCLUIDA',
  'REJEITADA',
];

export function statusParaUi(status) {
  return STATUS_PARA_UI[status] || status;
}

export function statusParaApi(status) {
  return STATUS_PARA_API[status] || status;
}

export function prioridadeParaUi(p) {
  if (p <= 1) return 'Alta';
  if (p === 2) return 'Média';
  return 'Baixa';
}

export function prioridadeParaApi(label) {
  if (label === 'Alta') return 1;
  if (label === 'Média') return 2;
  return 3;
}

export function minutosDeTempoEstimado(texto) {
  const numero = String(texto || '').match(/\d+/);
  return numero ? Number(numero[0]) : 0;
}

function dataBR(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

/** Data `dd/mm/aaaa` da tela para `aaaa-mm-dd` do input date da origem. */
export function dataParaApi(texto) {
  const casado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto || '').trim());
  if (!casado) return null;
  return `${casado[3]}-${casado[2]}-${casado[1]}`;
}

function horaCurta(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

/** Mesma conta de `tempoEfetivoSegundos` do servidor, para o cronômetro abrir certo. */
function tempoApontado(apontamentos) {
  const agora = Date.now();
  let total = 0;
  for (const a of apontamentos || []) {
    if (a.dataHoraFim) total += a.tempoTotalSegundos || 0;
    else if (a.ativo) {
      total += Math.floor((agora - new Date(a.dataHoraInicio).getTime()) / 1000);
    }
  }
  return total;
}

function historicoParadas(apontamentos) {
  return (apontamentos || [])
    .filter((a) => a.motivoParada)
    .slice()
    .sort((a, b) => new Date(a.dataHoraInicio) - new Date(b.dataHoraInicio))
    .map((a) => ({ motivo: a.motivoParada, horario: horaCurta(a.dataHoraFim || a.dataHoraInicio) }));
}

function motivoAtual(demanda) {
  if (demanda.status !== 'PAUSADO') return null;
  const paradas = (demanda.apontamentos || []).filter((a) => a.motivoParada);
  return paradas[0]?.motivoParada || null;
}

/** Código da demanda que ainda precisa concluir antes desta. */
function aguardaCodigo(demanda) {
  const pendente = (demanda.depsComoDestino || []).find(
    (dep) => dep.origem && dep.origem.status !== 'CONCLUIDA'
  );
  return pendente?.origem?.codigo || null;
}

/** Demanda do servidor no formato das telas. `id` continua sendo o código DEM-. */
export function demandaParaUi(demanda) {
  return {
    id: demanda.codigo,
    serverId: demanda.id,
    atividade: demanda.tipoAtividade?.nome || '',
    produto: demanda.produto?.nome || '',
    modulacao: demanda.modulacao?.nome || '',
    especificacao: demanda.especificacao || '',
    executor: demanda.executor?.nome || '',
    prioridade: prioridadeParaUi(demanda.prioridade),
    solicitacao: dataBR(demanda.dataSolicitacao),
    status: statusParaUi(demanda.status),
    tempoEstimado: `${demanda.tempoEstimadoMin} min`,
    tempoEmAtividadeSegundos: tempoApontado(demanda.apontamentos),
    motivoPausa: motivoAtual(demanda),
    historicoParadas: historicoParadas(demanda.apontamentos),
    observacoes: demanda.observacoes || '',
    aguardaId: aguardaCodigo(demanda),
    subprocessos: (demanda.opcoes || []).map((o) => o.opcaoId),
    progressoPct: demanda.progressoPct,
    conferida: demanda.conferida,
  };
}

export function demandasParaUi(lista) {
  return (lista || []).map(demandaParaUi);
}
