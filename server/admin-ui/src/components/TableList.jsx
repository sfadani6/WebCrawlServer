import React, { useEffect, useState } from 'react';
import { fetchJSON } from '../api';

function TableList({ onSelect }) {
  const [tables, setTables] = useState([]);

  useEffect(() => {
    fetchJSON('/admin/api/tables')
      .then(data => setTables(data.tables || []))
      .catch(err => console.error('Failed to load tables', err));
  }, []);

  return (
    <div className="table-list">
      <h2>테이블 목록</h2>
      <ul>
        {tables.map(name => (
          <li key={name} onClick={() => onSelect(name)} className="table-item">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TableList;
