import bcbFullLogo from "../../assets/bcb-full-logo.png";

/** The full BharatConnect for Business logo (mark + wordmark), cropped from the official logo file. */
export function BharatConnectLogo({ width = 120, className = "" }: { width?: number; className?: string }) {
  return (
    <img
      src={bcbFullLogo}
      alt="BharatConnect for Business"
      width={width}
      height={width * (2104 / 4090)}
      className={className}
      style={{ width, height: "auto" }}
    />
  );
}
