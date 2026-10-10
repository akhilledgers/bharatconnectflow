import { create } from "zustand";
import type {
  Business,
  BharatConnectId,
  ConnectionState,
  ConnectSubmitPhase,
  IdVisibility,
  VerificationLevel,
  LedgerContact,
} from "../types";
import { makeSeedBusinesses, makeSeedInvoices, makeSeedContacts, STOCK_HOLDING_ID } from "../mock/seed";
import { baseId, existingIdFor } from "../lib/id-standard";
import type { BuyerResponse, Invoice, InvoiceNote, Receipt } from "../types";

/** "07-10-2026, 11:20" — the stamp shown on Notes entries. */
function noteStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function bcNote(event: string, text: string, author: string): InvoiceNote {
  return { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: "bc", event, text, author, at: noteStamp() };
}

const RESPONSE_STATUS = { accept: "accepted", return: "returned", reject: "rejected" } as const;
const RESPONSE_PAST = { accept: "Accepted", return: "Returned", reject: "Rejected" } as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

interface ConnectFlowState {
  basedOn: "PAN" | "GSTIN";
  changingBasis: boolean;
  otpCode: string;
  otpVerified: boolean;
  otpError: string | null;
  consentChecked: boolean;
  submitPhase: ConnectSubmitPhase;
}

function defaultConnectFlow(business: Business): ConnectFlowState {
  return {
    basedOn: business.gstin ? "GSTIN" : "PAN",
    changingBasis: false,
    otpCode: "",
    otpVerified: business.ownershipVerified,
    otpError: null,
    // Pre-agreed so the only action left on the connect screen is the submit
    // button itself — the checkbox still shows what was agreed to, it's just
    // not an extra click the user has to make.
    consentChecked: true,
    submitPhase: "idle",
  };
}

interface StoreState {
  businesses: Record<string, Business>;
  currentBusinessId: string;
  invoices: Invoice[];
  contacts: LedgerContact[];
  devPanelOpen: boolean;
  /** Dev panel: arms how the profile page's next save resolves (null = succeeds normally). */
  devProfileSaveOutcome: "reject" | "conflict" | null;
  connectFlow: Record<string, ConnectFlowState>;
  toasts: { id: string; message: string; tone: "success" | "error" }[];

  currentBusiness: () => Business;
  switchBusiness: (id: string) => void;
  toggleDevPanel: (open?: boolean) => void;
  setDevProfileSaveOutcome: (outcome: "reject" | "conflict" | null) => void;
  pushToast: (message: string, tone?: "success" | "error") => void;
  dismissToast: (id: string) => void;

  // Connection status (dev panel + banner + chip)
  forceConnectionState: (businessId: string, state: ConnectionState) => void;
  snoozeBanner: (businessId: string) => void;
  dismissBannerPermanentlyForSession: (businessId: string) => void;
  snoozeInvoiceBanner: (businessId: string, kind: "sales" | "purchase") => void;
  linkExistingId: (businessId: string) => Promise<void>;

  // Connect flow (single page onboarding)
  getConnectFlow: (businessId: string) => ConnectFlowState;
  setConnectBasis: (businessId: string, basedOn: "PAN" | "GSTIN") => void;
  toggleChangingBasis: (businessId: string) => void;
  setOtpCode: (businessId: string, code: string) => void;
  verifyOwnership: (businessId: string) => Promise<void>;
  setConsent: (businessId: string, checked: boolean) => void;
  submitConnect: (businessId: string) => Promise<void>;
  resetConnectFlow: (businessId: string) => void;

  // Bharat Connect IDs
  createId: (businessId: string, id: BharatConnectId) => void;
  deactivateId: (businessId: string, idValue: string) => void;
  reactivateId: (businessId: string, idValue: string) => void;

  // Profile draft
  updateProfileDraft: (businessId: string, patch: Partial<Business["profileDraft"]>) => void;
  sendProfileToBharatConnect: (businessId: string) => Promise<void>;

  // Dev-panel simulated webhooks
  simulateWebhookConfirm: (businessId: string) => void;
  simulateWebhookReject: (businessId: string) => void;

  // KYC / full-verification documents
  uploadKycDocument: (businessId: string, docId: string, fileName: string) => Promise<void>;
  devRequestKycDocument: (businessId: string) => void;

  // Dev-panel: force a verification level to test level-gated UI
  setVerificationLevel: (businessId: string, level: VerificationLevel) => void;

  // Full verification: GST connection (ownership) and bank account
  /** Mocks the GSP call that sends an OTP to the GSTIN's registered mobile. */
  sendGstOtp: (businessId: string, username: string, gstin: string) => Promise<void>;
  /** Verifies the GSP OTP — connects the GSTIN and counts as ownership verification. */
  verifyGstOtp: (businessId: string, code: string) => Promise<boolean>;
  /** Adds a bank account and verifies it with a ₹1 penny-drop. */
  addBankAccount: (businessId: string, account: { acNum: string; ifsc: string; beneficiaryName: string }) => Promise<void>;
  /** Verifies an existing unverified LEDGERS bank account with a ₹1 penny-drop. */
  verifyBankAccount: (businessId: string, accountId: string) => Promise<void>;
  /** Dev panel: toggle whether the business has GST connected in LEDGERS. */
  setGstConnected: (businessId: string, connected: boolean) => void;
  /** Dev panel: set the business's bank account to verified, unverified, or none (to demo the bank step). */
  devSetBankState: (businessId: string, state: "verified" | "unverified" | "none") => void;
  /**
   * Moves the business up to the highest level it now qualifies for (never down):
   * Level 2 = ownership verified + a verified bank account; Level 3 = Level 2 + every KYC document
   * verified (handbook Annexure Q). Called after each verification step completes.
   */
  promoteVerificationLevel: (businessId: string) => void;

  // Invoices / Bills
  sendInvoiceViaBharatConnect: (invoiceId: string, noteToBuyer?: string) => Promise<void>;
  respondToBill: (invoiceId: string, decision: BuyerResponse, comment: string) => Promise<void>;
  addInvoiceNote: (invoiceId: string, text: string, shareOnSend: boolean) => void;
  recordReceipt: (invoiceId: string, receipt: Omit<Receipt, "id">) => Promise<void>;
  updateInvoice: (invoiceId: string, patch: Partial<Invoice>) => Promise<void>;
  resendInvoice: (invoiceId: string, changeNote: string) => Promise<void>;
  cancelInvoice: (invoiceId: string, reason: string) => Promise<void>;
  simulateBuyerResponse: (invoiceId: string, decision: BuyerResponse, comment: string) => void;
  simulateSupplierResend: (invoiceId: string, changeNote: string) => void;
  createInvoice: (invoice: Invoice) => Promise<void>;

  // Dev-panel: simulate the buyer's webhook confirming/rejecting a sent sales invoice
  simulateInvoiceConfirmation: (invoiceId: string, outcome: "accepted" | "failure") => void;

  inviteToBharatConnect: (counterpartyName: string) => Promise<void>;
  /** Mocks reqNonPublicInfo — email/mobile aren't returned by search, they need the counterparty's consent. */
  requestContactDetails: (counterpartyName: string) => Promise<void>;

  // Contacts
  createContact: (contact: LedgerContact, inviteIfUnconnected: boolean) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  businesses: makeSeedBusinesses(),
  currentBusinessId: STOCK_HOLDING_ID,
  invoices: makeSeedInvoices(),
  contacts: makeSeedContacts(),
  devPanelOpen: false,
  devProfileSaveOutcome: null,
  connectFlow: {},
  toasts: [],

  currentBusiness: () => get().businesses[get().currentBusinessId],

  switchBusiness: (id) => set({ currentBusinessId: id }),

  toggleDevPanel: (open) =>
    set((s) => ({ devPanelOpen: open ?? !s.devPanelOpen })),

  setDevProfileSaveOutcome: (outcome) => set({ devProfileSaveOutcome: outcome }),

  pushToast: (message, tone = "success") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismissToast(id), 4000);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  forceConnectionState: (businessId, state) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: { ...s.businesses[businessId], connectionState: state },
      },
    })),

  snoozeBanner: (businessId) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          bannerSnoozedUntil: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
        },
      },
    })),

  dismissBannerPermanentlyForSession: (businessId) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          bannerSnoozedUntil: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
        },
      },
    })),

  snoozeInvoiceBanner: (businessId, kind) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          ...(kind === "sales"
            ? { invoiceBannerSnoozedUntil: new Date(Date.now() + THREE_DAYS_MS).toISOString() }
            : { billsBannerSnoozedUntil: new Date(Date.now() + THREE_DAYS_MS).toISOString() }),
        },
      },
    })),

  linkExistingId: async (businessId) => {
    const { delay } = await import("../mock/api");
    await delay(undefined);
    const business = get().businesses[businessId];
    // The ID that was found (see existingIdFor) becomes this business's default ID — without it
    // the Overview and IDs page would show no ID after linking.
    const alreadyHasActive = business.bharatConnectIds.some((i) => i.status === "active");
    const linkedId: BharatConnectId = {
      id: existingIdFor(business),
      label: "Default",
      basedOn: "PAN",
      linkedIdentifierValue: business.pan,
      visibility: "public",
      status: "active",
      settlementAccountId: null,
    };
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          connectionState: "connected",
          bharatConnectIds: alreadyHasActive ? s.businesses[businessId].bharatConnectIds : [linkedId, ...s.businesses[businessId].bharatConnectIds],
          lastSyncedAt: new Date().toISOString().slice(0, 10),
          welcomeSeen: false,
        },
      },
    }));
    get().pushToast("Linked to your existing Bharat Connect ID.");
  },

  getConnectFlow: (businessId) => {
    const existing = get().connectFlow[businessId];
    if (existing) return existing;
    const flow = defaultConnectFlow(get().businesses[businessId]);
    set((s) => ({ connectFlow: { ...s.connectFlow, [businessId]: flow } }));
    return flow;
  },

  setConnectBasis: (businessId, basedOn) =>
    set((s) => ({
      connectFlow: {
        ...s.connectFlow,
        [businessId]: { ...get().getConnectFlow(businessId), basedOn },
      },
    })),

  toggleChangingBasis: (businessId) =>
    set((s) => ({
      connectFlow: {
        ...s.connectFlow,
        [businessId]: {
          ...get().getConnectFlow(businessId),
          changingBasis: !get().getConnectFlow(businessId).changingBasis,
        },
      },
    })),

  setOtpCode: (businessId, code) =>
    set((s) => ({
      connectFlow: {
        ...s.connectFlow,
        [businessId]: { ...get().getConnectFlow(businessId), otpCode: code, otpError: null },
      },
    })),

  verifyOwnership: async (businessId) => {
    const { mockOtpVerify } = await import("../mock/api");
    const flow = get().getConnectFlow(businessId);
    const res = await mockOtpVerify(flow.otpCode);
    set((s) => ({
      connectFlow: {
        ...s.connectFlow,
        [businessId]: {
          ...get().getConnectFlow(businessId),
          otpVerified: res.ok,
          otpError: res.ok ? null : "That code didn't match. Check and try again.",
        },
      },
    }));
  },

  setConsent: (businessId, checked) =>
    set((s) => ({
      connectFlow: {
        ...s.connectFlow,
        [businessId]: { ...get().getConnectFlow(businessId), consentChecked: checked },
      },
    })),

  submitConnect: async (businessId) => {
    const business = get().businesses[businessId];
    const flow = get().getConnectFlow(businessId);
    const setPhase = (submitPhase: ConnectSubmitPhase) =>
      set((s) => ({
        connectFlow: { ...s.connectFlow, [businessId]: { ...get().getConnectFlow(businessId), submitPhase } },
      }));

    const { delay } = await import("../mock/api");
    setPhase("sending");
    await delay(undefined, 900, 1100);
    setPhase("creating_id");
    await delay(undefined, 900, 1100);
    setPhase("waiting_confirmation");
    await delay(undefined, 1000, 1200);

    const newId: BharatConnectId = {
      id: baseId(business, flow.basedOn),
      label: "Default",
      basedOn: flow.basedOn,
      linkedIdentifierValue: flow.basedOn === "GSTIN" ? business.gstin ?? business.pan : business.pan,
      visibility: "public",
      status: "active",
      settlementAccountId: null,
    };

    setPhase("success");
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          connectionState: "connected",
          bharatConnectIds: [newId, ...s.businesses[businessId].bharatConnectIds],
          verification: { level: 1, invoicing: true, payments: false },
          lastSyncedAt: new Date().toISOString().slice(0, 10),
          welcomeSeen: false,
        },
      },
    }));
  },

  resetConnectFlow: (businessId) =>
    set((s) => {
      const next = { ...s.connectFlow };
      delete next[businessId];
      return { connectFlow: next };
    }),

  createId: (businessId, id) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          bharatConnectIds: [...s.businesses[businessId].bharatConnectIds, id],
        },
      },
    })),

  deactivateId: (businessId, idValue) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          bharatConnectIds: s.businesses[businessId].bharatConnectIds.map((i) =>
            i.id === idValue ? { ...i, status: "deactivated" as const } : i,
          ),
        },
      },
    })),

  reactivateId: (businessId, idValue) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          bharatConnectIds: s.businesses[businessId].bharatConnectIds.map((i) =>
            i.id === idValue ? { ...i, status: "active" as const } : i,
          ),
        },
      },
    })),

  updateProfileDraft: (businessId, patch) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          profileDraft: { ...s.businesses[businessId].profileDraft, ...patch, dirtySinceSend: true },
        },
      },
    })),

  sendProfileToBharatConnect: async (businessId) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 600, 900);
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          connectionState: "setting_up",
          profileDraft: { ...s.businesses[businessId].profileDraft, dirtySinceSend: false },
        },
      },
    }));
  },

  simulateWebhookConfirm: (businessId) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          connectionState: "connected",
          lastRejection: null,
          lastSyncedAt: new Date().toISOString().slice(0, 10),
        },
      },
    })),

  simulateWebhookReject: (businessId) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          connectionState: "needs_attention",
          lastRejection: {
            tab: "settlement_accounts",
            field: "Settlement account",
            message: "Account could not be verified with the bank. Re-add or choose another account.",
          },
        },
      },
    })),

  uploadKycDocument: async (businessId, docId, fileName) => {
    const { delay } = await import("../mock/api");
    const uploadedAt = new Date().toISOString().slice(0, 10);
    const setStatus = (status: "uploaded" | "verified") =>
      set((s) => ({
        businesses: {
          ...s.businesses,
          [businessId]: {
            ...s.businesses[businessId],
            kycDocuments: s.businesses[businessId].kycDocuments.map((d) =>
              d.id === docId ? { ...d, status, fileName, uploadedAt } : d,
            ),
          },
        },
      }));

    await delay(undefined, 500, 900);
    setStatus("uploaded");
    // Bharat Connect's own review is async and out of LEDGERS' control — simulate it
    // resolving a little later, same as the connect/profile-send webhooks do.
    await delay(undefined, 1800, 2600);
    setStatus("verified");
    get().promoteVerificationLevel(businessId);
  },

  devRequestKycDocument: (businessId) =>
    set((s) => {
      const docs = s.businesses[businessId].kycDocuments;
      const target = docs.find((d) => d.status === "verified") ?? docs[0];
      if (!target) return s;
      return {
        businesses: {
          ...s.businesses,
          [businessId]: {
            ...s.businesses[businessId],
            kycDocuments: docs.map((d) => (d.id === target.id ? { ...d, status: "requested" as const } : d)),
          },
        },
      };
    }),

  setVerificationLevel: (businessId, level) =>
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          verification: {
            level,
            invoicing: level >= 1,
            payments: level >= 3,
          },
        },
      },
    })),

  sendGstOtp: async (_businessId, _username, _gstin) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 700, 1000);
    get().pushToast("OTP sent to the mobile registered on your GSTIN.");
  },

  verifyGstOtp: async (businessId, code) => {
    const { mockOtpVerify } = await import("../mock/api");
    const res = await mockOtpVerify(code);
    if (!res.ok) return false;
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: { ...s.businesses[businessId], gstConnected: true, ownershipVerified: true },
      },
    }));
    get().pushToast("GSTIN connected.");
    get().promoteVerificationLevel(businessId);
    return true;
  },

  addBankAccount: async (businessId, account) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 1200, 1600); // penny-drop round trip
    const newAccount = {
      id: `bank-${Date.now()}`,
      beneficiaryName: account.beneficiaryName,
      ifsc: account.ifsc.toUpperCase(),
      accountEnding: account.acNum.slice(-4),
      verified: true,
    };
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: { ...s.businesses[businessId], bankAccounts: [...s.businesses[businessId].bankAccounts, newAccount] },
      },
    }));
    get().pushToast("Bank account verified with ₹1.");
    get().promoteVerificationLevel(businessId);
  },

  verifyBankAccount: async (businessId, accountId) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 1200, 1600);
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: {
          ...s.businesses[businessId],
          bankAccounts: s.businesses[businessId].bankAccounts.map((a) => (a.id === accountId ? { ...a, verified: true } : a)),
        },
      },
    }));
    get().pushToast("Bank account verified with ₹1.");
    get().promoteVerificationLevel(businessId);
  },

  setGstConnected: (businessId, connected) =>
    set((s) => ({
      businesses: { ...s.businesses, [businessId]: { ...s.businesses[businessId], gstConnected: connected } },
    })),

  devSetBankState: (businessId, state) =>
    set((s) => {
      const b = s.businesses[businessId];
      // Reuse the business's first account if it has one, otherwise a demo account.
      const base = b.bankAccounts[0] ?? {
        id: `bank-demo-${businessId}`,
        beneficiaryName: b.name,
        ifsc: "HDFC0001234",
        accountEnding: "4321",
        verified: false,
      };
      const bankAccounts = state === "none" ? [] : [{ ...base, verified: state === "verified" }];
      return { businesses: { ...s.businesses, [businessId]: { ...b, bankAccounts } } };
    }),

  promoteVerificationLevel: (businessId) => {
    const b = get().businesses[businessId];
    const level2 = b.ownershipVerified && b.bankAccounts.some((a) => a.verified);
    const level3 = level2 && b.kycDocuments.length > 0 && b.kycDocuments.every((d) => d.status === "verified");
    const target: VerificationLevel = level3 ? 3 : level2 ? 2 : 1;
    if (target <= b.verification.level) return;
    get().setVerificationLevel(businessId, target);
    get().pushToast(
      target === 3
        ? "You're fully verified. You can now receive payments on Bharat Connect."
        : "You're now verified for Level 2. You can pay other businesses on Bharat Connect.",
    );
  },

  sendInvoiceViaBharatConnect: async (invoiceId, noteToBuyer) => {
    const { delay } = await import("../mock/api");
    set((s) => ({
      invoices: s.invoices.map((i) => (i.id === invoiceId ? { ...i, bcSendStatus: "sending" as const } : i)),
    }));
    await delay(undefined, 900, 1300);
    set((s) => ({
      invoices: s.invoices.map((i) => {
        if (i.id !== invoiceId) return i;
        // The latest note ticked "Share with buyer when sent" travels as invoiceRemarks (one per send).
        const notes = i.notes ?? [];
        const shared = [...notes].reverse().find((n) => n.shareOnSend);
        return {
          ...i,
          bcSendStatus: "sent" as const,
          bcConfirmationStatus: "pending" as const,
          notes: [
            ...notes.map((n) => (n.shareOnSend ? { ...n, shareOnSend: false } : n)),
            // A note typed in the Bharat Connect card wins; otherwise the latest ticked note (invoiceRemarks).
            bcNote(`Sent to ${i.counterpartyName}`, noteToBuyer?.trim() || shared?.text || "", "You"),
          ],
        };
      }),
    }));
    get().pushToast("Sent via Bharat Connect. Waiting for the buyer to respond.");
  },

  respondToBill: async (invoiceId, decision, comment) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 600, 1000);
    const bill = get().invoices.find((i) => i.id === invoiceId);
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              bcConfirmationStatus: RESPONSE_STATUS[decision],
              notes: [...(i.notes ?? []), bcNote(`${RESPONSE_PAST[decision]} by you`, comment, "You")],
            }
          : i,
      ),
    }));
    const who = bill?.counterpartyName ?? "the supplier";
    get().pushToast(
      decision === "accept" ? `Bill accepted. ${who} has been told.` : decision === "return" ? `Bill returned to ${who}.` : `Bill rejected. ${who} has been told.`,
      decision === "reject" ? "error" : "success",
    );
  },

  addInvoiceNote: (invoiceId, text, shareOnSend) => {
    const note: InvoiceNote = {
      id: `n-${Date.now()}`,
      kind: "internal",
      text,
      author: "You",
      at: noteStamp(),
      shareOnSend,
    };
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              // Only one note can travel with a send, so ticking a new one unticks the others.
              notes: [...(i.notes ?? []).map((n) => (shareOnSend ? { ...n, shareOnSend: false } : n)), note],
            }
          : i,
      ),
    }));
  },

  updateInvoice: async (invoiceId, patch) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 400, 700);
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === invoiceId ? { ...i, ...patch } : i)) }));
  },

  recordReceipt: async (invoiceId, receipt) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 500, 900);
    let settled = false;
    set((s) => ({
      invoices: s.invoices.map((i) => {
        if (i.id !== invoiceId) return i;
        const prefix = i.kind === "sales" ? "RCPT" : "PV";
        const receipts = [...(i.receipts ?? []), { ...receipt, id: `${prefix}-${Math.floor(Math.random() * 900 + 100)}` }];
        // TDS deducted by the customer counts towards settling the invoice.
        const received = receipts.reduce((sum, r) => sum + r.amount + (r.tds ?? 0), 0);
        settled = received >= i.amount - 0.005;
        return { ...i, receipts, status: settled ? ("paid" as const) : ("partly_paid" as const) };
      }),
    }));
    const inv = get().invoices.find((i) => i.id === invoiceId);
    get().pushToast(
      `${inv?.kind === "sales" ? "Receipt" : "Payment"} of INR ${receipt.amount.toLocaleString("en-IN")} recorded. ${invoiceId} is now ${settled ? "fully paid" : "partly paid"}.`,
    );
  },

  resendInvoice: async (invoiceId, changeNote) => {
    const { delay } = await import("../mock/api");
    set((s) => ({
      invoices: s.invoices.map((i) => (i.id === invoiceId ? { ...i, bcSendStatus: "sending" as const } : i)),
    }));
    await delay(undefined, 900, 1300);
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              bcSendStatus: "sent" as const,
              bcConfirmationStatus: "pending" as const,
              version: (i.version ?? 1) + 1,
              notes: [...(i.notes ?? []), bcNote("Revised and re-sent by you", changeNote, "You")],
            }
          : i,
      ),
    }));
    get().pushToast("Revised invoice sent. Waiting for the buyer to respond.");
  },

  cancelInvoice: async (invoiceId, reason) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 500, 900);
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId
          ? { ...i, bcConfirmationStatus: "cancelled" as const, notes: [...(i.notes ?? []), bcNote("Cancelled by you", reason, "You")] }
          : i,
      ),
    }));
    get().pushToast(`Invoice ${invoiceId} cancelled. The buyer has been told.`);
  },

  simulateBuyerResponse: (invoiceId, decision, comment) => {
    const invoice = get().invoices.find((i) => i.id === invoiceId);
    const who = invoice?.counterpartyName ?? "Buyer";
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              bcConfirmationStatus: RESPONSE_STATUS[decision],
              notes: [...(i.notes ?? []), bcNote(`${RESPONSE_PAST[decision]} by ${who}`, comment, who)],
            }
          : i,
      ),
    }));
    get().pushToast(`${who} ${RESPONSE_PAST[decision].toLowerCase()} ${invoiceId}.`, decision === "accept" ? "success" : "error");
  },

  simulateSupplierResend: (invoiceId, changeNote) => {
    const bill = get().invoices.find((i) => i.id === invoiceId);
    const who = bill?.counterpartyName ?? "Supplier";
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              bcConfirmationStatus: "pending" as const,
              version: (i.version ?? 1) + 1,
              notes: [...(i.notes ?? []), bcNote(`Revised and re-sent by ${who}`, changeNote, who)],
            }
          : i,
      ),
    }));
    get().pushToast(`${who} sent a revised ${invoiceId}.`);
  },

  createInvoice: async (invoice) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 500, 900);
    set((s) => ({ invoices: [invoice, ...s.invoices] }));
  },

  simulateInvoiceConfirmation: (invoiceId, outcome) => {
    set((s) => ({
      invoices: s.invoices.map((i) => (i.id === invoiceId ? { ...i, bcConfirmationStatus: outcome } : i)),
    }));
    const invoice = get().invoices.find((i) => i.id === invoiceId);
    get().pushToast(
      outcome === "accepted"
        ? `${invoice?.counterpartyName ?? "Buyer"} accepted ${invoiceId} via Bharat Connect.`
        : `${invoice?.counterpartyName ?? "Buyer"} rejected ${invoiceId} via Bharat Connect.`,
      outcome === "accepted" ? "success" : "error",
    );
  },

  inviteToBharatConnect: async (counterpartyName) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 500, 900);
    get().pushToast(`Invited ${counterpartyName} to join Bharat Connect.`);
  },

  requestContactDetails: async (counterpartyName) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 500, 900);
    get().pushToast(`Requested ${counterpartyName}'s email and mobile. They'll need to approve before it's shared.`);
  },

  createContact: async (contact, inviteIfUnconnected) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 500, 900);
    set((s) => ({ contacts: [contact, ...s.contacts] }));
    if (contact.b2bId) {
      get().pushToast(`${contact.name} added. Already on Bharat Connect.`);
    } else if (contact.b2bId === null && inviteIfUnconnected) {
      await get().inviteToBharatConnect(contact.name);
    } else {
      get().pushToast(`${contact.name} added to Contacts.`);
    }
  },
}));

export function isVisibilityPublic(v: IdVisibility) {
  return v === "public";
}
