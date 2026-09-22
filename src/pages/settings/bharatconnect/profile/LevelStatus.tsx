import { useState } from "react";
import type { Business } from "../../../../types";

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
    <div
      className="relative inline-block"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="cursor-default text-sm text-faint">
        Verified for: <span className="font-medium text-body">Level {level}</span>
      </span>

      {hover && (
        <div className="absolute left-0 top-full z-10 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm text-body">
            You're currently eligible to <span className="font-medium text-ink">{current.eligibility}</span>
          </div>
          {CHECK_GROUPS.map((group) => {
            const met = level >= group.level;
            return (
              <div key={group.level} className="mb-3 last:mb-0">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-faint">
                  {group.title}
                  <span className="normal-case">— {group.eligibility}</span>
                </div>
                <div className="space-y-1">
                  {group.checks.map((check) => (
                    <div key={check} className="flex items-center gap-2 text-sm">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                          met ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-faint"
                        }`}
                      >
                        {met ? "✓" : ""}
                      </span>
                      <span className={met ? "text-ink" : "text-faint"}>{check}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
