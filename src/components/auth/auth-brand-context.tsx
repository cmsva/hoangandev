"use client"

import { createContext, useContext, type ReactNode } from "react"

interface AuthBrand {
  logo: string | null
  title: string
}

const AuthBrandContext = createContext<AuthBrand>({ logo: null, title: "VanKhanh" })

export function AuthBrandProvider({
  logo,
  title,
  children,
}: AuthBrand & { children: ReactNode }) {
  return (
    <AuthBrandContext.Provider value={{ logo, title }}>
      {children}
    </AuthBrandContext.Provider>
  )
}

/** Logo + tên site từ DB, dùng ở header của các form auth. */
export function useAuthBrand() {
  return useContext(AuthBrandContext)
}
