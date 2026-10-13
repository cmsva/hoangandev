import type { IconProps } from "./types"

export function IconCreditCard({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M2.25 6.75H15.75V13.5C15.75 14.19 15.19 14.75 14.5 14.75H3.5C2.81 14.75 2.25 14.19 2.25 13.5V6.75Z" fill="currentColor" fillOpacity="0.3" />
      <rect x="2.25" y="3.75" width="13.5" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.25 7.5H15.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.25 11.25H8.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
