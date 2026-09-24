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
import { baseId } from "../lib/id-standard";
import type { Invoice } from "../types";

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
  connectFlow: Record<string, ConnectFlowState>;
  toasts: { id: string; message: string; tone: "success" | "error" }[];

  currentBusiness: () => Business;
  switchBusiness: (id: string) => void;
  toggleDevPanel: (open?: boolean) => void;
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

  // BharatConnect IDs
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

  // Invoices / Bills
  sendInvoiceViaBharatConnect: (invoiceId: string) => Promise<void>;
  respondToBill: (invoiceId: string, decision: "accept" | "reject") => Promise<void>;
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
  connectFlow: {},
  toasts: [],

  currentBusiness: () => get().businesses[get().currentBusinessId],

  switchBusiness: (id) => set({ currentBusinessId: id }),

  toggleDevPanel: (open) =>
    set((s) => ({ devPanelOpen: open ?? !s.devPanelOpen })),

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
    set((s) => ({
      businesses: {
        ...s.businesses,
        [businessId]: { ...s.businesses[businessId], connectionState: "connected", welcomeSeen: false },
      },
    }));
    get().pushToast("Linked to your existing BharatConnect ID.");
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
    // BharatConnect's own review is async and out of LEDGERS' control — simulate it
    // resolving a little later, same as the connect/profile-send webhooks do.
    await delay(undefined, 1800, 2600);
    setStatus("verified");
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

  sendInvoiceViaBharatConnect: async (invoiceId) => {
    const { delay } = await import("../mock/api");
    set((s) => ({
      invoices: s.invoices.map((i) => (i.id === invoiceId ? { ...i, bcSendStatus: "sending" as const } : i)),
    }));
    await delay(undefined, 900, 1300);
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId ? { ...i, bcSendStatus: "sent" as const, bcConfirmationStatus: "pending" as const } : i,
      ),
    }));
    get().pushToast("Sent via BharatConnect. Waiting for the buyer to confirm.");
  },

  respondToBill: async (invoiceId, decision) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 600, 1000);
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId
          ? { ...i, bcConfirmationStatus: decision === "accept" ? ("accepted" as const) : ("failure" as const) }
          : i,
      ),
    }));
    get().pushToast(decision === "accept" ? "Bill accepted." : "Bill rejected.", decision === "accept" ? "success" : "error");
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
        ? `${invoice?.counterpartyName ?? "Buyer"} accepted ${invoiceId} via BharatConnect.`
        : `${invoice?.counterpartyName ?? "Buyer"} rejected ${invoiceId} via BharatConnect.`,
      outcome === "accepted" ? "success" : "error",
    );
  },

  inviteToBharatConnect: async (counterpartyName) => {
    const { delay } = await import("../mock/api");
    await delay(undefined, 500, 900);
    get().pushToast(`Invited ${counterpartyName} to join BharatConnect.`);
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
      get().pushToast(`${contact.name} added. Already on BharatConnect.`);
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
