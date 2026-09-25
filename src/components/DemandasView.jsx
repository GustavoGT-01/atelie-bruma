import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  Play, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpDown,
  SlidersHorizontal
} from 'lucide-react';
import { ATIVIDADES_CONFIG, STATUS_LIST, EXECUTORES_LIST } from '../data/mockData';

export default function DemandasView({ 
  demands, 
  onSelectDemand, 
  onOpenNewDemandModal,
  atividadesConfig = ATIVIDADES_CONFIG,
  executores = EXECUTORES_LIST,
  usuarioAtual = 'GUSTAVO',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedAtividade, setSelectedAtividade] = useState('ALL');
  const [selectedExecutor, setSelectedExecutor] = useState('ALL');
  const [selectedPrioridade, setSelectedPrioridade] = useState('ALL');
  const [sortField, setSortField] = useState('id');
  const [sortAsc, setSortAsc] = useState(true);

  // Quick preset pills
  const [activePreset, setActivePreset] = useState('ALL');

  const filteredDemands = useMemo(() => {
    return demands.filter((item) => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchCode = item.id.toLowerCase().includes(query);
        const matchProd = item.produto.toLowerCase().includes(query);
        const matchAtiv = item.atividade.toLowerCase().includes(query);
        const matchSpec = item.especificacao.toLowerCase().includes(query);
        const matchExec = item.executor.toLowerCase().includes(query);
        if (!matchCode && !matchProd && !matchAtiv && !matchSpec && !matchExec) {
          return false;
        }
      }

      // Dropdown filters
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false;
      if (selectedAtividade !== 'ALL' && item.atividade !== selectedAtividade) return false;
      if (selectedExecutor !== 'ALL' && item.executor !== selectedExecutor) return false;
      if (selectedPrioridade !== 'ALL' && item.prioridade !== selectedPrioridade) return false;

      // Presets
      if (activePreset === 'LIBERADAS' && item.status !== 'Liberada') return false;
      if (activePreset === 'ALTA' && item.prioridade !== 'Alta') return false;
      if (activePreset === 'MINHAS' && item.executor !== usuarioAtual) return false;

      return true;
    }).sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [demands, searchQuery, selectedStatus, selectedAtividade, selectedExecutor, selectedPrioridade, activePreset, sortField, sortAsc, usuarioAtual]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const ordenarPeloTeclado = (event, field) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSort(field);
    }
  };

  const hasActiveFilters = searchQuery || selectedStatus !== 'ALL' || selectedAtividade !== 'ALL' || selectedExecutor !== 'ALL' || selectedPrioridade !== 'ALL' || activePreset !== 'ALL';

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('ALL');
    setSelectedAtividade('ALL');
    setSelectedExecutor('ALL');
    setSelectedPrioridade('ALL');
    setActivePreset('ALL');
  };

  const getStatusColor = (status) => {
    const found = STATUS_LIST.find(s => s.id === status);
    return found ? found.color : '#94A3B8';
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Demandas</h1>
          <p className="page-subtitle">
            Gerenciamento e distribuição de tarefas de desenvolvimento industrial e engenharia.
          </p>
        </div>
        <button 
          className="btn-primary"
          onClick={onOpenNewDemandModal}
          type="button"
        >
          <Plus size={16} />
          Nova Demanda
        </button>
      </div>

      {/* Modern Unified Search & Smart Filter Bar */}
      <div className="filter-search-bar">
        {/* Main Search Row */}
        <div className="search-primary-row">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input 
              type="text"
              placeholder="Buscar por código, produto, atividade, especificação ou executor... (Pressione Ctrl+K)"
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Limpar busca"
                type="button"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters & Quick Presets */}
        <div className="filter-chips-row">
          {/* Status Dropdown */}
          <div className="filter-group">
            <select
              className={`filter-chip-select ${selectedStatus !== 'ALL' ? 'active' : ''}`}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">Status: Todos</option>
              {STATUS_LIST.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Atividade Dropdown */}
          <div className="filter-group">
            <select
              className={`filter-chip-select ${selectedAtividade !== 'ALL' ? 'active' : ''}`}
              value={selectedAtividade}
              onChange={(e) => setSelectedAtividade(e.target.value)}
            >
              <option value="ALL">Atividade: Todas</option>
              {Object.keys(atividadesConfig).map((ativ) => (
                <option key={ativ} value={ativ}>{ativ}</option>
              ))}
            </select>
          </div>

          {/* Executor Dropdown */}
          <div className="filter-group">
            <select
              className={`filter-chip-select ${selectedExecutor !== 'ALL' ? 'active' : ''}`}
              value={selectedExecutor}
              onChange={(e) => setSelectedExecutor(e.target.value)}
            >
              <option value="ALL">Executor: Todos</option>
              {executores.map((exec) => (
                <option key={exec} value={exec}>{exec}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              className={`filter-chip-select ${selectedPrioridade !== 'ALL' ? 'active' : ''}`}
              value={selectedPrioridade}
              aria-label="Prioridade"
              onChange={(e) => setSelectedPrioridade(e.target.value)}
            >
              <option value="ALL">Prioridade: Todas</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 4px' }} />

          {/* Preset Chips */}
          <button
            className={`preset-chip ${activePreset === 'ALL' ? 'active' : ''}`}
            onClick={() => setActivePreset('ALL')}
            type="button"
            aria-pressed={activePreset === 'ALL'}
          >
            Todas
          </button>
          <button
            className={`preset-chip ${activePreset === 'LIBERADAS' ? 'active' : ''}`}
            onClick={() => setActivePreset(activePreset === 'LIBERADAS' ? 'ALL' : 'LIBERADAS')}
            type="button"
            aria-pressed={activePreset === 'LIBERADAS'}
          >
            Liberadas
          </button>
          <button
            className={`preset-chip ${activePreset === 'ALTA' ? 'active' : ''}`}
            onClick={() => setActivePreset(activePreset === 'ALTA' ? 'ALL' : 'ALTA')}
            type="button"
            aria-pressed={activePreset === 'ALTA'}
          >
            Prioridade Alta
          </button>
          <button
            className={`preset-chip ${activePreset === 'MINHAS' ? 'active' : ''}`}
            onClick={() => setActivePreset(activePreset === 'MINHAS' ? 'ALL' : 'MINHAS')}
            type="button"
            aria-pressed={activePreset === 'MINHAS'}
          >
            Minhas Demandas ({usuarioAtual.charAt(0)}{usuarioAtual.slice(1).toLocaleLowerCase('pt-BR')})
          </button>

          {/* Reset button */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              style={{
                marginLeft: 'auto',
                fontSize: '0.8rem',
                color: 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: '600'
              }}
              type="button"
            >
              <X size={14} />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Results Counter and Table */}
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
        <span aria-live="polite">Mostrando <strong key={filteredDemands.length} className="results-count">{filteredDemands.length}</strong> de {demands.length} demandas</span>
        <span>Dica: Clique em uma linha para abrir no Painel do Executor</span>
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} onKeyDown={(event) => ordenarPeloTeclado(event, 'id')} tabIndex={0} aria-sort={sortField === 'id' ? (sortAsc ? 'ascending' : 'descending') : 'none'} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Código
                  <ArrowUpDown size={12} aria-hidden="true" />
                </div>
              </th>
              <th onClick={() => handleSort('atividade')} onKeyDown={(event) => ordenarPeloTeclado(event, 'atividade')} tabIndex={0} aria-sort={sortField === 'atividade' ? (sortAsc ? 'ascending' : 'descending') : 'none'} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Atividade
                  <ArrowUpDown size={12} aria-hidden="true" />
                </div>
              </th>
              <th onClick={() => handleSort('produto')} onKeyDown={(event) => ordenarPeloTeclado(event, 'produto')} tabIndex={0} aria-sort={sortField === 'produto' ? (sortAsc ? 'ascending' : 'descending') : 'none'} style={{ cursor: 'pointer' }}>Produto</th>
              <th>Modulação</th>
              <th style={{ width: '30%' }}>Especificação da Tarefa</th>
              <th onClick={() => handleSort('executor')} onKeyDown={(event) => ordenarPeloTeclado(event, 'executor')} tabIndex={0} aria-sort={sortField === 'executor' ? (sortAsc ? 'ascending' : 'descending') : 'none'} style={{ cursor: 'pointer' }}>Executor</th>
              <th>Prioridade</th>
              <th>Solicitação</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {filteredDemands.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhuma demanda encontrada para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredDemands.map((demand) => {
                const configAtiv = atividadesConfig[demand.atividade] || { color: '#94a3b8' };
                const statusColor = getStatusColor(demand.status);

                return (
                  <tr 
                    key={demand.id}
                    onClick={() => onSelectDemand(demand)}
                  >
                    <td className="code-cell">{demand.id}</td>
                    <td>
                      <div className="activity-badge">
                        <span 
                          className="activity-dot" 
                          style={{ backgroundColor: configAtiv.color, color: configAtiv.color }} 
                        />
                        <span>{demand.atividade}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>
                      {demand.produto || '—'}
                    </td>
                    <td>{demand.modulacao || '—'}</td>
                    <td style={{ fontSize: '0.82rem', lineHeight: '1.35', color: 'var(--text-secondary)' }}>
                      {demand.especificacao}
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', color: '#ffffff' }}>
                        {demand.executor}
                      </span>
                    </td>
                    <td>
                      <span className={`priority-pill priority-${demand.prioridade.toLowerCase()}`}>
                        {demand.prioridade}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      {demand.solicitacao}
                    </td>
                    <td>
                      <span 
                        className="status-pill"
                        style={{
                          backgroundColor: `${statusColor}18`,
                          color: statusColor,
                          border: `1px solid ${statusColor}40`
                        }}
                      >
                        <span 
                          className="status-dot" 
                          style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
                        />
                        {demand.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDemand(demand);
                        }}
                        title="Abrir no Painel do Executor"
                        type="button"
                      >
                        <Play size={12} />
                        Executar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
