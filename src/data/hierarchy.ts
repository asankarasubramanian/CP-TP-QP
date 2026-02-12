import type { OrgNode } from '../types';

export const orgHierarchy: OrgNode | null = {
  id: 'cro',
  rowNumber: 1,
  name: 'CRO',
  personName: 'Michael Reynolds',
  role: 'CRO',
  avatarColor: '#2e2e2e',
  targetCapacity: 0,
  headcount: 8,
  expectedCapacity: 0,
  validatedCapacity: null,
  difference: 0,
  status: 'Cascaded',
  depth: 0,
  children: [
    {
      id: 'svp-amer',
      rowNumber: 2,
      name: 'SVP AMER',
      personName: 'Sarah Mitchell',
      role: 'SVP',
      avatarColor: '#e0a030',
      targetCapacity: 0,
      headcount: 8,
      expectedCapacity: 0,
      validatedCapacity: null,
      difference: 0,
      status: 'Cascaded',
      depth: 1,
      children: [
        {
          id: 'amer-industries-avp',
          rowNumber: 3,
          name: 'AMER Industries AVP',
          personName: 'James Carter',
          role: 'AVP',
          avatarColor: '#3b82f6',
          segments: ['AERO', 'Manufacturing'],
          targetCapacity: 0,
          headcount: 8,
          expectedCapacity: 0,
          validatedCapacity: null,
          difference: 0,
          status: 'Drafting',
          depth: 2,
          children: [
            {
              id: 'rvp-us',
              rowNumber: 4,
              name: 'RVP US',
              personName: 'Emily Thompson',
              role: 'RVP',
              avatarColor: '#22a06b',
              targetCapacity: 0,
              headcount: 4,
              expectedCapacity: 0,
              validatedCapacity: null,
              difference: 0,
              status: 'Not Started',
              depth: 3,
              children: [
                { id: 'ae1', rowNumber: 5, name: 'AE1', personName: '', role: 'AE', avatarColor: '#9ca3af', targetCapacity: 0, headcount: 1, expectedCapacity: 0, validatedCapacity: 1200, difference: 0, status: 'Not Started', depth: 4, segments: ['AERO'] },
                { id: 'ae2', rowNumber: 6, name: 'AE2', personName: '', role: 'AE', avatarColor: '#9ca3af', targetCapacity: 0, headcount: 1, expectedCapacity: 0, validatedCapacity: 1150, difference: 0, status: 'Not Started', depth: 4, segments: ['AERO'] },
                { id: 'ae3', rowNumber: 7, name: 'AE3', personName: '', role: 'AE', avatarColor: '#9ca3af', targetCapacity: 0, headcount: 1, expectedCapacity: 0, validatedCapacity: 1100, difference: 0, status: 'Not Started', depth: 4, segments: ['Manufacturing'] },
                { id: 'ae4', rowNumber: 8, name: 'AE4', personName: '', role: 'AE', avatarColor: '#9ca3af', targetCapacity: 0, headcount: 1, expectedCapacity: 0, validatedCapacity: 1050, difference: 0, status: 'Not Started', depth: 4, segments: ['Manufacturing'] },
              ],
            },
            {
              id: 'rvp-canada',
              rowNumber: 9,
              name: 'RVP Canada',
              personName: 'David Patel',
              role: 'RVP',
              avatarColor: '#e0a030',
              targetCapacity: 0,
              headcount: 4,
              expectedCapacity: 0,
              validatedCapacity: null,
              difference: 0,
              status: 'Not Started',
              depth: 3,
              children: [
                { id: 'ae5', rowNumber: 10, name: 'AE5', personName: '', role: 'AE', avatarColor: '#9ca3af', targetCapacity: 0, headcount: 1, expectedCapacity: 0, validatedCapacity: 1200, difference: 0, status: 'Not Started', depth: 4, segments: ['AERO'] },
                { id: 'ae6', rowNumber: 11, name: 'AE6', personName: '', role: 'AE', avatarColor: '#9ca3af', targetCapacity: 0, headcount: 1, expectedCapacity: 0, validatedCapacity: 1150, difference: 0, status: 'Not Started', depth: 4, segments: ['AERO'] },
                { id: 'ae7', rowNumber: 12, name: 'AE7', personName: '', role: 'AE', avatarColor: '#9ca3af', targetCapacity: 0, headcount: 1, expectedCapacity: 0, validatedCapacity: 1100, difference: 0, status: 'Not Started', depth: 4, segments: ['Manufacturing'] },
                { id: 'ae8', rowNumber: 13, name: 'AE8', personName: '', role: 'AE', avatarColor: '#9ca3af', targetCapacity: 0, headcount: 1, expectedCapacity: 0, validatedCapacity: 1050, difference: 0, status: 'Not Started', depth: 4, segments: ['Manufacturing'] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/**
 * rolled-up headcount: sum of all descendants' headcount from bottom up.
 * Leaf nodes use their own headcount; parents = sum of children's rolled-up headcount.
 */
export function getRolledUpHeadcount(node: OrgNode): number {
  if (!node.children || node.children.length === 0) {
    return node.headcount;
  }
  return node.children.reduce((sum, child) => sum + getRolledUpHeadcount(child), 0);
}

/**
 * rolled-up validated capacity: sum of all descendants' validatedCapacity from bottom up.
 * Leaf nodes use their own validatedCapacity; parents = sum of children's rolled-up value.
 * Returns null only if every descendant is null.
 */
export function getRolledUpValidatedCapacity(node: OrgNode): number | null {
  if (!node.children || node.children.length === 0) {
    return node.validatedCapacity;
  }
  let total = 0;
  let hasAny = false;
  for (const child of node.children) {
    const childVal = getRolledUpValidatedCapacity(child);
    if (childVal !== null) {
      total += childVal;
      hasAny = true;
    }
  }
  return hasAny ? total : null;
}

/**
 * Deep-clone a node tree and update a specific node by id.
 */
export function updateNodeInTree(root: OrgNode, nodeId: string, updater: (n: OrgNode) => OrgNode): OrgNode {
  if (root.id === nodeId) {
    return updater({ ...root });
  }
  if (!root.children) return root;
  return {
    ...root,
    children: root.children.map((child) => updateNodeInTree(child, nodeId, updater)),
  };
}

/**
 * Update a node's headcount and recalculate all ancestor headcounts upward.
 * Children below the edited node are NOT changed.
 * Each parent's headcount = sum of its direct children's headcount.
 */
export function updateHeadcountAndRollUp(root: OrgNode, nodeId: string, newHeadcount: number): OrgNode {
  // Step 1: set the target node's headcount
  const updated = updateNodeInTree(root, nodeId, (n) => ({ ...n, headcount: newHeadcount }));
  // Step 2: recalculate headcount for every parent whose children include the edited node
  return recalcParentHeadcounts(updated);
}

/**
 * Walk the tree bottom-up: for any node with children, set headcount = sum of children's headcount.
 * Leaf nodes keep their own headcount.
 */
function recalcParentHeadcounts(node: OrgNode): OrgNode {
  if (!node.children || node.children.length === 0) {
    return node;
  }
  const updatedChildren = node.children.map(recalcParentHeadcounts);
  const sum = updatedChildren.reduce((s, c) => s + c.headcount, 0);
  return { ...node, children: updatedChildren, headcount: sum };
}

// Flatten tree for counting
export function flattenTree(node: OrgNode): OrgNode[] {
  const result: OrgNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child));
    }
  }
  return result;
}

export function getTotals(node: OrgNode | null) {
  if (!node) return { totalRows: 0, targetCapacity: 0, headcount: 0, expectedCapacity: 0, difference: 0 };
  const all = flattenTree(node);
  return {
    totalRows: all.length,
    targetCapacity: node.targetCapacity,
    headcount: getRolledUpHeadcount(node),
    expectedCapacity: node.expectedCapacity,
    difference: node.difference,
  };
}
