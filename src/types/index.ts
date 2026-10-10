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
  /** GSTIN connected to LEDGERS through the GSP (GST portal username + OTP to the GSTIN's registered mobile). */
  gstConnected: boolean;
  bharatConnectIds: BharatConnectId[];
  verification: VerificationStatus;
  lastSyncedAt: string | null;

  bannerSnoozedUntil: string | null;
  invoiceBannerSnoozedUntil: string | null;
  billsBannerSnoozedUntil: string | null;
  welcomeSeen: boolean;

  profileDraft: ProfileDraft;
  lastRejection: { tab: ProfileTabId; field: string; message: string } | null;
  kycDocuments: KycDocument[];
}

export type BcSendStatus = "not_sent" | "sending" | "sent";
/**
 * Bharat Connect status after sending, from handbook Annexure H. "pending" = Sent To Buyer,
 * "returned" = Under Review (buyer returned it for correction). "failure" is a technical send
 * failure only — a buyer saying no is "rejected".
 */
export type BcConfirmationStatus = "pending" | "accepted" | "returned" | "rejected" | "cancelled" | "failure";

/** Buyer's answer to an invoice (reqConfirmInvoice → buyerResponse). */
export type BuyerResponse = "accept" | "return" | "reject";

/**
 * One entry in an invoice's Notes card. "internal" notes never leave LEDGERS; "bc" entries are
 * Bharat Connect events (sent, returned, accepted…) with the comment that travelled with them.
 */
export interface InvoiceNote {
  id: string;
  kind: "internal" | "bc";
  text: string;
  /** Bharat Connect event label, e.g. "Sent to Bharat Retail", "Returned by you". */
  event?: string;
  author: string;
  at: string;
  /** Internal note ticked to go out with the next send (invoiceRemarks, max 256). */
  shareOnSend?: boolean;
}

export interface InvoiceLineItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  qty: number;
  gstPercent: number;
  hsnSac?: string;
}

export interface Invoice {
  id: string;
  kind: "sales" | "purchase";
  counterpartyName: string;
  counterpartyEmail?: string;
  counterpartyGstin?: string;
  /** Bharat Connect B2B ID of the counterparty, if known — null means not on the network. */
  counterpartyB2bId?: string | null;
  amount: number;
  status: "unpaid" | "partly_paid" | "paid";
  date: string;
  dueDate?: string;
  createdBy?: string;
  lineItems: InvoiceLineItem[];

  /** Sales side: has this business sent it over Bharat Connect. */
  bcSendStatus: BcSendStatus;
  /** Either side: how the counterparty (sales) or this business (purchase, inbound) responded. */
  bcConfirmationStatus: BcConfirmationStatus | null;
  /** Notes card entries, oldest first. */
  notes?: InvoiceNote[];
  /** Bumped on every re-send after a return. */
  version?: number;
  /** E-invoices (with an IRN) can't be edited after a return (Annexure H). */
  isEInvoice?: boolean;
  /** Receipts (sales) / payments (bills) recorded against this document. */
  receipts?: Receipt[];
  /** LEDGERS-only expense category on bills (editable even on bills received over Bharat Connect). */
  category?: string;
}

export interface Receipt {
  id: string;
  date: string;
  amount: number;
  mode: string;
  depositTo: string;
  reference?: string;
  tds?: number;
}

export type ContactType = "customer" | "supplier";

export interface LedgerContact {
  id: string;
  salutation: string;
  name: string;
  displayName?: string;
  type: ContactType;
  businessName?: string;
  email?: string;
  mobile?: string;
  gstin?: string;
  pan?: string;
  region: string;
  billingAddress?: Address;
  /**
   * Bharat Connect B2B ID resolved from this contact's GSTIN, if any.
   * undefined = no GSTIN on file, never checked. null = checked, not on Bharat Connect. string = connected.
   */
  b2bId?: string | null;
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
