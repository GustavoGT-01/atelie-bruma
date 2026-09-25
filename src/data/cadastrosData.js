export const PAPEIS = ['Executor', 'Planejador', 'Admin'];

export const TELAS_CADASTRO = [
  { id: 'dashboard', label: 'Visão Geral' },
  { id: 'demandas', label: 'Demandas' },
  { id: 'executor', label: 'Painel Executor' },
  { id: 'fluxo', label: 'Fluxo' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'cadastros', label: 'Cadastros' },
  { id: 'relatorios', label: 'Exportação de Relatórios' },
];

const TELAS_OPERACAO = ['dashboard', 'demandas', 'executor', 'fluxo', 'cronograma'];
const TELAS_ADMIN = TELAS_CADASTRO.map((tela) => tela.id);

const ATIVIDADES = [
  { id: 'at-bloco', nome: 'BLOCO 3D', ordem: 0, minutos: 8, colaboradorPadrao: 'GUSTAVO', usaSubprocessos: false, cor: '#3B82F6', proximas: [] },
  { id: 'at-comercial', nome: 'SOLICITAÇÃO COMERCIAL', ordem: 0, minutos: 2, colaboradorPadrao: 'EZIO', usaSubprocessos: false, cor: '#F97316', proximas: ['at-3d'] },
  { id: 'at-doc', nome: 'DOCUMENTAÇÃO PARA TERCEIROS', ordem: 0, minutos: 45, colaboradorPadrao: 'GUSTAVO', usaSubprocessos: false, cor: '#0284C7', proximas: ['at-3d'] },
  { id: 'at-ti', nome: 'TI', ordem: 0, minutos: 30, colaboradorPadrao: 'ANDERSON', usaSubprocessos: false, cor: '#A855F7', proximas: [] },
  { id: 'at-gerencia', nome: 'GERÊNCIA', ordem: 0, minutos: 15, colaboradorPadrao: 'TATIANE', usaSubprocessos: false, cor: '#64748B', proximas: [] },
  { id: 'at-3d', nome: '3D ESTRUTURAL', ordem: 1, minutos: 197, colaboradorPadrao: 'MATHEUS', usaSubprocessos: false, cor: '#06B6D4', proximas: ['at-recortes', 'at-listagem', 'at-modelagem'] },
  { id: 'at-recortes', nome: 'RECORTES', ordem: 2, minutos: 73, colaboradorPadrao: 'GUSTAVO', usaSubprocessos: false, cor: '#F59E0B', proximas: ['at-listagem'] },
  { id: 'at-listagem', nome: 'LISTAGEM', ordem: 2, minutos: 140, colaboradorPadrao: 'GUSTAVO', usaSubprocessos: true, cor: '#10B981', proximas: ['at-cadastro'] },
  { id: 'at-modelagem', nome: 'MODELAGEM', ordem: 2, minutos: 60, colaboradorPadrao: 'MATHEUS', usaSubprocessos: false, cor: '#8B5CF6', proximas: ['at-encaixe'] },
  { id: 'at-encaixe', nome: 'ENCAIXE', ordem: 3, minutos: 40, colaboradorPadrao: 'MAYCON', usaSubprocessos: false, cor: '#EC4899', proximas: ['at-conferencia'] },
  { id: 'at-cadastro', nome: 'CADASTRO', ordem: 3, minutos: 65, colaboradorPadrao: 'RAYANE', usaSubprocessos: false, cor: '#14B8A6', proximas: ['at-conferencia'] },
  { id: 'at-conferencia', nome: 'CONFERÊNCIA', ordem: 4, minutos: 30, colaboradorPadrao: 'GUSTAVO', usaSubprocessos: false, cor: '#6366F1', proximas: ['at-tabela'] },
  { id: 'at-tabela', nome: 'TABELA', ordem: 5, minutos: 20, colaboradorPadrao: 'RAYANE', usaSubprocessos: false, cor: '#EAB308', proximas: ['at-ficha'] },
  { id: 'at-ficha', nome: 'FICHA TÉCNICA', ordem: 6, minutos: 25, colaboradorPadrao: 'RAYANE', usaSubprocessos: false, cor: '#84CC16', proximas: [] },
];

const TODOS_IDS = ATIVIDADES.map((atividade) => atividade.id);

function colaborador(id, nome, papel, atividades, telas) {
  return {
    id,
    nome,
    login: nome.toLowerCase(),
    senha: '',
    papel,
    atividades,
    telas,
  };
}

export const INITIAL_CATALOG = {
  atividades: ATIVIDADES,
  subprocessos: {
    'at-listagem': [
      { id: 'sub-a', codigo: 'A', nome: 'Lista madeira', minutos: 11, ordem: 1 },
      { id: 'sub-b', codigo: 'B', nome: 'Lista espuma', minutos: 1, ordem: 2 },
      { id: 'sub-c', codigo: 'C', nome: 'Lista embalagem madeira', minutos: 1, ordem: 3 },
      { id: 'sub-d', codigo: 'D', nome: 'Lista laminacao', minutos: 1, ordem: 4 },
      { id: 'sub-e', codigo: 'E', nome: 'Lista metalurgica', minutos: 30, ordem: 5 },
      { id: 'sub-f', codigo: 'F', nome: 'Lista almofada', minutos: 30, ordem: 6 },
      { id: 'sub-g', codigo: 'G', nome: 'Lista percinta', minutos: 30, ordem: 7 },
      { id: 'sub-h', codigo: 'H', nome: 'Custo estrutura', minutos: 1, ordem: 8 },
      { id: 'sub-i', codigo: 'I', nome: 'Custo laminacao', minutos: 30, ordem: 9 },
      { id: 'sub-j', codigo: 'J', nome: 'Custo metalurgico', minutos: 1, ordem: 10 },
      { id: 'sub-k', codigo: 'K', nome: 'Custo embalagem madeira', minutos: 30, ordem: 11 },
      { id: 'sub-l', codigo: 'L', nome: 'Custo acabado', minutos: 1, ordem: 12 },
    ],
  },
  colaboradores: [
    colaborador('col-gustavo', 'GUSTAVO', 'Admin', TODOS_IDS, TELAS_ADMIN),
    colaborador('col-matheus', 'MATHEUS', 'Executor', ['at-3d', 'at-modelagem'], TELAS_OPERACAO),
    colaborador('col-ezio', 'EZIO', 'Executor', ['at-comercial'], TELAS_OPERACAO),
    colaborador('col-maycon', 'MAYCON', 'Executor', ['at-encaixe'], TELAS_OPERACAO),
    colaborador('col-rayane', 'RAYANE', 'Planejador', ['at-cadastro', 'at-tabela', 'at-ficha'], TELAS_OPERACAO),
    colaborador('col-anderson', 'ANDERSON', 'Executor', ['at-ti'], TELAS_OPERACAO),
    colaborador('col-tatiane', 'TATIANE', 'Executor', ['at-gerencia'], TELAS_OPERACAO),
  ],
  produtos: [
    'ACONCHEGO', 'AIR III', 'AMANHÃ', 'AMY', 'ANTONY', 'ARREPIO', 'BAIÃO', 'BRAVO',
    'CAIE', 'CAPADÓCIA', 'CRIO', 'DEO', 'DONGUAN', 'ENGER', 'FORASTEIRO',
    'HUDSON', 'LUMI', 'MONTELLO', 'PLATAFORMA II', 'RÉGIA', 'SAMBO', 'SAVONA', 'SERENA',
  ].map((nome, index) => ({ id: `prod-${index + 1}`, nome })),
  modulacoes: [
    '1B', '1B 1A', '1B 2A', '1U AV 2A', '1B CURVO 2A', '1B CURVO CRECIO 1A', '2D',
    '2B 2A', 'SB 1A', 'POL', 'PUFF', 'MOD-1', 'TODAS', 'PADRÃO', 'ÚNICA', 'GERAL',
  ].map((nome, index) => ({ id: `mod-${index + 1}`, nome })),
  diagramDefault: ATIVIDADES.map((atividade) => ({
    id: atividade.id,
    ordem: atividade.ordem,
    proximas: [...atividade.proximas],
  })),
};

export function novoId(prefixo) {
  const aleatorio = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefixo}-${aleatorio}`;
}
