import type { IconProps } from "./types"

export function IconDatabase({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <ellipse cx="9" cy="3.75" rx="6" ry="1.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 3.75V14.25C3 15.0784 5.68629 15.75 9 15.75C12.3137 15.75 15 15.0784 15 14.25V3.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 9C3 9.82843 5.68629 10.5 9 10.5C12.3137 10.5 15 9.82843 15 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
