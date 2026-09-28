export function isAdmin(papel) {
  return papel === 'ADMIN';
}

/**
 * UI de admin efetiva. Papel ADMIN + modo EXECUTOR → comporta como executor na tela.
 * APIs sensiveis continuam checando isAdmin(papel) real.
 */
export function isAdminUi(papel, modoUi) {
  if (!isAdmin(papel)) return false;
  return modoUi !== 'EXECUTOR';
}

/**
 * TI / GERENCIA: visiveis so para usuarios ligados ao tipo (UsuarioTipoAtividade),
 * nao pelo executor da planilha.
 */
export const ATIVIDADES_VISIBILIDADE_POR_TIPO = ['TI', 'GERENCIA'];

/** Demandas ligadas ao usuario (executor, criador, etapa ou tipo TI/GERENCIA). */
export function demandaDoUsuarioWhere(userId) {
  return {
    OR: [
      {
        AND: [
          {
            OR: [
              { executorId: userId },
              { criadoPorId: userId },
              { executoresPorEtapa: { contains: userId } },
            ],
          },
          {
            OR: [
              { tipoAtividadeId: null },
              {
                tipoAtividade: {
                  nome: { notIn: [...ATIVIDADES_VISIBILIDADE_POR_TIPO] },
                },
              },
            ],
          },
        ],
      },
      {
        tipoAtividade: {
          nome: { in: [...ATIVIDADES_VISIBILIDADE_POR_TIPO] },
          colaboradores: { some: { usuarioId: userId } },
        },
      },
    ],
  };
}

/** Fila/cronograma/painel (nao-admin): o que o usuario deve executar. */
export function demandaParaExecutarWhere(userId) {
  return {
    OR: [
      {
        AND: [
          { executorId: userId },
          {
            OR: [
              { tipoAtividadeId: null },
              {
                tipoAtividade: {
                  nome: { notIn: [...ATIVIDADES_VISIBILIDADE_POR_TIPO] },
                },
              },
            ],
          },
        ],
      },
      {
        tipoAtividade: {
          nome: { in: [...ATIVIDADES_VISIBILIDADE_POR_TIPO] },
          colaboradores: { some: { usuarioId: userId } },
        },
      },
    ],
  };
}

export const STATUS_PENDENTE_APROVACAO = 'PENDENTE_APROVACAO';
export const STATUS_REJEITADA = 'REJEITADA';
