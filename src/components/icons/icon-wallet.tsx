import type { IconProps } from "./types"

export function IconWallet({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path opacity="0.3" d="M2.25 4.75V13.25C2.25 14.355 3.145 15.25 4.25 15.25H14.75C15.302 15.25 15.75 14.802 15.75 14.25V7.75C15.75 7.198 15.302 6.75 14.75 6.75H4.25C3.145 6.75 2.25 5.855 2.25 4.75Z" fill="currentColor" />
      <path d="M2.25 4.75C2.25 3.645 3.145 2.75 4.25 2.75H12.75C13.302 2.75 13.75 3.198 13.75 3.75V4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.25 4.75V13.25C2.25 14.355 3.145 15.25 4.25 15.25H14.75C15.302 15.25 15.75 14.802 15.75 14.25V7.75C15.75 7.198 15.302 6.75 14.75 6.75H4.25C3.145 6.75 2.25 5.855 2.25 4.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 12C13.052 12 13.5 11.552 13.5 11C13.5 10.448 13.052 10 12.5 10C11.948 10 11.5 10.448 11.5 11C11.5 11.552 11.948 12 12.5 12Z" fill="currentColor" />
    </svg>
  )
}
