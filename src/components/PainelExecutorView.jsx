import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Tag, 
  Check, 
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { MOTIVOS_PARADA } from '../data/mockData';
import { lerPainel } from '../api/demandas';
import { salvarPreferencias } from '../api/catalogo';
import { statusParaUi } from '../api/adapters';

function gruposPorProduto(demandas) {
  const mapa = new Map();
  for (const demanda of demandas) {
    const nome = (demanda.produto || '').trim();
    const chave = nome ? nome.toUpperCase() : '-';
    const label = nome || '-';
    if (!mapa.has(chave)) mapa.set(chave, { label, demandas: [] });
    mapa.get(chave).demandas.push(demanda);
  }
  return [...mapa.values()]
    .sort((a, b) => {
      if (a.label === '-') return 1;
      if (b.label === '-') return -1;
      return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });
    })
    .map((grupo) => ({
      ...grupo,
      demandas: [...grupo.demandas].sort((a, b) =>
        String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true })
      ),
    }));
}

function rotuloOpcao(demanda) {
  const partes = [demanda.atividade, demanda.modulacao, demanda.executor].filter(Boolean);
  return `${demanda.id} — ${partes.join(' · ')} (${(demanda.status || '').toUpperCase()})`;
}

export default function PainelExecutorView({ 
  demands, 
  activeDemand, 
  setActiveDemand, 
  onUpdateDemandStatus,
  onResetTempo
}) {
  const currentDemand = activeDemand || demands[0];

  const [isRunning, setIsRunning] = useState(currentDemand?.status === 'Em andamento');
  const [seconds, setSeconds] = useState(currentDemand?.tempoEmAtividadeSegundos || 1371);
  const [selectedMotivo, setSelectedMotivo] = useState(currentDemand?.motivoPausa || '');
  const [pauseHistory, setPauseHistory] = useState(currentDemand?.historicoParadas || [
    { motivo: "Setup / preparação", horario: "08:15" }
  ]);
  const [fila, setFila] = useState(null);
  const [fixando, setFixando] = useState(false);

  useEffect(() => {
    let ativo = true;
    lerPainel()
      .then((dados) => {
        if (ativo) setFila(dados);
      })
      .catch(() => {
        if (ativo) setFila(null);
      });
    return () => {
      ativo = false;
    };
  }, [demands]);

  useEffect(() => {
    if (!fila?.gruposPorProduto?.length) return;
    if (activeDemand && demands.some((item) => item.id === activeDemand.id)) return;
    const proxima = fila.gruposPorProduto
      .flatMap((grupo) => grupo.demandas)
      .find((item) => item.id === fila.proximaId);
    const alvo = demands.find((item) => item.id === proxima?.codigo);
    if (alvo) setActiveDemand(alvo);
  }, [fila, demands, activeDemand, setActiveDemand]);

  // Sync state when demand changes. O tempo e o histórico vêm dos apontamentos
  // gravados no servidor, então também ressincroniza a cada resposta dele.
  useEffect(() => {
    if (currentDemand) {
      setIsRunning(currentDemand.status === 'Em andamento');
      setSeconds(currentDemand.tempoEmAtividadeSegundos || 0);
      setSelectedMotivo(currentDemand.motivoPausa || '');
      setPauseHistory(currentDemand.historicoParadas || []);
    }
  }, [
    currentDemand?.id,
    currentDemand?.status,
    currentDemand?.tempoEmAtividadeSegundos,
  ]);

  // Timer Tick
  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Format seconds to HH:MM:SS
  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Estimate progress %
  const grupos = useMemo(() => {
    if (fila?.gruposPorProduto?.length) {
      return fila.gruposPorProduto.map((grupo) => ({
        label: grupo.produtoNome,
        demandas: grupo.demandas.map((item) => {
          const local = demands.find((demanda) => demanda.id === item.codigo);
          return local || {
            id: item.codigo,
            atividade: item.atividade,
            modulacao: item.modulacao,
            executor: item.executor,
            status: statusParaUi(item.status),
          };
        }),
      }));
    }
    return gruposPorProduto(
      demands.filter((item) => item.status === 'Liberada' || item.status === 'Em andamento' || item.status === 'Pausado')
    );
  }, [fila, demands]);

  const alternarFixar = async () => {
    if (!fila?.produtoFocoId || fixando) return;
    const soltar = fila.produtoFixadoId === fila.produtoFocoId;
    setFixando(true);
    try {
      await salvarPreferencias({ produtoFocoFixadoId: soltar ? null : fila.produtoFocoId });
      setFila(await lerPainel());
    } finally {
      setFixando(false);
    }
  };

  const estimatedMins = parseInt(currentDemand?.tempoEstimado) || 35;
  const estimatedSecs = estimatedMins * 60;
  const progressPercent = Math.min(100, Math.round((seconds / estimatedSecs) * 100));

  const handleStart = () => {
    if (!currentDemand) return;
    setIsRunning(true);
    setSelectedMotivo('');
    if (onUpdateDemandStatus) {
      onUpdateDemandStatus(currentDemand.id, 'Em andamento', null, seconds);
    }
  };

  const handlePause = (motivo) => {
    if (!currentDemand) return;
    const motivoToUse = motivo || selectedMotivo || 'Setup / preparação';
    setIsRunning(false);
    setSelectedMotivo(motivoToUse);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newHistory = [{ motivo: motivoToUse, horario: timeStr }, ...pauseHistory];
    setPauseHistory(newHistory);

    if (onUpdateDemandStatus) {
      onUpdateDemandStatus(currentDemand.id, 'Pausado', motivoToUse, seconds, newHistory);
    }
  };

  const handleFinish = () => {
    if (!currentDemand) return;
    setIsRunning(false);
    if (onUpdateDemandStatus) {
      onUpdateDemandStatus(currentDemand.id, 'Concluída', null, seconds);
    }
  };

  return (
    <div className="page-container executor-view">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Painel do Executor</h1>
          <p className="page-subtitle">Apontamento de horas e cronometragem da demanda ativa em tempo real.</p>
        </div>
      </div>

      {/* Demand Selector Bar */}
      <div className="demand-selector-card">
        <div className="demand-select-wrapper">
          <label
            htmlFor="painel-demanda-select"
            style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)' }}
          >
            SELECIONAR DEMANDA:
          </label>
          <select
            id="painel-demanda-select"
            className="demand-select-dropdown"
            value={currentDemand?.id || ''}
            onChange={(e) => {
              const found = demands.find((d) => d.id === e.target.value);
              if (found) setActiveDemand(found);
            }}
          >
            {grupos.map((grupo) => (
              <optgroup key={grupo.label} label={grupo.label}>
                {grupo.demandas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {rotuloOpcao(d)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="painel-foco">
          <Tag size={14} style={{ color: 'var(--accent-cyan)' }} aria-hidden="true" />
          <div>
            <span className="meta-label">Produto em foco</span>
            <strong>
              {fila?.produtoFocoNome || currentDemand?.produto || '—'}
              {fila?.produtoFixadoId && fila.produtoFixadoId === fila.produtoFocoId ? ' (fixado)' : ''}
            </strong>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={fixando || !fila?.produtoFocoId}
            onClick={alternarFixar}
          >
            {fila?.produtoFixadoId && fila.produtoFixadoId === fila.produtoFocoId ? 'Desafixar' : 'Fixar produto'}
          </button>
        </div>
      </div>

      {fila?.cadeia?.length ? (
        <div className="card painel-cadeia">
          {fila.cadeia.map((grupo) => (
            <section key={grupo.titulo}>
              <h2>{grupo.titulo}</h2>
              <ul>
                {grupo.itens.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={currentDemand?.id === item.codigo ? 'is-on' : undefined}
                      onClick={() => {
                        const found = demands.find((demanda) => demanda.id === item.codigo);
                        if (found) setActiveDemand(found);
                      }}
                    >
                      {item.codigo} — {item.atividade}
                      {item.executor ? ` · ${item.executor}` : ''} ({statusParaUi(item.status)})
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {/* Main Grid: Left Execution / Right Stop Reasons */}
      <div className="executor-grid">
        {/* Left Column: Details & Stopwatch */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Metadata Grid */}
          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">Demanda</span>
              <span className="meta-value">{currentDemand?.id}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Produto</span>
              <span className="meta-value">{currentDemand?.produto}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Modulação</span>
              <span className="meta-value">{currentDemand?.modulacao}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Etapa</span>
              <span className="meta-value" style={{ color: 'var(--accent-cyan)' }}>
                {currentDemand?.atividade}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Prioridade</span>
              <span className={`priority-pill priority-${currentDemand?.prioridade.toLowerCase()}`}>
                {currentDemand?.prioridade}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Estimado</span>
              <span className="meta-value">{currentDemand?.tempoEstimado}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className="meta-value" style={{ 
                color: currentDemand?.status === 'Em andamento' ? '#38bdf8' : 
                       currentDemand?.status === 'Pausado' ? '#fbbf24' : '#34d399' 
              }}>
                {currentDemand?.status?.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Task Specification Card */}
          <div className="task-spec-card">
            <div className="task-spec-title">Especificação da Tarefa</div>
            <div className="task-spec-text">
              {currentDemand?.especificacao}
            </div>
          </div>

          {/* High-Tech Timer Card */}
          <div className={isRunning ? 'timer-card is-running' : 'timer-card'}>
            <div className="timer-label">
              {isRunning ? '🟢 TEMPO EM ATIVIDADE (RODANDO)' : '🟡 TEMPO EM ATIVIDADE (PAUSADO)'}
            </div>

            {/* Glowing Big Stopwatch */}
            <div className="timer-display">
              {formatTime(seconds)}
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', maxWidth: '480px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>Progresso estimado: {progressPercent}%</span>
                <span>Alvo: {currentDemand?.tempoEstimado}</span>
              </div>
              <div className="timer-progress-bar-bg">
                <div 
                  className="timer-progress-bar-fill" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="timer-actions">
              {!isRunning ? (
                <button 
                  className="btn-timer-primary"
                  onClick={handleStart}
                  type="button"
                >
                  <Play size={18} fill="#0b0d13" />
                  {seconds === 0 ? 'Iniciar Atividade' : 'Retomar Atividade'}
                </button>
              ) : (
                <button 
                  className="btn-timer-secondary"
                  onClick={() => handlePause(selectedMotivo || 'Setup / preparação')}
                  style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}
                  type="button"
                >
                  <Pause size={18} />
                  Pausar / Interromper
                </button>
              )}

              <button 
                className="btn-timer-secondary"
                onClick={handleFinish}
                style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}
                type="button"
              >
                <CheckCircle size={18} aria-hidden="true" />
                Finalizar Atividade
              </button>

              <button 
                className="btn-secondary"
                onClick={() => {
                  setSeconds(0);
                  if (onResetTempo && currentDemand) {
                    onResetTempo(currentDemand.id);
                  }
                }}
                title="Zerar cronômetro"
                aria-label="Zerar cronômetro"
                style={{ padding: '12px 14px' }}
                type="button"
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Motivo da Parada */}
        <div className="reasons-panel">
          <div className="reasons-title">
            <span>Motivo da Parada</span>
            {selectedMotivo && (
              <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: '500' }}>
                Ativo
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Selecione a justificativa caso precise interromper ou pausar a execução da demanda.
          </p>

          <div className="reasons-list">
            {MOTIVOS_PARADA.map((motivo) => {
              const isSelected = selectedMotivo === motivo;
              return (
                <button
                  key={motivo}
                  className={`reason-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedMotivo(motivo);
                    if (isRunning) {
                      handlePause(motivo);
                    }
                  }}
                  type="button"
                >
                  <span>{motivo}</span>
                  {isSelected && <Check size={16} style={{ color: '#fbbf24' }} />}
                </button>
              );
            })}
          </div>

          {/* History of pauses */}
          <div className="pause-history-list">
            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Histórico de Paradas
            </span>
            {pauseHistory.map((h, idx) => (
              <div key={idx} className="pause-history-item">
                <span>{h.motivo}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{h.horario}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
