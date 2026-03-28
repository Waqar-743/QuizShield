import React from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

function DataTable<T extends { _id?: string; id?: string }>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data available',
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100 border-b"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 border-b border-gray-100 flex items-center px-6 space-x-4">
              {columns.map((_, idx) => (
                <div key={idx} className="h-4 bg-gray-200 rounded flex-1"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  const getValue = (item: T, key: string): any => {
    const keys = key.split('.');
    let value: any = item;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr
                key={item._id || item.id || index}
                className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${column.className || ''}`}
                  >
                    {column.render
                      ? column.render(item)
                      : getValue(item, String(column.key))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
