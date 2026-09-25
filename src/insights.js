function minutosEstimados(texto) {
  const valor = parseInt(texto, 10);
  return Number.isFinite(valor) ? valor : 0;
}

export function gerarInsights(demands) {
  const avisos = [];

  demands.forEach((demanda) => {
    if (demanda.prioridade === 'Alta' && (demanda.status === 'Liberada' || demanda.status === 'Aguardando')) {
      avisos.push({
        id: `alta-parada:${demanda.id}`,
        nivel: 1,
        titulo: `${demanda.id} ainda não começou`,
        texto: `Prioridade alta em ${demanda.atividade}. Status ${demanda.status}.`,
        demandId: demanda.id,
      });
    }

    if (demanda.prioridade === 'Alta' && demanda.status === 'Pausado') {
      avisos.push({
        id: `alta-pausa:${demanda.id}`,
        nivel: 2,
        titulo: `${demanda.id} pausada`,
        texto: demanda.motivoPausa
          ? `Parada em prioridade alta: ${demanda.motivoPausa}.`
          : 'Prioridade alta está pausada.',
        demandId: demanda.id,
      });
    }

    const estimado = minutosEstimados(demanda.tempoEstimado) * 60;
    const apontado = demanda.tempoEmAtividadeSegundos || 0;
    if (estimado > 0 && apontado > estimado && demanda.status !== 'Concluída') {
      avisos.push({
        id: `atraso:${demanda.id}`,
        nivel: 3,
        titulo: `${demanda.id} passou do previsto`,
        texto: `Tempo apontado acima de ${demanda.tempoEstimado}.`,
        demandId: demanda.id,
      });
    }
  });

  const pausas = new Map();
  demands.forEach((demanda) => {
    if (demanda.status !== 'Pausado') return;
    const lista = pausas.get(demanda.atividade) || [];
    lista.push(demanda);
    pausas.set(demanda.atividade, lista);
  });

  pausas.forEach((lista, atividade) => {
    if (lista.length < 3) return;
    avisos.push({
      id: `gargalo:${atividade}`,
      nivel: 4,
      titulo: `Gargalo em ${atividade}`,
      texto: `${lista.length} demandas pausadas nesta atividade.`,
      demandId: lista[0].id,
    });
  });

  return avisos.sort((a, b) => a.nivel - b.nivel || a.demandId.localeCompare(b.demandId));
}
