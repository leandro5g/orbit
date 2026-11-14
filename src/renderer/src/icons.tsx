// Ícones de traço fino, no estilo dos SF Symbols.
type P = { size?: number; className?: string }

const base = (size = 16) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
})

export const Sparkle = ({ size = 22, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z" fill="currentColor" />
  </svg>
)
export const Plus = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="M12 5v14M5 12h14" /></svg>
)
export const Gear = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)
export const Check = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)
export const Terminal = ({ size = 22, className }: P) => (
  <svg {...base(size)} strokeWidth={1.5} className={className} aria-hidden>
    <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
    <path d="m7 9.5 3 2.5-3 2.5M12.5 15H17" />
  </svg>
)
export const Clock = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const Calendar = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
  </svg>
)
export const Code = ({ size = 14, className }: P) => (
  <svg {...base(size)} strokeWidth={2.2} className={className} aria-hidden><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></svg>
)
export const Trend = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" /></svg>
)
export const Back = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="m15 18-6-6 6-6" /></svg>
)
export const Expand = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="M4 6h16M4 12h16M4 18h10" /></svg>
)
export const Refresh = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />
  </svg>
)
export const Trash = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)
