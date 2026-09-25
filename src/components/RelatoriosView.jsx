import React, { useEffect, useRef, useState } from 'react';
import { CalendarRange, FileDown, LayoutDashboard, ListTodo } from 'lucide-react';
import { rotuloBackup } from '../backups';
import { baixarPlanilha, lerPlanilha, montarDemandas } from '../planilha';

const VISIVEIS = 12;

function vazio(texto) {
  return texto || '—';
}

export default function RelatoriosView({
  demands,
  atividades,
  usuarioAtual,
  backups,
  onImportar,
  onAbrir,
  onSalvarBackup,
  onRestaurarBackup,
  onExcluirBackup,
}) {
  const [arquivo, setArquivo] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [erroBackup, setErroBackup] = useState('');
  const [previa, setPrevia] = useState(null);
  const [pendente, setPendente] = useState(null);
  const erroRef = useRef(null);
  const erroBackupRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (erro) erroRef.current?.focus();
  }, [erro]);

  useEffect(() => {
    if (erroBackup) erroBackupRef.current?.focus();
  }, [erroBackup]);

  const escolher = (event) => {
    const file = event.target.files?.[0] || null;
    setArquivo(file);
    setPrevia(null);
    setErro('');
  };

  const previsualizar = async () => {
    if (!arquivo) {
      setErro('Escolha um arquivo .xlsx.');
      return;
    }
    setLendo(true);
    setErro('');
    try {
      const buffer = await arquivo.arrayBuffer();
      const resultado = await lerPlanilha(buffer, atividades, usuarioAtual);
      setPrevia(resultado);
      if (!resultado.aceitas.length) {
        setErro('Nenhuma linha de TI, Gerência ou Documentação para terceiros entrou. Confira a aba Desenvolvimento.');
      }
    } catch (falha) {
      setPrevia(null);
      setErro(falha.message || 'Não foi possível ler a planilha.');
    } finally {
      setLendo(false);
    }
  };

  const importar = () => {
    if (!previa?.aceitas.length) return;
    const novas = montarDemandas(previa.aceitas, demands.map((demanda) => demanda.id));
    onImportar(novas);
    setPrevia(null);
    setArquivo(null);
    setErro('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const linhas = previa?.aceitas.slice(0, VISIVEIS) || [];
  const restantes = previa ? Math.max(previa.aceitas.length - VISIVEIS, 0) : 0;
  const resumo = previa
    ? `${previa.aceitas.length} entram. ${previa.ignoradas} ficam de fora.`
    : '';

  return (
    <div className="page-container rel-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Relatórios e importação</h1>
          <p className="page-subtitle">Exporte dados, importe a planilha ou restaure um backup salvo neste navegador.</p>
        </div>
      </header>

      <div className="rel-layout">
        <section aria-labelledby="rel-importar" aria-busy={lendo}>
          <h2 id="rel-importar">Importar TI, Gerência e Documentação</h2>
          <p id="rel-regra" className="rel-rule">
            Lê a aba Desenvolvimento. Entram só TI, Gerência e Documentação para terceiros, sem ligação no fluxograma. As outras atividades ficam de fora. Demandas que já existem continuam.
          </p>

          <div className="rel-file">
            <input
              ref={inputRef}
              id="rel-arquivo"
              className="rel-file-input"
              name="planilha"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              autoComplete="off"
              aria-describedby={erro ? 'rel-regra rel-erro' : 'rel-regra'}
              onChange={escolher}
            />
            <label htmlFor="rel-arquivo" className="btn-secondary rel-file-btn">Escolher planilha</label>
            <span className="rel-file-name">{arquivo ? arquivo.name : 'Nenhum arquivo selecionado.'}</span>
          </div>

          <div className="rel-actions">
            <button type="button" className="btn-secondary" disabled={!arquivo || lendo} onClick={previsualizar}>
              {lendo ? 'Lendo…' : 'Pré-visualizar'}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!previa?.aceitas.length || lendo}
              onClick={importar}
            >
              Importar agora
            </button>
          </div>

          {erro && (
            <p id="rel-erro" ref={erroRef} className="rel-erro" role="alert" tabIndex={-1}>{erro}</p>
          )}

          <p className="rel-resumo" aria-live="polite">
            {lendo ? 'Lendo a planilha…' : resumo}
            {previa?.cortou ? ' Li as primeiras 2.000 linhas.' : ''}
          </p>

          <div className="table-card rel-ledger">
            <table className="data-table">
              <caption className="rel-caption">Linhas que entram na importação</caption>
              <thead>
                <tr>
                  <th scope="col">Atividade</th>
                  <th scope="col">Produto</th>
                  <th scope="col">Especificação</th>
                  <th scope="col">Executor</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="rel-vazio">
                      {previa ? 'Nenhuma linha entra.' : 'Pré-visualize a planilha para ver o que entra.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((linha, indice) => (
                    <tr key={`${linha.atividade}-${indice}`} className="rel-row" style={{ animationDelay: `${indice * 30}ms` }}>
                      <td translate="no">{linha.atividade}</td>
                      <td translate="no">{vazio(linha.produto)}</td>
                      <td>{linha.especificacao}</td>
                      <td translate="no">{linha.executor}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {restantes > 0 && (
            <p className="rel-mais">E mais {restantes} linhas entram na importação.</p>
          )}
        </section>

        <section aria-labelledby="rel-saidas">
          <h2 id="rel-saidas">Consultar e baixar</h2>
          <ul className="rel-saidas">
            <li className="rel-saida">
              <div>
                <strong>Planilha das demandas</strong>
                <p>Arquivo com o lote atual e o tempo apontado. Abre no Excel.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => baixarPlanilha(demands)}>
                <FileDown size={16} aria-hidden="true" />
                Baixar planilha
              </button>
            </li>
            <li className="rel-saida">
              <div>
                <strong>Lista de demandas</strong>
                <p>Consulta e filtros no sistema.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => onAbrir('demandas')}>
                <ListTodo size={16} aria-hidden="true" />
                Abrir lista
              </button>
            </li>
            <li className="rel-saida">
              <div>
                <strong>Relatório de eficiência</strong>
                <p>Visão geral com os números do lote.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => onAbrir('dashboard')}>
                <LayoutDashboard size={16} aria-hidden="true" />
                Abrir eficiência
              </button>
            </li>
            <li className="rel-saida">
              <div>
                <strong>Cronograma</strong>
                <p>Abre a tela de cronograma.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => onAbrir('cronograma')}>
                <CalendarRange size={16} aria-hidden="true" />
                Abrir cronograma
              </button>
            </li>
          </ul>
        </section>
      </div>

      <section className="rel-backups" aria-labelledby="rel-backups-titulo">
        <div className="rel-backups-head">
          <div>
            <h2 id="rel-backups-titulo">Backups salvos</h2>
            <p className="rel-rule">Guarda o lote e o catálogo neste navegador. Restaurar troca o que está aberto agora.</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const falha = onSalvarBackup();
              setErroBackup(falha);
              if (!falha) setPendente(null);
            }}
          >
            Salvar backup
          </button>
        </div>

        {erroBackup && (
          <p id="rel-backup-erro" ref={erroBackupRef} className="rel-erro" role="alert" tabIndex={-1}>{erroBackup}</p>
        )}

        {backups.length === 0 ? (
          <p className="rel-vazio-backup">Nenhum backup salvo.</p>
        ) : (
          <ul className="rel-saidas">
            {backups.map((backup) => {
              const rotulo = rotuloBackup(backup);
              const pedido = pendente?.id === backup.id ? pendente.acao : null;
              return (
                <li key={backup.id} className="rel-saida">
                  <div>
                    <time className="rel-backup-quando" dateTime={backup.criadoEm}>{rotulo.quando}</time>
                    <p>{rotulo.texto}</p>
                  </div>
                  {pedido ? (
                    <div className="cad-actions is-confirm" role="group" aria-label={pedido === 'restaurar' ? 'Confirmar restauração' : 'Confirmar exclusão'}>
                      <span className="cad-confirm-label">{pedido === 'restaurar' ? 'Restaurar?' : 'Excluir?'}</span>
                      <button
                        type="button"
                        className="cad-text-btn danger"
                        onClick={() => {
                          if (pedido === 'restaurar') {
                            onRestaurarBackup(backup);
                            setPendente(null);
                            setErroBackup('');
                            return;
                          }
                          const falha = onExcluirBackup(backup.id);
                          setErroBackup(falha);
                          if (!falha) setPendente(null);
                        }}
                      >
                        Confirmar
                      </button>
                      <button type="button" className="cad-text-btn" onClick={() => setPendente(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="rel-backup-acoes">
                      <button type="button" className="btn-secondary" onClick={() => setPendente({ id: backup.id, acao: 'restaurar' })}>Restaurar</button>
                      <button type="button" className="btn-secondary" onClick={() => setPendente({ id: backup.id, acao: 'excluir' })}>Excluir</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
