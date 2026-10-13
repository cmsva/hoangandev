import type { IconProps } from "./types"

export function IconLogout({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M6.75 15.75H3.75C3.15 15.75 2.25 15.15 2.25 14.25V3.75C2.25 2.85 3.15 2.25 3.75 2.25H6.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12.75L15.75 9L12 5.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.75 9H6.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
