import ledgersLogo from "../../assets/ledgers-logo.svg";

/** The real LEDGERS logo (mark + wordmark). */
export function LedgersLogoFull({ height = 26, className = "" }: { height?: number; className?: string }) {
  return (
    <img
      src={ledgersLogo}
      alt="LEDGERS"
      height={height}
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
