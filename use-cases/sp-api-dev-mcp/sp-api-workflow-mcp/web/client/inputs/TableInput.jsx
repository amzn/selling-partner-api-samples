import React, { useState, useMemo } from 'react';

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export default function TableInput({ inputRequest, onSubmit, loading }) {
  const data = inputRequest.data || [];
  const columns = inputRequest.columns || [];
  const selectable = inputRequest.selectable ?? true;
  const multiSelect = inputRequest.multiSelect ?? false;
  const minSelections = inputRequest.minSelections ?? 0;
  const maxSelections = inputRequest.maxSelections;
  const sortable = inputRequest.sortable ?? true;
  const filterable = inputRequest.filterable ?? false;
  const rowKey = inputRequest.rowKey;
  const returnType = inputRequest.returnType || 'row';
  const pageSize = inputRequest.pageSize || 10;

  const [selected, setSelected] = useState(new Set());
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  function getRowId(row, index) {
    return rowKey ? row[rowKey] : index;
  }

  // Filter + sort
  const processed = useMemo(() => {
    let rows = [...data];
    if (filterable && filter) {
      const lower = filter.toLowerCase();
      rows = rows.filter(row =>
        columns.some(col => String(getNestedValue(row, col.Field) ?? '').toLowerCase().includes(lower))
      );
    }
    if (sortField) {
      rows.sort((a, b) => {
        const av = getNestedValue(a, sortField) ?? '';
        const bv = getNestedValue(b, sortField) ?? '';
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, columns, filter, sortField, sortDir, filterable]);

  // Paginate
  const totalPages = pageSize > 0 ? Math.ceil(processed.length / pageSize) : 1;
  const paged = pageSize > 0 ? processed.slice(page * pageSize, (page + 1) * pageSize) : processed;

  function toggleSort(field) {
    if (!sortable) return;
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function toggleRow(id) {
    if (!selectable) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!multiSelect) next.clear();
        if (maxSelections && next.size >= maxSelections) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit() {
    const selectedRows = data.filter((row, i) => selected.has(getRowId(row, i)));
    if (returnType === 'id' && rowKey) {
      const ids = selectedRows.map(r => r[rowKey]);
      onSubmit(multiSelect ? ids : ids[0]);
    } else {
      onSubmit(multiSelect ? selectedRows : selectedRows[0]);
    }
  }

  const valid = selected.size >= minSelections &&
    (!maxSelections || selected.size <= maxSelections);

  return (
    <div className="input-form table-input">
      {filterable && (
        <input
          type="text"
          className="table-filter"
          placeholder="Search..."
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(0); }}
        />
      )}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {selectable && <th className="col-select" />}
              {columns.map(col => (
                <th
                  key={col.Field}
                  onClick={() => col.Sortable !== false && toggleSort(col.Field)}
                  style={{ width: col.Width, cursor: sortable && col.Sortable !== false ? 'pointer' : 'default' }}
                >
                  {col.Header}
                  {sortField === col.Field && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="empty-row">
                {inputRequest.emptyMessage || 'No data available'}
              </td></tr>
            ) : paged.map((row, i) => {
              const id = getRowId(row, page * pageSize + i);
              const isSelected = selected.has(id);
              return (
                <tr
                  key={id}
                  className={isSelected ? 'row-selected' : ''}
                  onClick={() => toggleRow(id)}
                >
                  {selectable && (
                    <td className="col-select">
                      <input
                        type={multiSelect ? 'checkbox' : 'radio'}
                        checked={isSelected}
                        readOnly
                      />
                    </td>
                  )}
                  {columns.map(col => {
                    const raw = getNestedValue(row, col.Field);
                    const val = applyTransform(raw, col.Transform);
                    return <td key={col.Field}>{formatCell(val, col.Format)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="table-pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
      {selectable && (
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading || !valid}
        >
          {loading ? 'Submitting...' : `Continue (${selected.size} selected)`}
        </button>
      )}
    </div>
  );
}

// Apply a column Transform to a value before formatting.
// Supported transforms:
//   "length"              – array length
//   "sum:path"            – sum a numeric field from each array element (e.g. "sum:value.amount")
//   "pluck:path"          – extract a field from each array element, return as array
//   "pluck:path,sep"      – extract + join with separator
function applyTransform(value, transform) {
  if (!transform || value === null || value === undefined) return value;
  if (transform === 'length') {
    return Array.isArray(value) ? value.length : value;
  }
  const [op, arg] = transform.split(':');
  if (!arg) return value;
  const [fieldPath, sep] = arg.split(',');
  if (op === 'sum' && Array.isArray(value)) {
    const total = value.reduce((s, item) => s + (Number(getNestedValue(item, fieldPath)) || 0), 0);
    return total;
  }
  if (op === 'pluck' && Array.isArray(value)) {
    const items = value.map(item => getNestedValue(item, fieldPath)).filter(v => v != null);
    return sep !== undefined ? items.join(sep || ', ') : items;
  }
  return value;
}

function formatCell(value, format) {
  if (value === null || value === undefined) return '-';
  switch (format) {
    case 'currency': return `$${Number(value).toFixed(2)}`;
    case 'number': return Number(value).toLocaleString();
    case 'date': return new Date(value).toLocaleDateString();
    case 'boolean': return value ? 'Yes' : 'No';
    default: {
      if (Array.isArray(value)) {
        if (value.length === 0) return 'None';
        if (typeof value[0] === 'object') return `${value.length} item${value.length !== 1 ? 's' : ''}`;
        return value.join(', ');
      }
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }
}
