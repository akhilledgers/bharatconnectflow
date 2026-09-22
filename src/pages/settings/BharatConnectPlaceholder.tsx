export function BharatConnectPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
      <div className="text-lg font-medium text-ink">{label}</div>
      <p className="mt-2 text-sm text-faint">Coming in the next build pass.</p>
    </div>
  );
}
