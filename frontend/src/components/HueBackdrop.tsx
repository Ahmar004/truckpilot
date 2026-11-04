import { useRef } from 'react'
import { useHueMotion } from '../hooks/useHueMotion'
import './HueBackdrop.css'

/** The living background (UIi 4): static glows plus three blurred hue balls that drift and bounce. */
export function HueBackdrop() {
  const root = useRef<HTMLDivElement>(null)
  useHueMotion(root)
  return (
    <div ref={root} aria-hidden data-hue-backdrop className="hue-backdrop">
      <div className="hue-ball hue-ball-1" />
      <div className="hue-ball hue-ball-2" />
      <div className="hue-ball hue-ball-3" />
    </div>
  )
}
