import { useState, useCallback } from 'react';
import Header from './components/Header';
import SubHeader from './components/SubHeader';
import TreeTable from './components/TreeTable';
import TerritoryPlanning from './components/TerritoryPlanning';
import { orgHierarchy } from './data/hierarchy';
import type { OrgNode } from './types';
import './App.css';

type Page = 'capacity' | 'territory';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('capacity');
  const [treeData, setTreeData] = useState<OrgNode | null>(orgHierarchy);

  const handleDataChange = useCallback((data: OrgNode | null) => {
    setTreeData(data);
  }, []);

  return (
    <div className="app">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      {currentPage === 'capacity' && (
        <>
          <SubHeader />
          <div className="app-body">
            <TreeTable data={treeData} onDataChange={handleDataChange} />
          </div>
        </>
      )}
      {currentPage === 'territory' && (
        <div className="app-body">
          <TerritoryPlanning orgData={treeData} />
        </div>
      )}
    </div>
  );
}

export default App;
