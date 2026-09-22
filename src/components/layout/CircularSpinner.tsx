/** Material/Google-style indeterminate circular spinner — the arc grows and
 * shrinks while rotating, not just a static ring spinning. */
export function CircularSpinner({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`spinner-arc text-primary ${className}`} width={size} height={size} viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}
