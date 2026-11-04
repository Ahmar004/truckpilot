// The physics loads on idle in its own chunk, so it is never on the load path (UIi 4.2). The
// dynamic import sits in a plain module, not in the hook.
export const loadHueMotion = () => import('../lib/hueMotion')
