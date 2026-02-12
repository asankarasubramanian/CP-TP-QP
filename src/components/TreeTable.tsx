import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, User, UserX, FileText, ArrowUpDown, X } from 'lucide-react';
import type { OrgNode } from '../types';
import { getRolledUpHeadcount, getRolledUpValidatedCapacity, updateNodeInTree, updateHeadcountAndRollUp } from '../data/hierarchy';

interface TreeTableProps {
  data: OrgNode | null;
  onDataChange?: (data: OrgNode | null) => void;
}

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US');
}

const CAPACITY_PER_HC = 1000;

/** Computed expected capacity = node headcount × $1,000 */
function getExpectedCapacity(node: OrgNode): number {
  return node.headcount * CAPACITY_PER_HC;
}

/**
 * Inline editable number cell. Shows formatted value; on click turns into an input.
 */
function EditableNumberCell({
  value,
  onChange,
  isCurrency = false,
}: {
  value: number;
  onChange: (v: number) => void;
  isCurrency?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
      setDraft(String(value));
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="editable-cell-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setEditing(false); setDraft(String(value)); }
        }}
      />
    );
  }

  return (
    <span className="editable-cell-value" onClick={() => { setDraft(String(value)); setEditing(true); }}>
      {isCurrency ? formatCurrency(value) : value}
    </span>
  );
}

/**
 * Inline editable currency cell for validated capacity (nullable).
 */
function EditableValidatedCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value !== null ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
      setDraft(value !== null ? String(value) : '');
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="editable-cell-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setEditing(false); setDraft(value !== null ? String(value) : ''); }
        }}
      />
    );
  }

  return (
    <span className="editable-cell-value" onClick={() => { setDraft(value !== null ? String(value) : '0'); setEditing(true); }}>
      {value !== null ? formatCurrency(value) : '—'}
    </span>
  );
}

function Avatar({ node }: { node: OrgNode }) {
  const isTBH = node.repType === 'TBH';
  if (node.avatarInitials) {
    return (
      <div
        className={`avatar ${isTBH ? 'avatar-tbh' : ''}`}
        style={{ backgroundColor: node.avatarColor || '#64748b' }}
      >
        <span className="avatar-initials">{node.avatarInitials}</span>
      </div>
    );
  }
  return (
    <div
      className={`avatar ${isTBH ? 'avatar-tbh' : ''}`}
      style={{ backgroundColor: isTBH ? '#e2e8f0' : (node.avatarColor || '#64748b') }}
    >
      {isTBH ? (
        <UserX size={14} className="avatar-icon-tbh" />
      ) : (
        <User size={14} className="avatar-icon" />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === 'Cascaded' ? 'status-cascaded' :
    status === 'Plan In Progress' ? 'status-in-progress' :
    status === 'Not Started' ? 'status-not-started' :
    'status-drafting';

  return (
    <span className={`status-badge ${className}`}>
      {status === 'Drafting' && <FileText size={12} className="status-icon" />}
      {status}
    </span>
  );
}

/**
 * Build the subtitle text based on the node's level and metadata.
 */
function buildSubtitle(node: OrgNode): string {
  // AE level: show (Veteran) or (TBH - Oct 1 Start) — Assigned to: INDUSTRY
  if (node.role === 'AE') {
    const parts: string[] = [];
    if (node.repType === 'Veteran') {
      parts.push('Veteran');
    } else if (node.repType === 'TBH') {
      parts.push(node.startDate ? `TBH - ${node.startDate}` : 'TBH');
    }
    if (node.industry) {
      return `(${parts.join('')}) — Assigned to: ${node.industry}`;
    }
    return parts.length > 0 ? `(${parts.join('')})` : '';
  }

  // RVP level: show Allocated HC and Validated info
  if (node.role === 'RVP') {
    const parts: string[] = [];
    if (node.allocatedHC !== undefined) {
      parts.push(`Allocated: ${node.allocatedHC} HC`);
    }
    const validatedParts: string[] = [];
    if (node.validatedVeterans !== undefined && node.validatedVeterans > 0) {
      validatedParts.push(`${node.validatedVeterans} Veteran${node.validatedVeterans > 1 ? 's' : ''}`);
    }
    if (node.validatedTBH !== undefined && node.validatedTBH > 0) {
      validatedParts.push(`${node.validatedTBH} TBH${node.validatedTBH > 1 ? 's' : ''}`);
    }
    if (validatedParts.length > 0) {
      parts.push(`Validated: ${validatedParts.join(', ')}`);
    }
    return parts.join(' | ');
  }

  // AVP level: show Total HC
  if (node.role === 'AVP') {
    const parts: string[] = [];
    if (node.totalHC !== undefined) {
      parts.push(`Total HC: ${node.totalHC}`);
    }
    return parts.join(' | ');
  }

  // SVP level: no subtitle
  if (node.role === 'SVP') {
    return '';
  }

  // CRO level: no subtitle per screenshot
  if (node.role === 'CRO') {
    return '';
  }

  // Fallback: show person name if available
  if (node.personName) {
    return node.personName;
  }

  return '';
}

interface TreeRowProps {
  node: OrgNode;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  visibleRowIndex: number;
  addedColumns: string[];
  onNodeUpdate: (nodeId: string, updater: (n: OrgNode) => OrgNode) => void;
  onHeadcountUpdate: (nodeId: string, value: number) => void;
  onNodeClick: (node: OrgNode) => void;
  selectedNodeId: string | null;
}

function TreeRow({ node, expandedIds, onToggle, visibleRowIndex, addedColumns, onNodeUpdate, onHeadcountUpdate, onNodeClick, selectedNodeId }: TreeRowProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  const indent = node.depth * 24;
  const subtitle = buildSubtitle(node);

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) onToggle(node.id);
  };

  return (
    <>
      <tr className={`tree-row ${selectedNodeId === node.id ? 'tree-row-selected' : ''}`} onClick={() => onNodeClick(node)}>
        {/* Name cell with tree indentation - org chart: only this area toggles expand */}
        <td className="cell cell-name">
          <div
            className={`name-content ${hasChildren ? 'name-content-expandable' : ''}`}
            style={{ paddingLeft: `${indent}px` }}
            onClick={handleToggleClick}
            role={hasChildren ? 'button' : undefined}
            tabIndex={hasChildren ? 0 : undefined}
            onKeyDown={hasChildren ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(node.id); } } : undefined}
          >
            <span
              className={`expand-indicator ${hasChildren ? '' : 'expand-indicator-leaf'}`}
              aria-hidden
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
              ) : (
                <span className="expand-indicator-spacer" />
              )}
            </span>
            <Avatar node={node} />
            <div className="name-info">
              <span className="name-primary">{node.name}</span>
              {node.personName && (
                <span className="name-person">{node.personName}</span>
              )}
              {subtitle && (
                <span className="name-subtitle">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Segment */}
        <td className="cell cell-segment">
          {node.segments && node.segments.length > 0 ? (
            <div className="segment-badges">
              {node.segments.map((s) => (
                <span key={s} className="segment-badge">{s}</span>
              ))}
            </div>
          ) : (
            '—'
          )}
        </td>

        {/* Target Capacity — editable */}
        <td className="cell cell-number cell-editable">
          <EditableNumberCell
            value={node.targetCapacity}
            isCurrency
            onChange={(v) => onNodeUpdate(node.id, (n) => ({ ...n, targetCapacity: v }))}
          />
        </td>

        {/* LY Headcount (IC) — dynamic column (read-only, same as HC) */}
        {addedColumns.includes('LY Headcount (IC)') && (
          <td className="cell cell-number">{getRolledUpHeadcount(node)}</td>
        )}

        {/* LY AE Capacity — dynamic column: LY Headcount (IC) × $800 */}
        {addedColumns.includes('LY AE Capacity') && (
          <td className="cell cell-number">{formatCurrency(getRolledUpHeadcount(node) * 800)}</td>
        )}

        {/* Headcount (IC) — editable on all nodes; rolls up to ancestors */}
        <td className="cell cell-number cell-editable">
          <EditableNumberCell
            value={node.headcount}
            onChange={(v) => onHeadcountUpdate(node.id, v)}
          />
        </td>

        {/* Expected Capacity — computed: headcount × $1,000 */}
        <td className="cell cell-number">{formatCurrency(getExpectedCapacity(node))}</td>

        {/* Validated Capacity — editable only for AE, rolled up for parents */}
        <td className="cell cell-number">
          {node.role === 'AE' ? (
            <span className="cell-editable">
              <EditableValidatedCell
                value={node.validatedCapacity}
                onChange={(v) => onNodeUpdate(node.id, (n) => ({ ...n, validatedCapacity: v }))}
              />
            </span>
          ) : (
            (() => {
              const rolled = getRolledUpValidatedCapacity(node);
              return rolled !== null ? formatCurrency(rolled) : '—';
            })()
          )}
        </td>

        {/* Difference = Validated Capacity − Expected Capacity (rolled up) */}
        <td className="cell cell-number">
          {(() => {
            const expected = getExpectedCapacity(node);
            const validated = node.role === 'AE' ? node.validatedCapacity : getRolledUpValidatedCapacity(node);
            return validated !== null ? formatCurrency(validated - expected) : '—';
          })()}
        </td>

        {/* Status */}
        <td className="cell cell-status">
          <StatusBadge status={node.status} />
        </td>

        {/* Action */}
        <td className="cell cell-action">
          {node.status === 'Drafting' && (
            <button className="submit-btn">Submit</button>
          )}
        </td>
        <td className="cell"></td>
      </tr>
      {hasChildren && isExpanded &&
        node.children!.map((child, idx) => {
          const childIdx = visibleRowIndex + idx + 1;
          return (
            <TreeRow
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              visibleRowIndex={childIdx}
              addedColumns={addedColumns}
              onNodeUpdate={onNodeUpdate}
              onHeadcountUpdate={onHeadcountUpdate}
              onNodeClick={onNodeClick}
              selectedNodeId={selectedNodeId}
            />
          );
        })}
    </>
  );
}

export default function TreeTable({ data, onDataChange }: TreeTableProps) {
  const [treeData, setTreeDataInternal] = useState<OrgNode | null>(data);

  // Sync with external data when it changes
  const setTreeData = useCallback((updater: OrgNode | null | ((prev: OrgNode | null) => OrgNode | null)) => {
    setTreeDataInternal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (onDataChange) onDataChange(next);
      return next;
    });
  }, [onDataChange]);

  // Org chart: expand CRO, SVP AMER, AMER Industries AVP (depth 0-2), NOT RVP
  const getInitialExpanded = useCallback(() => {
    if (!treeData) return new Set<string>();
    const ids = new Set<string>();
    const addExpanded = (node: OrgNode, depth: number) => {
      if (depth < 3) ids.add(node.id);
      node.children?.forEach((child) => addExpanded(child, depth + 1));
    };
    addExpanded(treeData, 0);
    return ids;
  }, [treeData]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(getInitialExpanded);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [addedColumns, setAddedColumns] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);

  const handleSaveColumns = (selected: string[]) => {
    setAddedColumns((prev) => {
      const existing = new Set(prev);
      const newCols = selected.filter((c) => !existing.has(c));
      return [...prev, ...newCols];
    });
    setAddColumnModalOpen(false);
  };

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleNodeUpdate = useCallback((nodeId: string, updater: (n: OrgNode) => OrgNode) => {
    setTreeData((prev) => {
      if (!prev) return prev;
      return updateNodeInTree(prev, nodeId, updater);
    });
  }, [setTreeData]);

  const handleHeadcountUpdate = useCallback((nodeId: string, value: number) => {
    setTreeData((prev) => {
      if (!prev) return prev;
      return updateHeadcountAndRollUp(prev, nodeId, value);
    });
  }, [setTreeData]);

  const handleNodeClick = useCallback((node: OrgNode) => {
    setSelectedNode((prev) => prev?.id === node.id ? null : node);
  }, []);

  // Keep selectedNode in sync when treeData changes
  const selectedNodeId = selectedNode?.id ?? null;
  const syncedSelectedNode = useMemo(() => {
    if (!selectedNodeId || !treeData) return null;
    const findNode = (n: OrgNode): OrgNode | null => {
      if (n.id === selectedNodeId) return n;
      if (n.children) {
        for (const c of n.children) {
          const found = findNode(c);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(treeData);
  }, [treeData, selectedNodeId]);

  return (
    <div className={`tree-table-layout ${syncedSelectedNode ? 'tree-table-layout-panel-open' : ''}`}>
    <div className="tree-table-container">
      <div className="tree-table-wrapper">
        <table className="tree-table">
          <thead>
            <tr className="tree-header-row">
              <th className="th th-name">
                <div className="th-content">
                  Name
                  <ArrowUpDown size={10} className="sort-icon" />
                </div>
              </th>
              <th className="th th-segment">
                <div className="th-content">
                  Segment
                  <ArrowUpDown size={10} className="sort-icon" />
                </div>
              </th>
              <th className="th th-number">
                <div className="th-content th-content-right">
                  Target Capacity
                  <ArrowUpDown size={10} className="sort-icon" />
                </div>
              </th>
              {addedColumns.includes('LY Headcount (IC)') && (
                <th className="th th-number">
                  <div className="th-content th-content-right">
                    LY Headcount (IC)
                    <ArrowUpDown size={10} className="sort-icon" />
                  </div>
                </th>
              )}
              {addedColumns.includes('LY AE Capacity') && (
                <th className="th th-number">
                  <div className="th-content th-content-right">
                    LY AE Capacity
                    <ArrowUpDown size={10} className="sort-icon" />
                  </div>
                </th>
              )}
              <th className="th th-number">
                <div className="th-content th-content-right">
                  Headcount (IC)
                  <ArrowUpDown size={10} className="sort-icon" />
                </div>
              </th>
              <th className="th th-number">
                <div className="th-content th-content-right">
                  Expected Capacity
                  <ArrowUpDown size={10} className="sort-icon" />
                </div>
              </th>
              <th className="th th-number">
                <div className="th-content th-content-right">
                  Validated Capacity
                  <ArrowUpDown size={10} className="sort-icon" />
                </div>
              </th>
              <th className="th th-number">
                <div className="th-content th-content-right">
                  Difference
                  <ArrowUpDown size={10} className="sort-icon" />
                </div>
              </th>
              <th className="th th-status">
                <div className="th-content">
                  Status
                  <ArrowUpDown size={10} className="sort-icon" />
                </div>
              </th>
              <th className="th th-action">
                <div className="th-content">
                  Action
                </div>
              </th>
              <th className="th th-add">
                <button className="add-column-btn" onClick={() => setAddColumnModalOpen(true)} type="button">+</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {treeData && (
              <TreeRow
                key={treeData.id}
                node={treeData}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                visibleRowIndex={1}
                addedColumns={addedColumns}
                onNodeUpdate={handleNodeUpdate}
                onHeadcountUpdate={handleHeadcountUpdate}
                onNodeClick={handleNodeClick}
                selectedNodeId={selectedNodeId}
              />
            )}
          </tbody>
        </table>
      </div>

      {addColumnModalOpen && (
        <AddColumnModal
          onClose={() => setAddColumnModalOpen(false)}
          onSave={handleSaveColumns}
          alreadyAdded={addedColumns}
        />
      )}
    </div>

    {syncedSelectedNode && (
      <NodeSidePanel node={syncedSelectedNode} onClose={() => setSelectedNode(null)} addedColumns={addedColumns} />
    )}
    </div>
  );
}

function NodeSidePanel({ node, onClose, addedColumns }: { node: OrgNode; onClose: () => void; addedColumns: string[] }) {
  const expectedCap = getExpectedCapacity(node);
  const hc = node.headcount;
  const rampedCapacity = hc > 0 ? Math.round(expectedCap / hc) : 0;
  const totalCapacity = expectedCap;

  // Determine badge status for Target Revenue
  const targetRevenueStatus = node.targetCapacity > 0 ? 'projected' : 'projected';
  // Determine badge status for Headcount
  const hcStatus = hc > 0 ? 'undefined' : 'undefined';

  return (
    <aside className="side-panel" role="complementary">
      <div className="side-panel-header">
        <h2 className="side-panel-title">{node.name} Hierarchy Details</h2>
        <button type="button" className="side-panel-close" onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>
      </div>

      <div className="side-panel-body">
        {/* Target Revenue & Headcount row */}
        <div className="sp-summary-row">
          <div className="sp-summary-item">
            <span className="sp-summary-label">Target Revenue</span>
            <div className="sp-summary-value-row">
              <span className={`sp-badge sp-badge-${targetRevenueStatus}`}>
                Projected {formatNumber(totalCapacity)}
              </span>
              <span className="sp-summary-number">{formatNumber(totalCapacity)}</span>
            </div>
          </div>
          <div className="sp-summary-item">
            <span className="sp-summary-label">Headcount</span>
            <div className="sp-summary-value-row">
              <span className={`sp-badge sp-badge-${hcStatus}`}>
                Undefined {hc}
              </span>
              <span className="sp-summary-number">{hc}</span>
            </div>
          </div>
        </div>

        {/* Job Profile Table */}
        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead>
              <tr>
                <th className="sp-th">Job Profile</th>
                {addedColumns.includes('LY Headcount (IC)') && (
                  <th className="sp-th sp-th-right">LY Headcount (IC)</th>
                )}
                <th className="sp-th sp-th-right">Headcount</th>
                <th className="sp-th sp-th-right">Ramped Capacity</th>
                <th className="sp-th sp-th-right">Total Capacity</th>
                <th className="sp-th sp-th-action"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="sp-tr">
                <td className="sp-td">AE</td>
                {addedColumns.includes('LY Headcount (IC)') && (
                  <td className="sp-td sp-td-right">{hc}</td>
                )}
                <td className="sp-td sp-td-right">{hc}</td>
                <td className="sp-td sp-td-right">{formatNumber(rampedCapacity)}</td>
                <td className="sp-td sp-td-right">{formatNumber(totalCapacity)}</td>
                <td className="sp-td sp-td-action">
                  <button type="button" className="sp-row-menu-btn" aria-label="Row actions">
                    <ChevronDown size={14} />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add Job Profile */}
        <div>
          <button type="button" className="sp-add-profile-btn">
            Add Job Profile <ChevronDown size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

const ALL_AVAILABLE_COLUMNS = [
  'LY Headcount (IC)',
  'LY AE Capacity',
  'User ID',
  'User Name',
  'Role',
  'Level',
  'Avg. Deal Size',
  'Win Rate',
  'Quota Attainment Rate',
];

function AddColumnModal({ onClose, onSave, alreadyAdded }: { onClose: () => void; onSave: (selected: string[]) => void; alreadyAdded: string[] }) {
  const [available, setAvailable] = useState<string[]>(
    ALL_AVAILABLE_COLUMNS.filter((c) => !alreadyAdded.includes(c))
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [highlightedAvailable, setHighlightedAvailable] = useState<Set<string>>(new Set());
  const [highlightedSelected, setHighlightedSelected] = useState<Set<string>>(new Set());

  const toggleHighlightAvailable = (item: string) => {
    setHighlightedAvailable((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const toggleHighlightSelected = (item: string) => {
    setHighlightedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const selectAll = () => {
    setHighlightedAvailable(new Set(available));
  };

  const selectNone = () => {
    setHighlightedAvailable(new Set());
  };

  const moveRight = () => {
    const toMove = available.filter((i) => highlightedAvailable.has(i));
    if (toMove.length === 0) return;
    setSelected([...selected, ...toMove]);
    setAvailable(available.filter((i) => !highlightedAvailable.has(i)));
    setHighlightedAvailable(new Set());
  };

  const moveLeft = () => {
    const toMove = selected.filter((i) => highlightedSelected.has(i));
    if (toMove.length === 0) return;
    setAvailable([...available, ...toMove]);
    setSelected(selected.filter((i) => !highlightedSelected.has(i)));
    setHighlightedSelected(new Set());
  };

  const moveUp = () => {
    if (highlightedSelected.size !== 1) return;
    const item = [...highlightedSelected][0];
    const idx = selected.indexOf(item);
    if (idx <= 0) return;
    const next = [...selected];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSelected(next);
  };

  const moveDown = () => {
    if (highlightedSelected.size !== 1) return;
    const item = [...highlightedSelected][0];
    const idx = selected.indexOf(item);
    if (idx < 0 || idx >= selected.length - 1) return;
    const next = [...selected];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setSelected(next);
  };

  const handleSave = () => {
    onSave(selected);
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden />
      <div className="modal add-column-modal" role="dialog" aria-modal aria-labelledby="add-column-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="add-column-title" className="modal-title">Add Column</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body shuttle-body">
          <div className="shuttle-panel">
            <div className="shuttle-panel-header">
              <span className="shuttle-panel-label">Available</span>
              <span className="shuttle-select-actions">
                <button type="button" className="shuttle-link" onClick={selectAll}>Select All</button>
                <span className="shuttle-divider">|</span>
                <button type="button" className="shuttle-link" onClick={selectNone}>None</button>
              </span>
            </div>
            <ul className="shuttle-list">
              {available.map((item) => (
                <li
                  key={item}
                  className={`shuttle-item ${highlightedAvailable.has(item) ? 'shuttle-item-active' : ''}`}
                  onClick={() => toggleHighlightAvailable(item)}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="shuttle-arrows">
            <button type="button" className="shuttle-arrow-btn" onClick={moveRight} title="Move right" disabled={highlightedAvailable.size === 0}>
              ▶
            </button>
            <button type="button" className="shuttle-arrow-btn" onClick={moveLeft} title="Move left" disabled={highlightedSelected.size === 0}>
              ◀
            </button>
          </div>

          <div className="shuttle-panel">
            <div className="shuttle-panel-header">
              <span className="shuttle-panel-label">Selected</span>
            </div>
            <ul className="shuttle-list">
              {selected.map((item) => (
                <li
                  key={item}
                  className={`shuttle-item ${highlightedSelected.has(item) ? 'shuttle-item-active' : ''}`}
                  onClick={() => toggleHighlightSelected(item)}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="shuttle-order-arrows">
            <button type="button" className="shuttle-arrow-btn" onClick={moveUp} title="Move up" disabled={highlightedSelected.size !== 1}>
              ▲
            </button>
            <button type="button" className="shuttle-arrow-btn" onClick={moveDown} title="Move down" disabled={highlightedSelected.size !== 1}>
              ▼
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="modal-btn modal-btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}
