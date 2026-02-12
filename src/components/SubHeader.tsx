import { LayoutList, LayoutGrid, Home, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface BreadcrumbItem {
  label: string;
  isLink: boolean;
  isCurrent: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
  { label: '', isLink: true, isCurrent: false },     // Home icon
  { label: 'FY27 Plan', isLink: true, isCurrent: false },
  { label: 'Capacity Planning', isLink: true, isCurrent: false },
  { label: 'All Org', isLink: false, isCurrent: true },
];

export default function SubHeader() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  return (
    <div className="sub-header">
      <div className="sub-header-left">
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'view-toggle-btn-active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <LayoutList size={16} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'grid' ? 'view-toggle-btn-active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
        <nav className="breadcrumb">
          {breadcrumbs.map((item, index) => (
            <span key={index} className="breadcrumb-segment">
              {index > 0 && <ChevronRight size={12} className="breadcrumb-separator" />}
              {index === 0 ? (
                <a className="breadcrumb-link breadcrumb-home">
                  <Home size={14} />
                </a>
              ) : item.isCurrent ? (
                <span className="breadcrumb-current">{item.label}</span>
              ) : (
                <a className="breadcrumb-link">{item.label}</a>
              )}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}
