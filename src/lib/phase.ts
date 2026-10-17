/**
 * Phase 1 scope (see README → Phase 1 scope). Features built but switched off until Phase 2.
 * What other platforms send us (a buyer returning our invoice, a supplier editing or cancelling a bill)
 * is always handled — these flags only cover what our own users can start.
 */
export const PHASE2 = {
  /** Buyer's Return on a bill (reqConfirmInvoice → RETURN). Phase 1: Accept / Reject only. */
  buyerReturn: false,
  /** Supplier's Edit & Resend on a sent invoice (reqEditInvoice, version change). Phase 1: Cancel and create a new one. */
  editAndResend: false,
};
