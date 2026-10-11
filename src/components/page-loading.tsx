export function PageLoading({
  label = "Opening your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="loading-caption">{label}</span>
      <div className="loading-lines" aria-hidden="true">
        <div className="loading-line loading-title" />
        <div className="loading-line loading-subtitle" />
        <div className="loading-cards">
          {[0, 1, 2].map((item) => (
            <div className="loading-card" key={item}>
              <div className="loading-line" />
              <div className="loading-line loading-subtitle" />
              <div className="loading-line" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
