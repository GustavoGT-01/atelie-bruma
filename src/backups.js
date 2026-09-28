export {
  listarBackups as lerBackups,
  criarBackup as salvarBackup,
  restaurarBackup,
  excluirBackup,
} from './api/relatorios.js';

export function rotuloBackup(backup) {
  const quando = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(backup.criadoEm));
  const demandas = backup.demandasCount;
  const tipos = backup.tiposCount;
  const lote = demandas === 1 ? '1 demanda' : `${demandas} demandas`;
  const catalogo = tipos === 1 ? '1 tipo de atividade' : `${tipos} tipos de atividade`;
  return {
    quando,
    texto: `${lote}, ${catalogo}.`,
  };
}
