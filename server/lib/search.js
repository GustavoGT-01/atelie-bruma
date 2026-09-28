/** Builds Prisma OR filters so search matches any demand field shown in the UI. */
export function demandaSearchWhere(q) {
  const term = q.trim();
  if (!term) return undefined;

  const upper = term.toUpperCase();
  const statusMap = {
    AGUARDANDO: 'AGUARDANDO',
    AGUARDAR: 'AGUARDANDO',
    PENDENTE: 'AGUARDANDO',
    LIBERADA: 'LIBERADA',
    'EM ANDAMENTO': 'EM_ANDAMENTO',
    EM_ANDAMENTO: 'EM_ANDAMENTO',
    PAUSADO: 'PAUSADO',
    CONCLUIDA: 'CONCLUIDA',
    CONCLUÍDA: 'CONCLUIDA',
  };

  const prioridadeMap = {
    ALTA: 1,
    MEDIA: 2,
    MÉDIA: 2,
    BAIXA: 3,
  };

  const or = [
    { codigo: { contains: term } },
    { especificacao: { contains: term } },
    { observacoes: { contains: term } },
    { status: { contains: term } },
    { executor: { nome: { contains: term } } },
    { executor: { login: { contains: term } } },
    { produto: { nome: { contains: term } } },
    { modulacao: { nome: { contains: term } } },
    { tipoAtividade: { nome: { contains: term } } },
  ];

  // Also try uppercase for product/activity names stored in caps
  if (upper !== term) {
    or.push(
      { codigo: { contains: upper } },
      { especificacao: { contains: upper } },
      { produto: { nome: { contains: upper } } },
      { modulacao: { nome: { contains: upper } } },
      { tipoAtividade: { nome: { contains: upper } } },
      { executor: { nome: { contains: upper } } }
    );
  }

  const statusKey = Object.keys(statusMap).find(
    (k) => k === upper || statusMap[k] === upper
  );
  if (statusKey) {
    or.push({ status: statusMap[statusKey] });
  }

  const prioKey = Object.keys(prioridadeMap).find((k) => k === upper);
  if (prioKey) {
    or.push({ prioridade: prioridadeMap[prioKey] });
  }

  // Numeric priority or DEM code fragment
  if (/^\d+$/.test(term)) {
    or.push({ prioridade: Number(term) });
  }

  return { OR: or };
}
