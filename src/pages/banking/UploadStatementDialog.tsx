import { useRef, useState, type DragEvent } from "react";
import { AlertCircle, FileText, Lock, UploadCloud, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { CONNECTED_BANKING, FY_START, last4, type CompanyAccount } from "./data";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

const ACCEPT = [".pdf", ".csv", ".xls", ".xlsx"];
const MAX_MB = 10;
const EXTRA_UPLOAD_FEE = 100;

type Phase = { kind: "pick"; error?: string } | { kind: "reading" } | { kind: "locked"; wrong?: boolean } | { kind: "other-account" } | { kind: "ready" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fromDmy = (dmy: string) => {
  const [d, m, y] = dmy.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const short = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const range = (a: Date, b: Date) => `${short(a)}${a.getFullYear() !== b.getFullYear() ? ` ${a.getFullYear()}` : ""} – ${short(b)} ${b.getFullYear()}`;
const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/**
 * Upload a bank statement for one account. Everything LEDGERS can work out from the file — the period, the
 * account it belongs to, whether it's locked — it reads instead of asking: pick or drop the file, and only a
 * password-protected PDF asks for anything more. Overlap with what's already in is skipped, not refused.
 */
export function UploadStatementDialog({ account: a, onClose }: { account: CompanyAccount; onClose: () => void }) {
  const credits = useBankingStore((s) => s.uploadCredits);
  const scenario = useBankingStore((s) => s.scenario.statementFile);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEscape(onClose);

  const name = `${a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} ${last4(a.number)}`;
  const today = new Date();
  const lastIn = a.statement ? fromDmy(a.statement.date) : null;
  // What the statement covers, as read from it: from the start of the year up to today, overlapping anything already in.
  const from = lastIn ? new Date(lastIn.getFullYear(), lastIn.getMonth(), 1) : new Date(FY_START);
  const newFrom = lastIn ? new Date(lastIn.getTime() + 86400000) : from;
  const newLines = Math.max(1, Math.round((today.getTime() - newFrom.getTime()) / 86400000) * 2);

  const read = (unlocking = false) => {
    setPhase({ kind: "reading" });
    setTimeout(() => {
      if (!unlocking && scenario === "locked") return setPhase({ kind: "locked" });
      if (scenario === "other-account") return setPhase({ kind: "other-account" });
      setPhase({ kind: "ready" });
    }, 900);
  };

  const take = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPT.includes(ext)) return setPhase({ kind: "pick", error: "Upload a PDF, Excel or CSV statement" });
    if (f.size > MAX_MB * 1024 * 1024) return setPhase({ kind: "pick", error: `That file is over ${MAX_MB} MB` });
    setFile({ name: f.name, size: f.size });
    setPassword("");
    read();
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files?.[0]);
  };

  const reset = () => {
    setFile(null);
    setPhase({ kind: "pick" });
  };

  const importIt = () => {
    if (!file) return;
    useBankingStore.getState().uploadStatement(a.id, file.name, range(from, today));
    useStore.getState().pushToast(`Importing ${file.name} for ${name}. New transactions show up in Transactions once it's read.`);
    onClose();
  };

  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Upload statement for ${name}`}
        className="fixed left-1/2 top-1/2 z-50 flex w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[fade-in_.15s_ease]"
      >
        <Button variant="ghost" size="icon-sm" className="absolute end-4 top-4" onClick={onClose} aria-label="Close">
          <X />
        </Button>
        <div className="flex flex-col gap-4 p-6">
          <div className="pe-8">
            <h2 className="text-base font-semibold text-foreground">Upload statement</h2>
            <p className="mt-1 text-2sm text-muted-foreground">
              {name}
              {a.nickname && ` · ${a.nickname}`}
            </p>
          </div>

          {!file || phase.kind === "pick" ? (
            <div>
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={drop}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-input hover:border-primary/60 hover:bg-muted/40",
                )}
              >
                <UploadCloud className="size-6 text-muted-foreground" />
                <span className="text-2sm text-foreground">
                  Drop your statement here or <span className="font-medium text-primary">browse</span>
                </span>
                <span className="text-xs text-muted-foreground">PDF, Excel or CSV · up to {MAX_MB} MB</span>
              </button>
              <input
                ref={input}
                type="file"
                accept={ACCEPT.join(",")}
                className="hidden"
                onChange={(e) => {
                  take(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {phase.kind === "pick" && phase.error && <div className="mt-2 text-xs text-destructive">{phase.error}</div>}
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-3 px-3.5 py-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-2sm font-medium text-foreground">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{size(file.size)}</div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="Remove file">
                  <X />
                </Button>
              </div>

              <div className="border-t border-border px-3.5 py-3 text-xs">
                {phase.kind === "reading" ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CircularSpinner size={12} /> Reading statement…
                  </span>
                ) : phase.kind === "locked" ? (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (password) read(true);
                    }}
                  >
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Lock className="size-3.5" /> This PDF is password-protected
                    </span>
                    <div className="flex gap-2">
                      <Input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="PDF password" aria-label="PDF password" />
                      <Button type="submit" disabled={!password}>
                        Unlock
                      </Button>
                    </div>
                    <span className="text-muted-foreground">It's usually in the email the statement came with. LEDGERS doesn't keep it.</span>
                  </form>
                ) : phase.kind === "other-account" ? (
                  <span className="flex items-start gap-1.5 text-destructive">
                    <AlertCircle className="mt-px size-3.5 shrink-0" />
                    This statement is for a different account (••4417). Upload the one for {name}.
                  </span>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{range(from, today)}</span>
                    <span className="text-muted-foreground">
                      {lastIn
                        ? `Up to ${short(lastIn)} is already in, so only ${newLines} new transactions are added.`
                        : `${newLines} transactions`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {credits > 0 ? `Uses 1 upload credit · ${credits} left` : `INR ${EXTRA_UPLOAD_FEE} for this upload · no credits left`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={phase.kind !== "ready"} onClick={importIt}>
              Import
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
