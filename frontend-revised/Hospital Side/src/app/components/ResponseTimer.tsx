export function ResponseTimer({ secondsLeft }: { secondsLeft: number }) {
  const mm = String(Math.floor(Math.max(secondsLeft, 0) / 60)).padStart(2, "0");
  const ss = String(Math.max(secondsLeft, 0) % 60).padStart(2, "0");
  const urgent = secondsLeft <= 30;
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 text-right shrink-0 ${
        urgent ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"
      }`}
    >
      <div
        className={urgent ? "text-red-700" : "text-blue-700"}
        style={{ fontSize: 11, letterSpacing: 0.6, fontWeight: 600 }}
      >
        RESPONSE REQUIRED
      </div>
      <div
        className={urgent ? "text-red-700" : "text-blue-700"}
        style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}
      >
        {mm}:{ss}
      </div>
    </div>
  );
}
