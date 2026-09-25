import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertOctagon, 
  Plus, 
  AlertTriangle
} from 'lucide-react';
import { ATIVIDADES_CONFIG } from '../data/mockData';

export default function DashboardView({ 
  demands, 
  onSelectDemand, 
  onOpenNewDemandModal,
  atividadesConfig = ATIVIDADES_CONFIG,
}) {
  const inProgressCount = demands.filter(d => d.status === 'Em andamento').length;
  const liberatedCount = demands.filter(d => d.status === 'Liberada').length;
  const completedCount = demands.filter(d => d.status === 'Concluída').length;
  const pausedCount = demands.filter(d => d.status === 'Pausado').length;
  const total = demands.length;
  const eficiencia = total ? Math.round((completedCount / total) * 100) : 0;

  const activityStats = useMemo(() => {
    const contagem = new Map();
    demands.forEach((demanda) => {
      contagem.set(demanda.atividade, (contagem.get(demanda.atividade) || 0) + 1);
    });
    const maximo = Math.max(1, ...contagem.values());
    return [...contagem.entries()]
      .map(([label, count]) => ({
        label,
        count,
        color: atividadesConfig[label]?.color || '#94a3b8',
        max: maximo,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [demands, atividadesConfig]);

  const executorRanks = useMemo(() => {
    const mapa = new Map();
    demands.forEach((demanda) => {
      const linha = mapa.get(demanda.executor) || { name: demanda.executor, total: 0, completed: 0 };
      linha.total += 1;
      if (demanda.status === 'Concluída') linha.completed += 1;
      mapa.set(demanda.executor, linha);
    });
    return [...mapa.values()]
      .map((linha) => ({
        ...linha,
        percent: linha.total ? Math.round((linha.completed / linha.total) * 100) : 0,
        avatar: linha.name.slice(0, 1),
      }))
      .sort((a, b) => b.percent - a.percent || b.completed - a.completed || a.name.localeCompare(b.name));
  }, [demands]);

  const processAlerts = demands.filter(d => d.status === 'Pausado' || d.status === 'Em andamento').slice(0, 4);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-subtitle">Acompanhe o desempenho de desenvolvimento e engenharia em tempo real.</p>
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

      {/* KPI Stat Cards */}
      <div className="kpi-row">
        {/* Card 1 */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Demandas em Andamento</span>
            <Clock size={18} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div className="kpi-number" key={inProgressCount}>{inProgressCount}</div>
          <div className="kpi-subtext">
            <span style={{ color: '#34d399', fontWeight: '700' }}>{liberatedCount}</span> liberadas na esteira
          </div>
        </div>

        {/* Card 2 */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Eficiência Geral</span>
            <TrendingUp size={18} style={{ color: '#10b981' }} />
          </div>
          <div className="kpi-number" key={eficiencia}>{eficiencia}%</div>
          <div className="kpi-subtext">
            <span>{completedCount} de {total} demandas concluídas</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Concluídas no lote</span>
            <CheckCircle2 size={18} style={{ color: '#34d399' }} />
          </div>
          <div className="kpi-number" key={completedCount}>{completedCount}</div>
          <div className="kpi-subtext" style={{ color: '#10b981' }}>
            No lote atual
          </div>
        </div>

        {/* Card 4 (Gargalos) */}
        <div className="kpi-card alert-card">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#f87171' }}>Gargalos & Paradas</span>
            <AlertOctagon size={18} style={{ color: '#f87171' }} />
          </div>
          <div className="kpi-number" key={pausedCount} style={{ color: '#fca5a5' }}>{pausedCount}</div>
          <div className="kpi-subtext" style={{ color: '#f87171' }}>
            <span>demandas pausadas</span>
          </div>
        </div>
      </div>

      {/* Middle Split: Status por atividade & Eficiência dos Executores */}
      <div className="dashboard-split-grid">
        {/* Left: Status por Atividade */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#ffffff' }}>
              Status por Atividade
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Volume de demandas ativas
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activityStats.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Nenhuma demanda no lote.</p>
            )}
            {activityStats.map((item, index) => {
              const widthPct = Math.round((item.count / item.max) * 100);
              return (
                <div key={item.label} className="activity-bar-item">
                  <div className="activity-bar-header">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '999px', backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#ffffff' }}>
                      {item.count}
                    </span>
                  </div>
                  <div className="activity-bar-track">
                    <div 
                      className="activity-bar-fill" 
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: item.color,
                        boxShadow: `0 0 10px ${item.color}66`,
                        animationDelay: `${index * 40}ms`,
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Eficiência dos Executores */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#ffffff' }}>
              Eficiência dos Executores
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Taxa de conclusão
            </span>
          </div>

          <div className="leaderboard-list">
            {executorRanks.map((exec, idx) => (
              <div key={exec.name} className="leaderboard-item">
                <span className="rank-index">{idx + 1}</span>
                <div className="leader-avatar">{exec.avatar}</div>
                <div className="leader-info">
                  <div className="leader-name-row">
                    <span>{exec.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{exec.percent}%</span>
                  </div>
                  <div className="leader-track">
                    <div 
                      className="leader-fill" 
                      style={{ width: `${exec.percent}%`, animationDelay: `${idx * 40}ms` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Alertas de Processo */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
            Alertas de Processo & Demandas Prioritárias
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Clique para ir direto à demanda
          </span>
        </div>

        <div className="alerts-grid">
          {processAlerts.map((item) => (
            <div
              key={item.id}
              className="alert-item-card"
              role="button"
              tabIndex={0}
              onClick={() => onSelectDemand(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectDemand(item);
                }
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '0.85rem', color: '#ffffff' }}>
                    {item.id}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                    {item.atividade}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  {item.produto} • {item.executor}
                </div>
              </div>

              <span 
                className="status-pill"
                style={{
                  backgroundColor: item.status === 'Pausado' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                  color: item.status === 'Pausado' ? '#fbbf24' : '#38bdf8',
                  border: `1px solid ${item.status === 'Pausado' ? '#fbbf2440' : '#38bdf840'}`
                }}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
