import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { lerPreferencias, salvarPreferencias } from '../api/catalogo';
import { atualizarDemandasLote, excluirDemanda } from '../api/demandas';
import {
  dataParaApi,
  prioridadeParaApi,
  statusParaApi,
  statusParaUi,
} from '../api/adapters';
import { STATUS_LIST } from '../data/mockData';

const EXECUTOR_SEM = '__sem__';

const STATUS_PILLS = [
  { value: '', label: 'Todos', idleClass: 'dem-adm-pill-todos' },
  { value: 'Liberada', label: 'Liberadas', idleClass: 'dem-adm-pill-liberada' },
  { value: 'Pausado', label: 'Pausadas', idleClass: 'dem-adm-pill-pausado' },
  { value: 'Aguardando', label: 'Aguardando', idleClass: 'dem-adm-pill-aguardando' },
  { value: 'Em andamento', label: 'Em andamento', idleClass: 'dem-adm-pill-andamento' },
  { value: 'Concluída', label: 'Concluídas', idleClass: 'dem-adm-pill-concluida' },
  { value: 'Aguardando aprovação', label: 'Aprovação', idleClass: 'dem-adm-pill-aprovacao' },
];

const COLUNAS = [
  { key: 'codigo', label: 'Código' },
  { key: 'atividade', label: 'Atividade' },
  { key: 'produto', label: 'Produto' },
  { key: 'modulacao', label: 'Modulação' },
  { key: 'especificacao', label: 'Especificação' },
  { key: 'executor', label: 'Executor' },
  { key: 'prioridade', label: 'Prioridade' },
  { key: 'solicitacao', label: 'Solicitação' },
  { key: 'status', label: 'Status' },
];

const LARGURAS = {
  codigo: 110,
  atividade: 180,
  produto: 120,
  modulacao: 120,
  especificacao: 280,
  executor: 130,
  prioridade: 100,
  solicitacao: 120,
  status: 140,
  acoes: 140,
};

const STATUS_API_OPTS = [
  'PENDENTE_APROVACAO',
  'AGUARDANDO',
  'LIBERADA',
  'EM_ANDAMENTO',
  'PAUSADO',
  'CONCLUIDA',
  'REJEITADA',
];

const LISTA_VAZIA = [];

function corStatus(status) {
  return STATUS_LIST.find((item) => item.id === status)?.color || '#94A3B8';
}

function rascunhoDe(demanda, tipos, pessoas, modulacoes) {
  const tipo = tipos.find((item) => item.nome === demanda.atividade);
  const pessoa = pessoas.find((item) => item.nome === demanda.executor);
  const modulacao = modulacoes.find((item) => item.nome === demanda.modulacao);
  return {
    especificacao: demanda.especificacao || '',
    status: statusParaApi(demanda.status),
    prioridade: prioridadeParaApi(demanda.prioridade),
    dataSolicitacao: dataParaApi(demanda.solicitacao) || '',
    tipoAtividadeId: tipo?.id || '',
    produtoNome: demanda.produto || '',
    modulacaoId: modulacao?.id || '',
    executorId: pessoa?.id || '',
  };
}

export default function DemandasAdmView({
  demands,
  catalog,
  atividadesConfig,
  isAdmin = true,
  onSelectDemand,
  onOpenNewDemandModal,
  onRecarregar,
  onToast,
}) {
  const tipos = catalog?.atividades || LISTA_VAZIA;
  const pessoas = catalog?.colaboradores || LISTA_VAZIA;
  const produtos = catalog?.produtos || LISTA_VAZIA;
  const modulacoes = catalog?.modulacoes || LISTA_VAZIA;

  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [status, setStatus] = useState('');
  const [atividadeId, setAtividadeId] = useState('');
  const [executorId, setExecutorId] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortAsc, setSortAsc] = useState(true);
  const [larguras, setLarguras] = useState(LARGURAS);
  const [visiveis, setVisiveis] = useState(COLUNAS.map((c) => c.key));
  const [menuCols, setMenuCols] = useState(false);
  const [editavel, setEditavel] = useState(false);
  const [rascunhos, setRascunhos] = useState({});
  const [sujos, setSujos] = useState(() => new Set());
  const [gravando, setGravando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [excluirId, setExcluirId] = useState(null);
  const menuRef = useRef(null);
  const arrasto = useRef(null);

  useEffect(() => {
    lerPreferencias()
      .then((prefs) => {
        const st = prefs.filtroStatusDemandas?.[0];
        if (st === 'PENDENTE_APROVACAO') setStatus('Aguardando aprovação');
        else if (st) setStatus(statusParaUi(st));
        if (prefs.filtroAtividadeDemandas?.[0]) setAtividadeId(prefs.filtroAtividadeDemandas[0]);
        if (prefs.filtroExecutorDemandas?.[0]) setExecutorId(prefs.filtroExecutorDemandas[0]);
        if (Array.isArray(prefs.colunasDemandas) && prefs.colunasDemandas.length) {
          setVisiveis(prefs.colunasDemandas.filter((k) => COLUNAS.some((c) => c.key === k)));
        }
      })
      .catch(() => {});
    try {
      const raw = localStorage.getItem('demandas-col-widths-v1');
      if (raw) setLarguras((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!menuCols) return undefined;
    const fechar = (evento) => {
      if (!menuRef.current?.contains(evento.target)) setMenuCols(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [menuCols]);

  useEffect(() => {
    const mover = (evento) => {
      const d = arrasto.current;
      if (!d) return;
      const next = Math.max(72, d.startW + (evento.clientX - d.startX));
      setLarguras((prev) => ({ ...prev, [d.key]: next }));
    };
    const soltar = () => {
      if (!arrasto.current) return;
      setLarguras((prev) => {
        try {
          localStorage.setItem('demandas-col-widths-v1', JSON.stringify(prev));
        } catch {
          /* ignore */
        }
        return prev;
      });
      arrasto.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
    return () => {
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('mouseup', soltar);
    };
  }, []);

  const gravarFiltro = (proximo) => {
    const st = proximo.status !== undefined ? proximo.status : status;
    const at = proximo.atividadeId !== undefined ? proximo.atividadeId : atividadeId;
    const ex = proximo.executorId !== undefined ? proximo.executorId : executorId;
    salvarPreferencias({
      filtroStatusDemandas: st ? [statusParaApi(st)] : [],
      filtroAtividadeDemandas: at ? [at] : [],
      filtroExecutorDemandas: ex ? [ex] : [],
    }).catch(() => {});
  };

  const filtradas = useMemo(() => {
    const nomeAtividade = tipos.find((t) => t.id === atividadeId)?.nome || '';
    const nomeExecutor = pessoas.find((p) => p.id === executorId)?.nome || '';
    return demands.filter((item) => {
      if (buscaAtiva.trim()) {
        const q = buscaAtiva.toLowerCase();
        const hit = [item.id, item.produto, item.atividade, item.especificacao, item.executor]
          .join(' ')
          .toLowerCase()
          .includes(q);
        if (!hit) return false;
      }
      if (!status) {
        if (item.status === 'Concluída' || item.status === 'Rejeitada') return false;
      } else if (item.status !== status) {
        return false;
      }
      if (atividadeId && item.atividade !== nomeAtividade) return false;
      if (executorId === EXECUTOR_SEM && item.executor) return false;
      if (executorId && executorId !== EXECUTOR_SEM && item.executor !== nomeExecutor) return false;
      return true;
    }).sort((a, b) => {
      const campo = sortField === 'id' ? 'id' : sortField;
      const va = String(a[campo] || '');
      const vb = String(b[campo] || '');
      const cmp = va.localeCompare(vb, 'pt-BR', { numeric: true, sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    });
  }, [demands, buscaAtiva, status, atividadeId, executorId, tipos, pessoas, sortField, sortAsc]);

  const ordenar = (campo) => {
    if (sortField === campo) setSortAsc((v) => !v);
    else {
      setSortField(campo);
      setSortAsc(true);
    }
  };

  const limpar = () => {
    setBusca('');
    setBuscaAtiva('');
    setStatus('');
    setAtividadeId('');
    setExecutorId('');
    gravarFiltro({ status: '', atividadeId: '', executorId: '' });
  };

  const mostrar = new Set(visiveis);
  const planilha = isAdmin && editavel;

  const minTabela = visiveis.reduce((acc, key) => acc + (larguras[key] || 100), 0)
    + (isAdmin ? larguras.acoes : 0);

  const iniciarArrasto = (key, evento) => {
    evento.preventDefault();
    evento.stopPropagation();
    arrasto.current = { key, startX: evento.clientX, startW: larguras[key] };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const salvarColunas = (next) => {
    const final = next.length ? next : COLUNAS.map((c) => c.key);
    setVisiveis(final);
    salvarPreferencias({ colunasDemandas: final }).catch(() => {});
  };

  const toggleCol = (key) => {
    if (visiveis.includes(key)) {
      if (visiveis.length <= 1) return;
      salvarColunas(visiveis.filter((k) => k !== key));
    } else {
      salvarColunas([...visiveis, key]);
    }
  };

  const entrarEdicao = () => {
    if (!isAdmin) return;
    const mapa = {};
    demands.forEach((d) => {
      mapa[d.serverId] = rascunhoDe(d, tipos, pessoas, modulacoes);
    });
    setRascunhos(mapa);
    setSujos(new Set());
    setEditavel(true);
    setAviso('');
  };

  const patchCelula = (serverId, campo, valor) => {
    setRascunhos((prev) => ({ ...prev, [serverId]: { ...prev[serverId], [campo]: valor } }));
    setSujos((prev) => new Set(prev).add(serverId));
  };

  const aplicar = async () => {
    const ids = [...sujos];
    if (!ids.length) {
      setAviso('Nenhuma célula alterada.');
      return;
    }
    setGravando(true);
    setAviso('');
    try {
      const data = await atualizarDemandasLote(ids.map((id) => {
        const d = rascunhos[id];
        return {
          id,
          especificacao: d.especificacao,
          status: d.status,
          prioridade: Number(d.prioridade),
          dataSolicitacao: d.dataSolicitacao || null,
          tipoAtividadeId: d.tipoAtividadeId || null,
          produtoNome: d.produtoNome.trim(),
          modulacaoId: d.modulacaoId || null,
          executorId: d.executorId || null,
        };
      }));
      setAviso(
        data.erros?.length
          ? `Atualizadas ${data.ok}/${data.total}. ${data.erros.length} com erro.`
          : `${data.ok} demanda(s) atualizada(s).`
      );
      setEditavel(false);
      setSujos(new Set());
      setRascunhos({});
      await onRecarregar?.();
    } catch (erro) {
      setAviso(erro?.message || 'Erro ao aplicar alterações');
    } finally {
      setGravando(false);
    }
  };

  const confirmarExcluir = async (demanda) => {
    try {
      await excluirDemanda(demanda.serverId);
      setExcluirId(null);
      onToast?.(`Demanda ${demanda.id} excluída.`);
      await onRecarregar?.();
    } catch (erro) {
      onToast?.(erro?.message || 'Erro ao excluir');
    }
  };

  const th = (label, key) => (
    <th
      key={key}
      style={{ width: larguras[key], minWidth: 72, position: 'relative' }}
      aria-sort={sortField === key || (key === 'codigo' && sortField === 'id')
        ? (sortAsc ? 'ascending' : 'descending')
        : 'none'}
    >
      <button
        type="button"
        className="dem-adm-sort"
        onClick={() => ordenar(key === 'codigo' ? 'id' : key)}
      >
        {label}
      </button>
      <span
        role="separator"
        aria-orientation="vertical"
        title="Arraste para redimensionar"
        className="dem-adm-resize"
        onMouseDown={(e) => iniciarArrasto(key, e)}
      />
    </th>
  );

  return (
    <div className="page-container dem-adm">
      <div className="page-header">
        <div>
          <h1 className="page-title">Demandas</h1>
          <p className="page-subtitle">Clique no cabeçalho para ordenar. Arraste a borda da coluna para redimensionar.</p>
        </div>
        <button type="button" className="btn-primary" onClick={onOpenNewDemandModal}>
          Nova demanda
        </button>
      </div>

      <div className="dem-adm-card">
      <form
        className="dem-adm-filtro"
        onSubmit={(e) => {
          e.preventDefault();
          setBuscaAtiva(busca);
          gravarFiltro({});
        }}
      >
        <div className="dem-adm-filtro-row">
          <label className="dem-adm-busca" htmlFor="dem-adm-q">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Buscar</span>
            <input
              id="dem-adm-q"
              className="form-input search-input"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar código, produto, atividade, especificação..."
            />
          </label>
          <select
            id="dem-adm-atividade"
            className="form-select"
            aria-label="Atividade"
            value={atividadeId}
            onChange={(e) => {
              setAtividadeId(e.target.value);
              gravarFiltro({ atividadeId: e.target.value });
            }}
          >
            <option value="">Atividade: Todas</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
          <select
            id="dem-adm-executor"
            className="form-select"
            aria-label="Executor"
            value={executorId}
            onChange={(e) => {
              setExecutorId(e.target.value);
              gravarFiltro({ executorId: e.target.value });
            }}
          >
            <option value="">Executor: Todos</option>
            <option value={EXECUTOR_SEM}>Sem executor</option>
            {pessoas.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={limpar}>Limpar</button>
          <button type="submit" className="btn-primary">Buscar</button>
        </div>

        <div className="dem-adm-status" role="group" aria-label="Status">
          <span className="dem-adm-status-label">Status:</span>
          {STATUS_PILLS.map((p) => (
            <button
              key={p.value || 'ALL'}
              type="button"
              className={`dem-adm-pill ${p.idleClass} ${status === p.value ? 'is-on' : ''}`}
              aria-pressed={status === p.value}
              onClick={() => {
                setStatus(p.value);
                gravarFiltro({ status: p.value });
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {!isAdmin ? (
          <p className="dem-adm-nota">
            Só administradores podem alterar ou excluir. Demandas criadas por você precisam de aprovação do admin.
          </p>
        ) : null}
      </form>

      <div className="dem-adm-toolbar">
        <div className="dem-adm-cols" ref={menuRef}>
          <button type="button" className="btn-secondary" onClick={() => setMenuCols((v) => !v)}>
            Colunas
          </button>
          {menuCols && (
            <div className="dem-adm-cols-menu" role="dialog" aria-label="Colunas visíveis">
              <p>Marque os campos que quer ver na lista.</p>
              <ul>
                {COLUNAS.map(({ key, label }) => (
                  <li key={key}>
                    <label>
                      <input
                        type="checkbox"
                        checked={visiveis.includes(key)}
                        onChange={() => toggleCol(key)}
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" className="cad-text-btn" onClick={() => salvarColunas(COLUNAS.map((c) => c.key))}>
                Mostrar todas
              </button>
            </div>
          )}
        </div>
        {isAdmin ? (
          !editavel ? (
            <button type="button" className="btn-secondary" onClick={entrarEdicao}>
              Tornar editável (planilha)
            </button>
          ) : (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={gravando || sujos.size === 0}
              onClick={aplicar}
            >
              {gravando ? 'Aplicando…' : `Aplicar${sujos.size ? ` (${sujos.size})` : ''}`}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={gravando}
              onClick={() => {
                setEditavel(false);
                setRascunhos({});
                setSujos(new Set());
                setAviso('');
              }}
            >
              Cancelar
            </button>
            <span className="dem-adm-hint">Edite as células e clique em Aplicar para salvar.</span>
          </>
          )
        ) : null}
        {aviso ? (
          <span
            className="dem-adm-hint"
            role={aviso.startsWith('Erro') || aviso.includes('com erro') ? 'alert' : 'status'}
          >
            {aviso}
          </span>
        ) : null}
      </div>

      <div className="dem-adm-scroll">
        <table className="data-table" style={{ tableLayout: 'fixed', width: minTabela, minWidth: '100%' }}>
          <thead>
            <tr>
              {COLUNAS.filter((c) => mostrar.has(c.key)).map((c) => th(c.label, c.key))}
              {isAdmin ? <th style={{ width: larguras.acoes }}>Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={visiveis.length + (isAdmin ? 1 : 0)} className="dem-adm-vazio">
                  Nenhuma demanda encontrada para esta busca.
                </td>
              </tr>
            ) : filtradas.map((demand) => {
              const cor = atividadesConfig[demand.atividade]?.color || '#94a3b8';
              const statusColor = corStatus(demand.status);
              const draft = rascunhos[demand.serverId];
              return (
                <tr
                  key={demand.serverId || demand.id}
                  className={excluirId === demand.id ? 'cad-row-confirm' : undefined}
                  onClick={() => {
                    if (!planilha && excluirId !== demand.id) onSelectDemand(demand);
                  }}
                >
                  {mostrar.has('codigo') && <td className="code-cell">{demand.id}</td>}
                  {mostrar.has('atividade') && (
                    <td>
                      {planilha ? (
                        <select
                          className="form-select"
                          value={draft?.tipoAtividadeId || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patchCelula(demand.serverId, 'tipoAtividadeId', e.target.value)}
                        >
                          <option value="">—</option>
                          {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                      ) : (
                        <div className="activity-badge">
                          <span className="activity-dot" style={{ backgroundColor: cor }} />
                          <span>{demand.atividade}</span>
                        </div>
                      )}
                    </td>
                  )}
                  {mostrar.has('produto') && (
                    <td>
                      {planilha ? (
                        <input
                          className="form-input"
                          list="dem-adm-produtos"
                          value={draft?.produtoNome || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patchCelula(demand.serverId, 'produtoNome', e.target.value)}
                        />
                      ) : demand.produto || '—'}
                    </td>
                  )}
                  {mostrar.has('modulacao') && (
                    <td>
                      {planilha ? (
                        <select
                          className="form-select"
                          value={draft?.modulacaoId || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patchCelula(demand.serverId, 'modulacaoId', e.target.value)}
                        >
                          <option value="">—</option>
                          {modulacoes.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>
                      ) : demand.modulacao || '—'}
                    </td>
                  )}
                  {mostrar.has('especificacao') && (
                    <td>
                      {planilha ? (
                        <input
                          className="form-input"
                          value={draft?.especificacao || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patchCelula(demand.serverId, 'especificacao', e.target.value)}
                        />
                      ) : demand.especificacao}
                    </td>
                  )}
                  {mostrar.has('executor') && (
                    <td>
                      {planilha ? (
                        <select
                          className="form-select"
                          value={draft?.executorId || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patchCelula(demand.serverId, 'executorId', e.target.value)}
                        >
                          <option value="">—</option>
                          {pessoas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      ) : demand.executor || '—'}
                    </td>
                  )}
                  {mostrar.has('prioridade') && (
                    <td>
                      {planilha ? (
                        <select
                          className="form-select"
                          value={draft?.prioridade ?? 3}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patchCelula(demand.serverId, 'prioridade', Number(e.target.value))}
                        >
                          <option value={1}>Alta</option>
                          <option value={2}>Média</option>
                          <option value={3}>Baixa</option>
                        </select>
                      ) : (
                        <span className={`priority-pill priority-${(demand.prioridade || '').toLowerCase()}`}>
                          {demand.prioridade}
                        </span>
                      )}
                    </td>
                  )}
                  {mostrar.has('solicitacao') && (
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {planilha ? (
                        <input
                          type="date"
                          className="form-input"
                          value={draft?.dataSolicitacao || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patchCelula(demand.serverId, 'dataSolicitacao', e.target.value)}
                        />
                      ) : demand.solicitacao}
                    </td>
                  )}
                  {mostrar.has('status') && (
                    <td>
                      {planilha ? (
                        <select
                          className="form-select"
                          value={draft?.status || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patchCelula(demand.serverId, 'status', e.target.value)}
                        >
                          {STATUS_API_OPTS.map((s) => (
                            <option key={s} value={s}>{statusParaUi(s)}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="status-pill"
                          style={{
                            backgroundColor: `${statusColor}18`,
                            color: statusColor,
                            border: `1px solid ${statusColor}40`,
                          }}
                        >
                          <span className="status-dot" style={{ backgroundColor: statusColor }} />
                          {demand.status}
                        </span>
                      )}
                    </td>
                  )}
                  {isAdmin ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    {excluirId === demand.id ? (
                      <div className="cad-actions is-confirm" role="group" aria-label="Confirmar exclusão">
                        <span className="cad-confirm-label">Excluir?</span>
                        <button type="button" className="cad-text-btn danger" onClick={() => confirmarExcluir(demand)}>
                          Confirmar
                        </button>
                        <button type="button" className="cad-text-btn" onClick={() => setExcluirId(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="dem-adm-acoes">
                        <button type="button" className="cad-text-btn" onClick={() => onSelectDemand(demand)}>
                          Executar
                        </button>
                        <button type="button" className="cad-text-btn danger" onClick={() => setExcluirId(demand.id)}>
                          Excluir
                        </button>
                      </div>
                    )}
                  </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="dem-adm-produtos">
          {produtos.map((p) => <option key={p.id} value={p.nome} />)}
        </datalist>
      </div>
      </div>
    </div>
  );
}
