import { useState } from "react";
import { X } from "lucide-react";
import type { Business } from "../../../../../types";
import type { useProfileForm } from "../useProfileForm";
import { FIELD_CONFIG } from "../fieldConfig";
import { FieldShell, ProfileSection, TextInput } from "../fields";
import { Input } from "../../../../../components/ui/input";
import { Button } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";

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

  function add() {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1 pe-1">
              {item}
              <button onClick={() => onRemove(item)} aria-label={`Remove ${item}`} className="cursor-pointer rounded-sm opacity-60 hover:opacity-100">
                <X />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">None added</p>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
        />
        <Button variant="outline" onClick={add}>
          Add
        </Button>
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
    <ProfileSection id="contacts" title="Contacts & Notifications" description="Where Bharat Connect sends OTPs and notifications for this business.">
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
    </ProfileSection>
  );
}
