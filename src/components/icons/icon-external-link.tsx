import type { IconProps } from "./types"

export function IconExternalLink({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M4.25 9.25V3.75C4.25 2.645 5.145 1.75 6.25 1.75H12.25C13.355 1.75 14.25 2.645 14.25 3.75V13.25C14.25 14.355 13.355 15.25 12.25 15.25H7.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.23999 6.75H11.25V10.76" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.25 6.75L1.75 16.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
