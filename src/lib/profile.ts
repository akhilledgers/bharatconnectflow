import type { Business } from "../types";

export const MCC_CODES = [
  { code: "6211", label: "Security brokers and dealers" },
  { code: "6012", label: "Financial institutions" },
  { code: "5411", label: "Grocery stores and supermarkets" },
  { code: "5045", label: "Computers and peripherals" },
  { code: "5311", label: "Department stores" },
  { code: "7372", label: "Computer software" },
  { code: "5999", label: "Miscellaneous retail" },
  { code: "4121", label: "Taxi and limousine services" },
  { code: "8299", label: "Schools and educational services" },
];

const PINCODE_PREFIX_STATE: Record<string, string> = {
  "400": "MAHARASHTRA",
  "411": "MAHARASHTRA",
  "110": "DELHI",
  "560": "KARNATAKA",
  "600": "TAMIL NADU",
  "396": "DAMAN AND DIU",
  "500": "TELANGANA",
};

export function expectedStateForPincode(pincode: string): string | null {
  const prefix = pincode.slice(0, 3);
  return PINCODE_PREFIX_STATE[prefix] ?? null;
}

export function pincodeMatchesState(pincode: string, state: string): boolean {
  const expected = expectedStateForPincode(pincode);
  if (!expected) return true;
  return expected === state.toUpperCase();
}

export function generatePaymentAddress(business: Pick<Business, "pan">, accountEnding: string): string {
  return `${business.pan.toLowerCase()}.${accountEnding}@bcb`;
}
