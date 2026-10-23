# PF wage ceiling revision — decision log

Owner: Stany Devdas (PM). Source brief: `HANDOFF-pf-wage-ceiling.md` (was in Downloads) — PF wage ceiling
₹15,000 → ₹25,000 from 17 Sep 2026 (S.O. 5109(E); EPS joining for non-members, G.S.R. 847(E)).
Newest entries at the bottom. Each entry: what was decided, why, and what it changed.

## Ground rules (15-10-2026)

- Build in the `akhilledgers/bharatconnectflow` prototype, locally first; **nothing pushed** until Stany says so.
- First replicate LEDGERS v4 HRMS as it works today (observed on Demo Ledgers, where setting salaries and
  running payroll was allowed — "it's a demo database"), then layer the PF change on top.
- Copy v4 behaviour on purpose where it matters (Run Payroll lands on Monthly Pay Report, upserts per
  employee, month-granular salary revisions); deliberate differences are listed in `bharatconnectflow/README.md`.

## Engine

| Decision | Why |
|---|---|
| Effective-dated `PF_CEILINGS` in `statutory.ts`; no amount hardcoded anywhere ("Limit to PF ceiling (₹X)") | v4 hardcodes ₹1,800 in the frontend and ₹15,000 EPS/EDLI wages in the PF report — the bug class behind the revision |
| One formula for every month: PF wage per segment = min(W × paid days ÷ D, C × E_s ÷ E); September has two segments | Matches the handoff; other months reduce to today's v4 result |
| Full precision, round once at the end | Rounding per half gave ₹1,022 instead of ₹1,023 in a handoff case |
| Loss of pay never reduces the ceiling share; split LOP by attendance dates, typed totals spread by days employed | Handoff cases; Kavya ₹960 vs ₹1,023 shows why attendance wins |
| EPS 8.33% of capped wage on EPS-eligible days; none at 58+; non-EPS members join EPS from 17 Sep (`epsFrom`, not `epsMember: true`) | Setting `epsMember` gave EPS for all of September — bug found and fixed |
| Net-pay floor: recover at most what keeps October take-home ≥ 90% of September net, excluding September one-off benefits; rest carries forward | Rohit's ₹5,000 incentive in September made the floor hold back the whole recovery |
| Keep-CTC solver solves exactly when the absorbing component is itself PF wage (÷ 1.12 below cap, −3,000 at cap) | Circular calculation question raised by Stany |

## September flow

| Decision | Why |
|---|---|
| Ceiling choice: **Mid-month change** (default) or **Old ceiling, full month** | Stany: drop "New ceiling, full month" — "I don't see any company wanting to do that" |
| Run Payroll asks one question: Not paid yet / Paid as calculated here / Paid on the old ceiling | Earlier 2-step impact dialog was "too complicated" |
| "Paid on the old ceiling" keeps the paid record and creates a difference settled in October | Stany asked what happens if September was already paid on the old ceiling (chose option 2) |
| Compare against **as-paid** figures (struck out), not the last computed run | Switching to old ceiling looked like a payout increase — Stany flagged it |
| After correction the choice collapses to a one-line status with Change | Reduce noise once done |
| "Affected by PF ceiling" filter in September and October | Stany asked for a way to see affected employees |

## October flow

| Decision | Why |
|---|---|
| No separate PF revision page; one-time choices sit on the October computation page and preview live in the table | Revision page was "still very complicated"; Stany wanted CTC changes visible on the payroll page, not in a crowded pop-up |
| September difference: Add to October (default) / Don't add — shown only while September stands on the old ceiling | |
| ~~Higher employer PF: CTC increases (default) / Keep CTC the same, page-wide with per-employee switch~~ — **superseded 23-10-2026: CTC always increases** (see below) | Stany: CTC absorb vs extra deduction affects all employees |
| Coverage (newly under PF / EPS) is a rule, recorded by whichever run first uses the new ceiling | "Record coverage automatically" clarified with Stany |
| TDS/PT/ESI recalculated from October when Keep CTC lowers gross (no longer applies — gross never changes) | Stany asked about implications on other deductions like TDS |
| **23-10-2026: "Keep CTC the same" removed.** Higher employer PF always increases CTC; gross and fixed salary stay as they are. Removed the toggle, the per-row switch, the keep-CTC solver and the "PF ceiling — CTC kept the same" revision. October card now shows only the September difference choice; dashboard reads "CTC increased for n employee(s)". | Stany: simplify implementation. Matches the HR email of 23 Oct (CTC increases ₹1,200; no change to fixed or gross salary) |

## Salary Setup

| Decision | Why |
|---|---|
| Salary structures stay month-based; the 17 Sep split lives in payroll only | Stany asked whether 17 Sep needs handling in Salary Setup |
| Blue coverage notice + save warning for NO-PF within ₹25,000; note for SEP-2026 effective salaries; system revisions carry a reason label; profile shows PF / Pension line | "Show me how it would look" — approved |

## Documentation

- 16-10-2026: Claude Doc "PF Wage Ceiling Revision — Product Flows" (new format: per screen — what changes, expected
  flow with screenshots, checks and banners, calculations). No "About this document" section.
  https://claude.ai/code/artifact/47f3b3c1-563e-4dd3-af47-9c199fa79239
- 16-10-2026: Word version in the spec house format (A4 landscape, Roboto 12, Title 24 / H1 20 blue 1F4E79 / H2 18 /
  H3 16, Version History, Index) → `bharatconnectflow/docs/PF_Wage_Ceiling_Product_Flows_v1.0.docx`, built by `docx/build.js`.

## Repository

- 17-10-2026: work lives on a new branch `pf-wage-ceiling` of `akhilledgers/bharatconnectflow`; main and the other branches
  stay untouched, no PR or merge until Stany decides. Workspace moved to Documents\Claude Folder.
- 17-10-2026: Stany asked to merge into main. Done as a fast-forward (main e079121 → c9bf9e4), no force push; existing
  main content kept — only README.md, src/App.tsx and src/components/layout/Sidebar.tsx were touched (additions; Sidebar
  restructured to add the HRMS menu and the Advanced Settings link). The pf-wage-ceiling branch is still on GitHub.

- 23-10-2026: Google Doc version (https://docs.google.com/document/d/1edMUYz8isopIHWaP0MTC41YogC_Dh_UCrNiPDft44Fc) updated
  to v1.1 for the Keep-CTC removal: removed text struck through in red, new text in green, version row added. New
  screenshots for figures 16–18, 20 and 25–28 are in `doc-shots/out/` (v1.0 copies in `doc-shots/out/v1.0/`) and were
  placed in the Google Doc through Claude in Chrome (the Docs API only inserts images from a public URL). Figures 5 and 19
  keep their old images under struck-through captions, since those flows no longer exist.

## Open questions

- When September was paid on the mid-month basis but its ECR was filed on ₹15,000 ("Paid as calculated here"), should a
  difference ECR still be offered?
