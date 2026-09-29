import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { Business, KycDocument } from "../../../../types";
import { useStore } from "../../../../store/useStore";
import { Badge, type BadgeVariant } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";

const STATUS_META: Record<KycDocument["status"], { label: string; variant: BadgeVariant }> = {
  not_uploaded: { label: "Not uploaded", variant: "secondary" },
  uploaded: { label: "Uploaded — pending review", variant: "primary" },
  requested: { label: "Requested by BharatConnect", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
};

function DocRow({ doc, business }: { doc: KycDocument; business: Business }) {
  const uploadKycDocument = useStore((s) => s.uploadKycDocument);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = STATUS_META[doc.status];
  const canUpload = doc.status !== "verified" && doc.status !== "uploaded" && !uploading;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadKycDocument(business.id, doc.id, file.name);
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{doc.label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge variant={uploading ? "primary" : meta.variant}>{uploading ? "Uploading…" : meta.label}</Badge>
          {doc.fileName && (
            <span className="truncate text-xs text-muted-foreground">
              {doc.fileName} · {doc.uploadedAt}
            </span>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={!canUpload}>
        <Upload />
        {doc.status === "requested" ? "Re-upload" : doc.status === "not_uploaded" ? "Upload" : "Uploaded"}
      </Button>
    </div>
  );
}

/** Pure content — rendered inside the "reach full verification" dialog, opened from the header button. */
export function DocumentsCard({ business }: { business: Business }) {
  const devRequestKycDocument = useStore((s) => s.devRequestKycDocument);
  const requested = business.kycDocuments.find((d) => d.status === "requested");

  return (
    <div>
      {requested && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-[var(--color-warning-soft)] px-3 py-2 text-xs text-[var(--color-warning-accent)]">
          BharatConnect asked you to re-upload <span className="font-medium">{requested.label}</span>.
        </div>
      )}

      <div>
        {business.kycDocuments.map((doc) => (
          <DocRow key={doc.id} doc={doc} business={business} />
        ))}
      </div>

      {/* Dev tooling, kept here because the dev panel sits behind this dialog. */}
      <button
        onClick={() => devRequestKycDocument(business.id)}
        className="mt-4 cursor-pointer rounded-md border border-dashed border-input px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
        title="Dev: simulate BharatConnect asking for a document again"
      >
        Dev · Simulate re-request
      </button>
    </div>
  );
}
