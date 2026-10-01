import bcbMark from "../../assets/bcb-mark.png";

/** The actual Bharat Connect "B" logomark, cropped from the official logo file. */
export function BharatConnectMark({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={bcbMark}
      alt="Bharat Connect"
      width={size}
      height={size * (1396 / 745)}
      className={className}
      style={{ width: size, height: "auto" }}
    />
  );
}
