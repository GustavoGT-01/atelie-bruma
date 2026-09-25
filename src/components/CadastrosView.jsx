import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RotateCcw, Save } from 'lucide-react';
import { PAPEIS, TELAS_CADASTRO, novoId } from '../data/cadastrosData';

const ABAS = [
  { id: 'subprocessos', label: 'Subprocessos' },
  { id: 'colaboradores', label: 'Colaboradores' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'modulacoes', label: 'Modulações' },
  { id: 'atividades', label: 'Tipo de atividade' },
  { id: 'diagrama', label: 'Diagrama de atividades' },
];

const CARD_W = 196;
const CARD_H = 96;
const GAP_X = 88;
const GAP_Y = 18;
const PAD = 28;

function nomeCatalogo(valor) {
  return valor.trim().toLocaleUpperCase('pt-BR');
}

function mesmoNome(a, b) {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

function toggleId(lista, id) {
  return lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id];
}

function proximoCodigo(linhas) {
  const usados = new Set(linhas.map((linha) => linha.codigo.toUpperCase()));
  for (let indice = 0; indice < 26; indice += 1) {
    const letra = String.fromCharCode(65 + indice);
    if (!usados.has(letra)) return letra;
  }
  return '';
}

function ErroForm({ id, mensagem }) {
  const ref = useRef(null);
  useEffect(() => {
    if (mensagem) ref.current?.focus();
  }, [mensagem]);
  if (!mensagem) return null;
  return (
    <p id={id} ref={ref} className="form-error" role="alert" tabIndex={-1}>{mensagem}</p>
  );
}

function AcoesLinha({ pending, onAsk, onConfirm, onCancel, extra }) {
  if (pending) {
    return (
      <div className="cad-actions is-confirm" role="group" aria-label="Confirmar exclusão">
        <span className="cad-confirm-label">Excluir?</span>
        <button type="button" className="cad-text-btn danger" onClick={onConfirm}>Confirmar</button>
        <button type="button" className="cad-text-btn" onClick={onCancel}>Cancelar</button>
      </div>
    );
  }
  return (
    <div className="cad-actions">
      {extra}
      <button type="button" className="cad-text-btn danger" onClick={onAsk}>Excluir</button>
    </div>
  );
}

function CheckGrid({ legend, hint, options, selected, onToggle, idPrefix }) {
  return (
    <fieldset className="cad-fieldset">
      <legend className="form-label">{legend}</legend>
      {hint && <p className="cad-help">{hint}</p>}
      <div className="cad-check-grid">
        {options.map((opcao) => (
          <label key={opcao.id} className="cad-check" htmlFor={`${idPrefix}-${opcao.id}`}>
            <input
              id={`${idPrefix}-${opcao.id}`}
              type="checkbox"
              checked={selected.includes(opcao.id)}
              onChange={() => onToggle(opcao.id)}
            />
            <span>{opcao.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function estadoSub(atividade, linhas) {
  return {
    activityId: atividade?.id || '',
    assinatura: linhas.map((linha) => `${linha.id}:${linha.codigo}:${linha.nome}:${linha.minutos}:${linha.ordem}`).join('|'),
    drafts: Object.fromEntries(linhas.map((linha) => [linha.id, { ...linha }])),
    novo: {
      codigo: proximoCodigo(linhas),
      nome: '',
      minutos: 30,
      ordem: linhas.reduce((max, linha) => Math.max(max, Number(linha.ordem) || 0), 0) + 1,
    },
  };
}

function SubprocessosPanel({ catalog, onCatalogChange, onToast }) {
  const [atividadeId, setAtividadeId] = useState('at-listagem');
  const [sync, setSync] = useState(() => estadoSub(null, []));
  const [erro, setErro] = useState('');
  const [pendingId, setPendingId] = useState(null);

  const atividade = catalog.atividades.find((item) => item.id === atividadeId) || catalog.atividades[0];
  const linhas = useMemo(() => {
    const lista = atividade ? (catalog.subprocessos[atividade.id] || []) : [];
    return [...lista].sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo));
  }, [atividade, catalog.subprocessos]);

  const base = atividade ? estadoSub(atividade, linhas) : sync;
  const alinhado = !atividade || (sync.activityId === base.activityId && sync.assinatura === base.assinatura);
  if (atividade && !alinhado) setSync(base);
  const drafts = alinhado ? sync.drafts : base.drafts;
  const novo = alinhado ? sync.novo : base.novo;

  if (!atividade) {
    return <p className="cad-empty">Cadastre um tipo de atividade antes dos subprocessos.</p>;
  }

  const gravarLinhas = (proximasLinhas, mensagem) => {
    onCatalogChange({
      ...catalog,
      subprocessos: { ...catalog.subprocessos, [atividade.id]: proximasLinhas },
    });
    onToast(mensagem);
  };

  const adicionar = (event) => {
    event.preventDefault();
    const codigo = novo.codigo.trim().toLocaleUpperCase('pt-BR');
    const nome = novo.nome.trim();
    if (!codigo || !nome) {
      setErro('Informe código e nome do subprocesso.');
      return;
    }
    if (linhas.some((linha) => linha.codigo.toLocaleUpperCase('pt-BR') === codigo)) {
      setErro(`Código ${codigo} já existe nesta atividade.`);
      return;
    }
    gravarLinhas([
      ...linhas,
      {
        id: novoId('sub'),
        codigo,
        nome,
        minutos: Number(novo.minutos) || 0,
        ordem: Number(novo.ordem) || linhas.length + 1,
      },
    ], `Subprocesso ${codigo} adicionado em ${atividade.nome}.`);
  };

  const salvarLinha = (id) => {
    const draft = drafts[id];
    if (!draft) return;
    const codigo = String(draft.codigo || '').trim().toLocaleUpperCase('pt-BR');
    const nome = String(draft.nome || '').trim();
    if (!codigo || !nome) {
      setErro('Código e nome não podem ficar vazios.');
      return;
    }
    if (linhas.some((linha) => linha.id !== id && linha.codigo.toLocaleUpperCase('pt-BR') === codigo)) {
      setErro(`Código ${codigo} já existe nesta atividade.`);
      return;
    }
    gravarLinhas(linhas.map((linha) => (
      linha.id === id
        ? { ...linha, codigo, nome, minutos: Number(draft.minutos) || 0, ordem: Number(draft.ordem) || 0 }
        : linha
    )), `Subprocesso ${codigo} salvo.`);
  };

  return (
    <div className="cad-stack">
      <div className="cad-toolbar">
        <label className="form-label" htmlFor="subprocesso-atividade">Atividade</label>
        <select
          id="subprocesso-atividade"
          className="form-select"
          value={atividade.id}
          onChange={(event) => setAtividadeId(event.target.value)}
        >
          {catalog.atividades.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}{item.usaSubprocessos ? '' : ' (sem subprocessos)'}
            </option>
          ))}
        </select>
      </div>

      {!atividade.usaSubprocessos && (
        <p className="cad-note">
          {atividade.nome} não usa subprocessos. Marque a opção em Tipo de atividade para liberar esta lista.
        </p>
      )}

      <form className="cad-composer" onSubmit={adicionar}>
        <div className="cad-composer-copy">
          <h2 className="cad-section-title">Novo subprocesso</h2>
          <p className="cad-help">Entra em {atividade.nome}. Código em letra, tempo em minutos.</p>
        </div>
        <div className="cad-form-grid cad-form-grid-sub">
          <div className="form-group">
            <label className="form-label" htmlFor="sub-codigo">Código</label>
            <input id="sub-codigo" className="form-input" value={novo.codigo} aria-invalid={Boolean(erro)} aria-describedby={erro ? 'sub-erro' : undefined} onChange={(event) => { setErro(''); setSync((prev) => ({ ...prev, novo: { ...prev.novo, codigo: event.target.value } })); }} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sub-nome">Nome</label>
            <input id="sub-nome" className="form-input" value={novo.nome} placeholder="Nome do subprocesso" aria-invalid={Boolean(erro)} aria-describedby={erro ? 'sub-erro' : undefined} onChange={(event) => { setErro(''); setSync((prev) => ({ ...prev, novo: { ...prev.novo, nome: event.target.value } })); }} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sub-min">Minutos</label>
            <input id="sub-min" className="form-input" type="number" min="0" value={novo.minutos} onChange={(event) => setSync((prev) => ({ ...prev, novo: { ...prev.novo, minutos: event.target.value } }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sub-ordem">Ordem</label>
            <input id="sub-ordem" className="form-input" type="number" min="1" value={novo.ordem} onChange={(event) => setSync((prev) => ({ ...prev, novo: { ...prev.novo, ordem: event.target.value } }))} />
          </div>
          <div className="cad-composer-actions">
            <button type="submit" className="btn-primary" disabled={!atividade.usaSubprocessos}>
              <Plus size={16} aria-hidden="true" />
              Adicionar subprocesso
            </button>
          </div>
        </div>
        <ErroForm id="sub-erro" mensagem={erro} />
      </form>

      <div className="cad-list">
        <h2 className="cad-section-title">Já em {atividade.nome}</h2>
        <div className="table-card">
        <table className="data-table cad-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Minutos</th>
              <th>Ordem</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={5} className="cad-empty-cell">Nenhum subprocesso nesta atividade.</td>
              </tr>
            ) : linhas.map((linha) => {
              const draft = drafts[linha.id] || linha;
              return (
                <tr key={linha.id} className={pendingId === linha.id ? 'is-pending' : undefined}>
                  <td>
                    <input className="form-input" aria-label={`Código de ${linha.nome}`} value={draft.codigo} onChange={(event) => setSync((prev) => ({ ...prev, drafts: { ...prev.drafts, [linha.id]: { ...draft, codigo: event.target.value } } }))} />
                  </td>
                  <td>
                    <input className="form-input" aria-label={`Nome de ${linha.codigo}`} value={draft.nome} onChange={(event) => setSync((prev) => ({ ...prev, drafts: { ...prev.drafts, [linha.id]: { ...draft, nome: event.target.value } } }))} />
                  </td>
                  <td>
                    <input className="form-input" type="number" min="0" aria-label={`Minutos de ${linha.codigo}`} value={draft.minutos} onChange={(event) => setSync((prev) => ({ ...prev, drafts: { ...prev.drafts, [linha.id]: { ...draft, minutos: event.target.value } } }))} />
                  </td>
                  <td>
                    <input className="form-input" type="number" min="1" aria-label={`Ordem de ${linha.codigo}`} value={draft.ordem} onChange={(event) => setSync((prev) => ({ ...prev, drafts: { ...prev.drafts, [linha.id]: { ...draft, ordem: event.target.value } } }))} />
                  </td>
                  <td>
                    <AcoesLinha
                      pending={pendingId === linha.id}
                      onAsk={() => setPendingId(linha.id)}
                      onCancel={() => setPendingId(null)}
                      onConfirm={() => {
                        gravarLinhas(linhas.filter((item) => item.id !== linha.id), `Subprocesso ${linha.codigo} excluído.`);
                        setPendingId(null);
                      }}
                      extra={<button type="button" className="cad-text-btn" onClick={() => salvarLinha(linha.id)}>Salvar</button>}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function ColaboradoresPanel({ catalog, onCatalogChange, onToast, isUsed }) {
  const vazio = {
    id: null,
    nome: '',
    login: '',
    senha: '',
    papel: 'Executor',
    atividades: [],
    telas: ['executor', 'cronograma'],
  };
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [compondo, setCompondo] = useState(false);
  const nomeRef = useRef(null);

  useEffect(() => {
    if (compondo) nomeRef.current?.focus();
  }, [compondo, form.id]);

  const salvar = (event) => {
    event.preventDefault();
    const nome = nomeCatalogo(form.nome);
    const login = form.login.trim().toLocaleLowerCase('pt-BR');
    if (!nome || !login) {
      setErro('Informe nome e login.');
      return;
    }
    if (catalog.colaboradores.some((item) => item.id !== form.id && mesmoNome(item.nome, nome))) {
      setErro(`Já existe colaborador ${nome}.`);
      return;
    }
    if (catalog.colaboradores.some((item) => item.id !== form.id && item.login.toLocaleLowerCase('pt-BR') === login)) {
      setErro(`Login ${login} já está em uso.`);
      return;
    }
    const anterior = catalog.colaboradores.find((item) => item.id === form.id);
    const registro = {
      id: form.id || novoId('col'),
      nome,
      login,
      senha: form.senha || anterior?.senha || '',
      papel: form.papel,
      atividades: form.atividades,
      telas: form.telas,
    };
    const colaboradores = anterior
      ? catalog.colaboradores.map((item) => (item.id === anterior.id ? registro : item))
      : [...catalog.colaboradores, registro];
    const renomeou = anterior && anterior.nome !== nome;
    const atividades = renomeou
      ? catalog.atividades.map((item) => (
        item.colaboradorPadrao === anterior.nome ? { ...item, colaboradorPadrao: nome } : item
      ))
      : catalog.atividades;
    onCatalogChange(
      { ...catalog, colaboradores, atividades },
      renomeou ? { field: 'executor', from: anterior.nome, to: nome } : undefined,
    );
    onToast(anterior ? `${nome} atualizado.` : `${nome} adicionado.`);
    setForm(vazio);
    setErro('');
    setCompondo(false);
  };

  return (
    <div className="cad-stack">
      <div className="cad-list-head">
        <div>
          <h2 className="cad-section-title">Colaboradores</h2>
          <p className="cad-help">Nome em maiúsculas. Login em minúsculas, sem repetir.</p>
        </div>
        {!compondo && (
          <button type="button" className="btn-primary" onClick={() => { setForm(vazio); setErro(''); setCompondo(true); }}>
            <Plus size={16} aria-hidden="true" />
            Novo colaborador
          </button>
        )}
      </div>

      {compondo && (
        <form className="cad-composer" onSubmit={salvar}>
          <div className="cad-composer-copy">
            <h2 className="cad-section-title">{form.id ? 'Editar colaborador' : 'Novo colaborador'}</h2>
            <p className="cad-help">Identificação primeiro. Atividades e telas ficam abaixo, só neste cadastro.</p>
          </div>
          <div className="cad-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="col-nome">Nome</label>
              <input ref={nomeRef} id="col-nome" className="form-input" value={form.nome} placeholder="Ex.: ANDERSON" aria-invalid={Boolean(erro)} aria-describedby={erro ? 'col-erro' : undefined} onChange={(event) => { setErro(''); setForm({ ...form, nome: event.target.value }); }} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="col-login">Login</label>
              <input id="col-login" className="form-input" autoComplete="off" spellCheck={false} value={form.login} aria-invalid={Boolean(erro)} aria-describedby={erro ? 'col-erro' : undefined} onChange={(event) => { setErro(''); setForm({ ...form, login: event.target.value }); }} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="col-senha">Senha</label>
              <input id="col-senha" className="form-input" type="password" autoComplete="new-password" value={form.senha} placeholder={form.id ? 'Em branco mantém a senha atual' : 'Defina uma senha'} onChange={(event) => setForm({ ...form, senha: event.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="col-papel">Papel</label>
              <select id="col-papel" className="form-select" value={form.papel} onChange={(event) => setForm({ ...form, papel: event.target.value })}>
                {PAPEIS.map((papel) => <option key={papel} value={papel}>{papel}</option>)}
              </select>
            </div>
          </div>
          <CheckGrid
            legend="Atividades visíveis"
            hint="Quais atividades esta pessoa enxerga no cadastro."
            idPrefix="col-at"
            selected={form.atividades}
            onToggle={(id) => setForm({ ...form, atividades: toggleId(form.atividades, id) })}
            options={catalog.atividades.map((item) => ({ id: item.id, label: item.nome }))}
          />
          <CheckGrid
            legend="Telas visíveis"
            hint="Quais telas ficam marcadas no cadastro. O menu real ainda segue o modo ADM ou Executor."
            idPrefix="col-tela"
            selected={form.telas}
            onToggle={(id) => setForm({ ...form, telas: toggleId(form.telas, id) })}
            options={TELAS_CADASTRO}
          />
          <div className="cad-composer-actions">
            <button type="button" className="btn-secondary" onClick={() => { setForm(vazio); setErro(''); setCompondo(false); }}>Cancelar</button>
            <button type="submit" className="btn-primary">
              {form.id ? 'Salvar colaborador' : 'Adicionar colaborador'}
            </button>
          </div>
        </form>
      )}
      <ErroForm id="col-erro" mensagem={erro} />

      <div className="table-card">
        <table className="data-table cad-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Login</th>
              <th>Papel</th>
              <th>Telas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {catalog.colaboradores.map((pessoa) => (
              <tr key={pessoa.id} className={pendingId === pessoa.id ? 'is-pending' : undefined}>
                <td className="code-cell">{pessoa.nome}</td>
                <td>{pessoa.login}</td>
                <td>{pessoa.papel}</td>
                <td>{pessoa.telas.length}</td>
                <td>
                  <AcoesLinha
                    pending={pendingId === pessoa.id}
                    onAsk={() => setPendingId(pessoa.id)}
                    onCancel={() => setPendingId(null)}
                    onConfirm={() => {
                      if (isUsed('executor', pessoa.nome)) {
                        setErro(`${pessoa.nome} está em demandas. Renomeie em vez de excluir.`);
                        setPendingId(null);
                        return;
                      }
                      onCatalogChange({
                        ...catalog,
                        colaboradores: catalog.colaboradores.filter((item) => item.id !== pessoa.id),
                      });
                      onToast(`${pessoa.nome} excluído.`);
                      setPendingId(null);
                    }}
                    extra={<button type="button" className="cad-text-btn" onClick={() => { setForm({ ...pessoa, senha: '' }); setErro(''); setCompondo(true); }}>Editar</button>}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListaNomePanel({ titulo, ajuda, placeholder, acao, itens, field, catalogKey, catalog, onCatalogChange, onToast, isUsed }) {
  const [nome, setNome] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [erro, setErro] = useState('');
  const [pendingId, setPendingId] = useState(null);

  const adicionar = (event) => {
    event.preventDefault();
    const valor = nomeCatalogo(nome);
    if (!valor) {
      setErro('Informe um nome.');
      return;
    }
    if (itens.some((item) => mesmoNome(item.nome, valor))) {
      setErro(`${valor} já está na lista.`);
      return;
    }
    onCatalogChange({
      ...catalog,
      [catalogKey]: [...itens, { id: novoId(catalogKey), nome: valor }],
    });
    onToast(`${valor} adicionado.`);
    setNome('');
    setErro('');
  };

  const salvarEdicao = (item) => {
    const valor = nomeCatalogo(editNome);
    if (!valor) {
      setErro('Informe um nome.');
      return;
    }
    if (itens.some((outro) => outro.id !== item.id && mesmoNome(outro.nome, valor))) {
      setErro(`${valor} já está na lista.`);
      return;
    }
    onCatalogChange(
      { ...catalog, [catalogKey]: itens.map((outro) => (outro.id === item.id ? { ...outro, nome: valor } : outro)) },
      item.nome !== valor ? { field, from: item.nome, to: valor } : undefined,
    );
    onToast(`${valor} atualizado.`);
    setEditId(null);
    setErro('');
  };

  return (
    <div className="cad-stack">
      <form className="cad-composer cad-composer-inline" onSubmit={adicionar}>
        <div className="form-group">
          <label className="form-label" htmlFor={`${catalogKey}-novo`}>Novo nome</label>
          <input
            id={`${catalogKey}-novo`}
            className="form-input"
            value={nome}
            placeholder={placeholder}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? `${catalogKey}-erro` : undefined}
            onChange={(event) => { setErro(''); setNome(event.target.value); }}
          />
          <p className="cad-help">{ajuda}</p>
        </div>
        <button type="submit" className="btn-primary">
          <Plus size={16} aria-hidden="true" />
          {acao}
        </button>
      </form>
      <ErroForm id={`${catalogKey}-erro`} mensagem={erro} />
      <div className="cad-list">
        <h2 className="cad-section-title">Já cadastrados</h2>
        <div className="table-card">
        <table className="data-table cad-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr>
                <td colSpan={2} className="cad-empty-cell">Nenhum item cadastrado.</td>
              </tr>
            ) : itens.map((item) => (
              <tr key={item.id} className={pendingId === item.id ? 'is-pending' : undefined}>
                <td>
                  {editId === item.id ? (
                    <input className="form-input" aria-label={`Nome de ${item.nome}`} value={editNome} onChange={(event) => setEditNome(event.target.value)} />
                  ) : (
                    <span className="code-cell">{item.nome}</span>
                  )}
                </td>
                <td>
                  <AcoesLinha
                    pending={pendingId === item.id}
                    onAsk={() => setPendingId(item.id)}
                    onCancel={() => setPendingId(null)}
                    onConfirm={() => {
                      if (isUsed(field, item.nome)) {
                        setErro(`${item.nome} está em demandas. Renomeie em vez de excluir.`);
                        setPendingId(null);
                        return;
                      }
                      onCatalogChange({
                        ...catalog,
                        [catalogKey]: itens.filter((outro) => outro.id !== item.id),
                      });
                      onToast(`${item.nome} excluído.`);
                      setPendingId(null);
                    }}
                    extra={editId === item.id ? (
                      <button type="button" className="cad-text-btn" onClick={() => salvarEdicao(item)}>Salvar</button>
                    ) : (
                      <button type="button" className="cad-text-btn" onClick={() => { setEditId(item.id); setEditNome(item.nome); setErro(''); }}>Editar</button>
                    )}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function resumirNomes(ids, atividades) {
  const nomes = ids
    .map((id) => atividades.find((item) => item.id === id)?.nome)
    .filter(Boolean);
  if (!nomes.length) return 'nenhuma';
  if (nomes.length <= 2) return nomes.join(', ');
  return `${nomes.slice(0, 2).join(', ')} +${nomes.length - 2}`;
}

function LigacoesTipo({ abertas, onToggle, opcoes, anteriores, proximas, nomes, onAnterior, onProxima }) {
  return (
    <div className="cad-links">
      <button
        type="button"
        className="cad-links-toggle"
        aria-expanded={abertas}
        aria-controls="at-ligacoes"
        onClick={onToggle}
      >
        <span>Ligações</span>
        <span className="cad-help">Antes: {resumirNomes(anteriores, nomes)}. Depois: {resumirNomes(proximas, nomes)}.</span>
      </button>
      <div id="at-ligacoes" className="cad-link-split" hidden={!abertas}>
        <CheckGrid
          legend="Antes desta"
          idPrefix="at-ant"
          selected={anteriores}
          onToggle={onAnterior}
          options={opcoes}
        />
        <CheckGrid
          legend="Depois desta"
          idPrefix="at-prox"
          selected={proximas}
          onToggle={onProxima}
          options={opcoes}
        />
      </div>
    </div>
  );
}

function tipoVazio(colaboradores) {
  return {
    id: null,
    nome: '',
    ordem: 0,
    minutos: 60,
    colaboradorPadrao: colaboradores[0]?.nome || '',
    usaSubprocessos: false,
    cor: '#10B981',
    proximas: [],
    anteriores: [],
  };
}

function TiposPanel({ catalog, onCatalogChange, onToast, isUsed, onOpenDiagram }) {
  const [form, setForm] = useState(() => tipoVazio(catalog.colaboradores));
  const [erro, setErro] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [compondo, setCompondo] = useState(false);
  const [ligacoesAbertas, setLigacoesAbertas] = useState(false);
  const nomeRef = useRef(null);

  useEffect(() => {
    if (compondo) nomeRef.current?.focus();
  }, [compondo, form.id]);

  const opcoes = catalog.atividades
    .filter((item) => item.id !== form.id)
    .map((item) => ({ id: item.id, label: item.nome }));

  const carregar = (atividade) => {
    setErro('');
    setCompondo(true);
    setLigacoesAbertas(true);
    setForm({
      ...atividade,
      anteriores: catalog.atividades.filter((item) => item.proximas.includes(atividade.id)).map((item) => item.id),
    });
  };

  const salvar = (event) => {
    event.preventDefault();
    const nome = nomeCatalogo(form.nome);
    if (!nome) {
      setErro('Informe o nome da atividade.');
      return;
    }
    if (catalog.atividades.some((item) => item.id !== form.id && mesmoNome(item.nome, nome))) {
      setErro(`${nome} já existe.`);
      return;
    }
    const anterior = catalog.atividades.find((item) => item.id === form.id);
    const id = form.id || novoId('at');
    const registro = {
      id,
      nome,
      ordem: Number(form.ordem) || 0,
      minutos: Number(form.minutos) || 0,
      colaboradorPadrao: form.colaboradorPadrao,
      usaSubprocessos: Boolean(form.usaSubprocessos),
      cor: form.cor || '#10B981',
      proximas: form.proximas.filter((proxima) => proxima !== id),
    };
    let atividades = anterior
      ? catalog.atividades.map((item) => (item.id === id ? registro : { ...item, proximas: [...item.proximas] }))
      : [...catalog.atividades.map((item) => ({ ...item, proximas: [...item.proximas] })), registro];

    atividades = atividades.map((item) => {
      if (item.id === id) return item;
      const deveApontar = form.anteriores.includes(item.id);
      const aponta = item.proximas.includes(id);
      if (deveApontar && !aponta) return { ...item, proximas: [...item.proximas, id] };
      if (!deveApontar && aponta) return { ...item, proximas: item.proximas.filter((proxima) => proxima !== id) };
      return item;
    });

    onCatalogChange(
      { ...catalog, atividades },
      anterior && anterior.nome !== nome ? { field: 'atividade', from: anterior.nome, to: nome } : undefined,
    );
    onToast(anterior ? `${nome} atualizado.` : `${nome} adicionado.`);
    setForm(tipoVazio(catalog.colaboradores));
    setErro('');
    setCompondo(false);
    setLigacoesAbertas(false);
  };

  return (
    <div className="cad-stack">
      <div className="cad-list-head">
        <div>
          <h2 className="cad-section-title">Tipos de atividade</h2>
          <p className="cad-help">Tempo, cor e para qual etapa cada atividade segue.</p>
        </div>
        <div className="cad-composer-actions">
          <button type="button" className="btn-secondary" onClick={() => onOpenDiagram(null)}>Ver diagrama</button>
          {!compondo && (
            <button type="button" className="btn-primary" onClick={() => { setForm(tipoVazio(catalog.colaboradores)); setErro(''); setLigacoesAbertas(false); setCompondo(true); }}>
              <Plus size={16} aria-hidden="true" />
              Novo tipo
            </button>
          )}
        </div>
      </div>

      {compondo && (
        <form className="cad-composer" onSubmit={salvar}>
          <div className="cad-composer-copy">
            <h2 className="cad-section-title">{form.id ? 'Editar tipo' : 'Novo tipo'}</h2>
            <p className="cad-help">Nome em maiúsculas. O colaborador padrão entra nas demandas novas.</p>
          </div>
          <div className="cad-form-grid cad-form-grid-tipo">
            <div className="form-group">
              <label className="form-label" htmlFor="at-nome">Nome</label>
              <input ref={nomeRef} id="at-nome" className="form-input" placeholder="Ex.: LISTAGEM" value={form.nome} aria-invalid={Boolean(erro)} aria-describedby={erro ? 'at-erro' : undefined} onChange={(event) => { setErro(''); setForm({ ...form, nome: event.target.value }); }} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-ordem">Ordem</label>
              <input id="at-ordem" className="form-input" type="number" min="0" value={form.ordem} onChange={(event) => setForm({ ...form, ordem: event.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-min">Minutos</label>
              <input id="at-min" className="form-input" type="number" min="0" value={form.minutos} onChange={(event) => setForm({ ...form, minutos: event.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-cor">Cor</label>
              <input id="at-cor" className="cad-color" type="color" value={form.cor} onChange={(event) => setForm({ ...form, cor: event.target.value })} />
            </div>
          </div>
          <div className="cad-tipo-meta">
            <div className="form-group">
              <label className="form-label" htmlFor="at-padrao">Colaborador padrão</label>
              <select id="at-padrao" className="form-select" value={form.colaboradorPadrao} onChange={(event) => setForm({ ...form, colaboradorPadrao: event.target.value })}>
                {catalog.colaboradores.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.nome}>{pessoa.nome}</option>
                ))}
              </select>
            </div>
            <label className="cad-check" htmlFor="at-sub">
              <input id="at-sub" type="checkbox" checked={form.usaSubprocessos} onChange={(event) => setForm({ ...form, usaSubprocessos: event.target.checked })} />
              <span>Usa subprocessos</span>
            </label>
          </div>
          <LigacoesTipo
            abertas={ligacoesAbertas}
            onToggle={() => setLigacoesAbertas((valor) => !valor)}
            opcoes={opcoes}
            anteriores={form.anteriores}
            proximas={form.proximas}
            nomes={catalog.atividades}
            onAnterior={(id) => setForm({ ...form, anteriores: toggleId(form.anteriores, id) })}
            onProxima={(id) => setForm({ ...form, proximas: toggleId(form.proximas, id) })}
          />
          <div className="cad-composer-actions">
            <button type="button" className="btn-secondary" onClick={() => { setForm(tipoVazio(catalog.colaboradores)); setErro(''); setCompondo(false); setLigacoesAbertas(false); }}>Cancelar</button>
            <button type="submit" className="btn-primary">
              {form.id ? 'Salvar tipo' : 'Adicionar tipo'}
            </button>
          </div>
        </form>
      )}
      <ErroForm id="at-erro" mensagem={erro} />

      <div className="cad-activity-list">
        {catalog.atividades.map((atividade) => {
          const proximas = atividade.proximas
            .map((id) => catalog.atividades.find((item) => item.id === id)?.nome)
            .filter(Boolean);
          return (
            <article key={atividade.id} className={`cad-activity-row${pendingId === atividade.id ? ' is-pending' : ''}`}>
              <span className="activity-dot" style={{ background: atividade.cor, color: atividade.cor }} />
              <div className="cad-activity-copy">
                <h3>{atividade.nome}</h3>
                <p>{atividade.minutos} min · padrão {atividade.colaboradorPadrao || 'sem padrão'} · ordem {atividade.ordem}</p>
                <p>{proximas.length ? `Próximas: ${proximas.join(', ')}` : 'Sem próxima atividade'}</p>
              </div>
              <AcoesLinha
                pending={pendingId === atividade.id}
                onAsk={() => setPendingId(atividade.id)}
                onCancel={() => setPendingId(null)}
                onConfirm={() => {
                  if (isUsed('atividade', atividade.nome)) {
                    setErro(`${atividade.nome} está em demandas. Renomeie em vez de excluir.`);
                    setPendingId(null);
                    return;
                  }
                  onCatalogChange({
                    ...catalog,
                    atividades: catalog.atividades
                      .filter((item) => item.id !== atividade.id)
                      .map((item) => ({ ...item, proximas: item.proximas.filter((id) => id !== atividade.id) })),
                    subprocessos: Object.fromEntries(
                      Object.entries(catalog.subprocessos).filter(([chave]) => chave !== atividade.id),
                    ),
                    colaboradores: catalog.colaboradores.map((pessoa) => ({
                      ...pessoa,
                      atividades: pessoa.atividades.filter((id) => id !== atividade.id),
                    })),
                  });
                  onToast(`${atividade.nome} excluído.`);
                  setPendingId(null);
                }}
                extra={(
                  <>
                    <button type="button" className="cad-text-btn" onClick={() => carregar(atividade)}>Editar</button>
                    <button type="button" className="cad-text-btn" onClick={() => onOpenDiagram(atividade.id)}>Diagrama</button>
                  </>
                )}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function caminho(origem, destino) {
  const x1 = origem.x + CARD_W;
  const y1 = origem.y + CARD_H / 2;
  const mesmaColuna = Math.abs(destino.x - origem.x) < 8;
  const x2 = destino.x + (mesmaColuna ? CARD_W : 0);
  const y2 = destino.y + CARD_H / 2;
  const curva = mesmaColuna ? 36 : Math.max(36, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + curva} ${y1}, ${x2 - curva} ${y2}, ${x2} ${y2}`;
}

function DiagramaPanel({ catalog, onCatalogChange, onToast, origemId, setOrigemId }) {
  const { pos, largura, altura } = useMemo(() => {
    const ordens = [...new Set(catalog.atividades.map((item) => Number(item.ordem) || 0))].sort((a, b) => a - b);
    const colunas = ordens.map((ordem) => catalog.atividades.filter((item) => (Number(item.ordem) || 0) === ordem));
    const mapa = new Map();
    colunas.forEach((coluna, colunaIndice) => {
      coluna.forEach((atividade, linhaIndice) => {
        mapa.set(atividade.id, {
          x: PAD + colunaIndice * (CARD_W + GAP_X),
          y: PAD + linhaIndice * (CARD_H + GAP_Y),
        });
      });
    });
    const linhasMax = Math.max(1, ...colunas.map((coluna) => coluna.length));
    return {
      pos: mapa,
      largura: PAD * 2 + Math.max(1, colunas.length) * CARD_W + Math.max(0, colunas.length - 1) * GAP_X,
      altura: PAD * 2 + linhasMax * CARD_H + (linhasMax - 1) * GAP_Y,
    };
  }, [catalog.atividades]);

  const origem = catalog.atividades.find((item) => item.id === origemId);

  const clicar = (id) => {
    if (!origemId || origemId === id) {
      setOrigemId(origemId === id ? null : id);
      return;
    }
    onCatalogChange({
      ...catalog,
      atividades: catalog.atividades.map((item) => {
        if (item.id !== origemId) return item;
        const proximas = item.proximas.includes(id)
          ? item.proximas.filter((proxima) => proxima !== id)
          : [...item.proximas, id];
        return { ...item, proximas };
      }),
    });
  };

  const salvarPadrao = () => {
    onCatalogChange({
      ...catalog,
      diagramDefault: catalog.atividades.map((item) => ({
        id: item.id,
        ordem: item.ordem,
        proximas: [...item.proximas],
      })),
    });
    onToast('Diagrama atual salvo como padrão.');
  };

  const restaurar = () => {
    const porId = new Map(catalog.diagramDefault.map((item) => [item.id, item]));
    onCatalogChange({
      ...catalog,
      atividades: catalog.atividades.map((item) => {
        const salvo = porId.get(item.id);
        if (!salvo) return item;
        return { ...item, ordem: salvo.ordem, proximas: [...salvo.proximas] };
      }),
    });
    onToast('Fluxo padrão restaurado.');
  };

  return (
    <div className="cad-stack">
      <div className="cad-diagram-head">
        <p className="cad-help">
          {origem
            ? `Origem: ${origem.nome}. Clique outra atividade para ligar ou desligar a próxima etapa.`
            : 'Clique uma atividade para usá-la como origem. Depois clique a próxima.'}
        </p>
        <div className="cad-form-actions">
          <button type="button" className="btn-secondary" onClick={salvarPadrao}>
            <Save size={15} aria-hidden="true" />
            Salvar diagrama atual como padrão
          </button>
          <button type="button" className="btn-secondary" onClick={restaurar}>
            <RotateCcw size={15} aria-hidden="true" />
            Restaurar fluxo padrão
          </button>
        </div>
      </div>
      <div className="cad-diagram-scroll">
        <div className="cad-diagram" style={{ width: largura, height: altura }}>
          <svg className="cad-diagram-svg" width={largura} height={altura} aria-hidden="true">
            <defs>
              <marker id="cad-seta" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6" fill="none" stroke="rgba(248,250,252,0.7)" strokeWidth="1.2" />
              </marker>
            </defs>
            {catalog.atividades.flatMap((item) => item.proximas.map((proxima) => {
              const de = pos.get(item.id);
              const para = pos.get(proxima);
              if (!de || !para) return null;
              return (
                <path
                  key={`${item.id}-${proxima}`}
                  d={caminho(de, para)}
                  fill="none"
                  stroke="rgba(248,250,252,0.55)"
                  strokeWidth="1.4"
                  markerEnd="url(#cad-seta)"
                />
              );
            }))}
          </svg>
          {catalog.atividades.map((item) => {
            const ponto = pos.get(item.id);
            if (!ponto) return null;
            return (
              <button
                key={item.id}
                type="button"
                className={`cad-node ${origemId === item.id ? 'is-origin' : ''}`}
                style={{ left: ponto.x, top: ponto.y, borderColor: item.cor }}
                aria-pressed={origemId === item.id}
                onClick={() => clicar(item.id)}
              >
                <strong>{item.nome}</strong>
                <span>Ordem {item.ordem} · {item.minutos} min</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function contagemAba(catalog, id) {
  if (id === 'subprocessos') {
    return Object.values(catalog.subprocessos).reduce((total, lista) => total + lista.length, 0);
  }
  if (id === 'colaboradores') return catalog.colaboradores.length;
  if (id === 'produtos') return catalog.produtos.length;
  if (id === 'modulacoes') return catalog.modulacoes.length;
  if (id === 'atividades') return catalog.atividades.length;
  return null;
}

export default function CadastrosView({ catalog, onCatalogChange, onToast, isUsed }) {
  const [aba, setAba] = useState('subprocessos');
  const [origemId, setOrigemId] = useState(null);

  const abrirDiagrama = (id) => {
    setOrigemId(id || null);
    setAba('diagrama');
  };

  const moverAba = (event, indice) => {
    const mapa = { ArrowRight: 1, ArrowLeft: -1, Home: 0, End: ABAS.length - 1 };
    if (!(event.key in mapa)) return;
    event.preventDefault();
    const proximo = event.key === 'Home' || event.key === 'End'
      ? mapa[event.key]
      : (indice + mapa[event.key] + ABAS.length) % ABAS.length;
    const destino = ABAS[proximo];
    setAba(destino.id);
    document.getElementById(`cad-tab-${destino.id}`)?.focus();
  };

  const painel = (id, conteudo) => (
    aba === id ? (
      <div id={`cad-panel-${id}`} role="tabpanel" aria-labelledby={`cad-tab-${id}`} className="cad-panel">
        {conteudo}
      </div>
    ) : null
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cadastros</h1>
          <p className="page-subtitle">Catálogos de subprocessos, pessoas, produtos, modulações e o fluxo entre atividades.</p>
        </div>
      </div>

      <div className="cad-tabs" role="tablist" aria-label="Áreas de cadastro">
        {ABAS.map((item, indice) => {
          const total = contagemAba(catalog, item.id);
          const ativa = aba === item.id;
          return (
            <button
              key={item.id}
              id={`cad-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls={`cad-panel-${item.id}`}
              tabIndex={ativa ? 0 : -1}
              className={`cad-tab ${ativa ? 'active' : ''}`}
              onClick={() => setAba(item.id)}
              onKeyDown={(event) => moverAba(event, indice)}
            >
              {item.label}
              {total !== null && <span className="cad-tab-count">{total}</span>}
            </button>
          );
        })}
      </div>

      {painel('subprocessos', (
        <SubprocessosPanel catalog={catalog} onCatalogChange={onCatalogChange} onToast={onToast} />
      ))}
      {painel('colaboradores', (
        <ColaboradoresPanel catalog={catalog} onCatalogChange={onCatalogChange} onToast={onToast} isUsed={isUsed} />
      ))}
      {painel('produtos', (
        <ListaNomePanel
          titulo="Produtos"
          ajuda="O nome entra em maiúsculas e passa a aparecer nas demandas."
          placeholder="Ex.: SAMBO"
          acao="Adicionar produto"
          itens={catalog.produtos}
          field="produto"
          catalogKey="produtos"
          catalog={catalog}
          onCatalogChange={onCatalogChange}
          onToast={onToast}
          isUsed={isUsed}
        />
      ))}
      {painel('modulacoes', (
        <ListaNomePanel
          titulo="Modulações"
          ajuda="Variante do produto. Também entra em maiúsculas."
          placeholder="Ex.: POL"
          acao="Adicionar modulação"
          itens={catalog.modulacoes}
          field="modulacao"
          catalogKey="modulacoes"
          catalog={catalog}
          onCatalogChange={onCatalogChange}
          onToast={onToast}
          isUsed={isUsed}
        />
      ))}
      {painel('atividades', (
        <TiposPanel
          catalog={catalog}
          onCatalogChange={onCatalogChange}
          onToast={onToast}
          isUsed={isUsed}
          onOpenDiagram={abrirDiagrama}
        />
      ))}
      {painel('diagrama', (
        <DiagramaPanel
          catalog={catalog}
          onCatalogChange={onCatalogChange}
          onToast={onToast}
          origemId={origemId}
          setOrigemId={setOrigemId}
        />
      ))}
    </div>
  );
}
