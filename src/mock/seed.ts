import type { Business, Invoice } from "../types";

export const STOCK_HOLDING_ID = "stock-holding";
export const SHARMA_TRADERS_ID = "sharma-traders";

export function makeSeedBusinesses(): Record<string, Business> {
  return {
    [STOCK_HOLDING_ID]: {
      id: STOCK_HOLDING_ID,
      name: "STOCK HOLDING CORPORATION OF INDIA LIMITED",
      pan: "AABCS1429B",
      gstin: "27AABCS1429B1Z5",
      businessType: "company",
      contacts: {
        mobile: "+919365551182",
        mobileMasked: "+91 936••••182",
        mobileVerified: true,
        email: "yoga.test@indiafilings.com",
        emailMasked: "y••••••••@indiafilings.com",
        emailVerified: true,
      },
      registeredAddress: {
        line1: "301, Raheja Centre, Nariman Point",
        city: "Mumbai",
        state: "MAHARASHTRA",
        pincode: "400021",
        source: "gst_portal",
      },
      bankAccounts: [
        {
          id: "bank-1",
          beneficiaryName: "yoga test",
          ifsc: "ICIC0005325",
          accountEnding: "9811",
          verified: true,
        },
      ],
      identifierPath: "gstin",
      connectionState: "not_connected",
      ownershipVerified: true,
      bharatConnectIds: [],
      verification: { level: 2, invoicing: true, payments: false },
      lastSyncedAt: null,
      bannerSnoozedUntil: null,
      welcomeSeen: false,
      profileDraft: {
        tradeName: "Stock Holding",
        mcc: null,
        additionalAddresses: [],
        additionalMobiles: [],
        additionalEmails: [],
        pendingReverification: {},
        dirtySinceSend: false,
      },
      lastRejection: null,
      kycDocuments: [
        { id: "pan_card", label: "PAN card", status: "verified", fileName: "pan_card.pdf", uploadedAt: "2026-09-02" },
        { id: "gst_certificate", label: "GST certificate", status: "uploaded", fileName: "gst_certificate.pdf", uploadedAt: "2026-09-18" },
        { id: "address_proof", label: "Address proof", status: "not_uploaded" },
        { id: "bank_proof", label: "Bank proof", status: "requested" },
      ],
    },
    [SHARMA_TRADERS_ID]: {
      id: SHARMA_TRADERS_ID,
      name: "Sharma Traders",
      pan: "PQRPR5678K",
      gstin: "27PQRPR5678K1ZQ",
      businessType: "sole_proprietor",
      proprietorName: "Ramesh",
      contacts: {
        mobile: "+919820001234",
        mobileMasked: "+91 982••••234",
        mobileVerified: true,
        email: "ramesh.sharma@sharmatraders.in",
        emailMasked: "r•••••@sharmatraders.in",
        emailVerified: true,
      },
      registeredAddress: {
        line1: "12, Marketyard Road",
        city: "Pune",
        state: "MAHARASHTRA",
        pincode: "411037",
        source: "gst_portal",
      },
      bankAccounts: [],
      identifierPath: "gstin",
      connectionState: "needs_attention",
      ownershipVerified: true,
      bharatConnectIds: [
        {
          id: "SHAR.RAME.5678.001@BCB",
          label: "Default",
          basedOn: "PAN",
          linkedIdentifierValue: "PQRPR5678K",
          visibility: "public",
          status: "active",
          settlementAccountId: null,
          hasOpenInvoices: true,
        },
        {
          id: "SHAR.RAME.5678.MUMB@BCB",
          label: "Extra",
          basedOn: "PAN",
          linkedIdentifierValue: "PQRPR5678K",
          visibility: "public",
          status: "active",
          settlementAccountId: null,
        },
        {
          id: "SHAR.RAME.5678.PUNE@BCB",
          label: "Extra",
          basedOn: "PAN",
          linkedIdentifierValue: "PQRPR5678K",
          visibility: "private",
          status: "deactivated",
          settlementAccountId: null,
        },
        {
          id: "sharmatraders",
          label: "Legacy format",
          basedOn: "PAN",
          linkedIdentifierValue: "PQRPR5678K",
          visibility: "public",
          status: "active",
          settlementAccountId: null,
          legacyFormat: true,
        },
      ],
      verification: { level: 1, invoicing: true, payments: false },
      lastSyncedAt: "2026-09-18",
      bannerSnoozedUntil: null,
      welcomeSeen: true,
      profileDraft: {
        tradeName: "Sharma Traders",
        mcc: null,
        additionalAddresses: [
          {
            line1: "4th Cross, Anna Nagar",
            city: "Daman",
            state: "TAMIL NADU",
            pincode: "396220",
            source: "manual",
            pincodeMismatch: true,
          },
        ],
        additionalMobiles: ["+919820001234"],
        additionalEmails: [],
        pendingReverification: {},
        dirtySinceSend: false,
      },
      lastRejection: {
        tab: "settlement_accounts",
        field: "Settlement account",
        message: "Account could not be verified with the bank. Re-add or choose another account.",
      },
      kycDocuments: [
        { id: "pan_card", label: "PAN card", status: "not_uploaded" },
        { id: "gst_certificate", label: "GST certificate", status: "not_uploaded" },
        { id: "address_proof", label: "Address proof", status: "not_uploaded" },
        { id: "bank_proof", label: "Bank proof", status: "not_uploaded" },
      ],
    },
  };
}

export function makeSeedInvoices(): Invoice[] {
  return [
    { id: "LP-45", kind: "sales", counterpartyName: "Bharat Retail Pvt Ltd", amount: 80000, status: "unpaid" },
    { id: "LP-44", kind: "sales", counterpartyName: "Anand Distributors", amount: 1000, status: "paid" },
    { id: "LP-43", kind: "sales", counterpartyName: "Sharma Traders", amount: 65000.01, status: "partly_paid" },
    { id: "LP-42", kind: "purchase", counterpartyName: "Ganesh Packaging Co", amount: 1124, status: "paid" },
  ];
}

export const COUNTERPARTY_DIRECTORY = [
  {
    id: "cp-1",
    registeredName: "Sharma Traders (proprietor: Ramesh)",
    bcId: "SHAR.RAME.5678.001@BCB",
    level: 2 as const,
    levelLabel: "Enhanced verification",
    levelDetail: "PAN, GSTIN and ownership verified",
    capability: "You can exchange invoices and purchase orders. They cannot receive on-platform payments yet.",
  },
  {
    id: "cp-2",
    registeredName: "Sharma and sons (proprietor: Ramesh)",
    bcId: "SHAR.RAME.5678.002@BCB",
    level: 3 as const,
    levelLabel: "Full due diligence",
    levelDetail: "Fully verified under regulatory guidelines",
    capability:
      "You can exchange invoices and purchase orders. Once payments are enabled for you, you can also pay them on the platform.",
  },
  {
    id: "cp-3",
    registeredName: "Sharma Traders Private Limited",
    bcId: "sharma.traders",
    legacyFormat: true,
    level: 1 as const,
    levelLabel: "Consent and name match",
    levelDetail: "Consent given and name matched to their tax record",
    capability: "You can exchange invoices and purchase orders. Payments on the platform are not available.",
  },
  {
    id: "cp-4",
    registeredName: "Bharat Retail Pvt Ltd",
    bcId: "AACCB4821F@BCB",
    level: 2 as const,
    levelLabel: "Enhanced verification",
    levelDetail: "PAN, GSTIN and ownership verified",
    capability: "You can exchange invoices and purchase orders. They cannot receive on-platform payments yet.",
  },
];
