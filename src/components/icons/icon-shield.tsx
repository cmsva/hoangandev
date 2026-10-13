import type { IconProps } from "./types"

export function IconShield({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M9 2.25L3 4.5V8.25C3 12.15 5.565 15.795 9 16.75C12.435 15.795 15 12.15 15 8.25V4.5L9 2.25Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M9 2.25L3 4.5V8.25C3 12.15 5.565 15.795 9 16.75C12.435 15.795 15 12.15 15 8.25V4.5L9 2.25Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.75 9L8.25 10.5L11.25 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
