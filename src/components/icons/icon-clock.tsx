import type { IconProps } from "./types"

export function IconClock({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M2.25 9C2.25 12.728 5.272 15.75 9 15.75C12.728 15.75 15.75 12.728 15.75 9C15.75 5.272 12.728 2.25 9 2.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 5.25V9L11.25 11.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.25 5.25V2.25H5.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.25 2.25L5.25 5.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
