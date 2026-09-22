import { useRef, useState } from "react";
import type { Business, KycDocument } from "../../../../types";
import { useStore } from "../../../../store/useStore";

const STATUS_META: Record<KycDocument["status"], { label: string; className: string }> = {
  not_uploaded: { label: "Not uploaded", className: "bg-gray-100 text-faint" },
  uploaded: { label: "Uploaded — pending review", className: "bg-blue-50 text-blue-700" },
  requested: { label: "Requested by BharatConnect", className: "bg-amber-50 text-amber-700" },
  verified: { label: "Verified", className: "bg-emerald-50 text-emerald-700" },
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
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-b-0">
      <div>
        <div className="text-sm font-medium text-ink">{doc.label}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
            {uploading ? "Uploading…" : meta.label}
          </span>
          {doc.fileName && (
            <span className="text-xs text-faint">
              {doc.fileName} · {doc.uploadedAt}
            </span>
          )}
        </div>
      </div>
      <div>
        <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-body hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {doc.status === "requested" ? "Re-upload" : doc.status === "not_uploaded" ? "Upload" : "Uploaded"}
        </button>
      </div>
    </div>
  );
}

/** Pure content — rendered inside the "reach full verification" modal, opened from the nudge. */
export function DocumentsCard({ business }: { business: Business }) {
  const devRequestKycDocument = useStore((s) => s.devRequestKycDocument);
  const requested = business.kycDocuments.find((d) => d.status === "requested");

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm text-faint">
          Upload these so BharatConnect can complete due diligence and let you receive payments on-platform.
          BharatConnect can ask for any of them again later.
        </p>
      </div>
      <button
        onClick={() => devRequestKycDocument(business.id)}
        className="mb-4 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-faint hover:bg-gray-50"
        title="Dev: simulate BharatConnect asking for a document again"
      >
        Simulate re-request
      </button>

      {requested && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          BharatConnect asked you to re-upload <span className="font-medium">{requested.label}</span>.
        </div>
      )}

      <div>
        {business.kycDocuments.map((doc) => (
          <DocRow key={doc.id} doc={doc} business={business} />
        ))}
      </div>
    </div>
  );
}
