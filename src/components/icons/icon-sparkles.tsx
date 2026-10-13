import type { IconProps } from "./types"

export function IconSparkles({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M9 1.5L10.5 6.75L15.75 8.25L10.5 9.75L9 15L7.5 9.75L2.25 8.25L7.5 6.75L9 1.5Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M9 1.5L10.5 6.75L15.75 8.25L10.5 9.75L9 15L7.5 9.75L2.25 8.25L7.5 6.75L9 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.25 2.25L14.625 3.375L15.75 3.75L14.625 4.125L14.25 5.25L13.875 4.125L12.75 3.75L13.875 3.375L14.25 2.25Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M3.75 12.75L4.05 13.65L4.95 13.95L4.05 14.25L3.75 15.15L3.45 14.25L2.55 13.95L3.45 13.65L3.75 12.75Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  )
}
