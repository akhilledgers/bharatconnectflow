# Bharat Connect × LEDGERS — Clickable Prototype

A working front-end prototype of the Bharat Connect integration inside LEDGERS. Everything is
client-side: React + TypeScript + Tailwind, React Router (hash routing), Zustand for state,
Sonner for toasts, and a mocked API layer with artificial network delay. Nothing talks to a
real backend.

The UI follows the **LEDGERS design system** (the v4 app's tokens and component recipes): the
theme lives in [`src/index.css`](src/index.css) and shared building blocks in
[`src/components/ui/`](src/components/ui/). The restyle is in progress — see
[Design system restyle](#design-system-restyle) for what's converted so far.

Two builds are stacked here:

1. **Onboarding & profile** — connection status everywhere, the one-page connect flow, the
   connected overview, Bharat Connect IDs, and the redesigned profile-edit page with a
   verification-level system.
2. **Invoices, Bills & Contacts, integrated natively** — Bharat Connect isn't a separate
   module. Sales Invoices, Expenses Bills, and Contacts are LEDGERS' own native pages; they
   render exactly as they would with no Bharat Connect connection at all until the business
   connects, at which point send/accept/reject actions, status filters, pending-action
   banners, and a Bharat Connect column appear in place — same page, same URL, same table.
   Bills work slightly differently: the Purchase Invoices list stays LEDGERS' own, and a
   **Bharat Connect** button on it shows everything received over Bharat Connect (see
   [§9](#9-bills-received-over-bharat-connect--purchase-invoices)).

## Running it

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173`. Uses Vite 6 (the Vite 8/rolldown default that `npm create
vite` installs today doesn't run on this machine's Node version — see `package.json`).

## How to explore it

Every screen has a **dev panel** — the small `{ }` button at the right end of the sidebar
footer. It lets you:

- Switch between the two seeded businesses (a company and a sole proprietorship)
- Force any of the six connection states directly, without going through a real flow
- Force the business's verification level (1, 2, or 3) to see level-gated UI
- Choose how the profile page's next save resolves — **Succeeds / Rejected / Conflict** —
  to test the save bar's rejected and version-conflict paths
- Fire the two simulated Bharat Connect webhooks (confirm activation / reject an update)
- Simulate the buyer's side of a sent sales invoice — Accept or Fail any invoice currently
  sitting in "sent, awaiting confirmation," without leaving the page you're on
- **Purchase** tab: receive a bill from a supplier (In catalog / New items / Mixed / Missing
  HSN), load one of eight bill-item scenarios (all in catalog, linked before, all new,
  similar item, Sales-only item, missing HSN/GST, services, mixed), reset the catalog, and
  play a supplier editing or cancelling a bill that's waiting on you

The "Reach full verification" documents dialog has one dev control of its own ("Dev ·
Simulate re-request"), kept inside the dialog because the dev panel sits behind it.

## Seeded businesses

| | Stock Holding Corporation of India Ltd | Sharma Traders |
|---|---|---|
| Type | Company | Sole proprietorship (proprietor: Ramesh) |
| PAN | AABCS1429B | PQRPR5678K |
| Default connection state | Not connected | Needs attention (seeded rejection on settlement account) |
| Verification level | 2 | 1 |
| Bharat Connect IDs | none yet (connect to generate one) | 4 — default, extra, a deactivated extra, and one legacy-format ID |
| Used to demo | The connect flow, ID generation for company-type PAN, Level 2→3 documents flow | The individual ID format, `needs_attention` state, IDs table with mixed statuses |

Both businesses share one flat pool of seed data — invoices/bills aren't scoped per
business in this prototype. [`src/mock/seed.ts`](src/mock/seed.ts) also seeds:

- **Invoices & Bills** (`makeSeedInvoices`) — a mix deliberately covering every
  Bharat Connect state a sales invoice or bill can be in: not sent, sent+pending,
  accepted, failed (with retry), and — for sales — customers with and without a
  Bharat Connect B2B ID (to exercise the greyed-out "Send" + Invite flow).
- **Contacts** (`makeSeedContacts`) — customers/suppliers spanning connected (has a B2B
  ID), invite-eligible (has a GSTIN, checked, not on Bharat Connect), and unchecked (no
  GSTIN on file at all).
- **`GST_REGISTRY_BY_GSTIN`** — mocks the native GST-portal autofill (name, PAN, address)
  that the Create Contact modal's "Autofill from GSTIN" box uses — works regardless of
  Bharat Connect connection.
- **`BC_REGISTRY_BY_GSTIN`** — mocks what a Bharat Connect `reqSearchEntity` call would
  return for a GSTIN (business name + B2B ID). Keyed by the same GSTINs used across the
  seed invoices/bills/contacts so results stay consistent everywhere a GSTIN is looked up.
  Includes `33AADCI6142F1ZX` ("Indus Comtrade Private Limited") as a known-good test GSTIN
  that resolves on both registries.

## What's built

### 1. Connection status (everywhere)
Six states — `not_connected`, `existing_id_found`, `setting_up`, `connected`,
`needs_attention`, `assisted_setup` — each with its own color/label, defined once in
[`src/lib/status.ts`](src/lib/status.ts) and consumed everywhere so they can't drift:

- **Top-bar badge** ([`StatusChip.tsx`](src/components/layout/StatusChip.tsx)): the
  Bharat Connect "B" mark plus a status dot. Hover to see the status and a contextual action
  ("Onboard Now", "Link Existing ID", "Manage", "Fix Now", "Contact Us"). When connected, a
  red count badge on the mark itself shows total pending items (invoices pending to send +
  bills pending to accept) without even opening the popover; inside the popover, all four
  quick stats — Pending to send, Pending to accept, Invoices accepted, Bills received — are
  clickable through to the relevant list page.
- **Dashboard banner** ([`DashboardBanner.tsx`](src/components/layout/DashboardBanner.tsx)):
  shown only for states that need action, with a 7-day snooze ("Remind me later"). Never
  shown when connected. For `existing_id_found`, its **Link existing ID** button links in
  place ("Linking…" → banner disappears → toast), exactly like the top-bar chip's action —
  both entry points behave the same.
- **Sidebar dot** on the Settings → Bharat Connect item while setup is incomplete.
- **"Send via Bharat Connect" button** on the dashboard's recent-sales list: disabled with a
  "Connect to enable" hint until connected.

### 2. Connect flow (`/settings/bharatconnect`, when not connected)
One page, not a wizard — this replaces an earlier 6-step design. Business details collapse
to a 3-line summary; the Bharat Connect ID is generated and shown read-only with a
part-by-part breakdown; ownership shows a single green line when LEDGERS already has it
verified (skipping the OTP screen entirely, which is the case for both seeded businesses);
consent is one checkbox. Submitting morphs the same card in place through
sending → creating ID → waiting for confirmation → success, with no page navigation.

Other states on this route:
- `existing_id_found` → a one-click "Link existing ID" card, no form. The ID shown is the
  one that gets linked (`existingIdFor` in [`id-standard.ts`](src/lib/id-standard.ts) —
  `PAN@BCB` for companies, the individual format for sole proprietors). Linking adds it to
  the business's IDs as the Default (unless it already has an active ID), so the Overview
  and IDs page show it straight away.
- `setting_up` → a static progress card
- `assisted_setup` → "Contact us", no automatic flow
- `connected` / `needs_attention` → the connected overview (below), with a red banner on
  top for `needs_attention` linking straight to the failing field

### 3. Connected overview (`/settings/bharatconnect`, when connected)
Deliberately minimal — plain label/value rows, no cards, one accent color. The Bharat Connect
ID in large monospace type with copy and an always-visible **Manage IDs** link (with the
active-ID count when there's more than one), an invoicing/payments summary, business details, and a
footer with last-synced date, an "unsent draft" link when the profile has unconfirmed
changes, and a disconnect link (blocked with a tooltip while any invoice is unpaid or partly
paid — see [`Overview.tsx`](src/pages/settings/bharatconnect/Overview.tsx)).

### 4. Bharat Connect IDs page (`/settings/bharatconnect/ids`)
Reached from **Manage IDs** on the connected overview and from **Manage** on the Default
Bharat Connect ID row of the profile page's Tax & legal IDs section.
Table of every ID for the business — visibility, linked identifier, status, and
Deactivate / Reactivate. (Editing an existing ID — `reqEditId` — is phase 2, so there's no
Edit action yet.)
"Create ID" opens a drawer: pick PAN or GSTIN as the base (skipped for sole proprietors,
whose format is fixed), a live-generated preview, a 2–5 character ending with a mocked
availability check and suggestion chips, public/private, and an optional settlement account
(verified LEDGERS accounts only). Deactivation is blocked per-ID when that ID has open
invoices or active financing, with the reason shown as a toast. Legacy (pre-standard) IDs
are labeled and never validated against the new pattern.

### 5. Bharat Connect ID standard
Implemented in [`src/lib/id-standard.ts`](src/lib/id-standard.ts):
`PAN@BCB` / `GSTIN@BCB` for companies, `AAAA.BBBB.CCCC.DDD@BCB` for individuals (from
business name, proprietor name, PAN digits 6–9, and a disambiguation sequence), and
`base.ENDING@BCB` for extra IDs. No user ever types an ID from scratch.
**⚠ Not confirmed:** no R3.8 reference defines this standard, and handbook Annexure F asks for IDs
derived from the registered business name — see [Flow audit §2](#2-b2b-ids).

### 6. Profile-edit page (`/settings/bharatconnect/profile`)
The page that took the most iteration — see the notes below on what changed and why. It's
the first screen fully converted to the LEDGERS design system. One scrollable page, laid out
as a single full-width card with five sections in a fixed order:

- **Header**: "Bharat Connect profile" with a **Verified for Level N** badge (hover it for the
  checklist of which checks are met at each level) and, below Level 3, an outline **Reach
  Full Verification** button on the right (with an amber dot when Bharat Connect has
  re-requested a document).
- **Line tabs** at the top of the card (Business details · Tax & legal IDs · Addresses ·
  Settlement account · Contacts & notifications) stay pinned under the top bar while you
  scroll; clicking one scrolls to its section, and the tab for the section you're in is
  highlighted (scroll-spy). Old tab-shaped URLs still scroll to the right section.
- Every field has an explicit permission in one config
  ([`fieldConfig.ts`](src/pages/settings/bharatconnect/profile/fieldConfig.ts)):
  **editable** (boxed input, tier 1 = saves immediately, tier 2 = needs confirmation),
  **readonly-sourced** (plain text with a grey source badge — "GST portal", "Derived from
  PAN", "Set by Bharat Connect", "Generated"), or **bc-owned** (the level badge in the header,
  never a form field).
- All fields — read-only and editable alike — are the same two-column row: label (plus its
  source badge) on the left, value or control on the right, so the only thing marking a
  field editable is its input box. A changed field gets an amber **Edited** badge next to
  its label. Invalid fields are marked on the input itself (red border, message below).
- The **save bar** is the card's sticky footer and the only save mechanism — no per-section
  saves, no separate review page. It runs through a real state machine: clean ("Up to date")
  → dirty ("N fields changed") → invalid ("Fix: …" link that scrolls to the field) →
  confirming (only when a tier-2 field changed — a before → after diff opens inside the
  footer with Cancel / Confirm & Send) → sending → success ("Sent to Bharat Connect",
  auto-reverts after 3s) / rejected (points at the specific field; editing that field clears
  it) / a version-conflict path that refreshes stale fields, keeps the user's pending edits,
  and shows a banner above the footer. The rejected/conflict outcomes are armed from the dev
  panel.
- **Reach Full Verification** opens the KYC documents dialog (not inline in the page).
  Uploading a document simulates Bharat Connect's own async review (uploaded → verified a
  couple seconds later), and Bharat Connect can re-request an already-verified document at
  any time (dev-toggleable), which reopens the upload control for just that document.
- MCC is hidden behind a collapsed "needed once you enable payments" row below Level 2,
  and becomes a required visible field once Level 2 is complete. **⚠ To fix:** handbook
  Annexure Q makes MCC mandatory only at Level 3 — see [Flow audit §3](#3-profile-and-verification-levels).
- The form opens with two pending demo edits (MCC set to 6211, "Use as default settlement
  account" toggled) so Save and the tier-2 confirm step can be tried straight away. No
  additional addresses are seeded; add one with a wrong pincode to see the invalid state.

### 7. Invoices & Bills — native, not a separate module
Sales Invoices (`/sales/invoices`) and Expenses Bills (`/expenses/bills`) are one shared,
kind-parameterized set of components
([`InvoiceListPage.tsx`](src/pages/invoices/InvoiceListPage.tsx),
[`InvoiceViewPage.tsx`](src/pages/invoices/InvoiceViewPage.tsx),
[`InvoiceCreatePage.tsx`](src/pages/invoices/InvoiceCreatePage.tsx)) so a fix or feature on
one side ships on both automatically. Behavior is one rule: **not connected → the plain
native UI, pixel-matched to the real LEDGERS screens, with nothing Bharat Connect-shaped
anywhere. Connected → the same UI, augmented in place.**

What "augmented" means, connected:
- **List page**: a Bharat Connect column appears (Sent/Pending/Accepted/Failure, or a
  "Send via [B]" action for sales / Accept·Reject icons for bills), plus a status filter
  ("Pending to send", "Awaiting confirmation", "Accepted", "Failed", etc.) tucked behind the
  toolbar's Filter icon as a popover ([`FilterMenu.tsx`](src/components/FilterMenu.tsx), a
  dot on the icon shows when a non-default filter is active) and a pending-actions banner
  ("N invoices pending to send via Bharat Connect") whose CTA applies that filter — no
  navigation needed. That banner dismisses with its own 3-day snooze, kept independent per
  page (Invoices vs. Bills) so dismissing one doesn't hide the other.
- **View page**: a Bharat Connect card in the sidebar mirrors the existing "GST filings"
  pattern — Send / Sending… / Status+Confirmation for sales, Accept/Reject for bills. A
  failed send gets a **Send Again** button right there (and a matching **Retry** link in
  the list's Bharat Connect column) — same underlying action as the original send.
- **Bills** don't get the inline column on the main list — see
  [§9](#9-bills-received-over-bharat-connect--purchase-invoices). Bills are received, never
  sent, so nothing on them ever says "Not sent".
- **Create → review → send**: creating never sends. After **Create**, you always land on
  the new document's view page with a "created" toast. For a sales invoice, a
  **review-and-send callout** sits above the document
  ([`ReviewAndSendCallout.tsx`](src/pages/invoices/ReviewAndSendCallout.tsx)): "Review it
  below, then send it to <customer>" with **Send via Bharat Connect**; it then follows the
  invoice in place (Sending… → Sent, waiting for confirmation). If the customer isn't on
  Bharat Connect it offers **Invite** instead; if the business isn't connected it offers
  Connect. It shows only right after Create and can be dismissed. The Create page has no
  "Send via Bharat Connect" checkbox — when the chosen customer has a B2B ID, a hint says
  you can review and send after creating.
- **One action per page**: while the callout is showing it holds the page's filled Send /
  Invite button, and the sidebar card's version steps back (outline Send, no Invite). The
  customer block on the document shows "Not on Bharat Connect" as status only — no second
  Invite link. The view page's header has no Bharat Connect icon; status lives only in the
  sidebar card.
- **Customer not onboarded on Bharat Connect** (no B2B ID): the send action greys out
  instead of pretending to work, everywhere it appears (list, view). Hovering it
  (list) or just looking at it (view — no hover needed there) surfaces an
  **Invite to Bharat Connect** CTA ([`InviteBcTooltip.tsx`](src/components/InviteBcTooltip.tsx)),
  which fires the same mocked-delay-then-toast pattern as everything else.
- **Not connected at all**: a banner CTA on the list page and a dashed placeholder card on
  the view page's sidebar both point at `/settings/bharatconnect`
  ([`ConnectBharatConnectCTA.tsx`](src/components/ConnectBharatConnectCTA.tsx)). The banner
  is self-governing (reads connection/snooze state straight from the store, same as the
  pending-actions banner) with its own dismiss and 7-day snooze — sharing the same
  `bannerSnoozedUntil` field as the Dashboard's connection banner, so dismissing "connect
  Bharat Connect" on any one page hides it everywhere, since it's one decision, not three.
  Copy is tailored per page (Invoices/Bills/Contacts each say something different, and each
  passes it via a `message` prop) rather than one generic sentence.

**Toasts** ([`AppShell.tsx`](src/components/layout/AppShell.tsx)) are Sonner toasts in the
**top-right** corner (the LEDGERS convention), green for success / red for error,
auto-dismissing after 4 seconds — used for every action above. Store actions still call
`pushToast`; the shell bridges each new store toast to Sonner exactly once.

### 8. Contacts (`/contacts`)
Matches the real LEDGERS Contacts screens (list, Create Contact modal, view page) with one
addition: the **Autofill from GSTIN** box on Create Contact — which businesses already use
for tax autofill — silently also checks Bharat Connect status as a side effect, but only once
this business is itself connected (with an explicit "We'll also check if they're on
Bharat Connect" hint so that isn't a surprise). Two independent mock lookups drive it:
native GST-portal autofill (name/PAN/address, always active, `GST_REGISTRY_BY_GSTIN`) and
the Bharat Connect check (B2B ID, connected-only, `BC_REGISTRY_BY_GSTIN`). A match shows the
B2B ID plus a **Request contact details** action rather than auto-filling email/mobile —
per the partner handbook, `reqSearchEntity` doesn't return those; they're "non-public
information" requiring a separate `reqNonPublicInfo` consent request, so that's what's
mocked (`requestContactDetails`, a toast, not an instant fill). No match still auto-checks
**"Invite them to Bharat Connect once saved"**, so creating a contact and inviting them onto
Bharat Connect collapse into one action.

The View Contact page ([`ContactViewPage.tsx`](src/pages/contacts/ContactViewPage.tsx))
joins that contact's invoices/bills by B2B ID when one exists (falls back to name match
otherwise) to compute Receivables/Payables and a Recent Invoices table, plus a Bharat Connect
card. That card deliberately shows only two numbers — **Pending to send** / **Pending to
accept**, scoped to this contact — rather than a full sent/accepted/received breakdown;
each is clickable through to the relevant list page, mirroring the top bar's own pending
stats. The list page's contact icon (a small B mark placed right before the name, not a
separate column) follows the same three-state logic: full-color when connected, greyed
with an Invite-on-hover tooltip when checked and not found, and a barely-visible placeholder
when there's no GSTIN/PAN on file at all — kept in a fixed-width slot so rows stay aligned
regardless of which state a given contact is in.

### 9. Bills received over Bharat Connect → Purchase Invoices
An invoice a supplier sends over Bharat Connect is raw data, not a LEDGERS bill. It becomes one
when the user creates it, and creating it is the **Accept** on Bharat Connect.

**Purchase Invoices list** (`/expenses/bills`,
[`InvoiceListPage.tsx`](src/pages/invoices/InvoiceListPage.tsx)) — matched to the live LEDGERS
page (`in.ledgers.cloud/v4/manage-purchase-invoice`): title **Purchase Invoices**, **Create
Purchase Invoice**, stat cards Total Purchase / Payables / Overdue / TDS with "Today", toolbar
search · date range · Filter · columns · settings, and columns **Bill Number · Purchase Invoice
Number · Purchase Date · Supplier Name · GSTIN · Total Amount · Status** with sort icons and no
Action column (Edit / Delete live on the bill's own page). Unpaid statuses carry LEDGERS'
dropdown chevron. Newest bill number first.

- **Two views, one page.** The default list is LEDGERS' own: only bills that exist in the
  books, no Bharat Connect column. The toolbar's **Bharat Connect** button (it replaces the old
  Active / Deleted toggle) switches to everything received over Bharat Connect in any status —
  waiting first with a **Create** button, then Accepted / Rejected / Cancelled — with the Bharat
  Connect column and status filter. A red count on the button shows how many are waiting to be
  created; the pending banner's "Show bills" opens this view.
- **Bill Number vs Purchase Invoice Number.** Bill Number is LEDGERS' own sequence
  (`2026-31`, given on create, [`lib/billNo.ts`](src/lib/billNo.ts)); Purchase Invoice Number is
  the supplier's. Not created yet → Bill Number shows "—".
- **The Bharat Connect "B".** A purchase invoice created from Bharat Connect carries the
  Bharat Connect mark in its own narrow column right after Status, centred, so it lines up down
  the list. It's a marker only — the bill number and its sequence are untouched.

**Create Purchase Invoice from Bharat Connect** (`/expenses/bills/:id/create`,
[`BcBillCreatePage.tsx`](src/pages/invoices/BcBillCreatePage.tsx)) — LEDGERS' Create Purchase
Invoice, prefilled from the supplier's invoice (amounts, quantities and taxes locked):

- **Vendor block as on LEDGERS**: Vendor | Billing Address | Shipping Address. Vendor shows
  the matching LEDGERS contact (by B2B ID or GSTIN) or the invoice's own details, then
  `GSTIN: …` and `B2B ID: …`. No remove — the vendor is whoever sent it. When no address is on
  file, the state comes from the GSTIN.
- **Bill No** is LEDGERS' next number; **Invoice No** is the supplier's.
- **Items.** Each line shows the supplier's item name, with its catalog match underneath:
  ✓ In catalog / ✓ Catalog: *name* / ● Possible match: *name* · Review / ● Not found in catalog ·
  Review / ✓ Will be added to catalog. Matching ([`lib/itemMatch.ts`](src/lib/itemMatch.ts)):
  a link saved from an earlier bill → same HSN and same name → a likely match by name
  similarity (same HSN, or a close name without HSN), preselected but confirmed by the user →
  otherwise nothing is chosen. Lines never default to "new item".
- **Review popup** ([`BillItems.tsx`](src/pages/invoices/BillItems.tsx)) goes in order: the match
  we found (one click to confirm, **Change** to pick another) → a short catalog search ranked by
  HSN and name (top 5) → **+ Add new item** (top right). The new-item form is prefilled from the
  bill and asks for HSN/SAC, GST rate, units and **Account Type** — all required by LEDGERS.
  "Remember for future bills" links the supplier's item to ours for next time.
- **Account type.** LEDGERS posts each line to an account (the catalog item's Purchase
  **Expense Type**, a chart-of-accounts ledger). Existing items are mapped to their own; a new
  item gets one chosen in the popup, preselected from an item with the same HSN, else from the
  HSN/SAC (freight → Freight Inward, packing → Packing Materials, services → Professional
  Fees), else Purchases. It's saved on the new catalog item and on the invoice line.
- **Remarks** (`buyerRemarks`, required): a right-aligned box in the totals column, half its
  width, growing with the text; 1–100 characters and no `"` (API spec, `reqConfirmInvoice`).
- **Create Purchase Invoice** creates the bill in LEDGERS (new items added to Catalog), accepts
  it on Bharat Connect, and lands back on the Purchase Invoices list with the new invoice on
  top, highlighted. **Reject** stays on the Bharat Connect strip above; a rejected invoice
  never becomes a LEDGERS bill.

**After Accept** (handbook Annexure H): the buyer can't edit, reject, return or cancel on Bharat
Connect — only pay (on/off platform) and raise a debit note (§5.12). Delete in LEDGERS is
blocked with "Raise a debit note instead" ([`lib/editRules.ts`](src/lib/editRules.ts)).

**Printed invoice**: a document that went over Bharat Connect prints `B2B ID: …` under the
issuer's GSTIN — the supplier's on a bill, ours on a sales invoice.

## Mocked endpoints and what drives them

Every function in [`src/mock/api.ts`](src/mock/api.ts) simulates a network call with
400–1100ms of random delay (jitter, not a fixed number, per screen). Store actions in
[`src/store/useStore.ts`](src/store/useStore.ts) call these and then update state; UI
re-renders from that state. Nothing here is a real request.

| Mock endpoint | Called by | Drives |
|---|---|---|
| `POST /bharatconnect/lookup` | `mockLookupConnectionStatus` | Stands in for the PAN/GSTIN lookup on login/business-switch (state itself is set via the dev panel in this prototype rather than a real lookup) |
| `POST /bharatconnect/ownership/verify` | `verifyOwnership` (store) | The connect flow's OTP step, when ownership isn't already verified |
| `POST /bharatconnect/ids/link` | `linkExistingId` (store) | The `existing_id_found` one-click link action, from the banner, chip, or dedicated page — also adds the found ID as the business's Default ID. (Not a handbook API: the handbook's path is `reqCheckEntity` → proceed with existing details; see Not built yet) |
| `GET /bharatconnect/ids/check?ending=` | `mockCheckEndingAvailability` | The "Create ID" drawer's live availability check (rejects `USED`/`TEST` as taken, for demo purposes) |
| — (client-side, no call) | `submitConnect` (store) | The connect flow's in-place progress morph: sending → creating ID → waiting for confirmation → success, ending with a real ID generated by `id-standard.ts` and the business flipped to `connected` |
| — (client-side) | `simulateWebhookConfirm` / `simulateWebhookReject` (store) | The dev panel's webhook buttons — confirm flips `setting_up`→`connected`; reject flips any state→`needs_attention` with a rejection pinned to the settlement-account field |
| — (client-side) | `uploadKycDocument` (store) | Profile page's document upload: sets `uploaded` immediately, then `verified` after a further 1.8–2.6s, simulating Bharat Connect's own async review |
| — (client-side) | `devRequestKycDocument` (store) | The documents dialog's "Dev · Simulate re-request" — flips a verified document back to `requested` and reopens its upload control |
| — (client-side) | `setVerificationLevel` (store) | Dev-panel-only. Recomputes `invoicing`/`payments` flags from the level, same as a real level change would |
| — (client-side, per-field) | `useProfileForm`'s `doSend` | The profile save bar's send pipeline — resolves to success, or (when armed via the dev panel's "Profile page — next save", stored as `devProfileSaveOutcome`) a field-specific rejection or a version-conflict merge |
| `POST /contacts/otp/send` / `POST /contacts/otp/verify` | `mockOtpSend` / `mockOtpVerify` | Wired but not currently called from any screen — reserved for a future "verify new contact before adding to draft" flow |
| — (client-side) | `sendInvoiceViaBharatConnect` (store) | Send / Send Again / Retry, everywhere they appear — sending → sent+pending, then resolves via the dev panel or `simulateInvoiceConfirmation` |
| — (client-side) | `respondToBill` (store) | Accept/Reject on a bill — on Accept, links each line to a catalog item (adding new ones with their account type) and saves "remember" links per supplier |
| — (client-side) | `createPurchaseFromBc` (store) | Create Purchase Invoice from Bharat Connect — Accept with `buyerRemarks`, then books the bill with LEDGERS' next bill number |
| — (client-side) | `devReceiveBill` / scenario loader (store, dev panel) | A supplier sending a bill (Awaiting Response), or one of the eight bill-item scenarios |
| — (client-side) | `createInvoice` (store) | Create Invoice/Bill submit — never sends; the page then opens the new document for review |
| — (client-side) | `simulateInvoiceConfirmation` (store) | Dev-panel-only — plays the buyer's side of a sent sales invoice (Accept/Fail) |
| — (client-side) | `inviteToBharatConnect` (store) | Every "Invite to Bharat Connect" CTA (invoice send column, view pages, contacts) |
| — (client-side) | `requestContactDetails` (store) | Mocks `reqNonPublicInfo` — "Request contact details" on a Bharat Connect-matched contact, since email/mobile aren't returned by search |
| — (client-side) | `createContact` (store) | Create Contact submit — auto-invites when the GSTIN check found no B2B ID and the (default-checked) invite box is still ticked |
| — (client-side) | `snoozeInvoiceBanner` (store) | The pending-actions banner's dismiss — 3-day snooze, tracked per page (`invoiceBannerSnoozedUntil` / `billsBannerSnoozedUntil`) |
| `lookupGstRegistry` / `lookupBcByGstin` ([`mock/seed.ts`](src/mock/seed.ts)) | Create Contact's GSTIN box | Two separate synchronous mock lookups — native GST autofill (always) vs. Bharat Connect status (connected-only) |

## Design decisions worth knowing about

- **The profile page was redesigned mid-build.** It started as a 6-tab step wizard (matching
  the original reference mockups), then was rebuilt as a single scrollable page with a
  sticky save bar and an explicit field-permission model, because the tabbed version added
  friction disproportionate to what most visits here actually need (one or two field
  changes). The route (`/settings/bharatconnect/profile/*`) still accepts the old tab-shaped
  paths (`business_details`, `settlement_accounts`, etc.) and maps them to a scroll-to
  target, so links from other screens didn't need to change.
- **Verification levels are numbered on screen** ("Verified for Level 2") rather than
  described only by capability, per direct feedback — the capability breakdown lives in the
  hover tooltip instead.
- **The Level-3 document flow is opt-in, not automatically inline.** It's reached through the
  header's "Reach Full Verification" button and a dialog, rather than a card that appears in the page flow once Level 2 is
  complete, to avoid pushing every Level 2 user into a KYC document checklist they may not
  be ready for yet.
- **useReducer per business.** The profile form is keyed by `business.id`
  (`<ProfilePageInner key={business.id} .../>`) so switching businesses in the dev panel
  fully remounts the form state — `useReducer`'s initializer only runs once per mount, so
  without the key a previous business's draft would leak into the next one.
- **Invoices/Bills share one component tree, parameterized by `kind`.** Rather than two
  near-identical page sets, `InvoiceListPage`/`InvoiceViewPage`/`InvoiceCreatePage` all take
  `kind: "sales" | "purchase"` and a small `kindConfig.ts` supplies the copy/labels that
  differ (page title, "Customer" vs "Supplier", stat-card labels). A fix ships to both sides
  at once.
- **The Bharat Connect UI is always additive, never a fork.** Every augmented screen renders
  the exact native layout first; Bharat Connect elements are conditionally inserted into that
  same layout rather than swapping to a different component tree, so "not connected" is
  never a degraded or placeholder experience — it's just the real screen.
- **Not on Bharat Connect gets an Invite CTA, not a dead end.** Wherever a send action is
  unavailable because the counterparty has no B2B ID, the affordance right there is to
  invite them — never just a disabled control with no next step.
- **Create → review → send, never auto-send.** Creating an invoice used to be able to send it
  in the same click (a "Send via Bharat Connect" checkbox on the Create page). Now nothing
  reaches a buyer unreviewed: every invoice lands on its view page first, and sending is a
  deliberate click from there.
- **One call to action per page.** Where the same action could appear in several places
  (Send, Invite, Connect), only one copy is the filled button; the rest step back to outline
  or plain status text. Follows the LEDGERS design system's "one filled button per view".
- **LEDGERS design system, hand-built components.** The theme is the design system's own
  `globals.css`; components in `src/components/ui/` are thin typed wrappers over plain HTML
  elements using the design system's class recipes (no shadcn CLI / Radix), which keeps
  dependencies to one addition (`sonner`). Toasts are top-right per LEDGERS convention.
- **Contact details follow the actual API contract, not a shortcut.** The partner handbook
  is explicit that `reqSearchEntity` doesn't return non-public info like email/mobile — that
  needs a separate consent-based `reqNonPublicInfo` request. Rather than fake an instant
  autofill, Create Contact mocks that real two-step shape (search → optional request →
  pending approval).

## Phase 1 scope: invoices and bills (decided 10-10-2026)

Phase 1 ships **Accept / Reject** only. Return, Edit & Resend and version history move to Phase 2,
because they need backend work (versioning, new tables). In the prototype they're built but switched
off in [`src/lib/phase.ts`](src/lib/phase.ts) (`PHASE2.buyerReturn`, `PHASE2.editAndResend`).

**Handbook check (R3.8).** §5.2 and §5.4 describe Return and Edit as things a business "can" do,
under "Suggested Steps"; there is no minimum feature list for a platform. What the handbook *does*
require is that the receiving platform stores and displays every incoming status change or edit
(#4.2 respConfirmInvoice, #4.3 reqEditInvoice, #4.4 reqStatusChangeInvoice). Annexure H: "Version
will change only if there was an edit", so invoices we never edit stay at version 1. To confirm
with NBBL during certification: that Return and Edit aren't expected for go-live.

| | Phase 1 (our users can do) | Must still handle (sent by other platforms) | Phase 2 |
|---|---|---|---|
| **Invoices** (we're the supplier) | Send; Cancel (from Sent To Buyer, Returned or Rejected) | Buyer accepts, rejects or **returns** our invoice: show the status and comment. After a return, the action is Cancel (and create a corrected one); the buyer may still accept or reject it | Edit & Resend (`reqEditInvoice`), "Revised · vN" label |
| **Bills** (we're the buyer) | Accept / Reject, comment required | Supplier **edits** the bill: replace it in place, store the current version, back to Awaiting Response. Supplier **cancels** it: show Cancelled with the reason | Return (`buyerResponse = RETURN`), version history |

Backend for Phase 1: status + remarks on each invoice/bill and **one current-version field** for
incoming edits. No version-history table.

In the prototype: a sent invoice's Edit is disabled with "Sent on Bharat Connect. Cancel it and
create a new one."; the bill card shows Accept / Reject; the bills filter drops Returned and adds
Cancelled. Dev panel → General → "Simulate buyer response" still includes Return (an incoming case),
and Dev panel → Purchase → "Simulate supplier (incoming)" plays a supplier editing or cancelling a bill.

## Role-based access (decided, in development)

**Decision (10-10-2026): Bharat Connect reuses LEDGERS' existing role permissions (Users & Roles →
Role Permissions). No separate Bharat Connect permission group.** Developers are building this in
LEDGERS now; the prototype doesn't enforce roles yet (everyone acts as Admin).

LEDGERS today: a user is **Admin** (everything) or **Custom** (a named role, e.g. "TECH", with
All / View / Create / Update / Delete ticked per module, grouped as Business, Sales, Purchase,
Banking, Accounting, Taxation, Settings, HR, Docs, Workspace, June). The partner handbook has no
rules for user roles inside a business, so this is LEDGERS' call.

| Bharat Connect action | Covered by existing permission |
|---|---|
| Send an invoice via Bharat Connect, Edit & Resend, Cancel | Sales → Invoice → **Update** |
| Accept / Return / Reject a bill received over Bharat Connect | Purchase → Bill → **Update** (Accept also creates the LEDGERS bill, so it needs **Create** too) |
| Onboard, edit the Bharat Connect profile, create / deactivate B2B IDs, disconnect | **Settings → Bharat Connect** (one new row in the existing Settings group, next to Sales, Purchases, Taxation, Payments, June) |
| See Bharat Connect statuses, badges and activity on invoices / bills | View on the same module (Sales → Invoice, Purchase → Bill) |

Trade-off accepted with this option: anyone who can update a bill can also accept, return or reject
it on Bharat Connect, which the supplier sees. A dedicated "Bharat Connect" group with its own
actions (like Banking's Credit / Debit / Fund Transfer / Max Limit columns) was considered and not
taken for now; it remains the path if finer control (or a payments limit in Phase 2) is needed.

## Reference documents (R3.8)

Rules in the prototype are checked against NBBL's R3.8 pack, which isn't stored in this repo.
References below use these short names:

| Short name | Document |
|---|---|
| **HB** | Partner development and integration handbook v1.8 (R3.8). `HB §5.4` = Section A §5.4; `HB A§4.2` = Annexure A §4.2; `HB Ann. H` = Annexure H |
| **SW** | B2B Swagger, Release 3.8 v1.30 (`b2bSwagger_Release3.8_v1.30.json`) — schema names in `code` |
| **XL** | Per-API Excel sheets, R3.8 (e.g. `ReqStatusChangeInvoice.xlsx`) |
| **RN** | Release Note 3.8 v1.0 |
| **EC** | Error code and message v4.16 |
| **SPEC** | `docs/BharatConnect_LEDGERS_Spec_v1.0.docx` (29-Sep-26, product spec) |
| **ONB** | `docs/BharatConnect_Onboarding_APIs_v1.0.docx` (03-Oct-26, onboarding tech handover) |

## Flow audit against R3.8 (13-10-2026)

Every Bharat Connect flow in the prototype, checked against the references above. Verdicts:
**✓** matches · **◐** partly / needs a change · **✗** conflicts with a reference ·
**◇** LEDGERS' own choice — the references are silent, so it's ours to decide.

### How every Bharat Connect call works (applies to all flows)
Every API is a POST that returns only an **Ack/Nack within 5 s**; the business result arrives
later on LEDGERS' webhook as `respXxx`, **within 180 s** (HB Ann. E). No response → `reqCheckStatus`
by `txn.id` (HB Ann. P). Two-party flows (invoices, notes, POs, payments) are relayed by the central
unit to the other business's **primary AI**, and other AIs of the same IDs get a broadcast copy they
must not reject (HB Ann. O). Before sending and after receiving anything, run the common checks:
AI/OU IDs valid, business mapped to the AI, mandatory fields, formats, duplicate `txn.id` (HB Ann. B).

**What this means for the UI:** every action that sends something has three outcomes — accepted by
the network (Ack), succeeded, failed — and a "still waiting" state that can last up to 3 minutes. The
prototype collapses this to one short mocked delay. Production screens need a visible pending state
for every action (◐, see the bill Accept finding below).

### 1. Onboarding and connection
| | |
|---|---|
| **What** | Connect a business to Bharat Connect: create its business record and default B2B ID, or link one that already exists |
| **Where** | Dashboard banner, top-bar chip, Settings → Bharat Connect (§1–§3 above) |
| **When** | On login / business switch LEDGERS checks the PAN (`reqCheckEntity`); the user starts it from the banner or chip |
| **How** | `reqCheckEntity` → `reqCheckId` → `reqRegEntity` → `respRegEntity` + `respEntityKyc`; existing ID: `reqMapEntity` → `reqFetchEntity` (ONB §2.4, §4) |

| Decision | Reference | Verdict |
|---|---|---|
| Six connection states and how each is entered | ONB §4.1 | ✓ (SPEC 6.1 still shows "ID found" as blue; the code and ONB use orange) |
| Skip the OTP step when LEDGERS already verified ownership | HB Ann. Q L1(b): **every** mobile and email sent must be OTP-verified | ◐ fine for contacts verified at LEDGERS sign-up; any other contact sent in `reqRegEntity` still needs an OTP |
| Onboard at Level 1 (`verificationLevel` "1") | HB Ann. Q: tag values 1 / 3 / 5; **if the tag is left out it is treated as 5 (full due diligence)** | ✓ — always send the tag |
| Non-sole-props: one business per PAN; sole props may create several | HB §1.1 notes 2–3 | ◐ "ID found" offers only *link*; the sole-prop *create a new business* and *edit existing details* options aren't built (already in Not built yet) |
| Default bank account linked to the default B2B ID | HB §1.1 note 4, Ann. R | ✓ |
| Disconnect = deactivate the business for this AI–OU pair | HB §1.5 (`reqActivateEntity`) | ◇ the "blocked while invoices are unpaid" rule is LEDGERS' own; SPEC open question 6 still open |
| Linking an existing business via `reqMapEntity` / `reqFetchEntity` | In SW only, not described in HB Ann. A | ◐ confirm with NBBL (ONB open question 1) |

### 2. B2B IDs
| | |
|---|---|
| **What** | The business's default ID, extra IDs, deactivate / reactivate |
| **Where** | Settings → Bharat Connect → IDs, Create ID drawer |
| **When** | Default ID at onboarding; extra IDs any time after |
| **How** | `reqCheckId` (availability), `reqRegId` (create), `reqEditId` (edit, privacy, primary AI, (de)activate) — HB §1.2, §1.4 |

| Decision | Reference | Verdict |
|---|---|---|
| Company IDs are `PAN@BCB` / `GSTIN@BCB` ([`id-standard.ts`](src/lib/id-standard.ts)) | HB Ann. F: an ID "should be derived from registered business name or acronym of first letters of registered business name"; SW only limits length (`b2BId` 3–256, no `"`) | **✗** No reference in the R3.8 pack defines `PAN@BCB`. It also puts the PAN in a public ID. **Find the source of this standard or switch to a name-based ID** (e.g. `STOCKHOLDING@BCB`, `SHCIL.MUMBAI@BCB`) |
| Sole-prop `AAAA.BBBB.CCCC.DDD@BCB` | HB Ann. F (name-based ✓); the PAN-digits part isn't in any reference | ◐ same source question |
| Ending rules: 2–5 letters/digits, no offensive words, no platform names | HB Ann. F: avoid offensive or generic terms; no AI/OU or brand name | ✓ (length 2–5 is ours ◇) |
| Many IDs per identifier; one ID across identifiers | HB §1.2 notes 1–3 | ✓ |
| Deactivation blocked while the ID has open invoices / financing | Not in HB (§1.4 only says a deactivated ID can't transact) | ◇ |
| `reqEditId` needs privacyType, **reason, description**, primaryAI, businessIdentifier | RN (reqEditId fields now mandatory) | ◐ the Deactivate action has no reason / description field yet |

### 3. Profile and verification levels
| | |
|---|---|
| **What** | Keep the business record on Bharat Connect current; show what the business can do at its level |
| **Where** | Settings → Bharat Connect → Profile, documents dialog |
| **When** | Any time after connecting |
| **How** | `reqEditEntity` — **send the full record, not just the changed fields** (HB §1.3); level changes also via `reqEditEntity` (HB Ann. Q) |

| Decision | Reference | Verdict |
|---|---|---|
| Level 1 = send and receive invoices; Level 2 = pay on-platform; Level 3 = receive on-platform payments | HB Ann. Q action table (on-platform payment: payer L2, payee L3; invoices L1 both sides) | ✓ |
| Level 2 checklist: ownership + bank penny-drop | HB Ann. Q L2: PAN verified, **every identifier given** verified, ownership via mobile/email linked to PAN/GSTIN/Udyam, bank penny-drop **only if a bank account was given** | ◐ add "PAN and all identifiers verified"; make bank conditional |
| MCC hidden below Level 2, **required from Level 2** ([`BusinessSection.tsx`](src/pages/settings/bharatconnect/profile/sections/BusinessSection.tsx)) | HB Ann. Q: MCC mandatory only when `verificationLevel` is 5 (**Level 3**); bank details mandatory at 5; address optional | **✗** require MCC (and a bank account) only for Level 3 |
| Payment address shown as `pan.ending@bcb` ([`profile.ts`](src/lib/profile.ts)) | HB Ann. I: first 4 of PAN + first 4 of IFSC + last 4 of account + count digit, e.g. `ABCDPUNB00131` | **✗** use the Annexure I format |
| Keep logs proving each verification | HB Ann. Q ("maintain the logs") | ◐ backend requirement — ONB §8 lists it |
| Field permissions, tier-2 confirmation, save bar | Not in HB | ◇ |

### 4. Contacts: search and invite
| | |
|---|---|
| **What** | Find a counterparty's B2B ID; ask for their contact details; tell them you're on Bharat Connect |
| **Where** | Create Contact (Autofill from GSTIN), Contacts list and view, Invite links on invoices |
| **When** | Adding or editing a contact; before sending the first invoice |
| **How** | `reqSearchEntity`, `reqNonPublicInfo` / `reqShareNonPublicInfo`, `reqSendInvite` (HB §2.1–2.4) |

| Decision | Reference | Verdict |
|---|---|---|
| Store the found B2B ID on the contact; don't search every time | HB §2.1 notes 2–3 | ✓ |
| Contacts checked and not found stay "not on Bharat Connect" | HB §2.1 note 4: **search again periodically** for counterparts not yet on the network | ◐ add a periodic re-check (and SPEC/ONB open question 6 for our own PAN) |
| Email / mobile only through a consent request | HB §2.2–2.3 | ✓ |
| Answering others' `reqNonPublicInfo` | HB §2.3: show the request; offer auto-reply for chosen fields | ◐ not built (we only send requests) |
| Invite = for counterparts **not** on Bharat Connect | HB §2.4: invite mainly tells a counterpart **already found** that you're on it too; **send it automatically when a B2B ID is added to the master**; with no receiver ID it's broadcast to all AIs | ◐ add the automatic invite when a contact with a B2B ID is saved; keep the broadcast invite for the not-found case |
| Search limit and search before onboarding | RN: `reqSearchEntity` returns at most **50** (make it configurable); search allowed **without a B2B ID** (use the AI ID) | ◐ could show "N of your contacts are already on Bharat Connect" on the connect page |

### 5. Sales invoices (we are the supplier)
| | |
|---|---|
| **What** | Send a LEDGERS sales invoice to the buyer; cancel it while allowed |
| **Where** | Sales → Invoices list / view (review-and-send callout, Bharat Connect card) |
| **When** | After Create, by a deliberate Send; Cancel while Sent To Buyer, Under Review or Rejected |
| **How** | `reqSendInvoice` → buyer AI validates → `respSendInvoice`; buyer answers with `reqConfirmInvoice`; Cancel via `reqStatusChangeInvoice` (`supplierAction` CANCEL, `supplierRemarks` 1–100) — HB §5.1, §5.3, A§4.1–4.4 |

| Decision | Reference | Verdict |
|---|---|---|
| Create never sends; Send is a separate click | Not in HB | ◇ |
| Statuses: Sent To Buyer / Accepted / Returned (Under Review) / Rejected / Cancelled / Failed | HB Ann. H; SW `statusTransition` | ◐ also needs **Closed, Abandoned, Partially Paid, Fully Paid, Payment Initiated** once payments or close/abandon exist. "Failed" = `respSendInvoice` FAILURE or timeout (HB Ann. E), not a buyer decision |
| Cancel only from Sent To Buyer / Under Review / Rejected; Accepted → credit note | HB Ann. H; XL `ReqStatusChangeInvoice` | ✓ |
| Phase 1: no Edit & Resend; e-invoices never editable | HB §5.2 note 3, A§4.3 ("edits only to a regular invoice") | ✓ (Phase 2 switch in [`phase.ts`](src/lib/phase.ts)) |
| Close / Abandon (e.g. paid outside, written off) | HB Ann. H, XL (`supplierAction` CLOSE / ABANDON) | ◇ not offered in Phase 1 |
| Before sending: totals add up; supplier name/GSTIN match onboarding; only our own bank VPA | HB A§4.1(i) 4–5 | ◐ backend validations to build |
| Reminders | HB §6: max **3 per invoice**; the receiver must show them and offer mute | ◐ not built |

### 6. Bills (we are the buyer)
| | |
|---|---|
| **What** | Receive a supplier's invoice, create it as a LEDGERS purchase invoice (= Accept) or Reject it; follow supplier edits, cancels, closes |
| **Where** | Purchase Invoices list → Bharat Connect view → Create page (§9 above) |
| **When** | When `reqSendInvoice` arrives on our webhook; the user acts on it from the Bharat Connect view |
| **How** | Receive `reqSendInvoice` → validate → **send `respSendInvoice`** → user Accepts/Rejects → `reqConfirmInvoice` (`buyerResponse`, `buyerRemarks` 1–100) → `respConfirmInvoice` from the supplier's AI (HB §5.1, §5.4, A§4.1–4.2) |

| Decision | Reference | Verdict |
|---|---|---|
| A received invoice isn't a LEDGERS bill until created; creating it = Accept | Not in HB (HB only requires storing and showing it, A§4.1(iii) 6) | ◇ |
| **Accept books the bill immediately** ([`useStore.ts`](src/store/useStore.ts) `createPurchaseFromBc`) | HB §5.4, A§4.2: status becomes ACCEPTED only when `respConfirmInvoice` arrives (up to 180 s; HB Ann. E) | **✗** show "Accepting…" and **book the bill only on SUCCESS**; on FAILURE keep it waiting with the error |
| On receiving, LEDGERS validates and answers `respSendInvoice` | HB §5.1 step 5, A§4.1(iii): objectId, B2B IDs belong to our business, totals add up, statuses per Ann. H | ◐ not modelled — every incoming invoice is assumed valid |
| Reject needs a reason | SW `invoiceConfirmation.buyerRemarks` required, 1–100, no `"` | ✓ (SPEC P0-5 and open question 2 are superseded: the API requires it) |
| Accept / Reject from Sent To Buyer or Under Review; Return is Phase 2 | HB Ann. H; XL `ReqConfirmInvoice` | ✓ |
| Supplier edit → replace in place, back to waiting; supplier cancel → Cancelled | HB Ann. H; XL `ReqStatusChangeInvoice` | ✓ |
| Supplier **Close / Abandon** | XL `ReqStatusChangeInvoice`: allowed from Sent To Buyer, Under Review, **Accepted**, Partially Paid | **✗** not handled — a bill waiting on us or already booked can become Closed / Abandoned; show it, and stop offering Create on a closed one |
| Line amounts recomputed as price × qty × GST% (exclusive) | SW `itemLists` carries the supplier's `assessmentAmount`, `itemValueDetails`, `totalItemValue`; `transactionDetails.isItemAmtTaxInclusive` (default NO) | **✗** use the supplier's amounts and honour tax-inclusive invoices, or totals can differ by rounding |
| Item name always present | SW `itemLists.productDescription` is **optional** (`itemCode`, `hsnCode`, `gstRate`, `unit` too) | ◐ fall back to item code / HSN in the Item column and matching |
| Taxability of new catalog items | RN: `itemLists.gstTaxType` (TAXABLE, EXEMPT, ZERO, NIL, NONTAXABLE, NONGST, SCHEDULEIII; default TAXABLE) | ◐ carry it onto the new item (LEDGERS' Non-Taxable field) |
| Reverse charge | SW `transactionDetails.reverseChargeTax` | ◐ prefill LEDGERS' "Reverse Charge" page setting |
| Incoming supplier **debit notes** sent as invoices | XL `ReqSendInvoice`: invoice `type` NEW / DEBIT NOTE, linked via `precedingInvoiceDetails` | ◐ label them and link to the original bill |
| Account type per line (new items ask; existing items mapped) | Not in HB — LEDGERS needs it to post the bill | ◇ |
| LEDGERS bill number + supplier's invoice number; Bharat Connect "B" marker | Not in HB (`supplierInvoiceNumber` max 50) | ◇ |
| After Accept: no edit / reject / return / cancel; delete blocked → debit note | HB Ann. H, §5.12 | ✓ |
| Fetch a supplier's open invoices | HB §5.17 (`reqFetchInvoice`) | ◇ optional, not built |

### 7. Payments, notes, POs (Phase 2 and later)
On-platform payment needs payer Level 2 and payee Level 3; **off-platform payment needs only Level 1**
(HB Ann. Q). RN makes the UTR optional for off-platform payments. Credit / debit notes must link to an
invoice and can't be edited (HB §5.9–5.14, Ann. L). POs follow Ann. K. None are built.

### Open questions from the working notes, answered
1. **Should a bill (or sales invoice) the counterparty rejected go to GST filing?** Bills: a rejected
   received invoice is never booked, so it's not in the purchase register; it may still show in
   GSTR-2B from the supplier's filing, which is a reconciliation item. Sales: a rejected invoice stays a
   LEDGERS invoice until we **cancel** it (HB Ann. H) — only then delete it or, if already in GSTR-1, raise
   a credit note ([`editRules.ts`](src/lib/editRules.ts)). The handbook is silent on GST; this is ◇.
2. **Does recording payment with a native LEDGERS receipt cause issues?** Nothing reaches Bharat
   Connect, so the counterparty keeps seeing *Accepted*. Fix: when a receipt/payment is recorded against
   a Bharat Connect invoice, send an **off-platform `reqPay`** (Level 1 is enough; UTR optional per RN). The
   invoice then moves to Payment Initiated until the supplier confirms (HB Ann. H).
3. **Is LEDGERS' payment gateway discarded for Bharat Connect payments?** No — on-platform payment is a
   separate flow (Level 2 payer / Level 3 payee). Off-platform covers everything else, including LEDGERS'
   gateway, as long as it's reported with `reqPay`.
4. **Rejected / cancelled vs deleted in LEDGERS?** Cancelled = deleted in LEDGERS (soft delete, kept for the
   record). Rejected = still a document until the supplier cancels it. SW also lists a `DELETED` invoice
   status that HB doesn't describe — confirm with NBBL.
5. **Accounting for bills created from Bharat Connect?** Each line posts to the catalog item's account
   type (Expense Type); new items get one chosen in the Review popup (§9). Still to do: add the supplier to
   Contacts for the payable, and use the supplier's own tax split (finding above).

### Fixes, in priority order
| # | Fix | Why | Reference |
|---|---|---|---|
| 1 | Book a bill only after `respConfirmInvoice` SUCCESS; show "Accepting…" | Otherwise a failed Accept leaves a bill in the books | HB §5.4, A§4.2, Ann. E |
| 2 | Confirm the B2B ID standard with NBBL; if none, switch to name-based IDs | `PAN@BCB` has no source in R3.8 and contradicts Ann. F | HB Ann. F |
| 3 | Handle supplier Close / Abandon on bills | Valid incoming statuses we don't show | XL `ReqStatusChangeInvoice`, HB Ann. H |
| 4 | Use the supplier's line amounts, tax split and tax-inclusive flag | Totals must match the supplier's invoice | SW `itemLists`, `transactionDetails` |
| 5 | Validate incoming invoices and send `respSendInvoice` | Required of the buyer's platform | HB §5.1, A§4.1(iii) |
| 6 | MCC and bank account required only at Level 3 | Over-asks Level 2 businesses | HB Ann. Q |
| 7 | Payment address in Annexure I format | Wrong format shown | HB Ann. I |
| 8 | Off-platform `reqPay` when a payment is recorded | Counterparty never sees payments | HB Ann. H, Ann. Q, RN |
| 9 | Auto-invite when a contact with a B2B ID is saved; periodic re-search of not-found contacts | Handbook asks for both | HB §2.1 note 4, §2.4 note 1 |
| 10 | Optional item name, `gstTaxType`, reverse charge, debit-note-type invoices on the create page | Fields the API can send | SW, RN, XL `ReqSendInvoice` |
| 11 | Reason + description on ID deactivation | Now mandatory in `reqEditId` | RN |
| 12 | Receiving reminders (show, mute) and answering `reqNonPublicInfo` | Receiver duties | HB §6.1, §2.3 |

### Questions for NBBL (certification)
1. Source of the `PAN@BCB` / `AAAA.BBBB.CCCC.DDD@BCB` ID standard, given HB Ann. F.
2. `statusTransition.newStatus` in SW lists `REJECTED` twice and no `CANCELLED`; and what is the `DELETED` status?
3. Is `reqMapEntity` + `reqFetchEntity` the way to link an existing business (ONB open question 1)?
4. Are Return and Edit expected for go-live (see Phase 1 scope)?
5. Where is Public / Private set for the default ID at onboarding (ONB open question 3)?

### Where SPEC v1.0 is out of date
SPEC predates the Bills work. Superseded points: bills are accepted by **creating** them, not from list
icons (6.8, P0-5); Reject needs a reason (open question 2 — the API requires it); "Failure" on a bill is
now "Rejected"; the Create page no longer ticks "Send via Bharat Connect" (6.8); Bills have their own
Bharat Connect view instead of an inline column (6.8, P0-6); Return / Edit are Phase 2 (Phase 1 scope).

## Not built yet

- The profile page's contact fields don't yet require OTP verification before a new
  phone/email is added to the draft (the mock endpoints for it exist and are wired into
  `mock/api.ts`, just not called from the UI).
- Contacts' Billing Address and Tax Information tabs, and the view page's Account Statement /
  Transaction / Documents / Notes / Activity Log tabs, are placeholders ("add this after
  creating the contact" / "No data available") — only the Information tab is fully wired.
- The "reqNonPublicInfo" request in Contacts stops at "request sent" — there's no simulated
  counterparty response that actually fills in the email/mobile fields afterward.
- No persistence across a hard reload — all state lives in the Zustand store in memory.
- **Purchase Invoices list**: the sort icons and the status chevron are visual only (no sorting,
  no status menu), and there's no way to see deleted bills since the Active / Deleted toggle
  gave way to the Bharat Connect button. Amounts use the Indian grouping (`6,72,600`); live
  LEDGERS shows `672,600`.
- **Account type for Sales-only items**: a Sales-only item bought for the first time gets a
  preselected account type without being asked.
- **Supplier as a contact**: creating a bill from a supplier who isn't in Contacts doesn't add
  them yet, so there's no party to post the payable to.
- **Debit note** from an accepted bill (§5.12) isn't built; the Delete tooltip points to it.
- **Handbook-aligned "ID found" flow (deferred).** Per the partner handbook (Annexure A §1.1,
  `reqCheckEntity`), when a PAN is already registered LEDGERS should first show the
  business's public details from Bharat Connect, then offer *proceed* / *edit existing
  details* / (sole proprietors only) *create a new business*, with consent and PAN/user
  verification before the check. It should also ask whether LEDGERS becomes the ID's
  **primary AI/OU** (§1.9 `reqEditId`; Annexure O — inbound invoices are delivered to the
  primary AI). The prototype keeps the one-click link for now. How LEDGERS attaches to a
  business onboarded through another platform needs confirming with NBBL.
- **Ownership rule (deferred).** The LEDGERS sign-up OTP (mobile + email) covers Level 1's
  "OTP on the contacts provided", but not Level 2's ownership check ("mobile/email linked
  with PAN/GSTIN/Udyam") unless the verified contact matches the GST/PAN record or the
  business has completed the GSTN connection. Both seeded businesses hard-code
  `ownershipVerified: true` today; it should record which route verified it.

## Design system restyle

In progress. The LEDGERS design-system theme and shared components are in place everywhere,
so unconverted screens already use the LEDGERS palette (blue primary, neutral canvas) through
temporary aliases for the old token names (`ink`, `body`, `faint`, `canvas` in `index.css`,
to be removed once every screen is converted).

| Area | Status |
|---|---|
| Theme, fonts, shared `ui/` components, Sonner toasts | Done |
| App shell — sidebar, top bar, Bharat Connect status chip | Done |
| Bharat Connect profile page (+ documents dialog, level badge) | Done |
| Invoice view — review-and-send callout | Done (rest of the page not yet restyled) |
| Purchase Invoices list, Create Purchase Invoice from Bharat Connect, Contacts, Catalog | Done (matched to live LEDGERS) |
| Dashboard, Sales Invoices list + view + create, Connect flow, Overview, IDs page | Not yet |

Design and plan notes: [`docs/superpowers/specs/2026-09-29-ledgers-ds-restyle-design.md`](docs/superpowers/specs/2026-09-29-ledgers-ds-restyle-design.md),
[`docs/superpowers/plans/2026-09-29-ledgers-ds-restyle.md`](docs/superpowers/plans/2026-09-29-ledgers-ds-restyle.md).

## File map

```
src/
  types/            Shared TypeScript types for the whole domain model
  mock/             seed.ts (businesses, invoices, contacts, GST/BharatConnect lookup tables),
                     api.ts (mocked network calls)
  index.css          LEDGERS design-system theme (tokens, radii, 13px control text) + temporary
                     aliases for the old token names
  lib/               id-standard.ts (B2B ID generation, existingIdFor), status.ts (connection-state
                     metadata), invoiceStatus.ts (status labels/pill classes), profile.ts (MCC
                     list, pincode validation, payment-address generation), cn.ts (class joiner),
                     itemMatch.ts (bill line → catalog matching, account type suggestion),
                     billNo.ts (LEDGERS' next bill number), editRules.ts (edit / delete rules
                     from Annexure H), phase.ts (Phase 2 switches)
  store/useStore.ts  Single Zustand store — business/connection/profile/invoices/contacts/
                     toasts/dev-panel state, all in one place
  components/
    ui/              Design-system building blocks: button (+ button-variants), badge, input
                     (Input/Select/Checkbox/Label), card, dialog (Dialog + Sheet), tabs
                     (Tabs + ToggleGroup), table, popover (surface classes + Callout)
    layout/          AppShell (incl. Sonner toaster + dev button), Sidebar, TopBar, StatusChip
                     (incl. the connected quick-stats popover), DashboardBanner,
                     PendingActionsBanner, BharatConnectMark, BharatConnectLogo, CircularSpinner
    dev/DevPanel.tsx Global dev panel (business switch, connection state, verification level,
                     profile-save outcome, webhooks, simulate invoice confirmation)
    ConnectBharatConnectCTA.tsx  Not-connected banner (list pages) / card (view pages)
    InviteBcTooltip.tsx          "Not on Bharat Connect · Invite" hover popover
    FilterMenu.tsx               Filter-icon popover for the Bharat Connect status filter,
                                  shared by Invoices/Bills and Contacts list pages
    SendViaBharatConnectButton.tsx
  pages/
    Dashboard.tsx
    settings/bharatconnect/     (see the onboarding & profile sections above — connect flow, IDs)
      profile/                  ProfilePage (header, sticky line tabs, card), fields.tsx
                                 (rows + ProfileSection), SaveBar (card footer), sections/*,
                                 LevelStatus, FullVerificationNudge, DocumentsCard,
                                 useProfileForm, fieldConfig
    invoices/
      kindConfig.ts             Per-kind (sales/purchase) copy + money/inr formatters
      InvoiceListPage.tsx       List + Bharat Connect column/filter/pending banner, shared by
                                 Invoices and Bills (Bills: LEDGERS Purchase Invoices layout +
                                 Bharat Connect view)
      BcBillCreatePage.tsx      Create Purchase Invoice prefilled from a Bharat Connect invoice
      BillItems.tsx             Item Review popup (match → catalog search → add new item)
      useBillItems.ts           Per-line matching state and the decisions sent on Create
      BcStrip.tsx, BcDialogs.tsx  Bharat Connect strip above a bill/invoice; Accept/Reject/Cancel
                                 dialogs
      InvoiceViewPage.tsx       View + Bharat Connect sidebar card, shared by both
      ReviewAndSendCallout.tsx  "Created — review, then send" callout on a new sales invoice
      InvoiceCreatePage.tsx     Create + counterparty search, shared by both; lands on the
                                 new document's view page
    catalog/                    Catalog list, Create Catalog, item page (matched to LEDGERS)
    contacts/
      ContactsListPage.tsx      List + Bharat Connect column, All/Customer/Supplier filter
      CreateContactModal.tsx    GSTIN autofill (native + Bharat Connect), invite-on-save
      ContactViewPage.tsx       Native layout + Bharat Connect card, invoices joined by B2B ID
```
