export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Interpreta data do input type="date" (YYYY-MM-DD) em horario local ao meio-dia,
 * evitando o bug UTC que atrasa 1 dia no Brasil (UTC-3).
 */
export function parseDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(y, mo, d, 12, 0, 0, 0);
  }
  // ISO com so a data no inicio
  const m2 = /^(\d{4})-(\d{2})-(\d{2})T/.exec(s);
  if (m2) {
    return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]), 12, 0, 0, 0);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function formatDateBR(d) {
  if (!d) return '—';
  if (typeof d === 'string') {
    const only = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim());
    if (only) {
      return `${only[3]}/${only[2]}/${only[1]}`;
    }
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';

  // Datas "so dia" gravadas como meia-noite UTC: exibe o dia do calendario UTC
  // (evita 18 virar 17 no fuso America/Sao_Paulo).
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return date.toLocaleDateString('pt-BR');
}

export function statusLabel(status) {
  const map = {
    PENDENTE_APROVACAO: 'Aguardando aprovação',
    REJEITADA: 'Rejeitada',
    AGUARDANDO: 'Aguardando',
    PENDENTE: 'Aguardando',
    LIBERADA: 'Liberada',
    EM_ANDAMENTO: 'Em andamento',
    PAUSADO: 'Pausado',
    CONCLUIDA: 'Concluída',
  };
  return map[status] || status;
}

export function prioridadeLabel(p) {
  if (p <= 1) return 'Alta';
  if (p === 2) return 'Média';
  return 'Baixa';
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
