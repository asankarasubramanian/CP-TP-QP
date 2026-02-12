import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, Undo2, Redo2, RefreshCw, Share2, Users, Settings, Search, Filter, Plus, X, Check } from 'lucide-react';
import type { OrgNode } from '../types';

interface TerritoryPlanningProps {
  orgData: OrgNode | null;
}

/* ─── Data ─── */
interface TerritoryRow {
  id: string;
  name: string;
  owner: string;
  region: string;
  units: number | null;
  tam: number | null;
}

const initialTerritoryData: TerritoryRow[] = [
  { id: 't1', name: 'US_AERO 1', owner: 'AE1', region: 'US', units: null, tam: null },
  { id: 't2', name: 'US_AERO 2', owner: 'AE2', region: 'US', units: null, tam: null },
  { id: 't5', name: 'CAN_AERO 1', owner: 'AE5', region: 'CAN', units: null, tam: null },
  { id: 't6', name: 'CAN_AERO 2', owner: 'AE6', region: 'CAN', units: null, tam: null },
  { id: 'unassigned', name: 'Unassigned', owner: '', region: '', units: 1000, tam: 12000 },
];

const barChartData = [
  { label: 'US', value: 350 },
  { label: 'CAN', value: 300 },
  { label: 'Unassigned', value: 200 },
];

interface SelectionRow {
  territory: string;
  units: number;
  tam: string;
}

const selectionData: SelectionRow[] = [
  { territory: 'US_AERO 1', units: 2, tam: '1,900' },
  { territory: 'US_AERO 2', units: 1, tam: '1,800' },
];

/* ─── Helpers ─── */
function formatLargeNumber(n: number | null): string {
  if (n === null) return '-';
  return n.toLocaleString('en-US');
}

function formatCurrency(n: number | null): string {
  if (n === null) return '—';
  return '$' + n.toLocaleString('en-US');
}

interface AEInfo {
  validatedCapacity: number | null;
  reportingTo: string; // e.g. "RVP US - Emily Thompson"
}

/** Flatten org tree to get all AE nodes with their validated capacity and parent info */
function flattenAEs(node: OrgNode): Map<string, AEInfo> {
  const map = new Map<string, AEInfo>();
  const walk = (n: OrgNode, parent: OrgNode | null) => {
    if (n.role === 'AE') {
      const parentLabel = parent
        ? `${parent.name}${parent.personName ? ' - ' + parent.personName : ''}`
        : '';
      map.set(n.name, {
        validatedCapacity: n.validatedCapacity,
        reportingTo: parentLabel,
      });
    }
    n.children?.forEach((child) => walk(child, n));
  };
  walk(node, null);
  return map;
}

/* ─── Component ─── */
export default function TerritoryPlanning({ orgData }: TerritoryPlanningProps) {
  const [territoryData, setTerritoryData] = useState<TerritoryRow[]>(initialTerritoryData);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['t1', 't2']));
  const [activeTab, setActiveTab] = useState<'legend' | 'history' | 'comments'>('legend');
  const [showBanner, setShowBanner] = useState(true);
  const [optimized, setOptimized] = useState(false);

  // Build a map of AE name -> info (validated capacity + reporting to) from the org hierarchy
  const aeInfoMap = useMemo(() => {
    if (!orgData) return new Map<string, AEInfo>();
    return flattenAEs(orgData);
  }, [orgData]);

  // Optimize: allocate 1000 units and $12,000 TAM proportionally to AEs by validated capacity
  const handleOptimize = useCallback(() => {
    const TOTAL_UNITS = 1000;
    const TOTAL_TAM = 12000;

    // Get AE rows (non-unassigned) and their validated capacities
    const aeRows = territoryData.filter((t) => t.id !== 'unassigned');
    const capacities = aeRows.map((t) => aeInfoMap.get(t.owner)?.validatedCapacity ?? 0);
    const totalCapacity = capacities.reduce((s, v) => s + v, 0);

    if (totalCapacity === 0) return; // can't allocate without capacity

    // Allocate proportionally, rounding units to integers
    const rawUnits = capacities.map((c) => (c / totalCapacity) * TOTAL_UNITS);
    const rawTam = capacities.map((c) => (c / totalCapacity) * TOTAL_TAM);

    // Round units ensuring they sum to exactly TOTAL_UNITS
    const flooredUnits = rawUnits.map((u) => Math.floor(u));
    const remaining = TOTAL_UNITS - flooredUnits.reduce((s, v) => s + v, 0);
    const fractionals = rawUnits.map((u, i) => ({ i, frac: u - flooredUnits[i] }));
    fractionals.sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remaining; k++) {
      flooredUnits[fractionals[k].i]++;
    }

    // Round TAM to integers ensuring they sum to exactly TOTAL_TAM
    const flooredTam = rawTam.map((t) => Math.floor(t));
    const remainingTam = TOTAL_TAM - flooredTam.reduce((s, v) => s + v, 0);
    const tamFractionals = rawTam.map((t, i) => ({ i, frac: t - flooredTam[i] }));
    tamFractionals.sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainingTam; k++) {
      flooredTam[tamFractionals[k].i]++;
    }

    // Build updated data
    let aeIndex = 0;
    const updated = territoryData.map((row) => {
      if (row.id === 'unassigned') {
        return { ...row, units: 0, tam: 0 };
      }
      const idx = aeIndex++;
      return { ...row, units: flooredUnits[idx], tam: flooredTam[idx] };
    });

    setTerritoryData(updated);
    setOptimized(true);
    setShowBanner(true);
  }, [territoryData, aeInfoMap]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === territoryData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(territoryData.map((t) => t.id)));
    }
  };

  // Totals
  const totalTerritories = territoryData.filter((t) => t.id !== 'unassigned').length;
  const totalUnits = territoryData.reduce((s, t) => s + (t.units ?? 0), 0);
  const totalTam = territoryData.reduce((s, t) => s + (t.tam ?? 0), 0);

  // Total validated capacity from all AE owners
  const totalValidatedCapacity = territoryData
    .filter((t) => t.id !== 'unassigned')
    .reduce((sum, t) => {
      const val = aeInfoMap.get(t.owner)?.validatedCapacity;
      return val !== null && val !== undefined ? sum + val : sum;
    }, 0);
  const hasAnyValidated = territoryData
    .filter((t) => t.id !== 'unassigned')
    .some((t) => { const v = aeInfoMap.get(t.owner)?.validatedCapacity; return v !== null && v !== undefined; });

  const maxBar = Math.max(...barChartData.map((b) => b.value));

  return (
    <div className="tp-page">
      {/* ─── Sub-header toolbar ─── */}
      <div className="tp-subheader">
        <div className="tp-subheader-left">
          <div className="tp-subheader-group">
            <span className="tp-subheader-label">2024 Field Sales</span>
            <span className="tp-subheader-value">2024 Field Sales <ChevronDown size={12} /></span>
          </div>
          <div className="tp-subheader-divider" />
          <div className="tp-subheader-group">
            <span className="tp-subheader-label">Focus</span>
            <span className="tp-subheader-value">Territories (4) <ChevronDown size={12} /></span>
          </div>
          <div className="tp-subheader-divider" />
          <div className="tp-subheader-group">
            <span className="tp-subheader-label">Hierarchy Level</span>
            <span className="tp-subheader-value">Level 4 <ChevronDown size={12} /></span>
          </div>
        </div>
        <div className="tp-subheader-right">
          <div className="tp-subheader-icons">
            <button className="tp-icon-btn" title="Undo"><Undo2 size={16} /></button>
            <button className="tp-icon-btn" title="Redo"><Redo2 size={16} /></button>
            <button className="tp-icon-btn" title="Refresh"><RefreshCw size={16} /></button>
          </div>
          <button className="tp-optimize-btn" onClick={handleOptimize}>
            Optimize <ChevronDown size={14} />
          </button>
          <button className="tp-publish-btn">Publish</button>
          <div className="tp-subheader-icons">
            <button className="tp-icon-btn" title="Share"><Share2 size={16} /></button>
            <button className="tp-icon-btn" title="Users"><Users size={16} /></button>
            <button className="tp-icon-btn" title="Settings"><Settings size={16} /></button>
          </div>
        </div>
      </div>

      {/* ─── Success banner ─── */}
      {showBanner && (
        <div className="tp-banner">
          <div className="tp-banner-content">
            <span className="tp-banner-icon"><Check size={16} /></span>
            <span>{optimized ? '1,000 units and $12,000 TAM allocated proportionally across 8 territories.' : '20 New Records have been added.'}</span>
          </div>
          <button className="tp-banner-close" onClick={() => setShowBanner(false)}><X size={16} /></button>
        </div>
      )}

      {/* ─── Action buttons row ─── */}
      <div className="tp-actions-row">
        <div className="tp-actions-spacer" />
        <div className="tp-actions-right">
          <button className="tp-geo-btn">Start Geographic Carving</button>
          <button className="tp-submit-approval-btn">Submit for Approval</button>
        </div>
      </div>

      {/* ─── Main two-panel layout ─── */}
      <div className="tp-main">
        {/* ─── Left panel: Summaries ─── */}
        <div className="tp-left-panel">
          {/* Territory Summary */}
          <div className="tp-summary-section">
            <div className="tp-summary-header">
              <h3 className="tp-summary-title">Territory Summary</h3>
              <div className="tp-summarize-by">
                <span className="tp-summarize-label">Summarize by:</span>
                <select className="tp-summarize-select">
                  <option>Territory</option>
                  <option>Region</option>
                  <option>Owner</option>
                </select>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="tp-chart">
              <div className="tp-chart-y-axis">
                <span>400</span>
                <span>300</span>
                <span>200</span>
                <span>100</span>
                <span>0</span>
              </div>
              <div className="tp-chart-area">
                <div className="tp-chart-grid">
                  <div className="tp-chart-grid-line" />
                  <div className="tp-chart-grid-line" />
                  <div className="tp-chart-grid-line" />
                  <div className="tp-chart-grid-line" />
                  <div className="tp-chart-grid-line" />
                </div>
                <div className="tp-chart-bars">
                  {barChartData.map((bar) => (
                    <div key={bar.label} className="tp-chart-bar-group">
                      <div
                        className="tp-chart-bar"
                        style={{ height: `${(bar.value / (maxBar + 50)) * 100}%` }}
                      />
                      <span className="tp-chart-bar-label">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="tp-chart-legend">
              <span className="tp-chart-legend-swatch" />
              <span className="tp-chart-legend-text">Units per area</span>
            </div>
          </div>

          {/* Selection Summary */}
          <div className="tp-selection-section">
            <div className="tp-summary-header">
              <h3 className="tp-summary-title">Selection Summary</h3>
              <div className="tp-summarize-by">
                <span className="tp-summarize-label">Summarize by:</span>
                <select className="tp-summarize-select">
                  <option>Territory</option>
                  <option>Region</option>
                </select>
              </div>
            </div>
            <table className="tp-sel-table">
              <thead>
                <tr>
                  <th className="tp-sel-th">Territory</th>
                  <th className="tp-sel-th">Units</th>
                  <th className="tp-sel-th">Sum of Account Potential/TAM</th>
                </tr>
              </thead>
              <tbody>
                {selectionData.map((row) => (
                  <tr key={row.territory} className="tp-sel-row">
                    <td className="tp-sel-td">{row.territory}</td>
                    <td className="tp-sel-td">{row.units}</td>
                    <td className="tp-sel-td">{row.tam}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tp-sel-total">
                  <td className="tp-sel-td tp-sel-td-bold">2</td>
                  <td className="tp-sel-td tp-sel-td-bold">3</td>
                  <td className="tp-sel-td tp-sel-td-bold">3,700</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ─── Right panel: Legend / Table ─── */}
        <div className="tp-right-panel">
          {/* Tabs */}
          <div className="tp-tabs">
            <button
              className={`tp-tab ${activeTab === 'legend' ? 'tp-tab-active' : ''}`}
              onClick={() => setActiveTab('legend')}
            >
              Legend
            </button>
            <button
              className={`tp-tab ${activeTab === 'history' ? 'tp-tab-active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
            <button
              className={`tp-tab ${activeTab === 'comments' ? 'tp-tab-active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              Comments
            </button>
          </div>

          {activeTab === 'legend' && (
            <div className="tp-legend-content">
              {/* Legend header */}
              <div className="tp-legend-header">
                <div className="tp-legend-left">
                  <div className="tp-legend-info">
                    <span className="tp-legend-label">Legend</span>
                    <span className="tp-legend-dropdown">Territory <ChevronDown size={12} /></span>
                  </div>
                  <div className="tp-legend-stats">
                    <span>Units selected: <strong>99</strong></span>
                    <span>Placeholder units: <strong>68</strong></span>
                    <span>Removed Units: <strong>100</strong></span>
                  </div>
                </div>
                <div className="tp-legend-right">
                  <div className="tp-show-selected">
                    <span className="tp-show-selected-label">Show Selected Only</span>
                    <span className="tp-show-selected-info">ⓘ</span>
                    <div className="tp-toggle tp-toggle-on">
                      <div className="tp-toggle-thumb" />
                    </div>
                  </div>
                  <div className="tp-legend-icons">
                    <button className="tp-legend-icon-btn"><Search size={15} /></button>
                    <button className="tp-legend-icon-btn"><Filter size={15} /></button>
                    <button className="tp-legend-icon-btn"><Users size={15} /></button>
                    <button className="tp-legend-icon-btn"><Plus size={15} /></button>
                  </div>
                </div>
              </div>

              {/* Assign by logic */}
              <div className="tp-assign-row">
                <div className="tp-assign-left">
                  <button className="tp-assign-btn">
                    Assign by Logic <ChevronDown size={12} />
                  </button>
                  <button className="tp-assign-action tp-assign-confirm"><Check size={16} /></button>
                  <button className="tp-assign-action tp-assign-cancel"><X size={16} /></button>
                </div>
              </div>

              {/* Territory table */}
              <div className="tp-territory-table-wrap">
                <table className="tp-territory-table">
                  <thead>
                    <tr>
                      <th className="tp-tt-th tp-tt-th-check">
                        <input
                          type="checkbox"
                          className="tp-checkbox"
                          checked={selectedIds.size === territoryData.length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th className="tp-tt-th tp-tt-th-name">Territory</th>
                      <th className="tp-tt-th">Owner</th>
                      <th className="tp-tt-th tp-tt-th-reporting">Reporting to</th>
                      <th className="tp-tt-th">Region</th>
                      <th className="tp-tt-th tp-tt-th-number">Validated Capacity</th>
                      <th className="tp-tt-th tp-tt-th-number">Units</th>
                      <th className="tp-tt-th tp-tt-th-revenue">Sum of Account Potential/TAM</th>
                      <th className="tp-tt-th tp-tt-th-action"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {territoryData.map((row) => {
                      const isSelected = selectedIds.has(row.id);
                      const isUnassigned = row.id === 'unassigned';
                      return (
                        <tr
                          key={row.id}
                          className={`tp-tt-row ${isSelected ? 'tp-tt-row-selected' : ''} ${isUnassigned ? 'tp-tt-row-unassigned' : ''}`}
                        >
                          <td className="tp-tt-td tp-tt-td-check">
                            {!isUnassigned && (
                              <input
                                type="checkbox"
                                className="tp-checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelection(row.id)}
                              />
                            )}
                          </td>
                          <td className="tp-tt-td tp-tt-td-name">
                            {isSelected && !isUnassigned && <span className="tp-color-swatch" />}
                            {row.name}
                          </td>
                          <td className="tp-tt-td">{row.owner || '-'}</td>
                          <td className="tp-tt-td">{!isUnassigned ? (aeInfoMap.get(row.owner)?.reportingTo || '-') : ''}</td>
                          <td className="tp-tt-td">{row.region || ''}</td>
                          <td className="tp-tt-td tp-tt-td-number">
                            {!isUnassigned ? formatCurrency(aeInfoMap.get(row.owner)?.validatedCapacity ?? null) : '—'}
                          </td>
                          <td className="tp-tt-td tp-tt-td-number">{formatLargeNumber(row.units)}</td>
                          <td className="tp-tt-td tp-tt-td-number">{formatLargeNumber(row.tam)}</td>
                          <td className="tp-tt-td tp-tt-td-action">
                            <button className="tp-row-add-btn"><Plus size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="tp-tt-footer">
                      <td className="tp-tt-td tp-tt-td-check"></td>
                      <td className="tp-tt-td tp-tt-td-bold"></td>
                      <td className="tp-tt-td tp-tt-td-bold">{totalTerritories + 1}</td>
                      <td className="tp-tt-td"></td>
                      <td className="tp-tt-td tp-tt-td-bold">{formatLargeNumber(totalUnits)}</td>
                      <td className="tp-tt-td tp-tt-td-number tp-tt-td-bold">{hasAnyValidated ? formatCurrency(totalValidatedCapacity) : '—'}</td>
                      <td className="tp-tt-td tp-tt-td-number tp-tt-td-bold">{formatLargeNumber(totalUnits)}</td>
                      <td className="tp-tt-td tp-tt-td-number tp-tt-td-bold">{formatLargeNumber(totalTam)}</td>
                      <td className="tp-tt-td"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="tp-tab-placeholder">
              <p>History content will appear here.</p>
            </div>
          )}
          {activeTab === 'comments' && (
            <div className="tp-tab-placeholder">
              <p>Comments content will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
