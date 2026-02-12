import { ArrowLeft, Settings, HelpCircle, Map } from 'lucide-react';

interface HeaderProps {
  currentPage: 'capacity' | 'territory';
  onNavigate: (page: 'capacity' | 'territory') => void;
}

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <button
          className="header-back-btn"
          onClick={() => currentPage !== 'capacity' ? onNavigate('capacity') : undefined}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="header-title">
          {currentPage === 'territory' ? 'Territory Planning' : 'Capacity Planning'}
        </span>
        <span className="header-plan">{currentPage === 'territory' ? 'AERO SEGMENT' : 'FY27 Plan'}</span>
      </div>
      <div className="header-right">
        <button
          className={`header-action-btn ${currentPage === 'territory' ? 'header-action-btn-active' : ''}`}
          onClick={() => onNavigate('territory')}
        >
          <Map size={16} />
          <span>Territory Planning</span>
        </button>
        <button className="header-action-btn">
          <Settings size={16} />
          <span>Settings</span>
        </button>
        <button className="header-action-btn">
          <HelpCircle size={16} />
          <span>Help</span>
        </button>
      </div>
    </header>
  );
}
