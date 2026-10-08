import { Badge, type BadgeVariant } from "../../components/ui/badge";
import type { CompanyAccount } from "./data";
import { shortDate } from "./overviewData";

/** How an account's bank data reaches LEDGERS, as a status badge (Live / Connection expired / Statement · date / …). */
export function SyncBadge({ account: a }: { account: CompanyAccount }) {
  let variant: BadgeVariant = "secondary";
  let label: string;
  if (!a.active) label = "Inactive";
  else if (a.bankKey && a.connection === "connected") [variant, label] = ["success", "Live"];
  else if (a.bankKey && a.connection === "expired") [variant, label] = ["warning", "Connection expired"];
  else if (a.statement) label = `Statement · ${shortDate(a.statement.date)}`;
  else label = a.bankKey ? "Not connected" : "No statement yet";
  return <Badge variant={variant}>{label}</Badge>;
}
