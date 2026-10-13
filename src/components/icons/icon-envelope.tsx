import type { IconProps } from "./types"

export function IconEnvelope({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M1.75 5.643L8.565 9.54C8.84 9.673 9.16 9.673 9.434 9.54L16.25 5.642V5.25C16.25 4.145 15.355 3.25 14.25 3.25H3.75C2.645 3.25 1.75 4.145 1.75 5.25V5.643Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M1.75 5.75L8.517 9.483C8.818 9.649 9.182 9.649 9.483 9.483L16.25 5.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="1.75" y="3.25" width="14.5" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
