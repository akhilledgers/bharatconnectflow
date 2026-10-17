# Banking — hand-over

Everything needed to keep building **Banking** (and the payment hooks in Bills and Expense Vouchers) on a local
machine. Read alongside the main [README](../README.md), which covers the rest of the prototype (Bharat Connect
onboarding, invoices, bills, contacts).

State as of 17 Oct 2026: all Banking work is on `main` (merge commit `45cf7a7`), also on branch
`claude/festive-faraday-1k9olx`.

---

## 1. Run it locally

```bash
git clone https://github.com/akhilledgers/bharatconnectflow.git
cd bharatconnectflow
npm install
npm run dev          # http://localhost:5173  →  Banking is at /#/banking
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npx tsc -b` | Typecheck (run before every commit; the build fails on type errors) |
| `npm run lint` | oxlint (`npx oxlint src/pages/banking` for just Banking) |
| `npm run build` | Typecheck + production build into `dist/` |

- **Node 22** (tested on 22.22). The repo pins Vite 6 on purpose; don't upgrade to Vite 7/8 without checking it
  runs on your Node.
- Routing is **hash-based** (`/#/banking`, `/#/expenses/bills/…`), so any static host works.
- Everything is client-side. There is no backend: all bank APIs are simulated in the store with delays, and
  their outcomes are driven by the **Dev panel** (§4). The only real network call is the IFSC lookup (§7).

---

## 2. What exists

Banking has four tabs plus drawers and dialogs. The header has **New payment** and **More ▾** (Bulk payment,
Pay a purchase bill, Upload statement → Accounts tab, Add bank account).

| Area | What it does |
|---|---|
| **Overview** | Cash in bank, money in/out this month, *Needs attention* (failed payouts, expired connections, pending net-banking approval, stale statements), accounts list. Layout: split or stacked (Dev panel). |
| **Transactions** | Bank statement vs books, per account or *All accounts*. AI-suggested matches to accept/reject; unmatched lines open the **Match panel** (§5). *Your books* tab shows entries not yet in the bank. Sync, upload statement, Move to… another account. |
| **Payouts** | Payments made from LEDGERS with status (awaiting approval → processing → paid / failed / rejected / returned / cancelled). Row opens a detail drawer. *No retry* by design. |
| **Accounts** | One row per company bank account: sync status, balance, at most one next step (Connect / Reconnect / Check status / Verify / Upload / Upload again). Import history side panel. |
| **New payment** (`SingleTransferDrawer`) | Pay from → Pay to (one search over contacts + employees; one-off payee; add contact; add bank account) → unpaid bills (vendors) → amount → purpose + mode → review → OTP → success. |
| **Bulk payment** (`BulkTransferDrawer`) | Same building blocks, many payees: add one by one or upload CSV, editable amounts, issues per row, purpose + mode for the batch, balance check, review with every payee, OTP. IndusInd and Axis only. |
| **Add bank account** (`AddBankAccountDrawer`) | Account number (masked, no copy) → confirm (no paste) → IFSC (live lookup) → type → nickname → opening balance (can be negative) as on an FY start. Banks with Connected Banking offer *Connect* next. |
| **Connect / Reconnect** (`RegisterBankDialog`) | Generic, driven by `bankConnectors.ts` (§3). IndusInd adds an *approve in net banking* step. |
| **Upload statement** (`UploadStatementDialog`) | Drop/pick PDF, Excel or CSV → LEDGERS reads period and overlap from the file → asks a password only if the PDF is locked → Import. Credits shown as one footer line. |
| **Beneficiary gate** (`BeneficiaryGate`) | IndusInd only pays payees on the customer's beneficiary list. Inline: *Not in your IndusInd beneficiaries · Add* → beneficiary code → OTP (single user) or *waiting for checker* (maker & checker). |
| **Pay from Bills / Expense Vouchers** | Bills list: row status menu → *Pay from bank*; select rows → *Pay INR X* (one supplier → New payment, several → Bulk payment). Bill / voucher view: **Pay** button in the due header; afterwards a status line (awaiting approval / on its way / paid → links to the payout). |

---

## 3. Code map

```
src/pages/banking/
  BankingPage.tsx          tabs, header actions, which drawer/dialog is open (Flow state), ?tab= deep link
  OverviewTab.tsx          Overview  (+ overviewData.ts helpers)
  TransactionsTab.tsx      Transactions + Match panel (largest file)
  PayoutsTab.tsx           Payouts list + payout drawer
  AccountsTab.tsx          Accounts + import history
  SingleTransferDrawer.tsx New payment
  BulkTransferDrawer.tsx   Bulk payment (+ AddPayment card)
  shared.tsx               shared pieces for both payment drawers: TransferDrawer, PayFromSelect, PayeePicker,
                           AccountForm, AmountInput, BillPicker, PurposeModeRow, OtpStep, ReviewRow,
                           SuccessView, VerifiedDot, UnverifiedTag, …
  AddBankAccountDrawer.tsx Add bank account          (+ ifscLookup.ts)
  RegisterBankDialog.tsx   Connect / Reconnect       (driven by bankConnectors.ts)
  ConnectBankDialog.tsx    "connect a bank" entry when nothing is connected
  UploadStatementDialog.tsx
  BeneficiaryGate.tsx      IndusInd beneficiary list (+ beneficiaries.ts helpers)
  PayDocs.tsx              usePayDocs(): pay bills / vouchers through the drawers; useDocPayment(), useDocPaid()
  PayDocSection.tsx        PayDocButton (due header) and PayDocStatus (status line) for bill & voucher views
  bankConnectors.ts        ★ per-bank Connected Banking config (see below)
  data.ts                  types + seed: company accounts, payees, employees, scenario, modes, purposes
  ledgerData.ts            types + seed: bank lines, book entries, parties, payouts, imports, reconFor()
  setups.ts                "Business stage" presets (new business … several banks)
  BankLogo.tsx, SyncBadge.tsx, StatCard.tsx, FilterChips.tsx, useEscape.ts
src/store/useBankingStore.ts   all Banking state + simulated bank APIs (zustand)
src/pages/expenses/            Expense Vouchers list + view (vouchers.ts = seed)
src/pages/invoices/payBill.ts  billDoc() / billNumber() / isPayableBill() — bills as payable documents
src/components/dev/DevPanel.tsx  "Banking" section (§4)
```

### Adding a bank — `bankConnectors.ts`

Everything bank-specific lives in one entry, so the dialogs stay generic:

1. Add its key to `BankKey` in `data.ts`.
2. Add an entry to `BANK_CONNECTORS`:
   - `ids` — fields the bank's Register API needs from everyone (with `numeric`, `where` help text)
   - `approval` — whether the customer chooses *Single user* / *Maker & checker*; then `single` /
     `makerChecker` fields
   - `bulk` — bulk payments supported
   - `netBankingApproval {url, steps}` — bank makes the customer approve LEDGERS in net banking
     (connection sits in `pending` until *I've approved it* / *Check status*)
   - `beneficiaryList {codeMax}` — bank only pays listed beneficiaries (turns on the Beneficiary gate)
3. Add its logo in `BankLogo.tsx`.

IndusInd is the reference implementation (customer ID with help, approval choice, net-banking approval at
`https://www.indusind.bank.in/`, beneficiary list with 20-char codes). Axis's fields are placeholders until its
API is confirmed. ICICI: no approval choice, no bulk.

### Store — `useBankingStore.ts`

Key state: `accounts`, `contacts`, `employees`, `beneficiaries[accountId][payeeKey]`, `bankLines`,
`bookEntries`, `parties`, `payouts`, `imports`, `uploadCredits`, `scenario`, `setup`.

Simulated APIs (all async, outcomes from `scenario`): `verifyAccount`, `verifyOwnAccount`, `registerBank`,
`checkConnection`, `syncAccount`, `uploadStatement`, `addBeneficiariesWithOtp`, `requestBeneficiaries`,
`checkBeneficiaries`, `addPayout` (processing payouts settle by themselves after a delay).

Recon actions: `acceptMatches`, `rejectMatch`, `resolveLine(lineId, match, {entryIds, party, settle})`,
`rememberKey`, `moveEntry`.

Payment-from-documents: `vendorForDocs(name, bills)` finds or creates the supplier as a payee and attaches the
bills; payouts carry `docs: string[]` (bill / voucher numbers) so the documents can show their payment state.

Payee keys: `contact:<contactId>:<accountId>`, `employee:<employeeId>`, `other:<…>`.

---

## 4. Dev panel → Banking

`{ }` button at the bottom of the sidebar → **Banking**.

- **Business stage** — swaps the whole dataset: *New business · no bank*, *Bank added · no statement*,
  *Statement uploaded*, *Connected · all reconciled*, *Connected · items to review*, *Connection expired*,
  *Several banks*.
- **Try** — checker approves everything waiting; next payout fails; reset this stage's data.
- **Bank API** — penny-less verification (random / pass / fail); IndusInd net-banking approval
  (approved / not yet); checker approved new beneficiaries (approved / not yet); next uploaded statement
  (reads fine / password / other account); Connect succeeds / rejected.
- **Accounts** — per Connected-Banking account: Live / Approval / Expired / Off and Checker / Single; bank
  balance normal / low; Overview layout.

---

## 5. Reconciliation model (Transactions)

- A **bank line** has a `status`: `suggested` (AI match to confirm), `needs` (unmatched), `auto`, `matched`.
  Its `match` says what it was matched to (`Receipt`, `Payment voucher`, `Bill payment`, `Expense`, `Journal`,
  `Transfer`).
- A **book entry** links to a bank line through `lineId`. `entryForLine()` builds the entry a match creates;
  `linkedEntries()` lists them; entries with no `lineId` are *Not in bank*.
- Transfers between own accounts pair two lines (`pairLineId`). One bank line can settle several entries.
- `reconFor(accountId, lines, entries)` gives the counts and difference used by every tab.
- **Match panel**: who it's from/to → *What does it settle?* (multi-select of open invoices / bills, with
  *on account* for the remainder) → **New** receipt/payment vs **Existing** entries. Wording rule: matching to
  existing receipts/payments doesn't create anything; settling invoices/bills creates a new receipt/payment —
  the panel says which, in a few words.

---

## 6. Design rules (from review feedback — keep to these)

These came out of rounds of review with the product owner; the current UI follows them.

1. **No yellow / coloured note boxes.** Put the information where it applies: unverified → small amber icon +
   "Unverified" on the payee; checker approval → an *Approval* row in the review summary. No explanatory
   labels like "Approved by a single operator…".
2. **Subtle, neutral states.** Status in grey text with a small icon; colour only for real errors (red, one
   short line).
3. **Fewer words.** No helper text that repeats the label. One-line copy. No "no money moved" style
   reassurance.
4. **Don't ask what the system can work out.** Statement period, PDF lock, overlap with existing data — read
   it, don't ask it.
5. **Dropdowns over free inputs** where the choices are known (account type, FY "as on" date, purpose, mode).
6. **One pattern everywhere.** New payment and Bulk payment share their pieces (`shared.tsx`); change them
   there, not per drawer. Sentence-case labels ("Pay from", "Review batch").
7. **Field order follows how people have the information:** account number before IFSC; confirm number
   appears only once the number is entered.
8. **Actions where the user already is.** Pay from the bill / voucher itself; on views the *Pay* button sits
   in the due header — no extra forms or tabs in the side card (a richer *Payment* section was tried and
   rejected).
9. **Naming:** "New payment" (not "Pay someone"), "Bulk payment", "net banking" (two words), "Single user" /
   "Maker & checker". No *Retry* on payouts.
10. **Bills list follows LEDGERS' Purchase Invoices list** (owned by the Bharat Connect / Bills work): no
    Action column; payment options live in the unpaid status menu.

---

## 7. Known gaps / next steps

- **IFSC lookup** calls `https://ifsc.razorpay.com/{IFSC}` and falls back to sample data when blocked. Works
  locally if your network allows it.
- **Paying a bill doesn't write back to the bill.** It shows *Paid* once the payout completes (derived from
  `payout.docs`), but no payment entry is added to the bill's Reconciliation table, and `invoice.status` is not
  updated in the main store.
- **Expense Vouchers** are static seed data (`src/pages/expenses/vouchers.ts`): no create/edit; notes live in
  page state only.
- **Bills' "Record payment"** item in the status menu is a placeholder (LEDGERS' own form isn't built here).
- **Bulk upload** loads a fixed demo batch for any non-empty CSV (covers each row issue); real CSV parsing is
  not built.
- **Axis connector fields** are placeholders until the API is confirmed.
- Payee lookup for bills / vouchers is by **supplier name**; in the real product, use the contact ID.
- **State resets on reload** (no persistence).
- Not covered yet: scheduled payments, payout cancellation rules per bank, multi-currency, partial bill
  payments from the drawer (amount can be edited, but the bill stays fully linked).

---

## 8. Testing

There are no automated tests in the repo. Changes were checked with:

1. `npx tsc -b` and `npx oxlint src` — both clean on `main`.
2. Clicking through in the browser with Playwright scripts (kept outside the repo). Each flow above was
   walked: bulk payment with every row issue, single payment from a bill, IndusInd beneficiary add (single
   user + maker & checker), connect with net-banking approval, upload with locked / other-account PDFs, pay
   from Bills (row menu + bulk bar) and Expense Vouchers.

When you change a flow, use the Dev panel to hit its failure paths too, not just the happy path.

---

## 9. Continuing with Claude Code locally

Open the repo folder in Claude Code and point it at this file first, e.g.:

> Read `docs/BANKING_HANDOVER.md` and `README.md`, then …

Worth telling it up front:

- follow §6 (design rules) for any UI change;
- don't push without asking;
- run `npx tsc -b` and `npm run lint` before committing;
- check UI changes in the browser (`npm run dev`), including the Dev panel failure paths.
