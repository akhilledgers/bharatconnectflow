import type { Business } from "../types";

const BANNED_WORDS = ["FUCK", "SHIT", "BASTARD", "RANDI"];
const BANNED_BRANDS = ["BCB", "BHARATCONNECT", "NBBL", "LEDGERS", "PAYTM", "PHONEPE", "GPAY", "RAZORPAY"];

function stripToAlnum(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** First 2-4 alphanumeric characters of a name, used for individual-business IDs. */
export function namePrefix(value: string, max = 4): string {
  const clean = stripToAlnum(value);
  return clean.slice(0, Math.min(max, Math.max(2, clean.length)));
}

/** PAN characters 6-9 (1-indexed), which for individuals are digits. */
export function panDigits(pan: string): string {
  return pan.slice(5, 9);
}

/**
 * The base BharatConnect ID for a business's first registration, before any
 * extra "." ending. Individuals get the AAAA.BBBB.CCCC.DDD shape; everyone
 * else gets PAN@BCB or GSTIN@BCB.
 */
export function baseId(
  business: Pick<Business, "businessType" | "pan" | "gstin" | "name" | "proprietorName">,
  basedOn: "PAN" | "GSTIN",
  disambiguation = "001",
): string {
  if (business.businessType === "sole_proprietor") {
    const aaaa = namePrefix(business.name);
    const bbbb = namePrefix(business.proprietorName ?? "");
    const cccc = panDigits(business.pan);
    return `${aaaa}.${bbbb}.${cccc}.${disambiguation}@BCB`;
  }
  const value = basedOn === "GSTIN" && business.gstin ? business.gstin : business.pan;
  return `${value}@BCB`;
}

export function baseIdWithoutSuffix(
  business: Pick<Business, "businessType" | "pan" | "gstin" | "name" | "proprietorName">,
  basedOn: "PAN" | "GSTIN",
): string {
  // The part of the ID an extra "." ending gets appended to, minus @BCB.
  const full = baseId(business, basedOn, "001");
  return full.replace(/\.\d{3}@BCB$/, "").replace(/@BCB$/, "");
}

export interface EndingCheck {
  valid: boolean;
  reason?: string;
}

export function checkEnding(ending: string): EndingCheck {
  const clean = ending.toUpperCase();
  if (clean.length < 2 || clean.length > 5) {
    return { valid: false, reason: "Use 2 to 5 characters." };
  }
  if (!/^[A-Z0-9]+$/.test(clean)) {
    return { valid: false, reason: "Letters A to Z and numbers only." };
  }
  if (BANNED_WORDS.some((w) => clean.includes(w))) {
    return { valid: false, reason: "That ending isn't allowed." };
  }
  if (BANNED_BRANDS.some((w) => clean.includes(w))) {
    return { valid: false, reason: "Can't include a partner or platform name." };
  }
  return { valid: true };
}

export function buildExtraId(baseWithoutSuffix: string, ending: string): string {
  return `${baseWithoutSuffix}.${ending.toUpperCase()}@BCB`;
}

/** Breakdown shown wherever a generated ID first appears. */
export interface IdBreakdownPart {
  value: string;
  label: string;
}

export function breakdown(
  business: Pick<Business, "businessType" | "pan" | "gstin" | "name" | "proprietorName">,
  basedOn: "PAN" | "GSTIN",
): IdBreakdownPart[] {
  if (business.businessType === "sole_proprietor") {
    return [
      { value: namePrefix(business.name), label: "From business name" },
      { value: namePrefix(business.proprietorName ?? ""), label: "From proprietor name" },
      { value: panDigits(business.pan), label: "PAN characters 6-9" },
      { value: "001", label: "Assigned by BharatConnect on registration" },
      { value: "@BCB", label: "Fixed suffix" },
    ];
  }
  const value = basedOn === "GSTIN" && business.gstin ? business.gstin : business.pan;
  return [
    { value, label: basedOn === "GSTIN" ? "Your GSTIN" : "Your PAN" },
    { value: "@BCB", label: "Fixed suffix" },
  ];
}
