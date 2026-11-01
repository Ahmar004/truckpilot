import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Scrolls to the element named by the URL hash on load and whenever the hash changes. */
export function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const raw = hash.slice(1)
    let id = raw
    try {
      id = decodeURIComponent(raw)
    } catch {
      // malformed escape such as "#%": use the raw text
    }
    document.getElementById(id)?.scrollIntoView()
  }, [hash])
}
