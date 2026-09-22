/** The LEDGERS diamond-cluster mark, recreated as SVG for crisp use at any size. */
export function LedgersLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <rect x="28" y="8" width="44" height="44" rx="8" transform="rotate(45 50 30)" fill="#E23B3B" />
      <rect x="48" y="28" width="44" height="44" rx="8" transform="rotate(45 70 50)" fill="#F5A623" />
      <rect x="28" y="48" width="44" height="44" rx="8" transform="rotate(45 50 70)" fill="#3FAE49" />
      <rect x="8" y="28" width="44" height="44" rx="8" transform="rotate(45 30 50)" fill="#F5D923" />
    </svg>
  );
}
