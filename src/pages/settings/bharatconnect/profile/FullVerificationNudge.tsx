import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Business } from "../../../../types";
import { Button } from "../../../../components/ui/button";
import { Dialog } from "../../../../components/ui/dialog";
import { DocumentsCard } from "./DocumentsCard";

export function FullVerificationNudge({ business }: { business: Business }) {
  const [open, setOpen] = useState(false);

  if (business.verification.level >= 3) return null;

  const requested = business.kycDocuments.some((d) => d.status === "requested");

  return (
    <>
      <Button variant="outline" size="md" onClick={() => setOpen(true)} title="Upload KYC documents to receive payments on-platform">
        <ShieldCheck />
        Reach Full Verification
        {requested && <span className="size-1.5 rounded-full bg-amber-500" aria-label="A document was re-requested" />}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reach full verification"
        description="Upload these so BharatConnect can complete due diligence and let you receive payments on-platform. BharatConnect can ask for any of them again later."
      >
        <DocumentsCard business={business} />
      </Dialog>
    </>
  );
}
