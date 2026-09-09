import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function CrossIcon(props: IconProps) {
  // Docsahab mark: a soft medical cross
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M9.5 3.5h5a1.5 1.5 0 0 1 1.5 1.5v3.5H20a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 20 16h-3.5v3.5A1.5 1.5 0 0 1 15 21h-5a1.5 1.5 0 0 1-1.5-1.5V16H5A1.5 1.5 0 0 1 3.5 14.5v-5A1.5 1.5 0 0 1 5 8h3.5V5A1.5 1.5 0 0 1 9.5 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 6v5.5c0 4 2.9 7.6 7 8.7 4.1-1.1 7-4.7 7-8.7V6l-7-3Z" />
      <path d="m9.3 12 1.9 1.9 3.6-3.8" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M10.5 17.5h3" />
    </svg>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CheckCircle(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4 4.6-4.9" />
    </svg>
  );
}

export function MapPin(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function Ambulance(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 16V8.5A1.5 1.5 0 0 1 4 7h9v9" />
      <path d="M13 10h4l3 3.2V16" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
      <path d="M6 4.5v2M5 5.5h2" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m12 3.5 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4-3.9 5.6-.8L12 3.5Z" />
    </svg>
  );
}

export function HeartPulse(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20s-7-4.5-7-9.5a4 4 0 0 1 7-2.6 4 4 0 0 1 7 2.6c0 1-.3 1.9-.7 2.7" />
      <path d="M12.5 13h2l1.2-2 1.6 3.5 1.2-2.2H21" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.2 5.4 1.8 6H4.2C4.8 14.4 6 13 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
