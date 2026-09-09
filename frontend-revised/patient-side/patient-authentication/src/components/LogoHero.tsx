import logoUrl from "../imports/logo-transparent.png";

/**
 * Official Docsahab logo (transparent PNG, used exactly as uploaded — no
 * recolor/crop/stretch, no box or border) centered above a subtle,
 * slow-looping healthcare animation: soft expanding ripples, a gentle
 * glow pulse, and slowly drifting cyan particles. The logo stays static.
 */
export function LogoHero({
  size = "lg",
  animateLogo = false,
}: {
  size?: "lg" | "sm";
  animateLogo?: boolean;
}) {
  const logoBox = size === "lg" ? "h-28 w-28" : "h-20 w-20";
  const pad = size === "lg" ? "pt-12 pb-8" : "pt-7 pb-5";

  const particles = [
    { left: "22%", top: "58%", d: "0s", dur: "9s", s: "6px" },
    { left: "72%", top: "44%", d: "2.5s", dur: "11s", s: "5px" },
    { left: "54%", top: "70%", d: "4s", dur: "10s", s: "4px" },
    { left: "36%", top: "30%", d: "6s", dur: "12s", s: "5px" },
    { left: "80%", top: "66%", d: "1.5s", dur: "10.5s", s: "4px" },
  ];

  return (
    <div className={`relative overflow-hidden ${pad}`}>
      {/* Animation layer (behind logo) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* soft base gradient wash */}
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_35%,#e8f3ff_0%,transparent_70%)]" />

        {/* gentle glow pulse */}
        <div
          className="ds-anim absolute left-1/2 top-1/2 size-48 rounded-full bg-[radial-gradient(circle,rgba(84,205,197,0.35)_0%,rgba(96,165,250,0.18)_45%,transparent_72%)] blur-[2px]"
          style={{ animation: "ds-glow 6s ease-in-out infinite" }}
        />

        {/* expanding ripples */}
        {[0, 2.7, 5.4].map((delay) => (
          <span
            key={delay}
            className="ds-anim absolute left-1/2 top-1/2 size-52 rounded-full border border-brand-200/70"
            style={{ animation: `ds-ripple 8.1s ease-out ${delay}s infinite` }}
          />
        ))}

        {/* slowly drifting cyan particles */}
        {particles.map((p, i) => (
          <span
            key={i}
            className="ds-anim absolute rounded-full bg-[radial-gradient(circle,#7fe0d8_0%,rgba(127,224,216,0)_70%)]"
            style={{
              left: p.left,
              top: p.top,
              width: p.s,
              height: p.s,
              animation: `ds-drift ${p.dur} ease-in-out ${p.d} infinite`,
            }}
          />
        ))}
      </div>

      {/* Transparent logo (static, on top) */}
      <div className="relative flex flex-col items-center">
        <img
          src={logoUrl}
          alt="Docsahab"
          className={`${logoBox} object-contain drop-shadow-[0_10px_20px_rgba(23,80,196,0.12)] ${animateLogo ? "ds-anim" : ""}`}
          style={animateLogo ? { animation: "ds-logo-float 4.5s ease-in-out infinite" } : undefined}
          draggable={false}
        />
        <p className="mt-2 text-[12.5px] font-medium text-slate-soft">
          Emergency medical assistance
        </p>
      </div>
    </div>
  );
}
