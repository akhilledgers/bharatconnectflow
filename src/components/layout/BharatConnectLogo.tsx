import bcbFullLogo from "../../assets/bcb-full-logo.png";

/** The full Bharat Connect for Business logo (mark + wordmark), cropped from the official logo file. */
export function BharatConnectLogo({ width = 120, className = "" }: { width?: number; className?: string }) {
  return (
    <img
      src={bcbFullLogo}
      alt="Bharat Connect for Business"
      width={width}
      height={width * (2104 / 4090)}
      className={className}
      style={{ width, height: "auto" }}
    />
  );
}
