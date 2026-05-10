// ============================================================
// <MetricCard /> — Dashboard stat card per doc 04 §5
// ============================================================

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  subtext?: string;
  loading?: boolean;
}

export function MetricCard({ title, value, delta, subtext, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
        <div className="h-4 bg-divider rounded w-24 mb-3" />
        <div className="h-8 bg-divider rounded w-36 mb-2" />
        <div className="h-3 bg-divider rounded w-20" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <p className="text-sm text-subtext mb-1">{title}</p>
      <div className="text-2xl font-bold text-maintext mb-1">{value}</div>
      {delta && <div className="text-sm">{delta}</div>}
      {subtext && <p className="text-xs text-subtext mt-1">{subtext}</p>}
    </div>
  );
}
