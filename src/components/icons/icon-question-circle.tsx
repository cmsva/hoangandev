import type { IconProps } from "./types"

export function IconQuestionCircle({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <circle cx="9" cy="9" r="6.75" fill="currentColor" fillOpacity="0.3" />
      <circle cx="9" cy="9" r="6.75" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.125 7.125C7.125 6.09 7.965 5.25 9 5.25C10.035 5.25 10.875 6.09 10.875 7.125C10.875 8.16 10.035 9 9 9V10.125" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="12" r="0.5" fill="currentColor" />
    </svg>
  )
}
