import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { octoberSepPending, useHrmsStore } from "../../../store/useHrmsStore";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/popover";
import { REVISION_MONTH } from "../payroll";

// October 2026 — the first month on the new ceiling. The September difference is only ever worked out by
// re-running September (answer "Yes, on the old ceiling" if it was already paid), so while September still
// stands on the old ceiling October shows an alert that leads there. A difference created after October has
// run goes to the first month not yet run. Higher employer PF always increases CTC — the CTC column shows the old one.

export function OctoberRerunAlert() {
  const navigate = useNavigate();
  const state = useHrmsStore();
  if (!octoberSepPending(state) || state.octAlertDismissed) return null;

  return (
    <div className="mb-5">
      <Callout
        tone="warning"
        icon={<AlertTriangle className="size-5 text-amber-600" />}
        title="September payroll was calculated on the old ₹15,000 PF ceiling"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={state.dismissOctAlert}>
              Not now
            </Button>
            <Button size="sm" variant="primary" onClick={() => navigate(`/hrms/payroll/computation?month=${REVISION_MONTH}`)}>
              Re-run September <ArrowRight />
            </Button>
          </>
        }
      >
        The new ₹25,000 ceiling applies from 17 Sep 2026. To work out the PF difference for 17–30 Sep and recover it in October, re-run September
        and answer "Yes, on the old ceiling" if salaries were already paid.
      </Callout>
    </div>
  );
}
