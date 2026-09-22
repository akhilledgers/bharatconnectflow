import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Business } from "../../../../types";
import { Modal } from "./Modal";
import { DocumentsCard } from "./DocumentsCard";

export function FullVerificationNudge({ business }: { business: Business }) {
  const [open, setOpen] = useState(false);

  if (business.verification.level >= 3) return null;

  const requested = business.kycDocuments.some((d) => d.status === "requested");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover"
      >
        {requested && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
        Reach full verification to receive payments on-platform
        <ArrowRight className="h-3.5 w-3.5" />
      </button>

      {open && (
        <Modal title="Reach full verification" onClose={() => setOpen(false)}>
          <DocumentsCard business={business} />
        </Modal>
      )}
    </>
  );
}
