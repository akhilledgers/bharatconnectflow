import { useState } from "react";
import { Check } from "lucide-react";
import type { Business } from "../../../../types";
import { Badge } from "../../../../components/ui/badge";
import { popoverCls } from "../../../../components/ui/popover";
import { cn } from "../../../../lib/cn";

const CHECK_GROUPS: { level: 1 | 2 | 3; title: string; eligibility: string; checks: string[] }[] = [
  {
    level: 1,
    title: "Level 1",
    eligibility: "Send and receive invoices.",
    checks: ["Consent given", "Contacts verified by OTP", "Name matched to your GST/PAN record"],
  },
  {
    level: 2,
    title: "Level 2",
    eligibility: "Pay other businesses on-platform.",
    checks: ["PAN/GSTIN ownership verified", "Bank account verified by penny-drop"],
  },
  {
    level: 3,
    title: "Level 3",
    eligibility: "Receive payments on-platform.",
    checks: ["KYC documents verified", "Regulatory due diligence complete"],
  },
];

export function LevelStatus({ business }: { business: Business }) {
  const [hover, setHover] = useState(false);
  const level = business.verification.level;
  const current = CHECK_GROUPS[level - 1];

  return (
    <div className="relative inline-flex" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Badge variant="primary" className="cursor-default">
        Verified for Level {level}
      </Badge>

      {hover && (
        // pt-2 (not mt-2) keeps the hover area continuous between badge and popover.
        <div className="absolute left-0 top-full z-30 pt-2">
          <div className={cn(popoverCls, "w-80 p-4")}>
            <p className="mb-3 text-xs text-muted-foreground">
              You're currently eligible to <span className="font-medium text-foreground">{current.eligibility}</span>
            </p>
            {CHECK_GROUPS.map((group) => {
              const met = level >= group.level;
              return (
                <div key={group.level} className="mb-3 last:mb-0">
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {group.title} <span className="font-normal">· {group.eligibility}</span>
                  </div>
                  <div className="space-y-1">
                    {group.checks.map((check) => (
                      <div key={check} className="flex items-center gap-2 text-2sm">
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full",
                            met ? "bg-[var(--color-success-soft)] text-green-600" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {met && <Check className="size-2.5" strokeWidth={3} />}
                        </span>
                        <span className={met ? "text-foreground" : "text-muted-foreground"}>{check}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
