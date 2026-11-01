/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The slice of Google Identity Services this app uses (accounts.google.com/gsi/client). */
declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string
  }
  interface IdConfiguration {
    client_id: string
    callback: (response: CredentialResponse) => void
  }
  interface ButtonConfiguration {
    type?: 'standard' | 'icon'
    theme?: 'outline' | 'filled_blue' | 'filled_black'
    size?: 'large' | 'medium' | 'small'
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
    shape?: 'rectangular' | 'pill'
    width?: number
  }
  function initialize(config: IdConfiguration): void
  function renderButton(parent: HTMLElement, options: ButtonConfiguration): void
}
