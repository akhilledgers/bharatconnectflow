# BharatConnect × LEDGERS — Clickable Prototype

A working front-end prototype of the BharatConnect integration inside LEDGERS. Everything is
client-side: React + TypeScript + Tailwind, React Router (hash routing), Zustand for state,
and a mocked API layer with artificial network delay. Nothing talks to a real backend.

Two builds are stacked here:

1. **Onboarding & profile** — connection status everywhere, the one-page connect flow, the
   connected overview, BharatConnect IDs, and the redesigned profile-edit page with a
   verification-level system.
2. **Invoices, Bills & Contacts, integrated natively** — BharatConnect isn't a separate
   module. Sales Invoices, Expenses Bills, and Contacts are LEDGERS' own native pages; they
   render exactly as they would with no BharatConnect connection at all until the business
   connects, at which point send/accept/reject actions, status filters, pending-action
   banners, and a BharatConnect column appear in place — same page, same URL, same table.

## Running it

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173`. Uses Vite 6 (the Vite 8/rolldown default that `npm create
vite` installs today doesn't run on this machine's Node version — see `package.json`).

## How to explore it

Every screen has a **dev panel** — the `{ }` button, bottom-right of every page. It lets you:

- Switch between the two seeded businesses (a company and a sole proprietorship)
- Force any of the six connection states directly, without going through a real flow
- Fire the two simulated BharatConnect webhooks (confirm activation / reject an update)
- Force the business's verification level (1, 2, or 3) to see level-gated UI
- Simulate the buyer's side of a sent sales invoice — Accept or Fail any invoice currently
  sitting in "sent, awaiting confirmation," without leaving the page you're on

The profile-edit page has two more dev controls of its own, next to its section nav
("Simulate reject" / "Simulate conflict" pills) — those arm the *next* save specifically,
rather than changing global state, so you can test the save-bar's rejected/conflict paths
without leaving the page.

## Seeded businesses

| | Stock Holding Corporation of India Ltd | Sharma Traders |
|---|---|---|
| Type | Company | Sole proprietorship (proprietor: Ramesh) |
| PAN | AABCS1429B | PQRPR5678K |
| Default connection state | Not connected | Needs attention (seeded rejection on settlement account) |
| Verification level | 2 | 1 |
| BharatConnect IDs | none yet (connect to generate one) | 4 — default, extra, a deactivated extra, and one legacy-format ID |
| Used to demo | The connect flow, ID generation for company-type PAN, Level 2→3 documents flow | The individual ID format, `needs_attention` state, IDs table with mixed statuses |

Both businesses share one flat pool of seed data — invoices/bills aren't scoped per
business in this prototype. [`src/mock/seed.ts`](src/mock/seed.ts) also seeds:

- **Invoices & Bills** (`makeSeedInvoices`) — a mix deliberately covering every
  BharatConnect state a sales invoice or bill can be in: not sent, sent+pending,
  accepted, failed (with retry), and — for sales — customers with and without a
  BharatConnect B2B ID (to exercise the greyed-out "Send" + Invite flow).
- **Contacts** (`makeSeedContacts`) — customers/suppliers spanning connected (has a B2B
  ID), invite-eligible (has a GSTIN, checked, not on BharatConnect), and unchecked (no
  GSTIN on file at all).
- **`GST_REGISTRY_BY_GSTIN`** — mocks the native GST-portal autofill (name, PAN, address)
  that the Create Contact modal's "Autofill from GSTIN" box uses — works regardless of
  BharatConnect connection.
- **`BC_REGISTRY_BY_GSTIN`** — mocks what a BharatConnect `reqSearchEntity` call would
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
  BharatConnect "B" mark plus a status dot. Hover to see the status and a contextual action
  ("Connect now", "Link existing ID", "Manage", "Fix now", "Contact us").
- **Dashboard banner** ([`DashboardBanner.tsx`](src/components/layout/DashboardBanner.tsx)):
  shown only for states that need action, with a 7-day snooze. Never shown when connected.
- **Sidebar dot** on the Settings → BharatConnect item while setup is incomplete.
- **"Send via BharatConnect" button** on the dashboard's recent-sales list: disabled with a
  "Connect to enable" hint until connected.

### 2. Connect flow (`/settings/bharatconnect`, when not connected)
One page, not a wizard — this replaces an earlier 6-step design. Business details collapse
to a 3-line summary; the BharatConnect ID is generated and shown read-only with a
part-by-part breakdown; ownership shows a single green line when LEDGERS already has it
verified (skipping the OTP screen entirely, which is the case for both seeded businesses);
consent is one checkbox. Submitting morphs the same card in place through
sending → creating ID → waiting for confirmation → success, with no page navigation.

Other states on this route:
- `existing_id_found` → a one-click "Link existing ID" card, no form
- `setting_up` → a static progress card
- `assisted_setup` → "Contact us", no automatic flow
- `connected` / `needs_attention` → the connected overview (below), with a red banner on
  top for `needs_attention` linking straight to the failing field

### 3. Connected overview (`/settings/bharatconnect`, when connected)
Deliberately minimal — plain label/value rows, no cards, one accent color. The BharatConnect
ID in large monospace type with copy, an invoicing/payments summary, business details, and a
footer with last-synced date, an "unsent draft" link when the profile has unconfirmed
changes, and a disconnect link (blocked with a tooltip while any invoice is unpaid or partly
paid — see [`Overview.tsx`](src/pages/settings/bharatconnect/Overview.tsx)).

### 4. BharatConnect IDs page (`/settings/bharatconnect/ids`)
Table of every ID for the business — visibility, linked identifier, status, actions.
"Create ID" opens a drawer: pick PAN or GSTIN as the base (skipped for sole proprietors,
whose format is fixed), a live-generated preview, a 2–5 character ending with a mocked
availability check and suggestion chips, public/private, and an optional settlement account
(verified LEDGERS accounts only). Deactivation is blocked per-ID when that ID has open
invoices or active financing, with the reason shown as a toast. Legacy (pre-standard) IDs
are labeled and never validated against the new pattern.

### 5. BharatConnect ID standard
Implemented in [`src/lib/id-standard.ts`](src/lib/id-standard.ts):
`PAN@BCB` / `GSTIN@BCB` for companies, `AAAA.BBBB.CCCC.DDD@BCB` for individuals (from
business name, proprietor name, PAN digits 6–9, and a disambiguation sequence), and
`base.ENDING@BCB` for extra IDs. No user ever types an ID from scratch.

### 6. Profile-edit page (`/settings/bharatconnect/profile`)
The page that took the most iteration — see the notes below on what changed and why.
Single scrollable page (no tabs, no wizard), five sections in a fixed order:

- Every field has an explicit permission in one config
  ([`fieldConfig.ts`](src/pages/settings/bharatconnect/profile/fieldConfig.ts)):
  **editable** (boxed input, tier 1 = saves immediately, tier 2 = needs confirmation),
  **readonly-sourced** (plain text, tagged "From GST portal" etc.), or **bc-owned** (a
  status display near the header, never a form field).
- All fields — read-only and editable alike — render as simple `label · value` rows
  separated by a thin divider (the same pattern as the connected overview page), so the
  only thing marking a field editable is its input box, not the layout.
- A single sticky **save bar** at the bottom is the only save mechanism — no per-section
  saves, no separate review page. It runs through a real state machine: clean → dirty →
  invalid → confirming (only when a tier-2 field changed — shows a diff panel that expands
  upward from the bar) → sending → success (auto-reverts after 3s) / rejected (points at the
  specific field; editing that field clears it) / a version-conflict path that refreshes
  stale fields while keeping the user's pending edits intact.
- **Verification level** (1/2/3) is shown as "Verified for: Level N" near the header, with
  a hover tooltip breaking down which checks are met at each level. Below it, a small nudge
  ("Reach full verification…") appears only below Level 3 and opens the KYC document
  upload flow in a modal — it isn't inline in the page. Uploading a document simulates
  BharatConnect's own async review (uploaded → verified a couple seconds later), and
  BharatConnect can re-request an already-verified document at any time (dev-toggleable),
  which reopens the upload control for just that document.
- MCC is hidden behind a collapsed "needed once you enable payments" line below Level 2,
  and becomes a required visible field once Level 2 is complete.

### 7. Invoices & Bills — native, not a separate module
Sales Invoices (`/sales/invoices`) and Expenses Bills (`/expenses/bills`) are one shared,
kind-parameterized set of components
([`InvoiceListPage.tsx`](src/pages/invoices/InvoiceListPage.tsx),
[`InvoiceViewPage.tsx`](src/pages/invoices/InvoiceViewPage.tsx),
[`InvoiceCreatePage.tsx`](src/pages/invoices/InvoiceCreatePage.tsx)) so a fix or feature on
one side ships on both automatically. Behavior is one rule: **not connected → the plain
native UI, pixel-matched to the real LEDGERS screens, with nothing BharatConnect-shaped
anywhere. Connected → the same UI, augmented in place.**

What "augmented" means, connected:
- **List page**: a BharatConnect column appears (Sent/Pending/Accepted/Failure, or a
  "Send via [B]" action for sales / Accept·Reject icons for bills), plus a status filter
  dropdown ("Pending to send", "Awaiting confirmation", "Accepted", "Failed", etc.) and a
  pending-actions banner ("N invoices pending to send via BharatConnect") whose CTA applies
  that filter — no navigation needed. The banner dismisses with its own 3-day snooze, kept
  independent per page (Invoices vs. Bills) so dismissing one doesn't hide the other.
- **View page**: a BharatConnect card in the sidebar mirrors the existing "GST filings"
  pattern — Send / Sending… / Status+Confirmation for sales, Accept/Reject for bills. A
  failed send gets a **Send Again** button right there (and a matching **Retry** link in
  the list's BharatConnect column) — same underlying action as the original send.
- **Create page**: the customer/supplier search auto-checks "Send via BharatConnect" the
  moment you pick a counterparty who has a B2B ID; the checkbox is disabled otherwise.
- **Customer not onboarded on BharatConnect** (no B2B ID): the send action greys out
  instead of pretending to work, everywhere it appears (list, view, create). Hovering it
  (list) or just looking at it (view — no hover needed there) surfaces an
  **Invite to BharatConnect** CTA ([`InviteBcTooltip.tsx`](src/components/InviteBcTooltip.tsx)),
  which fires the same mocked-delay-then-toast pattern as everything else.
- **Not connected at all**: a dismiss-free banner CTA on the list page and a dashed
  placeholder card on the view page's sidebar both point at
  `/settings/bharatconnect` ([`ConnectBharatConnectCTA.tsx`](src/components/ConnectBharatConnectCTA.tsx)).

**Toasts** ([`AppShell.tsx`](src/components/layout/AppShell.tsx)) are top-right cards, green
for success / red for error, auto-dismissing after 4 seconds — used for every action above.

### 8. Contacts (`/contacts`)
Matches the real LEDGERS Contacts screens (list, Create Contact modal, view page) with one
addition: the **Autofill from GSTIN** box on Create Contact — which businesses already use
for tax autofill — silently also checks BharatConnect status as a side effect, but only once
this business is itself connected (with an explicit "We'll also check if they're on
BharatConnect" hint so that isn't a surprise). Two independent mock lookups drive it:
native GST-portal autofill (name/PAN/address, always active, `GST_REGISTRY_BY_GSTIN`) and
the BharatConnect check (B2B ID, connected-only, `BC_REGISTRY_BY_GSTIN`). A match shows the
B2B ID plus a **Request contact details** action rather than auto-filling email/mobile —
per the partner handbook, `reqSearchEntity` doesn't return those; they're "non-public
information" requiring a separate `reqNonPublicInfo` consent request, so that's what's
mocked (`requestContactDetails`, a toast, not an instant fill). No match still auto-checks
**"Invite them to BharatConnect once saved"**, so creating a contact and inviting them onto
BharatConnect collapse into one action.

The View Contact page ([`ContactViewPage.tsx`](src/pages/contacts/ContactViewPage.tsx))
joins that contact's invoices/bills by B2B ID when one exists (falls back to name match
otherwise) to compute Receivables/Payables and a Recent Invoices table, plus a BharatConnect
card with live Sent/Accepted/Received counts for just that contact.

## Mocked endpoints and what drives them

Every function in [`src/mock/api.ts`](src/mock/api.ts) simulates a network call with
400–1100ms of random delay (jitter, not a fixed number, per screen). Store actions in
[`src/store/useStore.ts`](src/store/useStore.ts) call these and then update state; UI
re-renders from that state. Nothing here is a real request.

| Mock endpoint | Called by | Drives |
|---|---|---|
| `POST /bharatconnect/lookup` | `mockLookupConnectionStatus` | Stands in for the PAN/GSTIN lookup on login/business-switch (state itself is set via the dev panel in this prototype rather than a real lookup) |
| `POST /bharatconnect/ownership/verify` | `verifyOwnership` (store) | The connect flow's OTP step, when ownership isn't already verified |
| `POST /bharatconnect/ids/link` | `linkExistingId` (store) | The `existing_id_found` one-click link action, from the banner, chip, or dedicated page |
| `GET /bharatconnect/ids/check?ending=` | `mockCheckEndingAvailability` | The "Create ID" drawer's live availability check (rejects `USED`/`TEST` as taken, for demo purposes) |
| — (client-side, no call) | `submitConnect` (store) | The connect flow's in-place progress morph: sending → creating ID → waiting for confirmation → success, ending with a real ID generated by `id-standard.ts` and the business flipped to `connected` |
| — (client-side) | `simulateWebhookConfirm` / `simulateWebhookReject` (store) | The dev panel's webhook buttons — confirm flips `setting_up`→`connected`; reject flips any state→`needs_attention` with a rejection pinned to the settlement-account field |
| — (client-side) | `uploadKycDocument` (store) | Profile page's document upload: sets `uploaded` immediately, then `verified` after a further 1.8–2.6s, simulating BharatConnect's own async review |
| — (client-side) | `devRequestKycDocument` (store) | The documents modal's "Simulate re-request" — flips a verified document back to `requested` and reopens its upload control |
| — (client-side) | `setVerificationLevel` (store) | Dev-panel-only. Recomputes `invoicing`/`payments` flags from the level, same as a real level change would |
| — (client-side, per-field) | `useProfileForm`'s `doSend` | The profile save bar's send pipeline — resolves to success, or (when armed via the page's own dev toggles) a field-specific rejection or a version-conflict merge |
| `POST /contacts/otp/send` / `POST /contacts/otp/verify` | `mockOtpSend` / `mockOtpVerify` | Wired but not currently called from any screen — reserved for a future "verify new contact before adding to draft" flow |
| — (client-side) | `sendInvoiceViaBharatConnect` (store) | Send / Send Again / Retry, everywhere they appear — sending → sent+pending, then resolves via the dev panel or `simulateInvoiceConfirmation` |
| — (client-side) | `respondToBill` (store) | Accept/Reject on a bill, list or view page |
| — (client-side) | `createInvoice` (store) | Create Invoice/Bill submit |
| — (client-side) | `simulateInvoiceConfirmation` (store) | Dev-panel-only — plays the buyer's side of a sent sales invoice (Accept/Fail) |
| — (client-side) | `inviteToBharatConnect` (store) | Every "Invite to BharatConnect" CTA (invoice send column, view pages, contacts) |
| — (client-side) | `requestContactDetails` (store) | Mocks `reqNonPublicInfo` — "Request contact details" on a BharatConnect-matched contact, since email/mobile aren't returned by search |
| — (client-side) | `createContact` (store) | Create Contact submit — auto-invites when the GSTIN check found no B2B ID and the (default-checked) invite box is still ticked |
| — (client-side) | `snoozeInvoiceBanner` (store) | The pending-actions banner's dismiss — 3-day snooze, tracked per page (`invoiceBannerSnoozedUntil` / `billsBannerSnoozedUntil`) |
| `lookupGstRegistry` / `lookupBcByGstin` ([`mock/seed.ts`](src/mock/seed.ts)) | Create Contact's GSTIN box | Two separate synchronous mock lookups — native GST autofill (always) vs. BharatConnect status (connected-only) |

## Design decisions worth knowing about

- **The profile page was redesigned mid-build.** It started as a 6-tab step wizard (matching
  the original reference mockups), then was rebuilt as a single scrollable page with a
  sticky save bar and an explicit field-permission model, because the tabbed version added
  friction disproportionate to what most visits here actually need (one or two field
  changes). The route (`/settings/bharatconnect/profile/*`) still accepts the old tab-shaped
  paths (`business_details`, `settlement_accounts`, etc.) and maps them to a scroll-to
  target, so links from other screens didn't need to change.
- **Verification levels are numbered on screen** ("Verified for: Level 2") rather than
  described only by capability, per direct feedback — the capability breakdown lives in the
  hover tooltip instead.
- **The Level-3 document flow is opt-in, not automatically inline.** It's reached through a
  small nudge and a modal, rather than a card that appears in the page flow once Level 2 is
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
- **The BharatConnect UI is always additive, never a fork.** Every augmented screen renders
  the exact native layout first; BharatConnect elements are conditionally inserted into that
  same layout rather than swapping to a different component tree, so "not connected" is
  never a degraded or placeholder experience — it's just the real screen.
- **Not on BharatConnect gets an Invite CTA, not a dead end.** Wherever a send action is
  unavailable because the counterparty has no B2B ID, the affordance right there is to
  invite them — never just a disabled control with no next step.
- **Contact details follow the actual API contract, not a shortcut.** The partner handbook
  is explicit that `reqSearchEntity` doesn't return non-public info like email/mobile — that
  needs a separate consent-based `reqNonPublicInfo` request. Rather than fake an instant
  autofill, Create Contact mocks that real two-step shape (search → optional request →
  pending approval).

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

## File map

```
src/
  types/            Shared TypeScript types for the whole domain model
  mock/             seed.ts (businesses, invoices, contacts, GST/BharatConnect lookup tables),
                     api.ts (mocked network calls)
  lib/               id-standard.ts (B2B ID generation), status.ts (connection-state metadata),
                     invoiceStatus.ts (status labels/pill classes), profile.ts (MCC list,
                     pincode validation, payment-address generation)
  store/useStore.ts  Single Zustand store — business/connection/profile/invoices/contacts/
                     toasts/dev-panel state, all in one place
  components/
    layout/          AppShell (incl. toasts), Sidebar, TopBar, StatusChip (incl. the connected
                     quick-stats popover), DashboardBanner, PendingActionsBanner,
                     BharatConnectMark, BharatConnectLogo, CircularSpinner
    dev/DevPanel.tsx Global dev panel (business switch, connection state, verification level,
                     webhooks, simulate invoice confirmation)
    ConnectBharatConnectCTA.tsx  Not-connected banner (list pages) / card (view pages)
    InviteBcTooltip.tsx          "Not on BharatConnect · Invite" hover popover
    SendViaBharatConnectButton.tsx
  pages/
    Dashboard.tsx
    settings/bharatconnect/     (see the onboarding & profile sections above — connect flow, IDs)
    invoices/
      kindConfig.ts             Per-kind (sales/purchase) copy + money/inr formatters
      InvoiceListPage.tsx       List + BharatConnect column/filter/pending banner, shared by
                                 Invoices and Bills
      InvoiceViewPage.tsx       View + BharatConnect sidebar card, shared by both
      InvoiceCreatePage.tsx     Create + counterparty search, shared by both
    contacts/
      ContactsListPage.tsx      List + BharatConnect column, All/Customer/Supplier filter
      CreateContactModal.tsx    GSTIN autofill (native + BharatConnect), invite-on-save
      ContactViewPage.tsx       Native layout + BharatConnect card, invoices joined by B2B ID
```
