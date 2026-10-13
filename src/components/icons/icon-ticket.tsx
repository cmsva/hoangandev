import type { IconProps } from "./types"

export function IconTicket({ size = 18, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M2.25 6.75C2.25 5.645 3.145 4.75 4.25 4.75H13.75C14.855 4.75 15.75 5.645 15.75 6.75V7.75C14.783 7.75 14 8.533 14 9.5C14 10.467 14.783 11.25 15.75 11.25V12.25C15.75 13.355 14.855 14.25 13.75 14.25H4.25C3.145 14.25 2.25 13.355 2.25 12.25V11.25C3.217 11.25 4 10.467 4 9.5C4 8.533 3.217 7.75 2.25 7.75V6.75Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M2.25 6.75C2.25 5.645 3.145 4.75 4.25 4.75H13.75C14.855 4.75 15.75 5.645 15.75 6.75V7.75C14.783 7.75 14 8.533 14 9.5C14 10.467 14.783 11.25 15.75 11.25V12.25C15.75 13.355 14.855 14.25 13.75 14.25H4.25C3.145 14.25 2.25 13.355 2.25 12.25V11.25C3.217 11.25 4 10.467 4 9.5C4 8.533 3.217 7.75 2.25 7.75V6.75Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 7.25V11.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  )
}
