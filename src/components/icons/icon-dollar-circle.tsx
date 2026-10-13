import type { IconProps } from "./types"

export function IconDollarCircle({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <circle cx="9" cy="9" r="6.75" fill="currentColor" fillOpacity="0.3" />
      <circle cx="9" cy="9" r="6.75" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 5.25V12.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11.25 7.5C11.25 6.672 10.243 6 9 6C7.757 6 6.75 6.672 6.75 7.5C6.75 8.328 7.757 9 9 9C10.243 9 11.25 9.672 11.25 10.5C11.25 11.328 10.243 12 9 12C7.757 12 6.75 11.328 6.75 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
