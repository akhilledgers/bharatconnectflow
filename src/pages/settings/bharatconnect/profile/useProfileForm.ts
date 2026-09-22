import { useCallback, useMemo, useReducer, useRef } from "react";
import type { Business } from "../../../../types";
import { FIELD_CONFIG } from "./fieldConfig";
import { pincodeMatchesState } from "../../../../lib/profile";
import { delay } from "../../../../mock/api";

export interface DraftAddress {
  id: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ProfileValues {
  tradeName: string;
  mcc: string | null;
  additionalAddresses: DraftAddress[];
  settlementAccountId: string | null;
  useAsDefault: boolean;
  primaryMobile: string;
  primaryEmail: string;
  additionalMobiles: string[];
  additionalEmails: string[];
}

export type SaveBarPhase = "idle" | "confirming" | "sending" | "success" | "rejected";

interface FormState {
  saved: ProfileValues;
  draft: ProfileValues;
  phase: SaveBarPhase;
  rejectedFieldId: string | null;
  rejectedMessage: string | null;
  rejectedSnapshot: unknown;
  version: number;
  banner: string | null;
  armReject: boolean;
  armConflict: boolean;
}

type Action =
  | { type: "SET_FIELD"; id: keyof ProfileValues; value: unknown }
  | { type: "PRESS_SAVE" }
  | { type: "CANCEL_CONFIRM" }
  | { type: "CONFIRM_SEND" }
  | { type: "SEND_SUCCESS" }
  | { type: "SEND_REJECTED"; fieldId: string; message: string }
  | { type: "SEND_CONFLICT"; fresh: Partial<ProfileValues> }
  | { type: "REVERT_TO_CLEAN" }
  | { type: "TOGGLE_ARM_REJECT" }
  | { type: "TOGGLE_ARM_CONFLICT" }
  | { type: "DISMISS_BANNER" };

const EDITABLE_KEYS = Object.values(FIELD_CONFIG).filter((f) => f.permission === "editable");

function fieldsChanged(a: ProfileValues, b: ProfileValues): string[] {
  return EDITABLE_KEYS.filter((f) => JSON.stringify(a[f.id as keyof ProfileValues]) !== JSON.stringify(b[f.id as keyof ProfileValues])).map(
    (f) => f.id,
  );
}

function addressErrors(addresses: DraftAddress[]): Record<string, string> {
  const errs: Record<string, string> = {};
  addresses.forEach((a) => {
    if (a.pincode && a.state && !pincodeMatchesState(a.pincode, a.state)) {
      errs[a.id] = `Pincode ${a.pincode} doesn't match ${a.state}. Fix the address or remove it.`;
    }
  });
  return errs;
}

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "SET_FIELD": {
      const draft = { ...state.draft, [action.id]: action.value };
      let phase = state.phase;
      let rejectedFieldId = state.rejectedFieldId;
      let rejectedMessage = state.rejectedMessage;
      // Editing the flagged field clears the rejection lock.
      if (state.phase === "rejected" && action.id === state.rejectedFieldId) {
        phase = "idle";
        rejectedFieldId = null;
        rejectedMessage = null;
      }
      return { ...state, draft, phase, rejectedFieldId, rejectedMessage };
    }
    case "PRESS_SAVE":
      // Only dispatched for tier-2 saves; tier-1-only saves call doSend() directly.
      return { ...state, phase: "confirming" };
    case "CANCEL_CONFIRM":
      return { ...state, phase: "idle" };
    case "CONFIRM_SEND":
      return { ...state, phase: "sending" };
    case "SEND_SUCCESS":
      return { ...state, saved: state.draft, phase: "success", version: state.version + 1 };
    case "SEND_REJECTED":
      return {
        ...state,
        phase: "rejected",
        rejectedFieldId: action.fieldId,
        rejectedMessage: action.message,
        rejectedSnapshot: state.draft[action.fieldId as keyof ProfileValues],
      };
    case "SEND_CONFLICT":
      return {
        ...state,
        saved: { ...state.saved, ...action.fresh },
        version: state.version + 1,
        phase: "idle",
        banner: "This profile changed elsewhere. We refreshed it and kept your edits.",
      };
    case "REVERT_TO_CLEAN":
      return { ...state, phase: "idle" };
    case "TOGGLE_ARM_REJECT":
      return { ...state, armReject: !state.armReject, armConflict: false };
    case "TOGGLE_ARM_CONFLICT":
      return { ...state, armConflict: !state.armConflict, armReject: false };
    case "DISMISS_BANNER":
      return { ...state, banner: null };
    default:
      return state;
  }
}

function seedValues(business: Business): ProfileValues {
  return {
    tradeName: business.profileDraft.tradeName || business.name,
    mcc: business.profileDraft.mcc,
    additionalAddresses:
      business.profileDraft.additionalAddresses.length > 0
        ? business.profileDraft.additionalAddresses.map((a, i) => ({
            id: `addr-${i}`,
            line1: a.line1,
            city: a.city,
            state: a.state,
            pincode: a.pincode,
          }))
        : [{ id: "addr-seed", line1: "4th Cross, Anna Nagar", city: "Daman", state: "TAMIL NADU", pincode: "396220" }],
    settlementAccountId: business.bankAccounts.find((a) => a.verified)?.id ?? null,
    useAsDefault: true,
    primaryMobile: business.contacts.mobileMasked,
    primaryEmail: business.contacts.emailMasked,
    additionalMobiles: business.profileDraft.additionalMobiles,
    additionalEmails: business.profileDraft.additionalEmails,
  };
}

export function useProfileForm(business: Business) {
  const initial = useMemo<FormState>(() => {
    const saved = seedValues(business);
    // Seed one tier-1 change (MCC) and one tier-2 change (default settlement toggle)
    // already pending in the draft, so every Save-bar state is reachable immediately
    // regardless of how many verified bank accounts this business has.
    const draft: ProfileValues = {
      ...saved,
      mcc: saved.mcc ?? "6211",
      useAsDefault: !saved.useAsDefault,
    };
    return {
      saved,
      draft,
      phase: "idle",
      rejectedFieldId: null,
      rejectedMessage: null,
      rejectedSnapshot: null,
      version: 1,
      banner: null,
      armReject: false,
      armConflict: false,
    };
  }, [business.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, dispatch] = useReducer(reducer, initial);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changedFieldIds = useMemo(() => fieldsChanged(state.saved, state.draft), [state.saved, state.draft]);
  const errors = useMemo(() => addressErrors(state.draft.additionalAddresses), [state.draft.additionalAddresses]);
  const hasErrors = Object.keys(errors).length > 0;
  const hasChanges = changedFieldIds.length > 0;

  const barState: SaveBarPhase | "clean" | "dirty" | "invalid" =
    state.phase !== "idle" ? state.phase : hasErrors ? "invalid" : hasChanges ? "dirty" : "clean";

  const setField = useCallback((id: keyof ProfileValues, value: unknown) => {
    dispatch({ type: "SET_FIELD", id, value });
  }, []);

  const cancelConfirm = useCallback(() => dispatch({ type: "CANCEL_CONFIRM" }), []);

  const doSend = useCallback(async () => {
    dispatch({ type: "CONFIRM_SEND" });
    await delay(undefined, 700, 1100);

    if (state.armConflict) {
      // Simulate someone else changing a field the user never touched — merge
      // the fresh server value in, but leave every one of the user's pending
      // edits exactly as they left them.
      const untouchedDefault = state.saved.useAsDefault === state.draft.useAsDefault;
      dispatch({
        type: "SEND_CONFLICT",
        fresh: untouchedDefault ? { useAsDefault: !state.saved.useAsDefault } : {},
      });
      return;
    }
    if (state.armReject) {
      dispatch({
        type: "SEND_REJECTED",
        fieldId: "settlementAccountId",
        message: "BharatConnect couldn't verify this settlement account with the bank.",
      });
      return;
    }
    dispatch({ type: "SEND_SUCCESS" });
    successTimer.current = setTimeout(() => dispatch({ type: "REVERT_TO_CLEAN" }), 3000);
  }, [state.armConflict, state.armReject, state.saved, state.draft]);

  const confirmSend = useCallback(() => {
    doSend();
  }, [doSend]);

  const pressSaveOrConfirm = useCallback(() => {
    if (hasErrors) return;
    const isTier2 = changedFieldIds.some((id) => FIELD_CONFIG[id]?.tier === 2);
    if (isTier2) {
      dispatch({ type: "PRESS_SAVE" });
    } else {
      doSend();
    }
  }, [hasErrors, changedFieldIds, doSend]);

  const toggleArmReject = useCallback(() => dispatch({ type: "TOGGLE_ARM_REJECT" }), []);
  const toggleArmConflict = useCallback(() => dispatch({ type: "TOGGLE_ARM_CONFLICT" }), []);
  const dismissBanner = useCallback(() => dispatch({ type: "DISMISS_BANNER" }), []);

  return {
    draft: state.draft,
    saved: state.saved,
    changedFieldIds,
    errors,
    barState,
    rejectedFieldId: state.rejectedFieldId,
    rejectedMessage: state.rejectedMessage,
    rejectedSnapshot: state.rejectedSnapshot,
    banner: state.banner,
    armReject: state.armReject,
    armConflict: state.armConflict,
    setField,
    pressSave: pressSaveOrConfirm,
    cancelConfirm,
    confirmSend,
    toggleArmReject,
    toggleArmConflict,
    dismissBanner,
  };
}
