import React, { useMemo, useState } from 'react';
import { 
  GitBranch, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  AlertCircle,
  Layers,
  ChevronRight
} from 'lucide-react';
import { PRODUTOS_LIST, ATIVIDADES_CONFIG } from '../data/mockData';

export default function FluxoEtapasView({ 
  demands, 
  onSelectDemand,
  produtos = PRODUTOS_LIST,
  atividades = [],
  diagramDefault = [],
  atividadesConfig = ATIVIDADES_CONFIG,
}) {
  const [selectedProduct, setSelectedProduct] = useState(produtos[0] || '');
  const produtoAtivo = produtos.includes(selectedProduct) ? selectedProduct : (produtos[0] || '');

  const pipelineSteps = useMemo(() => {
    const ordem = new Map();
    for (const tipo of atividades) {
      const diagrama = diagramDefault.find((item) => item.id === tipo.id);
      ordem.set(tipo.nome, diagrama?.ordem ?? tipo.ordem ?? 999);
    }
    return demands
      .filter((demanda) => demanda.produto === produtoAtivo)
      .slice()
      .sort((a, b) => {
        const diff = (ordem.get(a.atividade) ?? 999) - (ordem.get(b.atividade) ?? 999);
        if (diff !== 0) return diff;
        return String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true });
      })
      .map((demanda, index) => ({
        step: index + 1,
        title: demanda.atividade,
        demand: demanda.id,
        description: demanda.especificacao || demanda.modulacao || '',
        executor: demanda.executor,
        status: demanda.status,
        color: atividadesConfig[demanda.atividade]?.color || '#94a3b8',
      }));
  }, [demands, produtoAtivo, atividades, diagramDefault, atividadesConfig]);

  const concluidas = pipelineSteps.filter((step) => step.status === 'Concluída').length;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fluxo de Etapas</h1>
          <p className="page-subtitle">Cadeia de produção por produto — liberação automática ao concluir cada etapa.</p>
        </div>
      </div>

      {/* Product Pills Scrollable Selector */}
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>
          Filtrar por Produto:
        </span>
      </div>

      <div className="products-pills-scroll">
        {produtos.map((prod) => {
          const isActive = produtoAtivo === prod;
          return (
            <button
              key={prod}
              className={`product-pill ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedProduct(prod)}
              type="button"
              aria-pressed={isActive}
            >
              {prod}
            </button>
          );
        })}
      </div>

      {/* Pipeline Card Container */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Esteira do Produto</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff' }}>
              {produtoAtivo || '—'}
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', fontSize: '0.82rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '6px' }}>
              Total Etapas: <strong>{pipelineSteps.length}</strong>
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '6px 12px', borderRadius: '6px' }}>
              Concluídas: <strong>{concluidas}</strong>
            </span>
          </div>
        </div>

        {/* Steps Flow Chain */}
        <div className="pipeline-flow">
          {pipelineSteps.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Nenhuma demanda deste produto.</p>
          ) : null}
          {pipelineSteps.map((step, idx) => {
            const isLast = idx === pipelineSteps.length - 1;
            const abrirEtapa = () => {
              const found = demands.find(d => d.id === step.demand);
              if (found) onSelectDemand(found);
            };
            return (
              <React.Fragment key={step.step}>
                <div
                  className="pipeline-step-card"
                  role="button"
                  tabIndex={0}
                  onClick={abrirEtapa}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      abrirEtapa();
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="pipeline-step-badge">
                      {step.step}
                    </div>
                    <span 
                      className="status-pill"
                      style={{
                        fontSize: '0.74rem',
                        backgroundColor: step.status === 'Concluída' ? 'rgba(16, 185, 129, 0.2)' :
                                       step.status === 'Em andamento' ? 'rgba(56, 189, 248, 0.2)' :
                                       step.status === 'Pausado' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.06)',
                        color: step.status === 'Concluída' ? '#34d399' :
                               step.status === 'Em andamento' ? '#38bdf8' :
                               step.status === 'Pausado' ? '#fbbf24' : '#94a3b8'
                      }}
                    >
                      {step.status}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: '700', color: '#ffffff', marginBottom: '4px' }}>
                      {step.title}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {step.description}
                    </p>
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{step.demand}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{step.executor}</span>
                  </div>
                </div>

                {!isLast && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowRight size={20} style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
