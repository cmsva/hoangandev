import type { IconProps } from "./types"

export function IconLink({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M14.689 9.669L12.53 7.509C11.149 6.128 8.909 6.128 7.528 7.509C6.147 8.89 6.147 11.13 7.528 12.511L9.688 14.67C11.069 16.051 13.308 16.051 14.689 14.67C16.07 13.289 16.07 11.05 14.689 9.669Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M8.369 6.893C8.066 7.054 7.782 7.262 7.528 7.517L7.518 7.527C6.137 8.908 6.137 11.146 7.518 12.527L9.693 14.702C11.074 16.083 13.312 16.083 14.693 14.702L14.703 14.692C16.084 13.311 16.084 11.073 14.703 9.692L13.941 8.93" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.633 11.107C9.935 10.946 10.22 10.738 10.474 10.483L10.484 10.473C11.865 9.092 11.865 6.854 10.484 5.473L8.309 3.298C6.928 1.917 4.69 1.917 3.309 3.298L3.299 3.308C1.918 4.689 1.918 6.927 3.299 8.308L4.061 9.07" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
