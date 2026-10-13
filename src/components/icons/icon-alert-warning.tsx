import type { IconProps } from "./types"

export function IconAlertWarning({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M9 2.75V10.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 16C9.551 16 10 15.551 10 15C10 14.449 9.551 14 9 14C8.449 14 8 14.449 8 15C8 15.551 8.449 16 9 16Z" fill="currentColor" />
    </svg>
  )
}
