import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const STATUS_INICIAL = ['Liberada', 'Aguardando', 'Aguardando aprovação'];

function isoHoje() {
  const data = new Date();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function isoParaBr(iso) {
  const [ano, mes, dia] = String(iso || '').split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${ano}`;
}

function criarId(usados) {
  let id = '';
  do {
    id = `DEM-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (usados.has(id));
  usados.add(id);
  return id;
}

function estadoInicial(catalog, usuarioAtual) {
  const atividade = catalog.atividades[0];
  const executor = catalog.colaboradores.some((pessoa) => pessoa.nome === usuarioAtual)
    ? usuarioAtual
    : (catalog.colaboradores[0]?.nome || '');
  return {
    especificacao: '',
    atividadeId: atividade?.id || '',
    produto: '',
    modulacoes: [],
    subprocessos: [],
    etapas: {},
    executor,
    prioridade: 'Média',
    status: 'Liberada',
    tempo: String(atividade?.minutos || 0),
    solicitacao: isoHoje(),
    observacoes: '',
  };
}

function apagarRamo(id, etapas, atividades) {
  delete etapas[id];
  const atual = atividades.find((item) => item.id === id);
  (atual?.proximas || []).forEach((prox) => apagarRamo(prox, etapas, atividades));
}

function somaMinutos(ids, lista) {
  return ids.reduce((total, id) => total + (lista.find((item) => item.id === id)?.minutos || 0), 0);
}

function EtapasProximas({ paiNome, atividadeId, atividades, executores, etapas, onToggle, onExecutor }) {
  const atual = atividades.find((item) => item.id === atividadeId);
  const proximas = (atual?.proximas || [])
    .map((id) => atividades.find((item) => item.id === id))
    .filter(Boolean);
  if (!proximas.length) return null;

  return (
    <div className="nd-ramos">
      <p className="nd-seguinte">Próximas após {paiNome}</p>
      {proximas.map((etapa) => {
        const marcada = Boolean(etapas[etapa.id]);
        const campoExecutor = `nd-exec-${etapa.id}`;
        return (
          <div key={etapa.id} className="nd-etapa">
            <label className={`nd-check ${marcada ? 'is-on' : ''}`} htmlFor={`nd-etapa-${etapa.id}`}>
              <input
                id={`nd-etapa-${etapa.id}`}
                type="checkbox"
                checked={marcada}
                onChange={() => onToggle(etapa)}
              />
              <span>
                <strong>{etapa.nome}</strong>
                <span className="nd-min"> ({etapa.minutos} min)</span>
              </span>
            </label>
            {marcada && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor={campoExecutor}>Colaborador</label>
                  <select
                    id={campoExecutor}
                    className="form-select"
                    value={etapas[etapa.id]}
                    onChange={(event) => onExecutor(etapa.id, event.target.value)}
                  >
                    {executores.map((nome) => (
                      <option key={nome} value={nome}>{nome}</option>
                    ))}
                  </select>
                </div>
                <EtapasProximas
                  paiNome={etapa.nome}
                  atividadeId={etapa.id}
                  atividades={atividades}
                  executores={executores}
                  etapas={etapas}
                  onToggle={onToggle}
                  onExecutor={onExecutor}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NewDemandModal({
  isOpen,
  onClose,
  onAddDemand,
  catalog,
  idsEmUso,
  usuarioAtual,
}) {
  const [form, setForm] = useState(() => estadoInicial(catalog, usuarioAtual));
  const [erro, setErro] = useState('');
  const [campoErro, setCampoErro] = useState('');
  const [visivel, setVisivel] = useState(isOpen);
  const erroRef = useRef(null);
  const specRef = useRef(null);
  const fecharRef = useRef(onClose);

  if (isOpen !== visivel) {
    setVisivel(isOpen);
    if (isOpen) {
      setForm(estadoInicial(catalog, usuarioAtual));
      setErro('');
      setCampoErro('');
    }
  }

  const atividades = catalog.atividades;
  const executores = catalog.colaboradores.map((pessoa) => pessoa.nome);
  const atividade = atividades.find((item) => item.id === form.atividadeId) || atividades[0];
  const subprocessos = atividade ? (catalog.subprocessos[atividade.id] || []) : [];
  const mostraSub = Boolean(atividade?.usaSubprocessos && subprocessos.length);

  useEffect(() => {
    fecharRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const quadro = requestAnimationFrame(() => specRef.current?.focus());
    const fechar = (event) => {
      if (event.key === 'Escape') fecharRef.current();
    };
    window.addEventListener('keydown', fechar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('keydown', fechar);
    };
  }, [isOpen]);

  useEffect(() => {
    if (erro) erroRef.current?.focus();
  }, [erro]);

  if (!isOpen || !atividade) return null;

  const etapasMarcadas = Object.keys(form.etapas).length;
  const pais = form.modulacoes.length;
  const total = pais * (1 + etapasMarcadas);
  const soma = somaMinutos(form.subprocessos, subprocessos);

  const mudarAtividade = (id) => {
    const proxima = atividades.find((item) => item.id === id);
    setForm((atual) => ({
      ...atual,
      atividadeId: id,
      subprocessos: [],
      etapas: {},
      tempo: String(proxima?.minutos || 0),
    }));
    if (campoErro === 'atividade') setErro('');
  };

  const alternarModulacao = (nome) => {
    setForm((atual) => ({
      ...atual,
      modulacoes: atual.modulacoes.includes(nome)
        ? atual.modulacoes.filter((item) => item !== nome)
        : [...atual.modulacoes, nome],
    }));
    if (campoErro === 'modulacao') setErro('');
  };

  const alternarSubprocesso = (id) => {
    setForm((atual) => {
      const proximos = atual.subprocessos.includes(id)
        ? atual.subprocessos.filter((item) => item !== id)
        : [...atual.subprocessos, id];
      const minutos = somaMinutos(proximos, subprocessos);
      return {
        ...atual,
        subprocessos: proximos,
        tempo: String(minutos || atividade.minutos),
      };
    });
  };

  const alternarEtapa = (etapa) => {
    setForm((atual) => {
      const etapas = { ...atual.etapas };
      if (etapas[etapa.id]) apagarRamo(etapa.id, etapas, atividades);
      else etapas[etapa.id] = etapa.colaboradorPadrao || executores[0] || '';
      return { ...atual, etapas };
    });
  };

  const falhar = (mensagem, campo) => {
    setCampoErro(campo);
    setErro(mensagem);
  };

  const montarFilhas = (atividadeId, aguardaId, base, usados, saida) => {
    const atual = atividades.find((item) => item.id === atividadeId);
    (atual?.proximas || []).forEach((proxId) => {
      if (!form.etapas[proxId]) return;
      const etapa = atividades.find((item) => item.id === proxId);
      if (!etapa) return;
      const id = criarId(usados);
      saida.push({
        ...base,
        id,
        atividade: etapa.nome,
        executor: form.etapas[proxId],
        status: 'Aguardando',
        tempoEstimado: `${etapa.minutos} min`,
        aguardaId,
        subprocessos: [],
      });
      montarFilhas(proxId, id, base, usados, saida);
    });
  };

  const enviar = (event) => {
    event.preventDefault();
    const especificacao = form.especificacao.trim().toLocaleUpperCase('pt-BR');
    const produto = form.produto.trim().toLocaleUpperCase('pt-BR');
    const tempo = Number(form.tempo);
    if (!especificacao) {
      falhar('Informe a especificação.', 'especificacao');
      return;
    }
    if (!produto) {
      falhar('Informe o produto.', 'produto');
      return;
    }
    if (!form.modulacoes.length) {
      falhar('Selecione ao menos uma modulação.', 'modulacao');
      return;
    }
    if (!Number.isFinite(tempo) || tempo < 1) {
      falhar('Informe o tempo estimado em minutos.', 'tempo');
      return;
    }
    if (!form.solicitacao) {
      falhar('Informe a data de solicitação.', 'solicitacao');
      return;
    }

    const usados = new Set(idsEmUso);
    const observacoes = form.observacoes.trim();
    const solicitacao = isoParaBr(form.solicitacao);
    const demandas = [];

    form.modulacoes.forEach((modulacao) => {
      const id = criarId(usados);
      const base = {
        produto,
        modulacao,
        especificacao,
        prioridade: form.prioridade,
        solicitacao,
        tempoEmAtividadeSegundos: 0,
        motivoPausa: null,
        historicoParadas: [],
        observacoes,
      };
      demandas.push({
        ...base,
        id,
        atividade: atividade.nome,
        executor: form.executor,
        status: form.status,
        tempoEstimado: `${tempo} min`,
        aguardaId: null,
        subprocessos: [...form.subprocessos],
      });
      montarFilhas(atividade.id, id, base, usados, demandas);
    });

    onAddDemand(demandas);
    onClose();
  };

  const described = erro ? 'nd-erro' : undefined;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content nd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nd-titulo"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="nd-titulo" className="nd-titulo">Nova demanda</h2>
            <p className="nd-help">Selecione a atividade e marque as próximas etapas do diagrama que devem ser geradas. Demandas filhas ficam em Aguardando até esta concluir.</p>
          </div>
          <button type="button" className="btn-secondary nd-fechar" aria-label="Fechar" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={enviar}>
          <div className="modal-body">
            {erro && (
              <p id="nd-erro" ref={erroRef} className="nd-erro" role="alert" tabIndex={-1}>{erro}</p>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="nd-especificacao">Especificação</label>
              <textarea
                ref={specRef}
                id="nd-especificacao"
                className="form-textarea"
                rows={3}
                placeholder="Descreva a demanda…"
                value={form.especificacao}
                aria-invalid={campoErro === 'especificacao'}
                aria-describedby={campoErro === 'especificacao' ? described : undefined}
                onChange={(event) => {
                  setForm((atual) => ({ ...atual, especificacao: event.target.value }));
                  if (campoErro === 'especificacao') setErro('');
                }}
              />
            </div>

            <div className="modal-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="nd-atividade">Atividade</label>
                <select
                  id="nd-atividade"
                  className="form-select"
                  value={atividade.id}
                  onChange={(event) => mudarAtividade(event.target.value)}
                >
                  {atividades.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome} ({item.minutos} min)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="nd-produto">Produto</label>
                <input
                  id="nd-produto"
                  className="form-input"
                  name="produto"
                  autoComplete="off"
                  placeholder="Digite o nome do produto…"
                  value={form.produto}
                  aria-invalid={campoErro === 'produto'}
                  aria-describedby={campoErro === 'produto' ? described : undefined}
                  onChange={(event) => {
                    setForm((atual) => ({ ...atual, produto: event.target.value }));
                    if (campoErro === 'produto') setErro('');
                  }}
                />
              </div>
            </div>

            <fieldset className="nd-fieldset">
              <legend className="form-label">Modulação</legend>
              <p id="nd-mod-ajuda" className="nd-help">Selecione uma ou mais. Cada modulação gera uma demanda individual com os mesmos dados do formulário.</p>
              <div className="nd-checks nd-checks-3" aria-describedby={campoErro === 'modulacao' ? 'nd-erro nd-mod-ajuda' : 'nd-mod-ajuda'}>
                {catalog.modulacoes.map((item) => {
                  const marcada = form.modulacoes.includes(item.nome);
                  return (
                    <label key={item.id} className={`nd-check ${marcada ? 'is-on' : ''}`} htmlFor={`nd-mod-${item.id}`}>
                      <input
                        id={`nd-mod-${item.id}`}
                        type="checkbox"
                        checked={marcada}
                        onChange={() => alternarModulacao(item.nome)}
                      />
                      <span>{item.nome}</span>
                    </label>
                  );
                })}
              </div>
              {pais > 0 && (
                <p className="nd-conta">{pais} selecionadas → {total} demandas serão criadas</p>
              )}
            </fieldset>

            {mostraSub && (
              <fieldset className="nd-fieldset">
                <legend className="form-label">Subprocessos de {atividade.nome}</legend>
                <div className="nd-checks nd-checks-2">
                  {subprocessos.map((item) => {
                    const marcada = form.subprocessos.includes(item.id);
                    return (
                      <label key={item.id} className={`nd-check nd-check-sub ${marcada ? 'is-on' : ''}`} htmlFor={`nd-sub-${item.id}`}>
                        <input
                          id={`nd-sub-${item.id}`}
                          type="checkbox"
                          checked={marcada}
                          onChange={() => alternarSubprocesso(item.id)}
                        />
                        <span>
                          <strong>{item.codigo}) {item.nome}</strong>
                          <span className="nd-min">{item.minutos} min</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="nd-soma">Soma: <strong>{soma} min</strong></p>
              </fieldset>
            )}

            <section className="nd-fieldset" aria-labelledby="nd-proximas">
              <h3 id="nd-proximas" className="form-label">Próximas etapas do processo</h3>
              <p className="nd-help">Marque a próxima etapa. Ao marcar, abrem as etapas seguintes do fluxograma. Demandas filhas ficam em Aguardando até a anterior concluir.</p>
              {(atividade.proximas || []).length === 0 && (
                <p className="nd-help">Esta atividade não tem próxima etapa no diagrama.</p>
              )}
              <EtapasProximas
                paiNome={atividade.nome}
                atividadeId={atividade.id}
                atividades={atividades}
                executores={executores}
                etapas={form.etapas}
                onToggle={alternarEtapa}
                onExecutor={(id, nome) => setForm((atual) => ({
                  ...atual,
                  etapas: { ...atual.etapas, [id]: nome },
                }))}
              />
            </section>

            <div className="modal-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="nd-executor">Executor desta demanda</label>
                <select
                  id="nd-executor"
                  className="form-select"
                  value={form.executor}
                  onChange={(event) => setForm((atual) => ({ ...atual, executor: event.target.value }))}
                >
                  {executores.map((nome) => (
                    <option key={nome} value={nome}>{nome}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="nd-prioridade">Prioridade</label>
                <select
                  id="nd-prioridade"
                  className="form-select"
                  value={form.prioridade}
                  onChange={(event) => setForm((atual) => ({ ...atual, prioridade: event.target.value }))}
                >
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="nd-status">Status inicial</label>
                <select
                  id="nd-status"
                  className="form-select"
                  value={form.status}
                  onChange={(event) => setForm((atual) => ({ ...atual, status: event.target.value }))}
                >
                  {STATUS_INICIAL.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="nd-tempo">Tempo estimado (min)</label>
                <input
                  id="nd-tempo"
                  className="form-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  name="tempo"
                  value={form.tempo}
                  aria-invalid={campoErro === 'tempo'}
                  aria-describedby={campoErro === 'tempo' ? described : undefined}
                  onChange={(event) => {
                    setForm((atual) => ({ ...atual, tempo: event.target.value }));
                    if (campoErro === 'tempo') setErro('');
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="nd-data">Data solicitação</label>
                <input
                  id="nd-data"
                  className="form-input"
                  type="date"
                  name="solicitacao"
                  value={form.solicitacao}
                  aria-invalid={campoErro === 'solicitacao'}
                  aria-describedby={campoErro === 'solicitacao' ? described : undefined}
                  onChange={(event) => {
                    setForm((atual) => ({ ...atual, solicitacao: event.target.value }));
                    if (campoErro === 'solicitacao') setErro('');
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="nd-obs">Observações</label>
              <input
                id="nd-obs"
                className="form-input"
                name="observacoes"
                autoComplete="off"
                value={form.observacoes}
                onChange={(event) => setForm((atual) => ({ ...atual, observacoes: event.target.value }))}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">
              {total <= 1 ? 'Criar demanda' : `Criar ${total} demandas`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
