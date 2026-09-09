import { useState } from "react";
import {
  ChevronLeft,
  Pencil,
  Check,
  X,
  Droplet,
  AlertTriangle,
  Activity,
  HeartPulse,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";

type Tone = "blue" | "amber" | "green";

const tones = {
  blue: "bg-[#eef4ff] text-[#1f6feb]",
  amber: "bg-[#fff5e5] text-[#b56b00]",
  green: "bg-[#e8f6ee] text-[#1f7a44]",
} as const;

type Contact = {
  id: string;
  name: string;
  relation: string;
  phone: string;
  primary?: boolean;
};

type Entry = { id: string; title: string; meta: string };

type Profile = {
  name: string;
  details: string;
  bloodGroup: string;
  organDonor: string;
  contacts: Contact[];
  allergies: Entry[];
  conditions: Entry[];
};

const initialProfile: Profile = {
  name: "Arjun Raghavan",
  details: "34 years · Male · +91 98••• ••432",
  bloodGroup: "O+ Positive",
  organDonor: "Registered",
  contacts: [
    {
      id: "c1",
      name: "Meera Raghavan",
      relation: "Spouse",
      phone: "+91 98••• ••110",
      primary: true,
    },
    {
      id: "c2",
      name: "Vikram Raghavan",
      relation: "Brother",
      phone: "+91 99••• ••884",
    },
    {
      id: "c3",
      name: "Dr. Kavita Iyer",
      relation: "Family doctor",
      phone: "+91 81••• ••020",
    },
  ],
  allergies: [
    { id: "a1", title: "Penicillin", meta: "Severe · anaphylaxis history" },
    { id: "a2", title: "Peanuts", meta: "Moderate · skin reaction" },
  ],
  conditions: [
    { id: "d1", title: "Asthma", meta: "Inhaler-dependent · since 2014" },
    { id: "d2", title: "Hypertension", meta: "Stage 1 · medically managed" },
  ],
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Field({
  value,
  onChange,
  placeholder,
  small,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  small?: boolean;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-[#f4f7fc] border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 outline-none focus:border-[#1f6feb] focus:bg-white transition-colors ${
        small ? "text-[12px]" : "text-[14px]"
      }`}
    />
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  tone = "blue",
  editing,
  onChange,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: Tone;
  editing?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${tones[tone]}`}
      >
        <Icon className="w-4.5 h-4.5" strokeWidth={2.2} />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      {editing ? (
        <div className="mt-1.5">
          <Field value={value} onChange={(v) => onChange?.(v)} small />
        </div>
      ) : (
        <div className="text-[15px] text-slate-900 mt-0.5 leading-tight">
          {value}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  icon: Icon,
  entry,
  tone = "blue",
  editing,
  onChange,
  onRemove,
  titlePlaceholder,
  metaPlaceholder,
}: {
  icon: any;
  entry: Entry;
  tone?: Tone;
  editing?: boolean;
  onChange?: (e: Entry) => void;
  onRemove?: () => void;
  titlePlaceholder?: string;
  metaPlaceholder?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}
      >
        <Icon className="w-5 h-5" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-1.5">
            <Field
              value={entry.title}
              placeholder={titlePlaceholder}
              onChange={(v) => onChange?.({ ...entry, title: v })}
            />
            <Field
              value={entry.meta}
              placeholder={metaPlaceholder}
              onChange={(v) => onChange?.({ ...entry, meta: v })}
              small
            />
          </div>
        ) : (
          <>
            <div className="text-[14px] text-slate-900 leading-tight">
              {entry.title}
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              {entry.meta}
            </div>
          </>
        )}
      </div>
      {editing && (
        <button
          onClick={onRemove}
          className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center active:bg-slate-200 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  editing,
  onChange,
  onRemove,
  onMakePrimary,
}: {
  contact: Contact;
  editing?: boolean;
  onChange?: (c: Contact) => void;
  onRemove?: () => void;
  onMakePrimary?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-11 h-11 rounded-full bg-[#eef4ff] text-[#1f6feb] flex items-center justify-center text-[13px] shrink-0">
        {initialsOf(contact.name)}
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-1.5">
            <Field
              value={contact.name}
              placeholder="Full name"
              onChange={(v) => onChange?.({ ...contact, name: v })}
            />
            <div className="flex gap-1.5">
              <Field
                value={contact.relation}
                placeholder="Relation"
                onChange={(v) => onChange?.({ ...contact, relation: v })}
                small
              />
              <Field
                value={contact.phone}
                placeholder="Phone"
                onChange={(v) => onChange?.({ ...contact, phone: v })}
                small
              />
            </div>
            <button
              onClick={onMakePrimary}
              className={`text-[11px] uppercase tracking-[0.1em] px-2 py-1 rounded ${
                contact.primary
                  ? "bg-[#eef4ff] text-[#1f6feb]"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {contact.primary ? "Primary contact" : "Set as primary"}
            </button>
          </div>
        ) : (
          <>
            <div className="text-[14px] text-slate-900 leading-tight flex items-center gap-2">
              <span className="truncate">{contact.name}</span>
              {contact.primary && (
                <span className="text-[10px] uppercase tracking-[0.1em] text-[#1f6feb] bg-[#eef4ff] px-1.5 py-0.5 rounded shrink-0">
                  Primary
                </span>
              )}
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              {contact.relation} · {contact.phone}
            </div>
          </>
        )}
      </div>
      {editing ? (
        <button
          onClick={onRemove}
          className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center active:bg-slate-200 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button className="w-9 h-9 rounded-full bg-[#1f6feb] text-white flex items-center justify-center shrink-0">
          <Phone className="w-4 h-4" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between px-1 mt-6 mb-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
        {title}
      </div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-slate-300 text-[13px] text-slate-500 active:bg-white transition-colors"
    >
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

export function MedicalProfileScreen({ onBack }: { onBack?: () => void }) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [draft, setDraft] = useState<Profile>(initialProfile);
  const [editing, setEditing] = useState(false);

  const data = editing ? draft : profile;
  const update = (patch: Partial<Profile>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const startEdit = () => {
    setDraft(profile);
    setEditing(true);
  };
  const save = () => {
    setProfile(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  const updateEntry = (key: "allergies" | "conditions", entry: Entry) =>
    update({
      [key]: draft[key].map((e) => (e.id === entry.id ? entry : e)),
    } as Partial<Profile>);
  const removeEntry = (key: "allergies" | "conditions", id: string) =>
    update({ [key]: draft[key].filter((e) => e.id !== id) } as Partial<Profile>);
  const addEntry = (key: "allergies" | "conditions") =>
    update({
      [key]: [
        ...draft[key],
        { id: `${key}-${Date.now()}`, title: "", meta: "" },
      ],
    } as Partial<Profile>);

  return (
    <div className="flex flex-col h-full bg-[#f7faff]">
      <div className="px-5 pt-3 pb-4 flex items-center justify-between bg-white">
        {editing ? (
          <button
            onClick={cancel}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
          >
            <X className="w-4.5 h-4.5 text-slate-700" />
          </button>
        ) : (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
        )}
        <div className="text-[15px] text-slate-900">
          {editing ? "Edit profile" : "Emergency Profile"}
        </div>
        {editing ? (
          <button
            onClick={save}
            className="h-9 px-3.5 rounded-full bg-[#1f6feb] text-white flex items-center gap-1.5 text-[13px] active:bg-[#1a5ec7] transition-colors"
          >
            <Check className="w-4 h-4" strokeWidth={2.6} /> Save
          </button>
        ) : (
          <button
            onClick={startEdit}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
          >
            <Pencil className="w-4 h-4 text-slate-700" />
          </button>
        )}
      </div>

      <div className="px-6 pt-4 pb-6 bg-white flex items-center gap-4 border-b border-slate-100">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2c7cf5] to-[#1d5fd6] text-white flex items-center justify-center text-[20px] shrink-0">
          {initialsOf(data.name)}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-1.5">
              <Field
                value={draft.name}
                placeholder="Full name"
                onChange={(v) => update({ name: v })}
              />
              <Field
                value={draft.details}
                placeholder="Age · Gender · Phone"
                onChange={(v) => update({ details: v })}
                small
              />
            </div>
          ) : (
            <>
              <div className="text-[18px] text-slate-900 tracking-tight">
                {data.name}
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                {data.details}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#e8f6ee] text-[#1f7a44]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
                <span className="text-[11px]">Visible to responders</span>
              </div>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="px-5 pt-4">
          <div className="text-[12px] text-[#1f6feb] bg-[#eef4ff] border border-[#1f6feb]/15 rounded-xl px-3.5 py-2.5 leading-snug">
            Keep this accurate — responders see it the moment you send an SOS.
          </div>
        </div>
      )}

      <div className="px-5 pt-5">
        <SectionHeader title="Emergency contacts" />
        <div className="bg-white border border-slate-200/80 rounded-2xl px-4 divide-y divide-slate-100">
          {data.contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              editing={editing}
              onChange={(next) =>
                update({
                  contacts: draft.contacts.map((x) =>
                    x.id === next.id ? next : x,
                  ),
                })
              }
              onRemove={() =>
                update({
                  contacts: draft.contacts.filter((x) => x.id !== c.id),
                })
              }
              onMakePrimary={() =>
                update({
                  contacts: draft.contacts.map((x) => ({
                    ...x,
                    primary: x.id === c.id,
                  })),
                })
              }
            />
          ))}
          {data.contacts.length === 0 && (
            <div className="py-4 text-[13px] text-slate-400">
              No contacts added yet.
            </div>
          )}
        </div>
        {editing && (
          <AddButton
            label="Add another contact"
            onClick={() =>
              update({
                contacts: [
                  ...draft.contacts,
                  {
                    id: `c-${Date.now()}`,
                    name: "",
                    relation: "",
                    phone: "",
                  },
                ],
              })
            }
          />
        )}

        <SectionHeader title="Critical information" />
        <div className="grid grid-cols-2 gap-3">
          <InfoTile
            icon={Droplet}
            label="Blood group"
            value={data.bloodGroup}
            editing={editing}
            onChange={(v) => update({ bloodGroup: v })}
          />
          <InfoTile
            icon={HeartPulse}
            label="Organ donor"
            value={data.organDonor}
            tone="green"
            editing={editing}
            onChange={(v) => update({ organDonor: v })}
          />
        </div>

        <SectionHeader title="Severe allergies" />
        <div className="bg-white border border-slate-200/80 rounded-2xl px-4 divide-y divide-slate-100">
          {data.allergies.map((a) => (
            <EntryRow
              key={a.id}
              icon={AlertTriangle}
              entry={a}
              tone="amber"
              editing={editing}
              titlePlaceholder="Allergy"
              metaPlaceholder="Severity · notes"
              onChange={(next) => updateEntry("allergies", next)}
              onRemove={() => removeEntry("allergies", a.id)}
            />
          ))}
          {data.allergies.length === 0 && (
            <div className="py-4 text-[13px] text-slate-400">
              None recorded.
            </div>
          )}
        </div>
        {editing && (
          <AddButton
            label="Add allergy"
            onClick={() => addEntry("allergies")}
          />
        )}

        <SectionHeader title="Critical conditions" />
        <div className="bg-white border border-slate-200/80 rounded-2xl px-4 divide-y divide-slate-100">
          {data.conditions.map((c) => (
            <EntryRow
              key={c.id}
              icon={Activity}
              entry={c}
              editing={editing}
              titlePlaceholder="Condition"
              metaPlaceholder="Details · since"
              onChange={(next) => updateEntry("conditions", next)}
              onRemove={() => removeEntry("conditions", c.id)}
            />
          ))}
          {data.conditions.length === 0 && (
            <div className="py-4 text-[13px] text-slate-400">
              None recorded.
            </div>
          )}
        </div>
        {editing && (
          <AddButton
            label="Add condition"
            onClick={() => addEntry("conditions")}
          />
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
