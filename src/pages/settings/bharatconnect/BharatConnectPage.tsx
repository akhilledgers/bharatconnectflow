import { useStore } from "../../../store/useStore";
import { ConnectFlow } from "./ConnectFlow";
import { LinkExistingId } from "./LinkExistingId";
import { AssistedSetup } from "./AssistedSetup";
import { Overview } from "./Overview";

export function BharatConnectPage() {
  const business = useStore((s) => s.currentBusiness());
  const connectFlow = useStore((s) => s.connectFlow[s.currentBusinessId]);

  // Keep showing the connect flow (its own progress/success screen) while a
  // submission is in flight or was just confirmed — connectionState flips to
  // "connected" the instant the mock webhook resolves, and without this check
  // this switch would swap straight to Overview before the success screen
  // (and its own timed auto-redirect) ever gets to render.
  if (connectFlow && connectFlow.submitPhase !== "idle" && connectFlow.submitPhase !== "error") {
    return <ConnectFlow business={business} />;
  }

  switch (business.connectionState) {
    case "connected":
    case "needs_attention":
      return <Overview business={business} />;
    case "existing_id_found":
      return <LinkExistingId business={business} />;
    case "assisted_setup":
      return <AssistedSetup business={business} />;
    // Registration sent, waiting for Bharat Connect's response: stays on the onboarding page.
    case "setting_up":
    case "not_connected":
    default:
      return <ConnectFlow business={business} />;
  }
}
