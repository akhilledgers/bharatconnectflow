# LEDGERS Design System Restyle — Design

**Date:** 29-09-2026 · **Status:** Draft for review · **Git:** uncommitted, nothing pushed until the owner says so

## Intent

Make the BharatConnect × LEDGERS prototype look like the real LEDGERS v4 app, so reviewers judge the
BharatConnect flows rather than a different visual language.

**Stated by the owner**
- Full alignment with the LEDGERS design system (skill `ledgers-design-system`: `globals.css`,
  `components.md`, `patterns.md`, `content.md`).
- Keep current labels and routes: "Bills" stays "Bills", the sidebar keeps its current items,
  `/sales/invoices` and `/expenses/bills` stay.
- No git push (and no commits) until the owner says so.

**Assumed (correct me if wrong)**
- Visual only. Flows, copy, store logic, mock API and behaviour don't change.
- BharatConnect's own logo and "B" mark keep their brand colours; the LEDGERS logo stays.
- Light mode only. The new tokens carry dark values, but no dark toggle is added.
- The dev panel is tooling, not product UI: it gets the new tokens but no redesign.

**Done means**
- No purple, no `ink/body/faint/canvas` tokens, no hard-coded hex left in product UI (logos and
  chart series excepted).
- Every button, badge, input, card, dialog/sheet, tab and table is one of the shared `ui/`
  components with a design-system variant.
- Each screen matches the matching `patterns.md` pattern (shell, list page, document editor,
  sheet, settings).
- `npm run build` and `npm run lint` pass; every screen screenshot-checked in the browser pane.

## Approach

Design-system theme + a small set of hand-built shared components (no shadcn CLI, no Radix).
Chosen over (a) installing shadcn/ReUI, which adds ~15 dependencies for fidelity that isn't visible
in a prototype, on a machine where newer tooling already has Node issues, and (b) aliasing old token
names, which leaves two vocabularies and no shared components.

Only new dependency: `sonner` (toasts, as used in LEDGERS v4).

## 1. Foundation

- **`src/index.css`** is replaced by the design system's `globals.css` (shadcn token names, blue-500
  primary, `--radius: 0.5rem`, `text-2sm` 13px step, Inter). The spinner keyframes and
  `.scrollbar-thin` are kept below it.
- **`src/App.css`** (184 lines, imported nowhere) is deleted.
- **Token migration** (applied in every file as it's converted):

| Old | New |
| --- | --- |
| `text-ink` | `text-foreground` |
| `text-body` | `text-foreground` (body copy) or `text-muted-foreground` (secondary) |
| `text-faint` | `text-muted-foreground` |
| `bg-canvas`, `bg-surface` | `bg-background` / `bg-card` |
| `bg-primary` (purple) / `hover:bg-primary-hover` | `<Button>` primary (`bg-primary hover:bg-primary/90`) |
| `bg-primary-soft` | `bg-primary/10` |
| `border-[#d1d5db]`, `border-gray-*` on controls | `border-input` |
| `text-[11px]`/`text-[13px]` ad hoc | `text-xs` / `text-2sm` (11px kept only for KPI/eyebrow labels, per DS) |
| Pill status spans | `<Badge variant>` |

## 2. Shared components — `src/components/ui/`

Each is a thin typed wrapper around a native element, with classes copied from `components.md`, plus
a `cn()` helper in `src/lib/cn.ts` (no `clsx`/`tailwind-merge`; simple join is enough here).

| Component | Variants / parts | Replaces |
| --- | --- | --- |
| `Button` | `primary`, `success`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes `default` (h-8.5), `md` (h-8), `sm` (h-7), `icon` | ~every `<button className=…>` |
| `Badge` | `success`, `warning`, `destructive`, `primary`, `info`, `secondary` | status pills, doc-status pills, ID status |
| `Input`, `Textarea`, `Select` (native `<select>` styled as trigger), `Checkbox` (native, styled), `InputGroup` | per recipes | form fields everywhere |
| `Label`, `FormItem` | label `text-xs font-medium`, required `*` | field labels |
| `Card` + `CardHeader/Title/Description/Toolbar/Content/Footer` | per recipe | bordered boxes |
| `Dialog` | overlay blur, centered, title/description/body/footer | `profile/Modal.tsx` |
| `Sheet` | right floating 798px panel, footer Cancel + green confirm | `CreateContactModal`, `CreateIdDrawer` |
| `Tabs` | `segmented`, `pill`, `line` | contact view tabs, profile section nav |
| `ToggleGroup` | joined outline items | All / Customer / Supplier |
| `Table` parts | th/tr/td recipes, pagination footer | list tables |
| `Popover`/`Menu` surface | dropdown-menu recipe | `FilterMenu`, status-chip popover, `InviteBcTooltip` |

Status → badge mapping (from `content.md`), defined once in `src/lib/invoiceStatus.ts`:

| Status | Badge |
| --- | --- |
| Paid, Accepted, Connected, Active, Verified | success |
| Partly Paid, Pending (awaiting confirmation / to accept), Uploaded, Setting up | warning |
| Not Paid, Failure/Failed, Rejected, Needs attention, Requested | destructive |
| Sent, ID found, Assisted setup | primary |
| Deactivated, Legacy format, Not uploaded, Not connected | secondary |

(Resolves the spec's open question 5: "Accepted" moves from amber to green.)

## 3. Shell

- `AppShell`: sidebar fixed 250px, top bar fixed 54px, `<main>` with `container-fluid py-5` (`px-5`).
  The current `max-w-6xl` centering goes; pages fill the width like v4.
- `Sidebar`: DS recipe (h-8 `rounded-lg` items, `bg-accent` selected, icons `size-4 opacity-60`,
  54px header with logo + "LEDGERS", footer with avatar + "BUSINESS" eyebrow + business name).
  Items, icons and labels unchanged. The Settings → BharatConnect setup dot stays.
- `TopBar`: centered "Ask AI or Search..." input with `Sparkles`, divider, avatar
  `bg-blue-500/10 text-blue-500`. The BharatConnect `StatusChip` sits left of the divider as a
  ghost icon button; its red count uses the DS alert-count style; its popover uses the menu surface.
- Toasts: store's `pushToast` unchanged; `AppShell` bridges new store toasts to Sonner
  (`<Toaster position="top-right" richColors />`), keeping the 4s duration. Top-right is the LEDGERS
  convention per the owner (the DS skill's "bottom-right" note is out of date).
- Dev panel `{ }` button moves from bottom-right to bottom-left, so it doesn't collide with the
  bottom-right toasts.

## 4. Screens (converted in this order, screenshot-checked after each group)

1. **Dashboard** — `patterns.md` §3: page head "Overview"; KPI tiles (`rounded-2xl`, compact INR);
   widget cards; bar chart card + "Recent Sales" card. Dashboard connection banner → DS alert
   (Card-like, neutral, outline CTA, not a coloured page band). Chart series → blue-500 / emerald-500.
2. **Invoices / Bills** — list (§2: page head with outline `+ Create`, 4 stat cards, flush Card with
   toolbar, table, pagination footer; BharatConnect column uses `Badge` + `sm` buttons; filter via
   Popover; pending-actions and connect banners restyled as neutral callouts with one CTA);
   view (document card + right sidebar cards, BharatConnect card mirrors the GST card);
   create (§5 document editor, primary `sm` submit bottom-right).
3. **Contacts** — list (ToggleGroup All/Customer/Supplier, B mark slot kept), Create Contact becomes a
   `Sheet` with segmented tabs, emerald "Autofill from GSTIN" callout, 2-col form grid, green
   "Add Contact"; view page with Card sections and the BharatConnect card.
4. **BharatConnect settings** — connect flow, overview, IDs table, Create ID `Sheet`, profile page
   (label·value rows kept, inputs become `Input`, save bar becomes a sticky Card footer with a
   single primary button, diff panel inside it), documents `Dialog`, level tooltip on the menu
   surface, needs-attention banner as a destructive callout.
5. **Remaining** — `InviteBcTooltip`, `SendViaBharatConnectButton`, `ConnectBharatConnectCTA`,
   `PendingActionsBanner`, `DashboardBanner`, dev panel tokens.

**One filled button per view** is enforced while converting: page-header create actions become
outline; document submit is primary; sheet confirm is green.

## 5. Formats

Amounts already use Indian grouping; add `tabular-nums` on every amount. Dates shown with slashes
(`toLocaleDateString("en-GB")`) switch to `DD-MM-YYYY`. No other copy changes.

## 6. Verification

After each screen group: `npm run build` (includes `tsc -b`) and `npm run lint`, then run the dev
server in the browser pane and screenshot every route in that group in the relevant connection
states (dev panel), checking against the DS "before finishing" list: no hard-coded hex, one filled
button, badges mapped, amounts formatted.

## Out of scope

Label/route changes, sidebar IA changes, dark-mode toggle, new behaviour, Radix/shadcn install,
tests (the repo has none; this is a visual change verified by build, lint and screenshots).
