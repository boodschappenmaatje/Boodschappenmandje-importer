import type { NavigationIcon } from "@/types/navigation";

type IconName = "bowl" | "chef" | "book" | NavigationIcon | "week" | "budget" | "prepare" | "arrow" | "cloud" | "history" | "pantry" | "settings" | "info" | "catalog" | "trash" | "plus" | "minus" | "users" | "store" | "check" | "lightbulb" | "back";

interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 24 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "bowl":
      return <svg {...common}><path d="M3 11h18a9 9 0 0 1-18 0ZM8 21h8M8 7c-2-2 2-2 0-4M13 7c-2-2 2-2 0-4M18 7c-2-2 2-2 0-4" /></svg>;
    case "chef":
      return <svg {...common}><path d="M6 14a4 4 0 1 1 2-7 4 4 0 0 1 8 0 4 4 0 1 1 2 7v7H6v-7ZM6 17h12M10 12v5M14 12v5" /></svg>;
    case "book":
      return <svg {...common}><rect x="5" y="3" width="15" height="18" rx="2" /><path d="M5 7H3M5 12H3M5 17H3M10 7h6M10 11h6M10 15h3" /></svg>;
    case "home":
      return <svg {...common}><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /><path d="M9 21v-7h6v7" /></svg>;
    case "menu":
      return <svg {...common}><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" /><path d="M17 3v18M17 3c3 2 4 5 4 9h-4" /></svg>;
    case "list":
      return <svg {...common}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
    case "products":
      return <svg {...common}><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z" /><path d="M12 11v10" /></svg>;
    case "more":
      return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    case "week":
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="m8 15 2 2 5-5" /></svg>;
    case "budget":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5a4 4 0 1 0 0 7M7.5 11h6M7.5 14h6" /></svg>;
    case "prepare":
      return <svg {...common}><path d="M6 3v8M3 3v5a3 3 0 0 0 6 0V3M6 11v10" /><path d="M16 3v18M16 3a5 5 0 0 1 5 5v4h-5" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "cloud":
      return <svg {...common}><path d="M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.5-1A4.5 4.5 0 0 0 7 18Z" /><path d="m9 13 2 2 4-4" /></svg>;
    case "history":
      return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>;
    case "pantry":
      return <svg {...common}><path d="M4 4h16v17H4zM4 10h16M8 7h3M8 14h3" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>;
    case "catalog":
      return <svg {...common}><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5M8 17h3" /><path d="M4 3v2M20 3v2" /></svg>;
    case "trash":
      return <svg {...common}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "minus":
      return <svg {...common}><path d="M5 12h14" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
    case "store":
      return <svg {...common}><path d="M3 9h18l-2-5H5L3 9Z" /><path d="M5 9v11h14V9M9 20v-6h6v6" /><path d="M3 9c0 2 3 3 4.5 1C9 12 12 12 13.5 10 15 12 18 12 19 9" /></svg>;
    case "check":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.7 2.7L16.5 9" /></svg>;
    case "lightbulb":
      return <svg {...common}><path d="M9 18h6M10 22h4" /><path d="M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z" /></svg>;
    case "back":
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
  }
}
