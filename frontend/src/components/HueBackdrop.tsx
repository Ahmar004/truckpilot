import './HueBackdrop.css'

/** The living background (UIi 4): static glows plus three slow hue balls. Decoration only, CSS only. */
export function HueBackdrop() {
  return (
    <div aria-hidden data-hue-backdrop className="hue-backdrop">
      <div className="hue-ball hue-ball-1" />
      <div className="hue-ball hue-ball-2" />
      <div className="hue-ball hue-ball-3" />
    </div>
  )
}
