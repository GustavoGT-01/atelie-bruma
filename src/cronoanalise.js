export function minutosDe(texto) {
  const valor = parseInt(String(texto ?? ''), 10);
  return Number.isFinite(valor) ? valor : 0;
}

export function relogio(segundos) {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = total % 60;
  return [horas, minutos, resto].map((parte) => String(parte).padStart(2, '0')).join(':');
}

export function sinalRelogio(segundos) {
  const valor = Math.round(Number(segundos) || 0);
  if (valor === 0) return relogio(0);
  const sinal = valor > 0 ? '+' : '−';
  return `${sinal}${relogio(Math.abs(valor))}`;
}

export function analisarTempo(demands) {
  const linhas = demands.map((demanda) => {
    const estimadoMin = minutosDe(demanda.tempoEstimado);
    const apontadoSeg = Math.max(0, Math.round(demanda.tempoEmAtividadeSegundos || 0));
    const estimadoSeg = estimadoMin * 60;
    const paradas = Array.isArray(demanda.historicoParadas) ? demanda.historicoParadas : [];
    return {
      id: demanda.id,
      atividade: demanda.atividade,
      executor: demanda.executor,
      status: demanda.status,
      estimadoSeg,
      apontadoSeg,
      diferencaSeg: apontadoSeg - estimadoSeg,
      paradas: paradas.length,
      motivos: paradas.map((parada) => parada.motivo).filter(Boolean),
    };
  });

  const grupos = new Map();
  linhas.forEach((linha) => {
    const grupo = grupos.get(linha.atividade) || {
      atividade: linha.atividade,
      demandas: 0,
      estimadoSeg: 0,
      apontadoSeg: 0,
      paradas: 0,
      acima: 0,
    };
    grupo.demandas += 1;
    grupo.estimadoSeg += linha.estimadoSeg;
    grupo.apontadoSeg += linha.apontadoSeg;
    grupo.paradas += linha.paradas;
    if (linha.diferencaSeg > 0) grupo.acima += 1;
    grupos.set(linha.atividade, grupo);
  });

  const atividades = [...grupos.values()]
    .map((grupo) => ({ ...grupo, diferencaSeg: grupo.apontadoSeg - grupo.estimadoSeg }))
    .sort((a, b) => b.diferencaSeg - a.diferencaSeg || a.atividade.localeCompare(b.atividade, 'pt-BR'));

  const totais = linhas.reduce((soma, linha) => ({
    estimadoSeg: soma.estimadoSeg + linha.estimadoSeg,
    apontadoSeg: soma.apontadoSeg + linha.apontadoSeg,
    paradas: soma.paradas + linha.paradas,
    acima: soma.acima + (linha.diferencaSeg > 0 ? 1 : 0),
  }), { estimadoSeg: 0, apontadoSeg: 0, paradas: 0, acima: 0 });

  return { linhas, atividades, totais };
}

export function resumoTempo(totais) {
  const acima = totais.acima === 0
    ? 'Nenhuma passou do previsto'
    : totais.acima === 1
      ? '1 passou do previsto'
      : `${totais.acima} passaram do previsto`;
  const paradas = totais.paradas === 1 ? '1 parada' : `${totais.paradas} paradas`;
  return `${relogio(totais.apontadoSeg)} apontados. ${relogio(totais.estimadoSeg)} estimados. ${acima}. ${paradas}.`;
}

function campoCsv(valor) {
  const texto = String(valor ?? '');
  if (/[;"\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function baixarCronoanalise(demands) {
  const { linhas } = analisarTempo(demands);
  const colunas = [
    'id',
    'atividade',
    'executor',
    'status',
    'estimado',
    'apontado',
    'diferenca',
    'paradas',
    'motivos',
  ];
  const corpo = linhas.map((linha) => [
    linha.id,
    linha.atividade,
    linha.executor,
    linha.status,
    relogio(linha.estimadoSeg),
    relogio(linha.apontadoSeg),
    sinalRelogio(linha.diferencaSeg),
    linha.paradas,
    linha.motivos.join(' | '),
  ].map(campoCsv).join(';'));
  const blob = new Blob([`\uFEFF${[colunas.join(';'), ...corpo].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cronoanalise.csv';
  link.click();
  URL.revokeObjectURL(url);
}
