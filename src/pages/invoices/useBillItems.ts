import { useMemo, useState } from "react";
import { useStore } from "../../store/useStore";
import type { CatalogItem, Invoice, InvoiceLineItem } from "../../types";
import { unitLabel } from "../../mock/catalog";
import { matchLine, suggestAccount, type LineMatch, type LineResolution } from "../../lib/itemMatch";

// Per-line catalog matching for a bill received over Bharat Connect, plus the user's review decisions (see BillItems).

export interface Draft {
  /** An existing catalog item id, "new", or "" while the user hasn't decided. */
  choice: string;
  /** Name for a new catalog item (defaults to the supplier's description). */
  name: string;
  hsn: string;
  gst: string;
  unit: string;
  /**
   * Account type (Expense Type) the line is posted to; LEDGERS requires it. Existing items bring their own (mapped);
   * a new item gets it chosen in the Review popup.
   */
  account: string;
  /** Train the system: remember this choice for the supplier's future bills. */
  remember: boolean;
  /** The user has looked at this line in the Review popup. */
  reviewed: boolean;
}

export interface ItemRowState {
  line: InvoiceLineItem;
  match: LineMatch;
  draft: Draft;
}

export interface BillItems {
  rows: ItemRowState[];
  set: (lineId: string, patch: Partial<Draft>) => void;
  lines: LineResolution[];
  /** Every new item has the details LEDGERS requires (HSN/SAC, GST rate). */
  valid: boolean;
  newCount: number;
  /** Lines that still want a look: new items not yet reviewed, or anything missing details. */
  toReview: ItemRowState[];
}

export const isComplete = (d: Draft) =>
  d.choice !== "" && d.account !== "" && (d.choice !== "new" || (d.hsn.length >= 4 && d.gst !== "" && d.name.trim() !== ""));

/** The catalog item's own account type (Purchase Expense Type), if it has one. */
export const itemAccount = (item?: CatalogItem) => item?.purchase?.expenseType;

/** Undecided, missing details, or a suggested match nobody has confirmed yet. */
export const needsReview = (r: ItemRowState) => !isComplete(r.draft) || (r.match.kind === "suggest" && !r.draft.reviewed);

function initDrafts(bill: Invoice | undefined) {
  if (!bill) return { key: "", rows: [] as ItemRowState[] };
  const { catalog, itemLinks } = useStore.getState();
  const supplier = bill.counterpartyB2bId ?? bill.counterpartyName;
  return {
    key: `${bill.id}-v${bill.version ?? 1}`,
    rows: bill.lineItems.map((line) => {
      const match = matchLine(line, supplier, catalog, itemLinks);
      return {
        line,
        match,
        draft: {
          choice: match.kind === "none" ? "" : match.item.id,
          name: line.name,
          hsn: line.hsnSac ?? "",
          gst: line.gstMissing ? "" : String(line.gstPercent),
          unit: unitLabel(line.unit) ?? "UNT-UNITS",
          account: (match.kind !== "none" && itemAccount(match.item)) || suggestAccount(line, catalog),
          remember: true,
          reviewed: false,
        },
      };
    }),
  };
}

/** Matches are worked out once per bill version, so rows don't reshuffle while the user reviews them. */
export function useBillItems(bill: Invoice | undefined): BillItems {
  const [state, setState] = useState(() => initDrafts(bill));
  const key = bill ? `${bill.id}-v${bill.version ?? 1}` : "";
  const current = state.key === key ? state : initDrafts(bill);
  if (current !== state) setState(current);

  return useMemo(() => {
    const rows = current.rows;
    return {
      rows,
      set: (lineId, patch) =>
        setState((s) => ({ ...s, rows: s.rows.map((r) => (r.line.id === lineId ? { ...r, draft: { ...r.draft, ...patch } } : r)) })),
      lines: rows.map(({ line, draft: d }) =>
        d.choice === "new"
          ? { lineId: line.id, account: d.account, remember: d.remember, create: { name: d.name.trim(), hsn: d.hsn, gstRate: Number(d.gst), unit: d.unit } }
          : { lineId: line.id, account: d.account, remember: d.remember, catalogId: d.choice },
      ),
      valid: rows.every((r) => isComplete(r.draft)),
      newCount: rows.filter((r) => r.draft.choice === "new").length,
      toReview: rows.filter(needsReview),
    };
  }, [current]);
}
