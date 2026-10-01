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
  and becomes a required visible field once Level 2 is complete.
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
- **Bills not received over Bharat Connect** (a supplier with no B2B ID, bill entered by
  hand): the list's Bharat Connect column says **Not on Bharat Connect** (never "Not sent" —
  bills are received, not sent), and hovering it offers **Invite to Bharat Connect** worded
  for suppliers ("…so their future bills reach you over Bharat Connect").
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
| — (client-side) | `respondToBill` (store) | Accept/Reject on a bill, list or view page |
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
| Dashboard, Invoices/Bills list + view + create, Contacts, Connect flow, Overview, IDs page | Not yet |

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
                     list, pincode validation, payment-address generation), cn.ts (class joiner)
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
                                 Invoices and Bills
      InvoiceViewPage.tsx       View + Bharat Connect sidebar card, shared by both
      ReviewAndSendCallout.tsx  "Created — review, then send" callout on a new sales invoice
      InvoiceCreatePage.tsx     Create + counterparty search, shared by both; lands on the
                                 new document's view page
    contacts/
      ContactsListPage.tsx      List + Bharat Connect column, All/Customer/Supplier filter
      CreateContactModal.tsx    GSTIN autofill (native + Bharat Connect), invite-on-save
      ContactViewPage.tsx       Native layout + Bharat Connect card, invoices joined by B2B ID
```
