"use client"

/**
 * ShopCredentialsField — copy 1:1 từ dichvugiare.net/website/9
 *
 * Layout:
 *  - Label "Tài khoản shop *" + input "Nhập tài khoản (tối thiểu 6 ký tự)"
 *  - Label "Mật khẩu shop *" + input password + eye toggle button
 *  - space-y-3 giữa 2 field, space-y-1 giữa label và input
 */
import { Eye, EyeOff } from "lucide-react"

export interface ShopCredentialsFieldProps {
  account: string
  onAccountChange: (v: string) => void
  password: string
  onPasswordChange: (v: string) => void
  showPassword: boolean
  onToggleShowPassword: () => void
  disabled?: boolean
}

const inputClass =
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10"

const labelClass = "flex items-center gap-2 select-none text-sm font-semibold"

export function ShopCredentialsField({
  account,
  onAccountChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  disabled = false,
}: ShopCredentialsFieldProps) {
  return (
    <div className="space-y-3">
      {/* Tài khoản shop */}
      <div className="space-y-1">
        <label className={labelClass}>
          Tài khoản shop <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={account}
          onChange={(e) => onAccountChange(e.target.value)}
          placeholder="Nhập tài khoản (tối thiểu 6 ký tự)"
          maxLength={200}
          disabled={disabled}
          autoComplete="off"
          className={inputClass}
        />
      </div>

      {/* Mật khẩu shop */}
      <div className="space-y-1">
        <label className={labelClass}>
          Mật khẩu shop <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
            maxLength={500}
            disabled={disabled}
            autoComplete="new-password"
            className={`${inputClass} pr-10`}
          />
          <button
            type="button"
            onClick={onToggleShowPassword}
            disabled={disabled}
            tabIndex={-1}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none hover:text-accent-foreground dark:hover:bg-accent/50 size-9 absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
