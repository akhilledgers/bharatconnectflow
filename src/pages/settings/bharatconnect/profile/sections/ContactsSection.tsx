import { useState } from "react";
import type { Business } from "../../../../../types";
import type { useProfileForm } from "../useProfileForm";
import { FIELD_CONFIG } from "../fieldConfig";
import { FieldShell, TextInput } from "../fields";

function ChipList({
  items,
  onRemove,
  onAdd,
  placeholder,
}: {
  items: string[];
  onRemove: (v: string) => void;
  onAdd: (v: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-body"
          >
            {item}
            <button onClick={() => onRemove(item)} className="text-faint hover:text-body">
              ✕
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-faint">None added</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onAdd(draft.trim());
              setDraft("");
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => {
            if (draft.trim()) {
              onAdd(draft.trim());
              setDraft("");
            }
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-body hover:bg-gray-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function ContactsSection({
  business: _business,
  form,
}: {
  business: Business;
  form: ReturnType<typeof useProfileForm>;
}) {
  const { draft, changedFieldIds, setField } = form;

  return (
    <section id="contacts" className="scroll-mt-28">
      <h2 className="mb-1 text-base font-semibold text-ink">Contacts &amp; notifications</h2>

      <div className="divide-y divide-gray-100">
        <FieldShell
          meta={FIELD_CONFIG.primaryMobile}
          changed={changedFieldIds.includes("primaryMobile")}
          hint="Used for ownership and OTP checks. Changing it needs confirmation."
        >
          <TextInput value={draft.primaryMobile} onChange={(v) => setField("primaryMobile", v)} />
        </FieldShell>

        <FieldShell meta={FIELD_CONFIG.primaryEmail} changed={changedFieldIds.includes("primaryEmail")}>
          <TextInput value={draft.primaryEmail} onChange={(v) => setField("primaryEmail", v)} />
        </FieldShell>

        <FieldShell meta={FIELD_CONFIG.additionalMobiles} changed={changedFieldIds.includes("additionalMobiles")} layout="block">
          <ChipList
            items={draft.additionalMobiles}
            onAdd={(v) => setField("additionalMobiles", [...draft.additionalMobiles, v])}
            onRemove={(v) => setField("additionalMobiles", draft.additionalMobiles.filter((m) => m !== v))}
            placeholder="+91 …"
          />
        </FieldShell>

        <FieldShell meta={FIELD_CONFIG.additionalEmails} changed={changedFieldIds.includes("additionalEmails")} layout="block">
          <ChipList
            items={draft.additionalEmails}
            onAdd={(v) => setField("additionalEmails", [...draft.additionalEmails, v])}
            onRemove={(v) => setField("additionalEmails", draft.additionalEmails.filter((m) => m !== v))}
            placeholder="name@company.com"
          />
        </FieldShell>
      </div>
    </section>
  );
}
