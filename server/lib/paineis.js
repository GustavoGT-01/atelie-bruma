import { isAdminUi } from './permissoes.js';

export const PAINEIS = [
  { id: 'visao', href: '/', label: 'Visão Geral', icon: '◈', padraoExecutor: false },
  { id: 'demandas', href: '/demandas', label: 'Demandas', icon: '☰', padraoExecutor: true },
  { id: 'painel', href: '/painel', label: 'Painel Executor', icon: '▶', padraoExecutor: true },
  { id: 'fluxo', href: '/fluxo', label: 'Fluxo', icon: '⇄', padraoExecutor: false },
  { id: 'fila', href: '/fila', label: 'Cronograma', icon: '▦', padraoExecutor: true },
  {
    id: 'relatorios',
    href: '/relatorios',
    label: 'Exportação de Relatórios',
    icon: '⇪',
    padraoExecutor: false,
  },
  { id: 'admin', href: '/admin', label: 'Cadastros', icon: '⚙', padraoExecutor: false },
];

const ALL_IDS = PAINEIS.map((p) => p.id);
const EXEC_DEFAULT = PAINEIS.filter((p) => p.padraoExecutor).map((p) => p.id);

export function normalizePaineisIds(raw) {
  if (!Array.isArray(raw)) return [];
  const set = new Set(ALL_IDS);
  const out = [];
  for (const x of raw) {
    const id = String(x || '').trim();
    if (set.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Lista efetiva de paineis no menu. */
export function paineisEfetivos(opts) {
  // Admin em modo ADM: sempre tudo
  if (isAdminUi(opts.papel, opts.modoUi)) return [...ALL_IDS];

  const custom = normalizePaineisIds(opts.paineisVisiveis);
  if (custom.length) return custom;
  return [...EXEC_DEFAULT];
}

export function podeVerPainel(painelId, opts) {
  return paineisEfetivos(opts).includes(painelId);
}
