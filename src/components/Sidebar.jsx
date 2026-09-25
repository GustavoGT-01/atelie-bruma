import React from 'react';
import { 
  LayoutDashboard, 
  ListTodo, 
  Timer, 
  CalendarRange,
  FileSpreadsheet,
  GitFork, 
  SlidersHorizontal,
  UserCheck,
  ShieldAlert,
  FolderKanban
} from 'lucide-react';

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  appMode, 
  setAppMode, 
  activeDemandsCount,
  usuarioNome = 'GUSTAVO',
  onNavigate,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'demandas', label: 'Demandas', icon: ListTodo, badge: activeDemandsCount },
    { id: 'executor', label: 'Painel Executor', icon: Timer },
    { id: 'cronograma', label: 'Cronograma', icon: CalendarRange },
    { id: 'relatorios', label: 'Exportação de Relatórios', icon: FileSpreadsheet, adminOnly: true },
    { id: 'fluxo', label: 'Fluxo de Etapas', icon: GitFork },
    { id: 'cadastros', label: 'Cadastros', icon: FolderKanban, adminOnly: true },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-logo">
        <div className="logo-badge">P</div>
        <div>
          <div className="logo-text">Piu Mobile</div>
          <div className="logo-sub">Design & Engenharia</div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="mode-switcher-container">
        <button 
          className={`mode-btn ${appMode === 'ADM' ? 'active' : ''}`}
          onClick={() => {
            setAppMode('ADM');
            onNavigate?.();
          }}
          type="button"
        >
          <ShieldAlert size={14} />
          Modo ADM
        </button>
        <button 
          className={`mode-btn ${appMode === 'EXECUTOR' ? 'active' : ''}`}
          onClick={() => {
            setAppMode('EXECUTOR');
            setCurrentTab('executor');
            onNavigate?.();
          }}
          type="button"
        >
          <UserCheck size={14} />
          Modo Executor
        </button>
      </div>

      {/* Navigation */}
      <nav className="nav-menu">
        {navItems.filter((item) => !item.adminOnly || appMode === 'ADM').map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setCurrentTab(item.id);
                onNavigate?.();
              }}
              type="button"
            >
              <Icon size={18} className="nav-icon" aria-hidden="true" />
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {item.badge != null && item.badge !== '' && (
                <span key={item.badge} className="nav-badge" style={{
                  background: isActive ? '#ffffff' : 'rgba(255,255,255,0.1)',
                  color: isActive ? '#0a0c10' : '#94a3b8'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">{usuarioNome.slice(0, 1)}</div>
          <div className="user-info">
            <span className="user-name">{usuarioNome}</span>
            <span className="user-role">{appMode === 'ADM' ? 'Administrador' : 'Executor Responsável'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
