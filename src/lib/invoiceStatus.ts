import type { Invoice } from "../types";

export function statusLabel(status: Invoice["status"]): string {
  if (status === "unpaid") return "Not Paid";
  if (status === "partly_paid") return "Partly Paid";
  return "Paid";
}

export function statusClass(status: Invoice["status"]): string {
  if (status === "unpaid") return "text-red-600";
  if (status === "partly_paid") return "text-amber-600";
  return "text-emerald-600";
}

export function statusPillClass(status: Invoice["status"]): string {
  if (status === "unpaid") return "bg-red-50 text-red-600";
  if (status === "partly_paid") return "bg-amber-50 text-amber-600";
  return "bg-emerald-50 text-emerald-600";
}

export function confirmationMeta(status: Invoice["bcConfirmationStatus"]): { label: string; className: string } | null {
  if (status === "accepted") return { label: "Accepted", className: "bg-amber-50 text-amber-700" };
  if (status === "failure") return { label: "Failure", className: "bg-red-50 text-red-700" };
  if (status === "pending") return { label: "Pending", className: "bg-blue-50 text-blue-700" };
  return null;
}
