import type { IconProps } from "./types"

export function IconMonitor({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M2.25 3.75H15.75V12.75H2.25V3.75Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M2.25 3.75H15.75V12.75H2.25V3.75Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 15.75H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12.75V15.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
