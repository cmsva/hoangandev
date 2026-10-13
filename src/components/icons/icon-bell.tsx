import type { IconProps } from "./types"

export function IconBell({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M13.5 6.75C13.5 4.265 11.485 2.25 9 2.25C6.515 2.25 4.5 4.265 4.5 6.75C4.5 11.25 2.25 12.75 2.25 12.75H15.75C15.75 12.75 13.5 11.25 13.5 6.75Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M13.5 6.75C13.5 4.265 11.485 2.25 9 2.25C6.515 2.25 4.5 4.265 4.5 6.75C4.5 11.25 2.25 12.75 2.25 12.75H15.75C15.75 12.75 13.5 11.25 13.5 6.75Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.298 15.75C10.166 15.978 9.932 16.154 9.659 16.254C9.386 16.354 9.087 16.372 8.803 16.306C8.519 16.24 8.264 16.093 8.073 15.886C7.882 15.679 7.764 15.422 7.736 15.15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
