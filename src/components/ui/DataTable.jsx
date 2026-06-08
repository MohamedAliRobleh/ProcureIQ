import { cn } from '../../utils/cn'
import LoadingSpinner from './LoadingSpinner'

export default function DataTable({ columns, data, isLoading, emptyMessage = 'No records found' }) {
  if (isLoading) return <LoadingSpinner className="py-12" />

  if (!data || data.length === 0) {
    return <div className="py-12 text-center text-sm text-text-secondary">{emptyMessage}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id ?? i}
              className={cn('border-b border-border/60 transition-colors hover:bg-bg-hover', i % 2 === 1 && 'bg-bg-secondary/40')}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-text-primary">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
