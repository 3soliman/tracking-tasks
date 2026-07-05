export function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return <span className="badge badge-success">مكتملة</span>;
  }
  if (status === "partial") {
    return <span className="badge badge-warning">جزئية</span>;
  }
  if (status === "in_progress") {
    return <span className="badge badge-info">جاري التنفيذ</span>;
  }
  if (status === "abandoned") {
    return <span className="badge badge-danger">متروكة</span>;
  }
  if (status === "pending") {
    return <span className="badge badge-muted">لم تبدأ</span>;
  }
  return <span className="badge badge-muted">{status}</span>;
}
