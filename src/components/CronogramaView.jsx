import React, { useState } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Filter, 
  User, 
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { ATIVIDADES_CONFIG } from '../data/mockData';

export default function CronogramaView({ 
  demands, 
  onSelectDemand,
  atividadesConfig = ATIVIDADES_CONFIG,
}) {
  const [currentView, setCurrentView] = useState('Dia');
  const [selectedDay, setSelectedDay] = useState('24 de Setembro, 2026');

  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  const scheduleRows = [
    { atividade: 'SOLICITAÇÃO COMERCIAL', demand: 'DEM-00010', color: '#F97316', startHour: 8, span: 2 },
    { atividade: 'BLOCO 3D', demand: 'DEM-00029', color: '#3B82F6', startHour: 9, span: 2 },
    { atividade: '3D ESTRUTURAL', demand: 'DEM-00162', color: '#06B6D4', startHour: 9, span: 2 },
    { atividade: 'RECORTES', demand: 'DEM-00132', color: '#F59E0B', startHour: 10, span: 3 },
    { atividade: 'LISTAGEM', demand: 'DEM-00133', color: '#10B981', startHour: 13, span: 4 },
    { atividade: 'MODELAGEM', demand: 'DEM-00140', color: '#8B5CF6', startHour: 11, span: 3 },
    { atividade: 'ENCAIXE', demand: 'DEM-00030', color: '#EC4899', startHour: 14, span: 2 },
    { atividade: 'DOCUMENTAÇÃO PARA TERCEIROS', demand: 'DEM-00013', color: '#0284C7', startHour: 8, span: 2 },
  ];

  return (
    <div className="page-container">
      {/* Header with period controls */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cronograma de Atividades</h1>
          <p className="page-subtitle">Demandas de GUSTAVO — priorize por entrega e dependências.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Day / Week / Month Switcher */}
          <div className="mode-switcher-container" style={{ marginBottom: 0 }}>
            {['Dia', 'Semana', 'Mês'].map(view => (
              <button
                key={view}
                className={`mode-btn ${currentView === view ? 'active' : ''}`}
                onClick={() => setCurrentView(view)}
                type="button"
              >
                {view}
              </button>
            ))}
          </div>

          {/* Date Picker Button */}
          <div className="btn-secondary" style={{ padding: '8px 14px' }}>
            <Calendar size={14} />
            <span>{selectedDay}</span>
          </div>
        </div>
      </div>

      {/* Main Split: Demands List on left & Gantt chart on right */}
      <div className="timeline-container">
        {/* Left demands list */}
        <div className="timeline-demands-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Demandas Agendadas ({demands.length})
            </span>
          </div>

          {demands.slice(0, 7).map((d) => {
            const config = atividadesConfig[d.atividade] || { color: '#94a3b8' };
            return (
              <div
                key={d.id}
                className="demand-timeline-card"
                role="button"
                tabIndex={0}
                onClick={() => onSelectDemand(d)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectDemand(d);
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '0.84rem', color: '#ffffff' }}>
                    {d.id}
                  </span>
                  <span 
                    className="status-pill"
                    style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(255,255,255,0.06)' }}
                  >
                    {d.status}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '999px', backgroundColor: config.color }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#ffffff' }}>
                    {d.atividade}
                  </span>
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Produto: <strong style={{ color: 'var(--text-secondary)' }}>{d.produto}</strong> • {d.executor}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Gantt Chart Pane */}
        <div className="timeline-grid-pane">
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff' }}>
              Linha do Tempo por Atividade
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Grade horária estimada (08:00 - 17:00)
            </span>
          </div>

          {/* Time scale headers */}
          <div className="gantt-header">
            <span style={{ textAlign: 'left', fontWeight: '700', color: 'var(--text-secondary)' }}>Atividade</span>
            {hours.map(h => (
              <span key={h}>{h}</span>
            ))}
          </div>

          {/* Gantt Rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {scheduleRows.map((row, idx) => {
              // Calculate horizontal offset
              const colStart = row.startHour - 7; // 8:00 maps to column 2
              return (
                <div key={idx} className="gantt-row">
                  <div className="gantt-row-label">
                    {row.atividade}
                  </div>

                  {/* Empty spacer up to start hour */}
                  <div 
                    style={{ 
                      gridColumnStart: colStart, 
                      gridColumnEnd: `span ${row.span}` 
                    }}
                  >
                    <div
                      className="gantt-bar"
                      role="button"
                      tabIndex={0}
                      style={{
                        backgroundColor: row.color,
                        boxShadow: `0 0 12px ${row.color}55`
                      }}
                      onClick={() => {
                        const d = demands.find(item => item.id === row.demand) || demands[0];
                        onSelectDemand(d);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          const d = demands.find(item => item.id === row.demand) || demands[0];
                          onSelectDemand(d);
                        }
                      }}
                      title={`Abrir ${row.demand}`}
                    >
                      {row.demand}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
