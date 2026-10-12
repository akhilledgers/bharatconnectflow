import { useMemo, useState } from "react";
import { useStore } from "../../store/useStore";
import type { Invoice, InvoiceLineItem } from "../../types";
import { unitLabel } from "../../mock/catalog";
import { matchLine, type LineMatch, type LineResolution } from "../../lib/itemMatch";

// Per-line catalog matching for a bill received over Bharat Connect, plus the user's changes (see BillItems).

export interface Draft {
  /** "new" or an existing catalog item id. */
  choice: string;
  hsn: string;
  gst: string;
  unit: string;
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
  valid: boolean;
  newCount: number;
}

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
          choice: match.kind === "new" ? "new" : match.item.id,
          hsn: line.hsnSac ?? "",
          gst: line.gstMissing ? "" : String(line.gstPercent),
          unit: unitLabel(line.unit) ?? "UNT-UNITS",
        },
      };
    }),
  };
}

/** Matches are worked out once per bill version, so rows don't reshuffle while the user edits them. */
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
        d.choice === "new" ? { lineId: line.id, create: { hsn: d.hsn, gstRate: Number(d.gst), unit: d.unit } } : { lineId: line.id, catalogId: d.choice },
      ),
      valid: rows.every(({ draft: d }) => d.choice !== "new" || (d.hsn.length >= 4 && d.gst !== "")),
      newCount: rows.filter((r) => r.draft.choice === "new").length,
    };
  }, [current]);
}

export function summary(items: BillItems): string {
  const matched = items.rows.length - items.newCount;
  return [matched && `${matched} matched`, items.newCount && `${items.newCount} new`].filter(Boolean).join(" · ");
}
