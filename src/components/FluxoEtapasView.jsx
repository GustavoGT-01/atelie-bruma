import React, { useState } from 'react';
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
}) {
  const [selectedProduct, setSelectedProduct] = useState('AMY');
  const produtoAtivo = produtos.includes(selectedProduct) ? selectedProduct : (produtos[0] || '');

  const pipelineSteps = [
    {
      step: 1,
      title: "CADASTRO",
      demand: "DEM-00018",
      description: "Cadastrar medidas e variantes",
      executor: "RAYANE",
      status: "Concluída",
      color: "#14B8A6"
    },
    {
      step: 2,
      title: "3D ESTRUTURAL",
      demand: "DEM-00162",
      description: "Estrutura interna em madeira e requadro",
      executor: "GUSTAVO",
      status: "Pausado",
      color: "#06B6D4"
    },
    {
      step: 3,
      title: "RECORTES",
      demand: "DEM-00132",
      description: "Plano de corte de chapas e espumas",
      executor: "GUSTAVO",
      status: "Liberada",
      color: "#F59E0B"
    },
    {
      step: 4,
      title: "LISTAGEM",
      demand: "DEM-00133",
      description: "Listagem de peças e ferragens para custos",
      executor: "GUSTAVO",
      status: "Liberada",
      color: "#10B981"
    },
    {
      step: 5,
      title: "MODELAGEM & ESTOFAMENTO",
      demand: "DEM-00140",
      description: "Padrão de costura e prototipagem do assento",
      executor: "MATHEUS",
      status: "Aguardando",
      color: "#8B5CF6"
    }
  ];

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
              {produtoAtivo} <span style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: '500' }}>• Modulação Geral</span>
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', fontSize: '0.82rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '6px' }}>
              Total Etapas: <strong>5</strong>
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '6px 12px', borderRadius: '6px' }}>
              Concluídas: <strong>1</strong>
            </span>
          </div>
        </div>

        {/* Steps Flow Chain */}
        <div className="pipeline-flow">
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
