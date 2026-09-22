import { useStore } from "../../../store/useStore";
import { ConnectFlow } from "./ConnectFlow";
import { LinkExistingId } from "./LinkExistingId";
import { SettingUp } from "./SettingUp";
import { AssistedSetup } from "./AssistedSetup";
import { Overview } from "./Overview";

export function BharatConnectPage() {
  const business = useStore((s) => s.currentBusiness());

  switch (business.connectionState) {
    case "connected":
    case "needs_attention":
      return <Overview business={business} />;
    case "existing_id_found":
      return <LinkExistingId business={business} />;
    case "setting_up":
      return <SettingUp business={business} />;
    case "assisted_setup":
      return <AssistedSetup business={business} />;
    case "not_connected":
    default:
      return <ConnectFlow business={business} />;
  }
}
