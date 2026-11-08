import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';

export interface SortState { sort?: string; order: 'asc' | 'desc' }

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> { sortKey?: string }
}

/** Server-driven table: sorting, filtering and paging happen in the API; TanStack Table owns column/row modelling. */
export function DataTable<T>({ columns, data, state, onSort, empty }: {
  columns: ColumnDef<T, any>[];
  data: T[];
  state: SortState;
  onSort: (sort: string) => void;
  empty: string;
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), manualSorting: true, manualPagination: true, manualFiltering: true });
  return (
    <div className="table-wrap">
      <table>
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(h => {
                const key = h.column.columnDef.meta?.sortKey;
                const label = flexRender(h.column.columnDef.header, h.getContext());
                const active = key && state.sort === key;
                return (
                  <th key={h.id} aria-sort={active ? (state.order === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {key ? (
                      <button type="button" className="link-button" onClick={() => onSort(key)}>
                        {label}{active ? (state.order === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    ) : label}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length ? table.getRowModel().rows.map(row => (
            <tr key={row.id}>{row.getVisibleCells().map(c => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>
          )) : <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
