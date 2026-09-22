export type ConnectionState =
  | "not_connected"
  | "existing_id_found"
  | "setting_up"
  | "connected"
  | "needs_attention"
  | "assisted_setup";

export type BusinessType = "company" | "sole_proprietor";

export type IdentifierPath = "gstin" | "pan_only" | "pan_not_on_itr";

export interface BankAccount {
  id: string;
  beneficiaryName: string;
  ifsc: string;
  accountEnding: string;
  verified: boolean;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  source: "gst_portal" | "manual";
  pincodeMismatch?: boolean;
}

export interface Contact {
  mobile: string;
  mobileMasked: string;
  mobileVerified: boolean;
  email: string;
  emailMasked: string;
  emailVerified: boolean;
}

export type IdVisibility = "public" | "private";
export type IdStatus = "active" | "deactivated";

export interface BharatConnectId {
  id: string;
  label: string; // e.g. "Default" | "Extra" | "Legacy format"
  basedOn: "PAN" | "GSTIN";
  linkedIdentifierValue: string;
  visibility: IdVisibility;
  status: IdStatus;
  settlementAccountId: string | null;
  legacyFormat?: boolean;
  hasOpenInvoices?: boolean; // blocks deactivation when true
  activeFinancing?: boolean;
}

export type VerificationLevel = 1 | 2 | 3;

export interface VerificationStatus {
  level: VerificationLevel;
  invoicing: boolean;
  payments: boolean;
}

export type KycDocumentStatus = "not_uploaded" | "uploaded" | "requested" | "verified";

export interface KycDocument {
  id: string;
  label: string;
  status: KycDocumentStatus;
  fileName?: string;
  uploadedAt?: string;
}

export type ProfileTabId =
  | "business_details"
  | "tax_legal_ids"
  | "addresses"
  | "settlement_accounts"
  | "contacts"
  | "review_send";

export type TabValidity = "valid" | "warning" | "untouched";

export interface ProfileDraft {
  tradeName: string;
  mcc: string | null;
  additionalAddresses: Address[];
  additionalMobiles: string[];
  additionalEmails: string[];
  pendingReverification: {
    bank?: boolean;
    phone?: boolean;
    email?: boolean;
  };
  dirtySinceSend: boolean;
}

export interface Business {
  id: string;
  name: string;
  pan: string;
  gstin: string | null;
  businessType: BusinessType;
  proprietorName?: string;
  contacts: Contact;
  registeredAddress: Address;
  bankAccounts: BankAccount[];
  identifierPath: IdentifierPath;

  connectionState: ConnectionState;
  ownershipVerified: boolean;
  bharatConnectIds: BharatConnectId[];
  verification: VerificationStatus;
  lastSyncedAt: string | null;

  bannerSnoozedUntil: string | null;
  welcomeSeen: boolean;

  profileDraft: ProfileDraft;
  lastRejection: { tab: ProfileTabId; field: string; message: string } | null;
  kycDocuments: KycDocument[];
}

export interface Invoice {
  id: string;
  kind: "sales" | "purchase";
  counterpartyName: string;
  amount: number;
  status: "unpaid" | "partly_paid" | "paid";
}

export type ConnectSubmitPhase =
  | "idle"
  | "sending"
  | "creating_id"
  | "waiting_confirmation"
  | "success"
  | "error";

export interface CounterpartyResult {
  id: string;
  registeredName: string;
  bcId: string;
  legacyFormat?: boolean;
  level: VerificationLevel;
  levelLabel: string;
  capability: string;
}
