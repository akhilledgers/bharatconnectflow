import { Link } from "react-router-dom";
import type { Business } from "../../../../../types";
import { FIELD_CONFIG } from "../fieldConfig";
import { ProfileSection, ReadonlyRow } from "../fields";
import { Badge } from "../../../../../components/ui/badge";

export function TaxSection({ business }: { business: Business }) {
  const defaultId = business.bharatConnectIds.find((i) => i.status === "active");

  return (
    <ProfileSection
      id="tax"
      title="Tax & legal IDs"
      aside={
        business.bharatConnectIds.length > 0 && (
          <Badge variant="secondary">
            {business.bharatConnectIds.filter((i) => i.status === "active").length} active ID
            {business.bharatConnectIds.filter((i) => i.status === "active").length === 1 ? "" : "s"}
          </Badge>
        )
      }
    >
        <ReadonlyRow meta={FIELD_CONFIG.pan} value={<span className="font-mono text-xs">{business.pan}</span>} />
        <ReadonlyRow meta={FIELD_CONFIG.gstin} value={business.gstin ? <span className="font-mono text-xs">{business.gstin}</span> : "Not on file"} />
        <ReadonlyRow
          meta={FIELD_CONFIG.defaultBcId}
          value={
            defaultId ? (
              <span className="inline-flex items-center gap-3">
                <span className="font-mono text-xs">{defaultId.id}</span>
                <Link to="/settings/bharatconnect/ids" className="text-xs font-medium text-primary hover:underline">
                  Manage
                </Link>
              </span>
            ) : (
              <span className="text-muted-foreground">Not connected yet</span>
            )
          }
        />
    </ProfileSection>
  );
}
