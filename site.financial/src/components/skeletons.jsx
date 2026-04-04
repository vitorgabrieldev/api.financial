export function MetricSkeletons() {
  return (
    <div className="layout-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <article className="card" key={index}>
          <div className="skeleton skeleton-line" style={{ width: '58%' }} />
          <div className="skeleton" style={{ height: 28, width: '70%', marginTop: 9 }} />
        </article>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 8, columns = 6 }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index}>carregando</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex}>
                  <div className="skeleton skeleton-row" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="form-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index}>
          <div className="skeleton skeleton-line" style={{ width: '48%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 38 }} />
        </div>
      ))}
      <div className="full">
        <div className="skeleton" style={{ height: 36, width: 160 }} />
      </div>
    </div>
  )
}
