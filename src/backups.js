const CHAVE = 'piu-mobile-backups';

function catalogoValido(catalog) {
  return Boolean(
    catalog
    && Array.isArray(catalog.atividades)
    && Array.isArray(catalog.produtos)
    && Array.isArray(catalog.modulacoes)
    && Array.isArray(catalog.colaboradores)
    && catalog.subprocessos
    && typeof catalog.subprocessos === 'object',
  );
}

function backupValido(item) {
  return Boolean(
    item
    && typeof item.id === 'string'
    && typeof item.criadoEm === 'string'
    && !Number.isNaN(Date.parse(item.criadoEm))
    && Array.isArray(item.demands)
    && catalogoValido(item.catalog),
  );
}

export function lerBackups() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return lista.filter(backupValido);
  } catch {
    return [];
  }
}

export function gravarBackups(lista) {
  localStorage.setItem(CHAVE, JSON.stringify(lista));
}

export function montarBackup(demands, catalog) {
  return {
    id: `bk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    criadoEm: new Date().toISOString(),
    demands: structuredClone(demands),
    catalog: structuredClone(catalog),
  };
}

export function rotuloBackup(backup) {
  const quando = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(backup.criadoEm));
  const demandas = backup.demands.length;
  const tipos = backup.catalog.atividades.length;
  const lote = demandas === 1 ? '1 demanda' : `${demandas} demandas`;
  const catalogo = tipos === 1 ? '1 tipo de atividade' : `${tipos} tipos de atividade`;
  return {
    quando,
    texto: `${lote}, ${catalogo}.`,
  };
}
