// v1.1.5 self-contained build (bundles THREE.js + TF.js internally).
// Served locally to avoid CDN dependency on mobile and mixed-content issues.
// Sets window.MINDAR.IMAGE.MindARThree when loaded.
const MINDAR_THREE_URL = '/mindar-image-three.prod.js'

export type MindarThreeModule = {
  MindARThree?: unknown
}

export async function loadMindARThree(): Promise<MindarThreeModule> {
  // The GitHub CDN build is an IIFE — dynamic import runs it but exports nothing.
  // It registers itself on window.MINDAR.IMAGE.MindARThree.
  // We inject a <script> tag so the global is definitely available, then return it.
  if (typeof window === 'undefined') return {}

  // If already loaded, return immediately
  const win = window as unknown as { MINDAR?: { IMAGE?: { MindARThree?: unknown } } }
  if (win.MINDAR?.IMAGE?.MindARThree) {
    return { MindARThree: win.MINDAR.IMAGE.MindARThree }
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = MINDAR_THREE_URL
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load MindAR script from CDN'))
    document.head.appendChild(script)
  })

  return { MindARThree: win.MINDAR?.IMAGE?.MindARThree }
}

