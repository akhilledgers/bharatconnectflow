import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/input";
import { useBankingStore } from "../../store/useBankingStore";
import type { BusinessType } from "../../types";
import { CASH_PARENT } from "./cash";
import { GROUP_LABEL, GROUP_ORDER, accountName, groupOf } from "./data";
import { personLedger } from "./otherAccounts";

const ADD_PERSON = "__add-person";

/**
 * Received in / Paid from: one dropdown for where the money went (or came from). Banking's own accounts come first (they're
 * reconciled); then people's accounts and the chart-of-accounts heads that hold money. A director's or
 * proprietor's account can be added in place: the user types the name, the head follows from the business type.
 */
export function AccountPicker({
  label,
  value,
  onChange,
  businessType,
  includeCards,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  businessType: BusinessType;
  /** Paying: a credit card can pay a bill; nothing is received into one. */
  includeCards?: boolean;
}) {
  const banks = useBankingStore((s) => s.accounts).filter((a) => a.active && (includeCards || groupOf(a) !== "card"));
  const cash = useBankingStore((s) => s.cashAccounts).filter((a) => a.active);
  const others = useBankingStore((s) => s.otherAccounts);
  const people = others.filter((a) => a.person);
  const heads = others.filter((a) => !a.person);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const preview = name.trim() ? personLedger(name.trim(), businessType) : null;

  const add = () => {
    const account = useBankingStore.getState().addPersonAccount(name, businessType);
    onChange(account.id);
    setAdding(false);
    setName("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        aria-label={label}
        value={adding ? ADD_PERSON : value}
        onChange={(e) => {
          if (e.target.value === ADD_PERSON) return setAdding(true);
          setAdding(false);
          onChange(e.target.value);
        }}
      >
        {GROUP_ORDER.filter((g) => includeCards || g !== "card").map((g) => {
          const list = banks.filter((a) => groupOf(a) === g);
          return (
            list.length > 0 && (
              <optgroup key={g} label={GROUP_LABEL[g]}>
                {list.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountName(a)}
                    {a.nickname ? ` · ${a.nickname}` : ""}
                  </option>
                ))}
              </optgroup>
            )
          );
        })}
        {cash.length > 0 && (
          <optgroup label={CASH_PARENT}>
            {cash.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label={businessType === "company" ? "Directors" : "Owners"}>
          {people.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          <option value={ADD_PERSON}>{businessType === "company" ? "+ Add director's account" : "+ Add owner's account"}</option>
        </optgroup>
        <optgroup label="Other accounts">
          {heads.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
      </Select>
      {adding && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
          <div className="flex gap-2">
            <Input autoFocus aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && preview && add()} />
            <Button variant="primary" disabled={!preview} onClick={add}>
              Add
            </Button>
          </div>
          {preview && (
            <div className="text-xs text-muted-foreground">
              Saved as <span className="text-foreground">{preview.name}</span> under {preview.head}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
