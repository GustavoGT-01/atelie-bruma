import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import DemandasAdmView from './components/DemandasAdmView';
import PainelExecutorView from './components/PainelExecutorView';
import DashboardView from './components/DashboardView';
import CronogramaView from './components/CronogramaView';
import FluxoEtapasView from './components/FluxoEtapasView';
import CadastrosView from './components/CadastrosView';
import RelatoriosView from './components/RelatoriosView';
import NewDemandModal from './components/NewDemandModal';
import LoginView from './components/LoginView';
import { INITIAL_CATALOG } from './data/cadastrosData';
import { gerarInsights } from './insights';
import { excluirBackup, lerBackups, restaurarBackup, salvarBackup } from './backups';
import { entrar, lerSessao, sair } from './api/auth';
import { carregarCatalogo, salvarModoUi, sincronizarCatalogo } from './api/catalogo';
import {
  criarDemandas,
  finalizarDemanda,
  iniciarDemanda,
  listarDemandas,
  pausarDemanda,
  zerarTempoDemanda,
} from './api/demandas';
import { Bell, Search, Command, Check, Menu, X } from 'lucide-react';
import './App.css';

const TIPOS_POR_LIGACAO = ['TI', 'GERENCIA'];

function demandaDoUsuario(demanda, usuarioNome, catalog) {
  const tipoNome = (demanda.atividade || '').toUpperCase().trim();
  if (TIPOS_POR_LIGACAO.includes(tipoNome)) {
    const pessoa = catalog.colaboradores.find((item) => item.nome === usuarioNome);
    const tipo = catalog.atividades.find((item) => item.nome === demanda.atividade);
    if (!pessoa || !tipo) return false;
    return (pessoa.atividades || []).includes(tipo.id);
  }
  return demanda.executor === usuarioNome;
}

export default function App() {
  const [sessao, setSessao] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [demands, setDemands] = useState([]);
  const [catalog, setCatalog] = useState(INITIAL_CATALOG);
  const [backups, setBackups] = useState([]);
  const [currentTab, setCurrentTab] = useState('demandas');
  const [appMode, setAppMode] = useState('ADM');
  const [activeDemand, setActiveDemand] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [insightAberto, setInsightAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const insightsVistos = useRef(new Set());
  const usuarioAtual = sessao?.user?.nome || 'GUSTAVO';

  const triggerToast = (msg) => {
    setToastLeaving(false);
    setToastKey((key) => key + 1);
    setToastMessage(msg);
  };

  const aplicarSessao = (dados) => {
    setSessao(dados);
    if (!dados) return;
    const modo = dados.adminUi ? 'ADM' : 'EXECUTOR';
    setAppMode(modo);
    if (modo === 'EXECUTOR') setCurrentTab('executor');
  };

  useEffect(() => {
    let ativo = true;
    lerSessao()
      .then((dados) => {
        if (!ativo) return;
        aplicarSessao(dados);
      })
      .catch(() => {
        if (ativo) setSessao(null);
      })
      .finally(() => {
        if (ativo) setCarregandoSessao(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const aplicarDemandas = (lista) => {
    setDemands(lista);
    setActiveDemand((prev) => lista.find((item) => item.id === prev?.id) || lista[0] || null);
    return lista;
  };

  const recarregarDemandas = () => listarDemandas().then(aplicarDemandas);

  useEffect(() => {
    if (!sessao) return undefined;
    let ativo = true;
    setCarregandoDados(true);
    Promise.all([
      carregarCatalogo(),
      listarDemandas(),
      sessao.adminUi ? lerBackups().catch(() => []) : Promise.resolve([]),
    ])
      .then(([catalogo, lista, listaBackups]) => {
        if (!ativo) return;
        setCatalog(catalogo);
        aplicarDemandas(lista);
        setBackups(listaBackups);
      })
      .catch((erro) => {
        if (ativo) triggerToast(erro?.message || 'Não foi possível carregar os dados.');
      })
      .finally(() => {
        if (ativo) setCarregandoDados(false);
      });
    return () => {
      ativo = false;
    };
  }, [sessao]);

  const trocarModo = (modo) => {
    setAppMode(modo);
    if (modo === 'EXECUTOR') setCurrentTab('executor');
    const gravar = sessao?.isRealAdmin ? salvarModoUi(modo) : Promise.resolve();
    gravar
      .then(() => recarregarDemandas())
      .catch((erro) => triggerToast(erro?.message || 'Não foi possível atualizar o modo.'));
  };

  const fazerLogin = async (login, senha) => {
    await entrar(login, senha);
    aplicarSessao(await lerSessao());
  };

  const fazerLogout = async () => {
    await sair();
    setSessao(null);
    setCurrentTab('demandas');
  };

  useEffect(() => {
    if (!toastMessage || toastLeaving) return undefined;
    const hideId = setTimeout(() => setToastLeaving(true), 3500);
    return () => clearTimeout(hideId);
  }, [toastMessage, toastKey, toastLeaving]);

  useEffect(() => {
    if (!toastLeaving) return undefined;
    const removeId = setTimeout(() => {
      setToastMessage(null);
      setToastLeaving(false);
    }, 160);
    return () => clearTimeout(removeId);
  }, [toastLeaving]);

  // Keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCurrentTab('demandas');
        const input = document.querySelector('.search-input');
        if (input) input.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle switching to executor view for a specific demand
  const handleSelectDemand = (demand) => {
    setActiveDemand(demand);
    setCurrentTab('executor');
    triggerToast(`Demanda ${demand.id} selecionada no Painel do Executor`);
  };

  // Handle status update from timer/executor
  const handleUpdateDemandStatus = (id, newStatus, reason) => {
    const alvo = demands.find((item) => item.id === id);
    if (!alvo) return;
    const statusAnterior = alvo.status;
    const statusAntes = new Map(demands.map((item) => [item.id, item.status]));

    const acao = newStatus === 'Em andamento'
      ? iniciarDemanda(alvo.serverId)
      : newStatus === 'Pausado'
        ? pausarDemanda(alvo.serverId, reason || 'Setup / preparação')
        : newStatus === 'Concluída'
          ? finalizarDemanda(alvo.serverId)
          : null;
    if (!acao) return;

    acao
      .then(recarregarDemandas)
      .then((lista) => {
        if (statusAnterior === newStatus) return;
        const liberou = lista.filter((item) => (
          statusAntes.get(item.id) === 'Aguardando' && item.status === 'Liberada'
        )).length;
        const aviso = liberou === 1
          ? ' A próxima etapa foi liberada.'
          : liberou > 1
            ? ` ${liberou} próximas etapas foram liberadas.`
            : '';
        triggerToast(`Status da ${id} alterado para "${newStatus}".${aviso}`);
      })
      .catch((erro) => {
        triggerToast(erro?.message || 'Não foi possível gravar a mudança.');
        recarregarDemandas().catch(() => {});
      });
  };

  const handleResetTempo = (id) => {
    const alvo = demands.find((item) => item.id === id);
    if (!alvo) return;
    zerarTempoDemanda(alvo.serverId)
      .then(recarregarDemandas)
      .then(() => triggerToast(`Tempo da ${id} zerado.`))
      .catch((erro) => {
        triggerToast(erro?.message || 'Não foi possível zerar o tempo.');
        recarregarDemandas().catch(() => {});
      });
  };

  const handleAddDemand = (novas) => {
    const lista = Array.isArray(novas) ? novas : [novas];
    criarDemandas(lista, catalog)
      .then((criadas) => recarregarDemandas().then(() => criadas))
      .then((criadas) => {
        triggerToast(criadas.length === 1
          ? `Demanda ${criadas[0].codigo} criada com sucesso!`
          : `${criadas.length} demandas criadas.`);
      })
      .catch((erro) => {
        triggerToast(erro?.message || 'Não foi possível criar a demanda.');
        recarregarDemandas().catch(() => {});
      });
  };

  const recarregarBackups = () =>
    lerBackups()
      .then(setBackups)
      .catch(() => setBackups([]));

  const handleImportDemands = (resultado) => {
    const quantidade = resultado?.imported ?? resultado?.length ?? 0;
    recarregarDemandas()
      .then(() => triggerToast(`${quantidade} demandas importadas.`))
      .catch((erro) => triggerToast(erro?.message || 'Não foi possível recarregar as demandas.'));
  };

  const handleSalvarBackup = () =>
    salvarBackup()
      .then(recarregarBackups)
      .then(() => {
        triggerToast('Backup salvo.');
        return '';
      })
      .catch((erro) => erro?.message || 'Não foi possível salvar o backup.');

  const handleRestaurarBackup = (backup) =>
    restaurarBackup(backup.id)
      .then(() => Promise.all([carregarCatalogo(), recarregarDemandas(), recarregarBackups()]))
      .then(([catalogo]) => {
        setCatalog(catalogo);
        triggerToast('Backup restaurado.');
        return '';
      })
      .catch((erro) => erro?.message || 'Não foi possível restaurar o backup.');

  const handleExcluirBackup = (id) =>
    excluirBackup(id)
      .then(recarregarBackups)
      .then(() => {
        triggerToast('Backup excluído.');
        return '';
      })
      .catch((erro) => erro?.message || 'Não foi possível excluir o backup.');

  const atividadesConfig = useMemo(() => {
    const mapa = {};
    catalog.atividades.forEach((atividade) => {
      mapa[atividade.nome] = { color: atividade.cor, label: atividade.nome };
    });
    return mapa;
  }, [catalog.atividades]);

  const produtoNames = useMemo(
    () => catalog.produtos.map((item) => item.nome),
    [catalog.produtos],
  );
  const demandsDoExecutor = useMemo(() => {
    if (appMode !== 'EXECUTOR') return demands;
    return demands.filter((item) => demandaDoUsuario(item, usuarioAtual, catalog));
  }, [appMode, demands, usuarioAtual, catalog]);

  const loteVisivel = appMode === 'EXECUTOR' ? demandsDoExecutor : demands;
  const insights = useMemo(() => gerarInsights(loteVisivel), [loteVisivel]);

  const demandaPainel = useMemo(() => {
    if (appMode !== 'EXECUTOR') return activeDemand;
    if (activeDemand && demandsDoExecutor.some((item) => item.id === activeDemand.id)) {
      return activeDemand;
    }
    return demandsDoExecutor[0] || null;
  }, [appMode, activeDemand, demandsDoExecutor]);

  useEffect(() => {
    const idsAtuais = new Set(insights.map((item) => item.id));
    insightsVistos.current.forEach((id) => {
      if (!idsAtuais.has(id)) insightsVistos.current.delete(id);
    });
    const novos = insights.filter((item) => !insightsVistos.current.has(item.id));
    novos.forEach((item) => insightsVistos.current.add(item.id));
    if (novos[0]) triggerToast(novos[0].titulo);
  }, [insights]);

  const abrirInsight = (aviso) => {
    const demanda = loteVisivel.find((item) => item.id === aviso.demandId);
    setInsightAberto(false);
    if (demanda) handleSelectDemand(demanda);
  };

  const handleCatalogChange = (next, rename) => {
    const anterior = catalog;
    setCatalog(next);
    if (rename) {
      setDemands((prev) => prev.map((demand) => (
        demand[rename.field] === rename.from
          ? { ...demand, [rename.field]: rename.to }
          : demand
      )));
      setActiveDemand((prev) => (
        prev && prev[rename.field] === rename.from
          ? { ...prev, [rename.field]: rename.to }
          : prev
      ));
    }
    sincronizarCatalogo(anterior, next)
      .then(carregarCatalogo)
      .then((catalogo) => {
        setCatalog(catalogo);
        return recarregarDemandas();
      })
      .catch((erro) => {
        setCatalog(anterior);
        triggerToast(erro?.message || 'Não foi possível gravar o cadastro.');
      });
  };

  const isCatalogNameUsed = (field, value) => demands.some((demand) => demand[field] === value);

  if (carregandoSessao) {
    return <div className="app-loading">Carregando…</div>;
  }

  if (!sessao) {
    return <LoginView onEntrar={fazerLogin} />;
  }

  if (carregandoDados) {
    return <div className="app-loading">Carregando demandas…</div>;
  }

  return (
    <div className={menuAberto ? 'app-container menu-open' : 'app-container'}>
      {/* Toast Notification */}
      {toastMessage && (
        <div key={toastKey} className={toastLeaving ? 'toast is-leaving' : 'toast'} role="status">
          <Check size={18} className="toast-icon" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      <button
        type="button"
        className="nav-backdrop"
        aria-label="Fechar menu"
        onClick={() => setMenuAberto(false)}
      />

      {/* Main Left Sidebar */}
      <Sidebar 
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        appMode={appMode}
        setAppMode={trocarModo}
        activeDemandsCount={loteVisivel.length}
        usuarioNome={usuarioAtual}
        onNavigate={() => setMenuAberto(false)}
        onSair={fazerLogout}
      />

      {/* Main Workspace Area */}
      <div className="main-wrapper">
        {/* Global Topbar */}
        <header className="topbar">
          <div className="topbar-breadcrumbs">
            <span style={{ color: 'var(--text-muted)' }}>Piu Mobile</span>
            <span className="crumb-trail">/</span>
            <span className="crumb-trail" style={{ color: '#ffffff', fontWeight: '600', textTransform: 'capitalize' }}>
              {currentTab === 'demandas' && 'Demandas & Tabela'}
              {currentTab === 'executor' && 'Painel do Executor'}
              {currentTab === 'dashboard' && 'Visão Geral & KPIs'}
              {currentTab === 'cronograma' && 'Cronograma de Produção'}
              {currentTab === 'relatorios' && 'Relatórios e importação'}
              {currentTab === 'fluxo' && 'Fluxo de Etapas'}
              {currentTab === 'cadastros' && 'Cadastros'}
            </span>
          </div>

          <div className="topbar-actions">
            <button
              className="btn-secondary menu-toggle"
              type="button"
              aria-expanded={menuAberto}
              aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenuAberto((aberto) => !aberto)}
            >
              {menuAberto ? <X size={18} /> : <Menu size={18} />}
            </button>
            {/* Quick search shortcut trigger */}
            <button 
              className="btn-secondary search-quick"
              onClick={() => {
                setMenuAberto(false);
                setCurrentTab('demandas');
                setTimeout(() => {
                  const input = document.querySelector('.search-input');
                  if (input) input.focus();
                }, 50);
              }}
              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              type="button"
            >
              <Search size={14} />
              <span className="search-quick-label">Busca rápida</span>
              <kbd className="search-quick-kbd">
                Ctrl+K
              </kbd>
            </button>

            {/* Notification icon */}
            <div className="insight-anchor">
              <button
                className="btn-secondary"
                style={{ padding: '8px 10px', position: 'relative' }}
                title="Insight"
                type="button"
                aria-expanded={insightAberto}
                aria-controls="insight-panel"
                onClick={() => setInsightAberto((aberto) => !aberto)}
              >
                <Bell size={16} />
                {insights.length > 0 && (
                  <span className="insight-count">{insights.length}</span>
                )}
              </button>
              {insightAberto && (
                <div id="insight-panel" className="insight-panel" role="dialog" aria-label="Insight">
                  <h2 className="insight-title">Insight</h2>
                  {insights.length === 0 ? (
                    <p className="insight-empty">Nenhum aviso no momento.</p>
                  ) : (
                    <ul className="insight-list">
                      {insights.map((aviso) => (
                        <li key={aviso.id}>
                          <button type="button" className="insight-item" onClick={() => abrirInsight(aviso)}>
                            <strong>{aviso.titulo}</strong>
                            <span>{aviso.texto}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic View Router */}
        <main key={currentTab} className="view-enter">
          {currentTab === 'demandas' && (
            <DemandasAdmView
              demands={loteVisivel}
              catalog={catalog}
              atividadesConfig={atividadesConfig}
              isAdmin={appMode === 'ADM'}
              onSelectDemand={handleSelectDemand}
              onOpenNewDemandModal={() => setIsModalOpen(true)}
              onRecarregar={recarregarDemandas}
              onToast={triggerToast}
            />
          )}

          {currentTab === 'executor' && (
            <PainelExecutorView 
              demands={loteVisivel}
              activeDemand={demandaPainel}
              setActiveDemand={setActiveDemand}
              onUpdateDemandStatus={handleUpdateDemandStatus}
              onResetTempo={handleResetTempo}
            />
          )}

          {currentTab === 'dashboard' && (
            <DashboardView 
              demands={loteVisivel}
              onSelectDemand={handleSelectDemand}
              onOpenNewDemandModal={() => setIsModalOpen(true)}
              atividadesConfig={atividadesConfig}
            />
          )}

          {currentTab === 'cronograma' && (
            <CronogramaView 
              demands={loteVisivel}
              onSelectDemand={handleSelectDemand}
              atividadesConfig={atividadesConfig}
            />
          )}

          {currentTab === 'relatorios' && appMode === 'ADM' && (
            <RelatoriosView
              demands={demands}
              atividades={catalog.atividades}
              usuarioAtual={usuarioAtual}
              backups={backups}
              onImportar={handleImportDemands}
              onAbrir={setCurrentTab}
              onSalvarBackup={handleSalvarBackup}
              onRestaurarBackup={handleRestaurarBackup}
              onExcluirBackup={handleExcluirBackup}
            />
          )}

          {currentTab === 'fluxo' && (
            <FluxoEtapasView 
              demands={loteVisivel}
              onSelectDemand={handleSelectDemand}
              produtos={produtoNames}
              atividades={catalog.atividades}
              diagramDefault={catalog.diagramDefault}
              atividadesConfig={atividadesConfig}
            />
          )}

          {currentTab === 'cadastros' && appMode === 'ADM' && (
            <CadastrosView
              catalog={catalog}
              onCatalogChange={handleCatalogChange}
              onToast={triggerToast}
              isUsed={isCatalogNameUsed}
            />
          )}
        </main>
      </div>

      {/* Modal Nova Demanda */}
      <NewDemandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddDemand={handleAddDemand}
        catalog={catalog}
        idsEmUso={demands.map((demanda) => demanda.id)}
        usuarioAtual={usuarioAtual}
      />
    </div>
  );
}
