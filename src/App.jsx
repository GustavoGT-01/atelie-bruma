import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import DemandasView from './components/DemandasView';
import PainelExecutorView from './components/PainelExecutorView';
import DashboardView from './components/DashboardView';
import CronogramaView from './components/CronogramaView';
import FluxoEtapasView from './components/FluxoEtapasView';
import CadastrosView from './components/CadastrosView';
import RelatoriosView from './components/RelatoriosView';
import NewDemandModal from './components/NewDemandModal';
import { INITIAL_DEMANDS } from './data/mockData';
import { INITIAL_CATALOG } from './data/cadastrosData';
import { gerarInsights } from './insights';
import { gravarBackups, lerBackups, montarBackup } from './backups';
import { Bell, Search, Command, Check, Menu, X } from 'lucide-react';
import './App.css';

export default function App() {
  const [demands, setDemands] = useState(INITIAL_DEMANDS);
  const [catalog, setCatalog] = useState(INITIAL_CATALOG);
  const [backups, setBackups] = useState(lerBackups);
  const [currentTab, setCurrentTab] = useState('demandas');
  const [appMode, setAppMode] = useState('ADM');
  const [activeDemand, setActiveDemand] = useState(INITIAL_DEMANDS[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [insightAberto, setInsightAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const insightsVistos = useRef(new Set());
  const usuarioAtual = 'GUSTAVO';

  const triggerToast = (msg) => {
    setToastLeaving(false);
    setToastKey((key) => key + 1);
    setToastMessage(msg);
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
  const handleUpdateDemandStatus = (id, newStatus, reason, elapsedSeconds, newHistory) => {
    let statusMudou = false;
    setDemands((prev) => {
      const atual = prev.find((d) => d.id === id);
      statusMudou = Boolean(atual && atual.status !== newStatus);
      return prev.map((d) => {
        if (d.id === id) {
          const updated = {
            ...d,
            status: newStatus,
            tempoEmAtividadeSegundos: elapsedSeconds !== undefined ? elapsedSeconds : d.tempoEmAtividadeSegundos,
            motivoPausa: reason !== undefined ? reason : d.motivoPausa,
            historicoParadas: newHistory || d.historicoParadas
          };
          if (activeDemand?.id === id) {
            setActiveDemand(updated);
          }
          return updated;
        }
        if (newStatus === 'Concluída' && d.aguardaId === id && d.status === 'Aguardando') {
          const liberada = { ...d, status: 'Liberada' };
          if (activeDemand?.id === d.id) setActiveDemand(liberada);
          return liberada;
        }
        return d;
      });
    });
    if (statusMudou) {
      const liberou = newStatus === 'Concluída'
        ? demands.filter((item) => item.aguardaId === id && item.status === 'Aguardando').length
        : 0;
      const aviso = liberou === 1
        ? ' A próxima etapa foi liberada.'
        : liberou > 1
          ? ` ${liberou} próximas etapas foram liberadas.`
          : '';
      triggerToast(`Status da ${id} alterado para "${newStatus}".${aviso}`);
    }
  };

  const handleAddDemand = (novas) => {
    const lista = Array.isArray(novas) ? novas : [novas];
    setDemands((prev) => [...lista, ...prev]);
    triggerToast(lista.length === 1
      ? `Demanda ${lista[0].id} criada com sucesso!`
      : `${lista.length} demandas criadas.`);
  };

  const handleImportDemands = (novas) => {
    setDemands((prev) => [...novas, ...prev]);
    triggerToast(`${novas.length} demandas importadas.`);
  };

  const handleSalvarBackup = () => {
    const lista = [montarBackup(demands, catalog), ...backups];
    try {
      gravarBackups(lista);
    } catch {
      return 'Não coube outro backup neste navegador. Exclua um antigo e tente de novo.';
    }
    setBackups(lista);
    triggerToast('Backup salvo.');
    return '';
  };

  const handleRestaurarBackup = (backup) => {
    const lote = structuredClone(backup.demands);
    const catalogo = structuredClone(backup.catalog);
    setDemands(lote);
    setCatalog(catalogo);
    setActiveDemand(lote.find((item) => item.id === activeDemand?.id) || lote[0] || null);
    triggerToast('Backup restaurado.');
  };

  const handleExcluirBackup = (id) => {
    const lista = backups.filter((item) => item.id !== id);
    try {
      gravarBackups(lista);
    } catch {
      return 'Não foi possível excluir o backup neste navegador.';
    }
    setBackups(lista);
    triggerToast('Backup excluído.');
    return '';
  };

  const atividadesConfig = useMemo(() => {
    const mapa = {};
    catalog.atividades.forEach((atividade) => {
      mapa[atividade.nome] = { color: atividade.cor, label: atividade.nome };
    });
    return mapa;
  }, [catalog.atividades]);

  const executorNames = useMemo(
    () => catalog.colaboradores.map((pessoa) => pessoa.nome),
    [catalog.colaboradores],
  );
  const produtoNames = useMemo(
    () => catalog.produtos.map((item) => item.nome),
    [catalog.produtos],
  );
  const insights = useMemo(() => gerarInsights(demands), [demands]);

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
    const demanda = demands.find((item) => item.id === aviso.demandId);
    setInsightAberto(false);
    if (demanda) handleSelectDemand(demanda);
  };

  const handleCatalogChange = (next, rename) => {
    setCatalog(next);
    if (!rename) return;
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
  };

  const isCatalogNameUsed = (field, value) => demands.some((demand) => demand[field] === value);

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
        setAppMode={setAppMode}
        activeDemandsCount={demands.length}
        usuarioNome={usuarioAtual}
        onNavigate={() => setMenuAberto(false)}
      />

      {/* Main Workspace Area */}
      <div className="main-wrapper">
        {/* Global Topbar */}
        <header className="topbar">
          <div className="topbar-breadcrumbs">
            <span style={{ color: 'var(--text-muted)' }}>Ateliê Bruma</span>
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
            <DemandasView 
              demands={demands}
              onSelectDemand={handleSelectDemand}
              onOpenNewDemandModal={() => setIsModalOpen(true)}
              atividadesConfig={atividadesConfig}
              executores={executorNames}
              usuarioAtual={usuarioAtual}
            />
          )}

          {currentTab === 'executor' && (
            <PainelExecutorView 
              demands={demands}
              activeDemand={activeDemand}
              setActiveDemand={setActiveDemand}
              onUpdateDemandStatus={handleUpdateDemandStatus}
            />
          )}

          {currentTab === 'dashboard' && (
            <DashboardView 
              demands={demands}
              onSelectDemand={handleSelectDemand}
              onOpenNewDemandModal={() => setIsModalOpen(true)}
              atividadesConfig={atividadesConfig}
            />
          )}

          {currentTab === 'cronograma' && (
            <CronogramaView 
              demands={demands}
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
              demands={demands}
              onSelectDemand={handleSelectDemand}
              produtos={produtoNames}
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
