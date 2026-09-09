import { useState } from "react";
import { StatusBar } from "../components/PhoneFrame";
import { Field, PrimaryButton, TextInput, SelectInput } from "../components/ui";
import { CheckCircle, ChevronLeft } from "../components/icons";
import { LogoHero } from "../components/LogoHero";
import type { PatientDetails } from "../types";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

export function PatientDetailsScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: (d: PatientDetails) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [done, setDone] = useState(false);

  const ready =
    fullName.trim() &&
    age.trim() &&
    gender &&
    bloodGroup &&
    emergencyName.trim() &&
    emergencyPhone.replace(/\D/g, "").length === 10;

  function submit() {
    if (!ready) return;
    setDone(true);
    onContinue({
      fullName: fullName.trim(),
      age,
      gender,
      bloodGroup,
      conditions,
      allergies,
      medications,
      emergencyName: emergencyName.trim(),
      emergencyPhone: emergencyPhone.replace(/\D/g, ""),
    });
  }

  return (
    <div className="ds-enter min-h-full bg-[linear-gradient(180deg,#eaf3ff_0%,#f6faff_30%,#ffffff_70%)]">
      <StatusBar />

      <div className="px-6 pt-4">
        <button
          onClick={onBack}
          aria-label="Back to verification"
          className="grid size-10 place-items-center rounded-full border border-brand-100 bg-white text-ink shadow-sm transition hover:bg-brand-50"
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>

      <LogoHero size="sm" />

      <div className="px-7 pt-3">
        <h1 className="font-display text-[24px] font-extrabold tracking-tight text-ink">
          Complete your profile
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-soft">
          Add your details so we can assist you during an emergency.
        </p>
      </div>

      <div className="mt-6 space-y-6 px-6 pb-10">
        <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-[0_12px_34px_-22px_rgba(23,80,196,0.45)]">
          <div className="space-y-4">
            <Field label="Full name">
              <TextInput
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <TextInput
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Enter your age"
                />
              </Field>
              <Field label="Gender">
                <SelectInput
                  value={gender}
                  onChange={setGender}
                  options={GENDERS}
                  placeholder="Select gender"
                />
              </Field>
            </div>
            <Field label="Blood group">
              <SelectInput
                value={bloodGroup}
                onChange={setBloodGroup}
                options={BLOOD_GROUPS}
                placeholder="Select blood group"
              />
            </Field>
            <Field label="Medical conditions">
              <TextInput
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Enter medical conditions"
              />
            </Field>
            <Field label="Allergies">
              <TextInput
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Enter allergies"
              />
            </Field>
            <Field label="Current medications">
              <TextInput
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="Enter current medications"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-[0_12px_34px_-22px_rgba(23,80,196,0.45)]">
          <h2 className="mb-1 font-display text-[15px] font-bold text-ink">
            Emergency contact
          </h2>
          <p className="mb-4 text-[12.5px] text-slate-soft">
            Reachable on your behalf during an emergency.
          </p>
          <div className="space-y-4">
            <Field label="Emergency contact">
              <TextInput
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Contact name"
              />
            </Field>
            <Field label="Emergency contact number">
              <div className="flex items-center gap-2 rounded-2xl border border-brand-100 bg-white px-3 py-1.5 shadow-[0_2px_8px_-4px_rgba(23,80,196,0.15)] transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                <span className="rounded-xl bg-brand-50 px-3 py-2 text-[14px] font-semibold text-ink">
                  +91
                </span>
                <input
                  inputMode="numeric"
                  value={emergencyPhone}
                  onChange={(e) =>
                    setEmergencyPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="Mobile number"
                  className="w-full bg-transparent py-2 text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-slate-soft/70"
                />
              </div>
            </Field>
          </div>
        </section>

        {done ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-4 text-[14px] font-semibold text-emerald-600">
            <CheckCircle className="size-5" /> Profile completed — you&apos;re all set.
          </div>
        ) : (
          <>
            <PrimaryButton disabled={!ready} onClick={submit}>
              Continue
            </PrimaryButton>
            {!ready && (
              <p className="-mt-3 text-center text-[12px] text-slate-soft">
                Add your name, age, gender, blood group &amp; an emergency contact to continue.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
