# BharatConnect × LEDGERS — Clickable Prototype

A working front-end prototype of the BharatConnect integration inside LEDGERS. Everything is
client-side: React + TypeScript + Tailwind, React Router (hash routing), Zustand for state,
and a mocked API layer with artificial network delay. Nothing talks to a real backend.

This is **phase one** of the prototype. It covers connection status, onboarding, the
connected overview, the BharatConnect IDs page, and a redesigned profile-edit page with a
verification-level system. Counterparty search (section 7 of the original brief) has not
been built yet — see "Not built yet" below.

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
| `GET /bharatconnect/counterparties/search?q=` | `mockSearchCounterparties` | Wired but unused — counterparty search hasn't been built yet |

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

## Not built yet

- **Counterparty search** (section 7 of the original brief) — the "Send via BharatConnect"
  button on an invoice currently routes to a placeholder page.
- The profile page's contact fields don't yet require OTP verification before a new
  phone/email is added to the draft (the mock endpoints for it exist and are wired into
  `mock/api.ts`, just not called from the UI).
- No persistence across a hard reload — all state lives in the Zustand store in memory.

## File map

```
src/
  types/            Shared TypeScript types for the whole domain model
  mock/             seed.ts (mock businesses/invoices/counterparty directory), api.ts (mocked network calls)
  lib/               id-standard.ts (B2B ID generation), status.ts (connection-state metadata),
                     profile.ts (MCC list, pincode validation, payment-address generation)
  store/useStore.ts  Single Zustand store — all business/connection/profile/dev-panel state
  components/
    layout/          AppShell, Sidebar, TopBar, StatusChip, DashboardBanner, BharatConnectMark
    dev/DevPanel.tsx Global dev panel (business switch, connection state, verification level, webhooks)
  pages/
    Dashboard.tsx
    settings/bharatconnect/
      BharatConnectPage.tsx   Routes to the right state-specific view
      ConnectFlow.tsx, LinkExistingId.tsx, SettingUp.tsx, AssistedSetup.tsx, Overview.tsx
      IdsPage.tsx, CreateIdDrawer.tsx
      profile/
        ProfilePage.tsx       Page shell: header, level status, nudge, section nav, save bar
        useProfileForm.ts     The save-bar state machine (saved/draft diffing, tiers, send pipeline)
        fieldConfig.ts        Per-field permission/tier config
        fields.tsx            Shared row/input primitives
        sections/             BusinessSection, TaxSection, AddressesSection, SettlementSection, ContactsSection
        LevelStatus.tsx, FullVerificationNudge.tsx, DocumentsCard.tsx, Modal.tsx, SaveBar.tsx
```
