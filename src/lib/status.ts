import type { ConnectionState } from "../types";

export interface StatusMeta {
  label: string;
  dotClass: string;
  needsAction: boolean;
}

export const STATUS_META: Record<ConnectionState, StatusMeta> = {
  not_connected: { label: "Not connected", dotClass: "bg-gray-400", needsAction: true },
  existing_id_found: { label: "ID found", dotClass: "bg-blue-500", needsAction: true },
  setting_up: { label: "Setting up", dotClass: "bg-amber-500", needsAction: false },
  connected: { label: "Connected", dotClass: "bg-emerald-500", needsAction: false },
  needs_attention: { label: "Needs attention", dotClass: "bg-red-500", needsAction: true },
  assisted_setup: { label: "Assisted setup", dotClass: "bg-blue-500", needsAction: true },
};

export function isBannerSnoozed(snoozedUntil: string | null): boolean {
  if (!snoozedUntil) return false;
  return new Date(snoozedUntil).getTime() > Date.now();
}
