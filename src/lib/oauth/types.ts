/**
 * OAuth shared types — chuẩn hoá user info trả về từ mọi provider.
 */
export interface OAuthUserInfo {
  id: string
  email?: string
  name?: string
  avatar?: string
  raw?: unknown
}

export interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}
