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
  { id: "business", label: "Business details", navLabel: "Business" },
  { id: "tax", label: "Tax & legal IDs", navLabel: "Tax IDs" },
  { id: "addresses", label: "Addresses", navLabel: "Address" },
  { id: "settlement", label: "Settlement account", navLabel: "Settlement" },
  { id: "contacts", label: "Contacts & notifications", navLabel: "Contacts" },
];

/**
 * The single source of truth for how each field behaves: whether it can be
 * edited, how it should look, and whether changing it needs confirmation
 * before it's sent. Add new fields here rather than branching in components.
 */
export const FIELD_CONFIG: Record<string, FieldMeta> = {
  legalName: { id: "legalName", section: "business", label: "Legal name", permission: "readonly-sourced", tag: "From GST portal" },
  tradeName: { id: "tradeName", section: "business", label: "Trade name", permission: "editable", tier: 1 },
  businessType: { id: "businessType", section: "business", label: "Business type", permission: "readonly-sourced", tag: "Derived from PAN" },
  mcc: { id: "mcc", section: "business", label: "Business category (MCC), optional", permission: "editable", tier: 1 },

  pan: { id: "pan", section: "tax", label: "PAN", permission: "readonly-sourced", tag: "From GST portal" },
  gstin: { id: "gstin", section: "tax", label: "GSTIN", permission: "readonly-sourced", tag: "From GST portal" },
  defaultBcId: { id: "defaultBcId", section: "tax", label: "Default BharatConnect ID", permission: "readonly-sourced", tag: "Set by BharatConnect" },

  registeredAddress: { id: "registeredAddress", section: "addresses", label: "Registered address", permission: "readonly-sourced", tag: "From GST portal" },
  additionalAddresses: { id: "additionalAddresses", section: "addresses", label: "Additional addresses", permission: "editable", tier: 1 },

  settlementAccount: { id: "settlementAccount", section: "settlement", label: "Settlement account", permission: "editable", tier: 2 },
  useAsDefault: { id: "useAsDefault", section: "settlement", label: "Use as default settlement account", permission: "editable", tier: 2 },
  paymentAddress: { id: "paymentAddress", section: "settlement", label: "BharatConnect payment address", permission: "readonly-sourced", tag: "Generated" },

  primaryMobile: { id: "primaryMobile", section: "contacts", label: "Primary mobile", permission: "editable", tier: 2 },
  primaryEmail: { id: "primaryEmail", section: "contacts", label: "Primary email", permission: "editable", tier: 2 },
  additionalMobiles: { id: "additionalMobiles", section: "contacts", label: "Additional mobile numbers", permission: "editable", tier: 1 },
  additionalEmails: { id: "additionalEmails", section: "contacts", label: "Additional emails", permission: "editable", tier: 1 },

  // bc-owned: status only, rendered near the page header — never inside a section body.
  verifiedFor: { id: "verifiedFor", section: "business", label: "Verified for", permission: "bc-owned" },
};

export function fieldsInSection(section: SectionId): FieldMeta[] {
  return Object.values(FIELD_CONFIG).filter((f) => f.section === section && f.permission !== "bc-owned");
}
