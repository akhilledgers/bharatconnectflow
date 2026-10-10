import { useState } from "react";
import { Lock } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { Invoice, InvoiceNote } from "../../types";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/input";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";

/**
 * Notes on a document, in two places:
 *  - "internal": LEDGERS' own "Add notes" section (private, never leaves LEDGERS).
 *  - "bc": the Bharat Connect conversation in the Bharat Connect card — what was sent, the other side's
 *    Accept / Return / Reject comment, the "what changed" note on a re-send. Read-only; comments are
 *    written through the Bharat Connect actions themselves.
 */
export function NotesSection({ invoice, mode }: { invoice: Invoice; connected: boolean; mode: "internal" | "bc" }) {
  const addInvoiceNote = useStore((s) => s.addInvoiceNote);
  const [text, setText] = useState("");
  const notes = (invoice.notes ?? []).filter((n) => n.kind === (mode === "bc" ? "bc" : "internal"));

  if (mode === "bc") {
    if (notes.length === 0) return null;
    return (
      <div className="space-y-2.5 border-t border-dashed border-border pt-4">
        <span className="text-xs font-semibold text-gray-900">Activity</span>
        <NoteList notes={notes} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-gray-900">Add notes</span>
      {notes.length > 0 && <NoteList notes={notes} />}
      <Textarea rows={3} placeholder="Add notes" value={text} onChange={(e) => setText(e.target.value)} className="!px-3 !py-3 !text-xs" />
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          disabled={!text.trim()}
          onClick={() => {
            addInvoiceNote(invoice.id, text.trim(), false);
            setText("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

const VISIBLE = 2;

/** Oldest first; only the latest two show until "Show more" is clicked. */
function NoteList({ notes }: { notes: InvoiceNote[] }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, notes.length - VISIBLE);
  const shown = expanded ? notes : notes.slice(hidden);
  return (
    <ul className="space-y-2.5">
      {hidden > 0 && (
        <li>
          <button onClick={() => setExpanded((e) => !e)} className="cursor-pointer text-xs font-medium text-primary hover:text-primary/80">
            {expanded ? "Show less" : `Show ${hidden} earlier`}
          </button>
        </li>
      )}
      {shown.map((n) => (
        <li key={n.id} className="text-xs">
          <div className="flex items-start gap-1.5">
            <span className="mt-px shrink-0 text-muted-foreground">
              {n.kind === "bc" ? <BharatConnectMark size={12} /> : <Lock className="size-3" />}
            </span>
            <span className="font-medium text-foreground">{n.kind === "bc" ? n.event : n.author}</span>
          </div>
          <div className="flex justify-between pl-[18px] text-[11px] text-muted-foreground">
            <span>{n.at}</span>
            {n.kind === "internal" && <span>Only you</span>}
          </div>
          {n.text && <p className="mt-0.5 pl-[18px] text-foreground">{n.text}</p>}
        </li>
      ))}
    </ul>
  );
}
