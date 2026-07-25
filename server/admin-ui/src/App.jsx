// src/App.jsx
import React, { useState } from 'react';
import TableList from './components/TableList';
import SpreadsheetView from './components/SpreadsheetView';
import './App.css';

function App() {
  const [selectedTable, setSelectedTable] = useState('');

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh' }}>
      <aside style={{ width: '250px', borderRight: '1px solid #444', padding: '1rem', backgroundColor: '#2a2a2a', color: '#fff' }}>
        <h2 style={{ marginBottom: '1rem' }}>테이블 목록</h2>
        <TableList onSelect={setSelectedTable} />
      </aside>
      <main style={{ flexGrow: 1, padding: '1rem', overflow: 'auto', backgroundColor: '#1e1e1e', color: '#fff' }}>
        {selectedTable ? (
          <SpreadsheetView tableName={selectedTable} />
        ) : (
          <div style={{ textAlign: 'center', marginTop: '5rem' }}>
            <h3>관리할 테이블을 선택해주세요.</h3>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
