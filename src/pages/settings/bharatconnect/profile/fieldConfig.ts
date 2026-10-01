export type SectionId = "business" | "tax" | "addresses" | "settlement" | "contacts";

export type FieldPermission = "editable" | "readonly-sourced" | "bc-owned";
export type FieldTier = 1 | 2;

export interface FieldMeta {
  id: string;
  section: SectionId;
  label: string;
  permission: FieldPermission;
  tier?: FieldTier; // only meaningful when permission === "editable"
  tag?: string; // shown next to readonly-sourced labels, e.g. "From GST portal"
}

export const SECTIONS: { id: SectionId; label: string; navLabel: string }[] = [
  { id: "business", label: "Business Details", navLabel: "Business" },
  { id: "tax", label: "Tax & Legal IDs", navLabel: "Tax IDs" },
  { id: "addresses", label: "Addresses", navLabel: "Address" },
  { id: "settlement", label: "Settlement Account", navLabel: "Settlement" },
  { id: "contacts", label: "Contacts & Notifications", navLabel: "Contacts" },
];

/**
 * The single source of truth for how each field behaves: whether it can be
 * edited, how it should look, and whether changing it needs confirmation
 * before it's sent. Add new fields here rather than branching in components.
 */
export const FIELD_CONFIG: Record<string, FieldMeta> = {
  legalName: { id: "legalName", section: "business", label: "Legal Name", permission: "readonly-sourced", tag: "From GST portal" },
  tradeName: { id: "tradeName", section: "business", label: "Trade Name", permission: "editable", tier: 1 },
  businessType: { id: "businessType", section: "business", label: "Business Type", permission: "readonly-sourced", tag: "Derived from PAN" },
  mcc: { id: "mcc", section: "business", label: "Business Category (MCC), Optional", permission: "editable", tier: 1 },

  pan: { id: "pan", section: "tax", label: "PAN", permission: "readonly-sourced", tag: "From GST portal" },
  gstin: { id: "gstin", section: "tax", label: "GSTIN", permission: "readonly-sourced", tag: "From GST portal" },
  defaultBcId: { id: "defaultBcId", section: "tax", label: "Default Bharat Connect B2B ID", permission: "readonly-sourced", tag: "Set by Bharat Connect" },

  registeredAddress: { id: "registeredAddress", section: "addresses", label: "Registered Address", permission: "readonly-sourced", tag: "From GST portal" },
  additionalAddresses: { id: "additionalAddresses", section: "addresses", label: "Additional Addresses", permission: "editable", tier: 1 },

  settlementAccount: { id: "settlementAccount", section: "settlement", label: "Settlement Account", permission: "editable", tier: 2 },
  useAsDefault: { id: "useAsDefault", section: "settlement", label: "Use as Default Settlement Account", permission: "editable", tier: 2 },
  paymentAddress: { id: "paymentAddress", section: "settlement", label: "Bharat Connect Payment Address", permission: "readonly-sourced", tag: "Generated" },

  primaryMobile: { id: "primaryMobile", section: "contacts", label: "Primary Mobile", permission: "editable", tier: 2 },
  primaryEmail: { id: "primaryEmail", section: "contacts", label: "Primary Email", permission: "editable", tier: 2 },
  additionalMobiles: { id: "additionalMobiles", section: "contacts", label: "Additional Mobile Numbers", permission: "editable", tier: 1 },
  additionalEmails: { id: "additionalEmails", section: "contacts", label: "Additional Emails", permission: "editable", tier: 1 },

  // bc-owned: status only, rendered near the page header — never inside a section body.
  verifiedFor: { id: "verifiedFor", section: "business", label: "Verified For", permission: "bc-owned" },
};

export function fieldsInSection(section: SectionId): FieldMeta[] {
  return Object.values(FIELD_CONFIG).filter((f) => f.section === section && f.permission !== "bc-owned");
}
