import type { IconProps } from "./types"

export function IconDocument({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M3.75 2.25H14.25C14.94 2.25 15.5 2.81 15.5 3.5V14.5C15.5 15.19 14.94 15.75 14.25 15.75H3.75C3.06 15.75 2.5 15.19 2.5 14.5V3.5C2.5 2.81 3.06 2.25 3.75 2.25Z" fill="currentColor" fillOpacity="0.3" />
      <rect x="2.5" y="2.25" width="13" height="13.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 6.75H12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.5 9.75H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.5 12.75H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
