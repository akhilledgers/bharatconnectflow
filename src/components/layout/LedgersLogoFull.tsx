/**
 * The LEDGERS logo as the live app draws it (in.ledgers.cloud/v4 sidebar): the mark from LEDGERS' CDN at 24px
 * and the word "LEDGERS" as text, xl and medium weight.
 */
const MARK_SRC = "https://img.ledgers.cloud/assets/favicon-lp.ico";

export function LedgersLogoFull({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <img src={MARK_SRC} alt="" className="size-6 shrink-0" />
      <span className="text-xl font-medium text-foreground">LEDGERS</span>
    </span>
  );
}
