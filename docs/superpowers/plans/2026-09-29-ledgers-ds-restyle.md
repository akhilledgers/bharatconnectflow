# LEDGERS Design System Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the BharatConnect × LEDGERS prototype to the LEDGERS v4 design system without changing behaviour, labels or routes.

**Architecture:** Swap the theme to the DS `globals.css` tokens, add typed wrapper components in `src/components/ui/` built from `components.md` recipes, then convert the shell and each screen group to those components. Store, mock API and routing are untouched.

**Tech Stack:** React 19, TypeScript 6, Tailwind v4 (`@tailwindcss/vite`), Vite 6, lucide-react, zustand, + `sonner`.

**Spec:** `docs/superpowers/specs/2026-09-29-ledgers-ds-restyle-design.md`

## Global Constraints

- No git commits and no git push until the owner explicitly says so (overrides the "Commit" steps skills normally add).
- Labels, routes and sidebar items unchanged ("Bills" stays "Bills").
- Only new dependency: `sonner`. No shadcn CLI, no Radix.
- Tokens from DS `globals.css`; no hard-coded hex in product UI except logos, the BharatConnect mark and chart series.
- One filled button per view: page-header create = outline + `Plus`; document submit = primary `sm`; sheet confirm = `success`.
- Controls `h-8.5` / `text-2sm` (13px); radii `rounded-md` controls, `rounded-lg` nav/dialog/sheet, `rounded-xl` cards, `rounded-2xl` KPI tiles.
- Amounts `tabular-nums`; displayed dates `DD-MM-YYYY`.
- Light mode only.

## Review Focus

- Dev-panel state switches (all 6 connection states, both businesses) must still render every converted screen without layout breakage — checked by screenshots per state in each task.
- Disabled states (greyed Send for counterparties without a B2B ID, blocked Disconnect, disabled Save) must stay visibly disabled with the new `disabled:opacity-60` — checked in Tasks 3–5 screenshots.
- Toast bridge must show each store toast exactly once (React StrictMode double effects) — checked in Task 2 by triggering Send and counting toasts.
- Sheets/dialogs must still close on Cancel/overlay click and keep their submit behaviour — checked in Tasks 4–5.
- Long values (GSTINs, BharatConnect IDs, business names) must truncate or wrap, not overflow at 1280px width — checked in screenshots.

(No automated test suite exists in this repo; per the spec, verification is `npm run build`, `npm run lint` and browser-pane screenshots.)

---

### Task 1: Foundation — theme + `ui/` components

**Files:**
- Modify: `src/index.css` (replace with DS `globals.css` + keep spinner/scrollbar rules)
- Delete: `src/App.css`
- Create: `src/lib/cn.ts`, `src/components/ui/{button,badge,input,card,dialog,sheet,tabs,toggle-group,table,popover}.tsx`
- Modify: `package.json` (+ `sonner`)

**Interfaces (produced):**
- `cn(...parts: (string | false | null | undefined)[]): string`
- `<Button variant="primary"|"success"|"outline"|"secondary"|"ghost"|"destructive"|"link" size="default"|"md"|"sm"|"icon"|"icon-sm">` — extends `ButtonHTMLAttributes`; `asChild` not supported; link-styled navigation uses `buttonVariants({variant,size})` on `<Link>`.
- `<Badge variant="success"|"warning"|"destructive"|"primary"|"info"|"secondary">`
- `<Input>`, `<Textarea>`, `<Select>` (native), `<Checkbox>` (native, `checked`/`onChange`), `<Label required?>`, `<FormItem>`
- `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, `<CardToolbar>`, `<CardContent>`, `<CardFooter>`
- `<Dialog open onClose title description? footer? size?>`
- `<Sheet open onClose title footer>`
- `<Tabs variant="segmented"|"pill"|"line" items={{value,label,icon?}[]} value onChange>`
- `<ToggleGroup items value onChange>`
- Table class constants: `tableCls`, `thCls`, `trCls`, `tdCls`
- `popoverCls`, `menuItemCls`

- [ ] Step 1: `npm install sonner`
- [ ] Step 2: Replace `src/index.css`; delete `src/App.css`
- [ ] Step 3: Write `cn.ts` and the ten `ui/` files from `components.md` recipes
- [ ] Step 4: `npm run build` → expect type errors only from old token names still used by pages is NOT expected (old names become unknown utilities, not TS errors); build must pass
- [ ] Step 5: Commit — **skipped** (owner rule)

### Task 2: Shell

**Files:** `src/components/layout/{AppShell,Sidebar,TopBar,StatusChip}.tsx`, `src/components/dev/DevPanel.tsx` (button position + tokens)

- [ ] Step 1: AppShell — fixed 250px sidebar, fixed 54px top bar, `<main>` `ms-[250px] mt-[54px]`, content `container-fluid py-5`; Sonner `<Toaster position="bottom-right" richColors />`; bridge store toasts via an effect that tracks already-shown ids in a `useRef<Set<string>>`
- [ ] Step 2: Sidebar per DS recipe (items/labels unchanged)
- [ ] Step 3: TopBar — "Ask AI or Search..." with `Sparkles`, StatusChip as ghost icon button, divider, avatar
- [ ] Step 4: StatusChip popover on `popoverCls`, count badge DS style
- [ ] Step 5: Dev `{ }` button bottom-left
- [ ] Step 6: `npm run build && npm run lint`; start dev server; screenshot Dashboard in `not_connected` and `connected`; trigger a Send and confirm one toast

### Task 3: Dashboard
Files: `src/pages/Dashboard.tsx`, `src/components/dashboard/*`, `src/components/layout/DashboardBanner.tsx`. KPI tiles, widget cards, chart colours blue-500/emerald-500, banner as neutral callout. Build, lint, screenshot.

### Task 4: Invoices / Bills
Files: `src/pages/invoices/*`, `src/lib/invoiceStatus.ts` (badge variants), `src/components/{FilterMenu,SendViaBharatConnectButton,InviteBcTooltip,ConnectBharatConnectCTA}.tsx`, `src/components/layout/PendingActionsBanner.tsx`. List (§2), view, create (§5). Build, lint, screenshots for sales + purchase in connected / not connected.

### Task 5: Contacts
Files: `src/pages/contacts/*`. ToggleGroup, `CreateContactModal` → `Sheet`, view page Cards. Build, lint, screenshots.

### Task 6: BharatConnect settings
Files: `src/pages/settings/bharatconnect/**`. Connect flow, overview, IDs, `CreateIdDrawer` → `Sheet`, profile (inputs, save bar, `Modal` → `Dialog`), documents, level tooltip. Build, lint, screenshots per connection state.

### Task 7: Sweep
Grep for `text-ink|text-body|text-faint|bg-canvas|primary-hover|primary-soft|#[0-9a-f]{6}|text-\[1[0-9]px\]` in `src/`; fix leftovers; final build, lint, full screenshot pass.
