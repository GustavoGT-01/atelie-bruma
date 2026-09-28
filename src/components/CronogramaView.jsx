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
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  const moverDia = (passo) => {
    setSelectedDay((atual) => {
      const next = new Date(atual);
      const delta = currentView === 'Mês' ? 30 : currentView === 'Semana' ? 7 : 1;
      next.setDate(next.getDate() + passo * delta);
      return next;
    });
  };

  const dataDaDemanda = (texto) => {
    const casado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto || '').trim());
    if (!casado) return null;
    return new Date(Number(casado[3]), Number(casado[2]) - 1, Number(casado[1]));
  };

  const noPeriodo = (demanda) => {
    const data = dataDaDemanda(demanda.solicitacao);
    if (!data) return false;
    const inicio = new Date(selectedDay);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    if (currentView === 'Semana') fim.setDate(fim.getDate() + 7);
    else if (currentView === 'Mês') fim.setMonth(fim.getMonth() + 1);
    else fim.setDate(fim.getDate() + 1);
    return data >= inicio && data < fim;
  };

  const linhas = demands.filter(noPeriodo);
  const agenda = (linhas.length ? linhas : demands.filter((item) => (
    item.status === 'Liberada' || item.status === 'Em andamento' || item.status === 'Pausado'
  ))).map((demanda, index) => {
    const minutos = Number(String(demanda.tempoEstimado || '').match(/\d+/)?.[0] || 60);
    const span = Math.min(6, Math.max(1, Math.round(minutos / 60)));
    const startHour = 8 + (index % Math.max(1, 10 - span));
    return {
      demanda,
      atividade: demanda.atividade,
      color: atividadesConfig[demanda.atividade]?.color || '#94a3b8',
      startHour,
      span,
    };
  });

  const rotuloDia = selectedDay.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="page-container">
      {/* Header with period controls */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cronograma de Atividades</h1>
          <p className="page-subtitle">Demandas do período — priorize por entrega e dependências.</p>
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
            <button type="button" aria-label="Período anterior" onClick={() => moverDia(-1)}>
              <ChevronLeft size={14} />
            </button>
            <Calendar size={14} />
            <span>{rotuloDia}</span>
            <button type="button" aria-label="Próximo período" onClick={() => moverDia(1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Demands List on left & Gantt chart on right */}
      <div className="timeline-container">
        {/* Left demands list */}
        <div className="timeline-demands-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Demandas Agendadas ({agenda.length})
            </span>
          </div>

          {agenda.map(({ demanda: d }) => {
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
            {agenda.map((row) => {
              const colStart = row.startHour - 6;
              const abrir = () => onSelectDemand(row.demanda);
              return (
                <div key={row.demanda.id} className="gantt-row">
                  <div className="gantt-row-label">
                    {row.atividade}
                  </div>
                  <div
                    style={{
                      gridColumnStart: colStart,
                      gridColumnEnd: `span ${row.span}`,
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
                      onClick={abrir}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          abrir();
                        }
                      }}
                      title={`Abrir ${row.demanda.id}`}
                    >
                      {row.demanda.id}
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
