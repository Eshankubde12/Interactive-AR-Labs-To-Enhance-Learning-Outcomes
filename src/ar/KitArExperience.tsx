/**
 * KitArExperience — Full-screen AR experience.
 *
 * Layout:
 *  • position:fixed full-screen (z-index 50) — camera fills the viewport
 *  • Slim top bar: back ← | practical name | start / stop
 *  • Camera region: fills all remaining height
 *      – HTML label cards projected from 3D anchor positions (move with kit)
 *      – 3D rotating component models appear above each component on click
 *      – Selected-component info card slides up from bottom of camera
 *  • Collapsible bottom panel: step guide + component list
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import type { Practical } from '../data/practicals'
import { loadMindARThree } from './mindar'
import type { ArMarker, KitArConfig, ComponentType } from './kitArConfigs'

// ─── Types ─────────────────────────────────────────────────────────────────────
type FlatConn = {
  fromId: string; toId: string; color: string
  from: ArMarker; to: ArMarker
}

// ─── Tiny helpers ──────────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

/** Canvas texture for the flat bounding-box overlay plane. */
function makeBoxTexture(color: string): THREE.CanvasTexture {
  const W = 256, H = 128
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = hexToRgba(color, 0.30)
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.setLineDash([18, 10])
  ctx.strokeRect(4, 4, W - 8, H - 8)
  ctx.setLineDash([]); ctx.lineWidth = 5
  const cs = 26
  for (const [x, y] of [[0, 0], [W - cs, 0], [0, H - cs], [W - cs, H - cs]] as [number, number][]) {
    ctx.strokeStyle = color
    ctx.beginPath(); ctx.moveTo(x + cs, y); ctx.lineTo(x, y); ctx.lineTo(x, y + cs); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

/** Invisible sprite — only used as a stable 3D world-position anchor. */
function makeAnchorSprite(): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({ transparent: true, opacity: 0 })
  const s = new THREE.Sprite(mat)
  s.visible = false
  return s
}


// ─── 3D Component model factory ───────────────────────────────────────────────
// Models float at z = 0.070 above the board surface.
// Animation: Z-spin + sinusoidal X-tilt to reveal depth.

function makeComponentModel(type: ComponentType | undefined, markerColor: string): THREE.Group {
  const group = new THREE.Group()
  group.visible = false

  const c = (hex: number | string) =>
    new THREE.Color(typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex)
  const std = (col: number | string, roughness = 0.72, metalness = 0.0) =>
    new THREE.MeshStandardMaterial({ color: c(col), roughness, metalness })
  const basic = (col: number | string) =>
    new THREE.MeshBasicMaterial({ color: c(col) })
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) =>
    new THREE.Mesh(geo, mat)

  switch (type ?? 'terminal') {

    case 'ic-dip': {
      group.add(mesh(new THREE.BoxGeometry(0.086, 0.026, 0.016), std(0x0d0d0d, 0.85)))
      const notch = mesh(new THREE.SphereGeometry(0.007, 8, 5), std(0x2a2a2a, 0.9))
      notch.position.set(-0.040, 0, 0.008); group.add(notch)
      const dot = mesh(new THREE.CircleGeometry(0.004, 10), basic(0xffffff))
      dot.rotation.x = -Math.PI / 2; dot.position.set(-0.033, 0.014, 0.004); group.add(dot)
      const pinMat = std(0xb8b8b8, 0.20, 0.82)
      for (let i = 0; i < 4; i++) {
        const px = (i - 1.5) * 0.020
        for (const py of [-0.021, 0.021]) {
          const pin = mesh(new THREE.BoxGeometry(0.004, 0.014, 0.003), pinMat)
          pin.position.set(px, py, 0); group.add(pin)
        }
      }
      const stripe = mesh(new THREE.PlaneGeometry(0.060, 0.008), basic(0x1a2a1a))
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(0.005, 0.0135, 0.002); group.add(stripe)
      break
    }

    case 'transistor': {
      group.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.036, 14), std(0x111111, 0.85)))
      group.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.037, 14, 1, false, -Math.PI / 2, Math.PI), std(0x222222, 0.75)))
      const band = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.005, 14), std(0x666666, 0.3, 0.5))
      band.position.y = -0.015; group.add(band)
      const leadMat = std(0xc0c0c0, 0.12, 0.90)
      for (const [lx, lz] of [[-0.007, 0], [0, 0], [0.007, 0]] as [number, number][]) {
        const lead = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.030, 5), leadMat)
        lead.position.set(lx, -0.033, lz); group.add(lead)
      }
      break
    }

    case 'resistor': {
      const body = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.046, 10), std(0xd4b483, 0.82))
      body.rotation.z = Math.PI / 2; group.add(body)
      for (const [bc, i] of [[0xe53935, 0], [0x7b1fa2, 1], [0xffa000, 2]] as [number, number][]) {
        const b = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 10), std(bc, 0.65))
        b.rotation.z = Math.PI / 2; b.position.x = (i - 1) * 0.011; group.add(b)
      }
      const tol = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.005, 10), std(0xffd600, 0.5, 0.4))
      tol.rotation.z = Math.PI / 2; tol.position.x = 0.018; group.add(tol)
      const leadMat = std(0xc0c0c0, 0.10, 0.88)
      for (const lx of [-0.036, 0.036]) {
        const lead = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.024, 4), leadMat)
        lead.rotation.z = Math.PI / 2; lead.position.x = lx; group.add(lead)
      }
      break
    }

    case 'capacitor': {
      group.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.054, 14), std(0x1a237e, 0.72)))
      const top = mesh(new THREE.CylinderGeometry(0.0138, 0.0138, 0.004, 14), std(0xd0d0d0, 0.25, 0.65))
      top.position.y = 0.029; group.add(top)
      const stripe = mesh(new THREE.BoxGeometry(0.005, 0.040, 0.015), basic(0xffffff))
      stripe.position.set(-0.013, 0.005, 0); group.add(stripe)
      for (const rot of [0, Math.PI / 2]) {
        const bar = mesh(new THREE.BoxGeometry(0.008, 0.003, 0.002), basic(0x333333))
        bar.rotation.y = rot; bar.position.set(0, 0.033, 0); group.add(bar)
      }
      const leadMat = std(0xc0c0c0, 0.12, 0.88)
      for (const lx of [-0.006, 0.006]) {
        const lead = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.026, 5), leadMat)
        lead.position.set(lx, -0.040, 0); group.add(lead)
      }
      break
    }

    case 'led': {
      const hex = parseInt(markerColor.replace('#', ''), 16)
      const ledMat = new THREE.MeshStandardMaterial({
        color: c(hex), emissive: c(hex), emissiveIntensity: 0.65,
        transparent: true, opacity: 0.88, roughness: 0.25,
      })
      group.add(mesh(new THREE.CylinderGeometry(0.008, 0.010, 0.022, 12), ledMat))
      const lensMat = new THREE.MeshStandardMaterial({
        color: c(hex), emissive: c(hex), emissiveIntensity: 0.90,
        transparent: true, opacity: 0.75, roughness: 0.1,
      })
      const lens = mesh(new THREE.SphereGeometry(0.010, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), lensMat)
      lens.position.y = 0.011; group.add(lens)
      const leadMat = std(0xc0c0c0, 0.12, 0.88)
      for (const lx of [-0.005, 0.005]) {
        const lead = mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.028, 5), leadMat)
        lead.position.set(lx, -0.025, 0); group.add(lead)
      }
      break
    }

    case 'switch': {
      group.add(mesh(new THREE.BoxGeometry(0.060, 0.012, 0.030), std(0x1a1a2e, 0.80)))
      const rocker = mesh(new THREE.BoxGeometry(0.042, 0.012, 0.022), std(0xc62828, 0.55))
      rocker.position.set(0, 0.010, 0); rocker.rotation.z = 0.22; group.add(rocker)
      const hl = mesh(new THREE.BoxGeometry(0.018, 0.005, 0.020), std(0xef9a9a, 0.5))
      hl.position.set(-0.010, 0.017, 0); group.add(hl)
      const pinMat = std(0xb0b0b0, 0.2, 0.8)
      for (const lx of [-0.015, 0.015]) {
        const p = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.016, 6), pinMat)
        p.position.set(lx, -0.014, 0); group.add(p)
      }
      break
    }

    case 'potentiometer': {
      group.add(mesh(new THREE.BoxGeometry(0.036, 0.016, 0.028), std(0x1565c0, 0.72)))
      const knob = mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.020, 10), std(0x757575, 0.45, 0.30))
      knob.position.y = 0.018; group.add(knob)
      const ind = mesh(new THREE.BoxGeometry(0.002, 0.009, 0.002), basic(0xffffff))
      ind.position.set(0, 0.028, 0.009); group.add(ind)
      const leadMat = std(0xc0c0c0, 0.12, 0.88)
      for (const lx of [-0.011, 0, 0.011]) {
        const lead = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.022, 5), leadMat)
        lead.position.set(lx, -0.019, 0); group.add(lead)
      }
      break
    }

    case 'terminal':
    default: {
      const tHex = parseInt(markerColor.replace('#', ''), 16)
      const collar = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.024, 10), std(tHex, 0.55, 0.20))
      group.add(collar)
      for (let i = 0; i < 8; i++) {
        const theta = (i / 8) * Math.PI * 2
        const groove = mesh(new THREE.BoxGeometry(0.003, 0.024, 0.003), std(0x000000, 0.95))
        groove.position.set(Math.sin(theta) * 0.013, 0, Math.cos(theta) * 0.013)
        group.add(groove)
      }
      group.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.027, 8), std(0x111111, 0.9)))
      const nut = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 6), std(tHex, 0.45, 0.25))
      nut.position.y = -0.015; group.add(nut)
      break
    }
  }

  return group
}

// Reusable projection vector — avoids allocation every frame
const _tmpVec3  = new THREE.Vector3()
const _tmpVec3b = new THREE.Vector3()

// ─── Types ─────────────────────────────────────────────────────────────────────

type MarkerObjects = {
  anchor: THREE.Sprite   // invisible world-space position anchor for label projection
  bbox:   THREE.Mesh     // coloured bounding-box plane — visible when tracked
  model:  THREE.Group    // 3D component — visible only when selected
  marker: ArMarker
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function KitArExperience({
  practical,
  config,
}: {
  practical: Practical
  config: KitArConfig
}) {
  const nav = useNavigate()

  // DOM refs
  const containerRef  = useRef<HTMLDivElement | null>(null)
  const cameraWrapRef = useRef<HTMLDivElement | null>(null)

  // Three.js / MindAR refs
  const mindarRef    = useRef<unknown>(null)
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef    = useRef<THREE.Camera | null>(null)
  const sceneRef     = useRef<THREE.Scene | null>(null)
  const moRef        = useRef<MarkerObjects[]>([])
  const flatPracticalConnsRef = useRef<FlatConn[]>([])

  // SVG wire overlay element refs (updated directly in rAF — no React re-renders)
  const wireSvgRef  = useRef<SVGSVGElement | null>(null)
  const wireElsRef  = useRef<{ glow: SVGPathElement | null; path: SVGPathElement | null; fromDot: SVGCircleElement | null; toDot: SVGCircleElement | null }[]>([])

  // rAF id for our separate label-update loop (MindAR owns the render loop)
  const rafIdRef     = useRef<number | null>(null)

  // Mini 3D viewer — dedicated Three.js renderer inside the info-card canvas
  const modelCanvasRef   = useRef<HTMLCanvasElement | null>(null)
  const modelRendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const modelRafRef3D    = useRef<number | null>(null)

  // HTML label div map (updated directly in rAF — no React re-renders)
  const labelDivRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Debounce timer for target-lost (prevents flickering on brief occlusion)
  const lostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable refs for animation loop (avoids stale closures)
  const stepIdxRef        = useRef(0)
  const selectedIdRef     = useRef<string | null>(null)
  const trackedRef        = useRef(false)
  const practicalModeRef  = useRef<'ar' | 'text' | null>(null)
  const practicalStepRef  = useRef(0)
  const connAnimStartRef  = useRef(0)   // Date.now() when current step started drawing

  // React state
  const [running,    setRunning]    = useState(false)
  const [tracked,    setTracked]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [stepIdx,    setStepIdx]    = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelOpen,  setPanelOpen]  = useState(false)
  const [practicalMode,  setPracticalMode]  = useState<'ar' | 'text' | null>(null)
  const [practicalStep,  setPracticalStep]  = useState(0)
  const [showModeSelect, setShowModeSelect] = useState(false)

  // Keep refs in sync with state
  useEffect(() => { stepIdxRef.current       = stepIdx       }, [stepIdx])
  useEffect(() => { trackedRef.current       = tracked       }, [tracked])
  useEffect(() => { practicalModeRef.current = practicalMode }, [practicalMode])
  useEffect(() => {
    practicalStepRef.current = practicalStep
    connAnimStartRef.current = Date.now()
  }, [practicalStep])


  // ── Mini 3D viewer: spin the selected component in the info-card canvas ───────
  useEffect(() => {
    if (modelRafRef3D.current !== null) { cancelAnimationFrame(modelRafRef3D.current); modelRafRef3D.current = null }
    if (modelRendererRef.current) { modelRendererRef.current.dispose(); modelRendererRef.current = null }

    const canvas = modelCanvasRef.current
    const marker = config.markers.find((m) => m.id === selectedId)
    if (!canvas || !marker) return

    // false = don't overwrite canvas CSS width/height (React controls those)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(320, 320, false)
    renderer.setClearColor(0x000000, 0)
    modelRendererRef.current = renderer

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(40, 1, 0.001, 100)
    cam.position.set(0, 0.06, 0.22); cam.lookAt(0, 0, 0)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2.0))
    const dir = new THREE.DirectionalLight(0xffffff, 3.0)
    dir.position.set(2, 3, 4); scene.add(dir)
    const fill = new THREE.DirectionalLight(0xffffff, 1.0)
    fill.position.set(-2, -1, 2); scene.add(fill)

    const model = makeComponentModel(marker.componentType, marker.color)
    model.visible = true
    scene.add(model)

    // Auto-fit: scale model so its largest dimension fills ~60% of the view
    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0) {
      const fovRad = (cam.fov * Math.PI) / 180
      const viewHeight = 2 * 0.22 * Math.tan(fovRad / 2)
      model.scale.setScalar((viewHeight * 0.60) / maxDim)
    }

    const tick = () => {
      const t = performance.now() / 1000
      model.rotation.y += 0.018
      model.rotation.x = Math.sin(t * 0.6) * 0.18
      renderer.render(scene, cam)
      modelRafRef3D.current = requestAnimationFrame(tick)
    }
    modelRafRef3D.current = requestAnimationFrame(tick)

    return () => {
      if (modelRafRef3D.current !== null) { cancelAnimationFrame(modelRafRef3D.current); modelRafRef3D.current = null }
      renderer.dispose()
    }
  }, [selectedId, config.markers])

  // Show / hide 3D overlays + HTML labels when tracking state changes
  useEffect(() => {
    for (const mo of moRef.current) {
      mo.bbox.visible   = tracked
      mo.anchor.visible = false  // always invisible — only used for position
    }
    // HTML wire divs are shown/hidden per-frame in animateMarkers
    if (!tracked) {
      for (const div of labelDivRefs.current.values()) div.style.display = 'none'
      selectedIdRef.current = null
      setSelectedId(null)
      for (const mo of moRef.current) mo.model.visible = false
    }
  }, [tracked])

  const selectedMarker = useMemo(
    () => config.markers.find((m) => m.id === selectedId) ?? null,
    [config.markers, selectedId],
  )

  // ── Select / deselect component ──────────────────────────────────────────────
  const selectMarker = useCallback((id: string | null) => {
    selectedIdRef.current = id
    setSelectedId(id)
    for (const mo of moRef.current) {
      const isThis = mo.marker.id === id
      mo.model.visible = isThis
      if (isThis) mo.model.scale.setScalar(0.01) // reset scale for scale-in animation
    }
  }, [])

  // ── Animation loop ────────────────────────────────────────────────────────────
  const animateMarkers = useCallback(() => {
    const t        = performance.now() / 1000
    const sel      = selectedIdRef.current
    const renderer = rendererRef.current
    const camera   = cameraRef.current
    const wrapEl   = cameraWrapRef.current

    // Force all world matrices to reflect MindAR's latest tracking data.
    // MindAR sets anchor.group.matrix each tracking frame but doesn't propagate
    // to matrixWorld — we must do it ourselves before projecting.
    sceneRef.current?.updateMatrixWorld(true)
    camera?.updateMatrixWorld()

    for (const mo of moRef.current) {
      const isSelected = mo.marker.id === sel

      // Bounding-box opacity varies with selection state
      if (mo.bbox.visible) {
        const mat = mo.bbox.material as THREE.MeshStandardMaterial
        mat.opacity           = isSelected ? 0.70 : 0.40
        mat.emissiveIntensity = isSelected ? 0.55 : 0.20
      }

      // 3D model: scale-in pop + continuous Z-spin + sinusoidal X-tilt
      if (isSelected && mo.model.visible) {
        const s = mo.model.scale.x
        if (s < 2.0) mo.model.scale.setScalar(Math.min(2.0, s + 0.09))
        mo.model.rotation.z += 0.022
        mo.model.rotation.x = -0.22 + Math.sin(t * 0.75) * 0.14
      }

      // ── Project anchor world-pos → screen → update HTML label position ─────
      const div = labelDivRefs.current.get(mo.marker.id)
      if (!div) continue

      // In AR practical mode: hide all labels and bboxes — only wires are shown
      if (practicalModeRef.current === 'ar') {
        div.style.display = 'none'
        mo.bbox.visible = false
        continue
      }

      if (!renderer || !camera || !trackedRef.current || !wrapEl) {
        div.style.display = 'none'
        continue
      }

      // Get the anchor's world position (MindAR updates world matrices each frame)
      mo.anchor.getWorldPosition(_tmpVec3)
      _tmpVec3.project(camera as THREE.PerspectiveCamera)

      // If behind the camera or off-screen, hide
      if (_tmpVec3.z > 1) { div.style.display = 'none'; continue }

      // Map NDC → pixels relative to the camera wrapper div
      const canvasRect = renderer.domElement.getBoundingClientRect()
      const wrapRect   = wrapEl.getBoundingClientRect()
      const sx = (_tmpVec3.x *  0.5 + 0.5) * canvasRect.width  + (canvasRect.left - wrapRect.left)
      const sy = (-_tmpVec3.y * 0.5 + 0.5) * canvasRect.height + (canvasRect.top  - wrapRect.top)

      // Flip label below the anchor when it would be clipped at the top of the frame
      const flipDown = sy < 90
      div.style.transform = flipDown ? 'translate(-50%, 6px)' : 'translate(-50%, -100%)'
      div.style.display = 'block'
      div.style.left    = `${sx}px`
      div.style.top     = `${sy}px`

      // Update inner card style: glow when selected
      const inner = div.firstElementChild as HTMLElement | null
      if (inner) {
        inner.style.boxShadow  = isSelected
          ? `0 0 16px ${mo.marker.color}99, 0 2px 12px rgba(0,0,0,0.7)`
          : `0 2px 10px rgba(0,0,0,0.55)`
        inner.style.opacity = (mo.marker.step === stepIdxRef.current) ? '1' : '0.75'
      }
    }

    // ── SVG wire overlay: all connections simultaneously, each coloured to match its FROM socket ──
    const inArPractical = practicalModeRef.current === 'ar' && trackedRef.current && renderer && camera && wrapEl
    const pStep = practicalStepRef.current
    const now   = Date.now()

    const svg = wireSvgRef.current
    const canvasRect2 = renderer?.domElement.getBoundingClientRect()
    const wrapRect2   = wrapEl?.getBoundingClientRect()

    if (!inArPractical || !svg || !canvasRect2 || !wrapRect2) {
      if (svg) svg.style.display = 'none'
    } else {
      svg.style.display = 'block'
      const allConns = flatPracticalConnsRef.current

      allConns.forEach((fc, i) => {
        const els = wireElsRef.current[i]
        if (!els) return

        const hide = () => {
          if (els.glow)    els.glow.style.display    = 'none'
          if (els.path)    els.path.style.display    = 'none'
          if (els.fromDot) els.fromDot.style.display = 'none'
          if (els.toDot)   els.toDot.style.display   = 'none'
        }

        // Only show connections introduced up to and including the current step
        if (i > pStep) { hide(); return }

        const fromMo = moRef.current.find((mo) => mo.marker.id === fc.fromId)
        const toMo   = moRef.current.find((mo) => mo.marker.id === fc.toId)
        if (!fromMo || !toMo || !els.glow || !els.path || !els.fromDot || !els.toDot) { hide(); return }

        fromMo.anchor.getWorldPosition(_tmpVec3)
        _tmpVec3.project(camera as THREE.PerspectiveCamera)
        toMo.anchor.getWorldPosition(_tmpVec3b)
        _tmpVec3b.project(camera as THREE.PerspectiveCamera)

        if (_tmpVec3.z > 1 || _tmpVec3b.z > 1) { hide(); return }

        const fx = (_tmpVec3.x  *  0.5 + 0.5) * canvasRect2.width  + (canvasRect2.left - wrapRect2.left)
        const fy = (-_tmpVec3.y *  0.5 + 0.5) * canvasRect2.height + (canvasRect2.top  - wrapRect2.top)
        const tx = (_tmpVec3b.x *  0.5 + 0.5) * canvasRect2.width  + (canvasRect2.left - wrapRect2.left)
        const ty = (-_tmpVec3b.y * 0.5 + 0.5) * canvasRect2.height + (canvasRect2.top  - wrapRect2.top)

        const dist = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2)
        const sag  = Math.min(90, Math.max(24, dist * 0.28))
        const pathD = `M ${fx} ${fy} C ${fx + (tx - fx) * 0.33} ${fy + sag} ${fx + (tx - fx) * 0.67} ${ty + sag} ${tx} ${ty}`

        // Wire colour matches the FROM socket colour
        const wireColor = fc.from.color

        els.glow.setAttribute('d', pathD)
        els.glow.setAttribute('stroke', wireColor)
        els.glow.style.display = ''
        els.path.setAttribute('d', pathD)
        els.path.setAttribute('stroke', wireColor)
        els.path.style.display = ''
        els.fromDot.setAttribute('cx', String(fx))
        els.fromDot.setAttribute('cy', String(fy))
        els.fromDot.setAttribute('fill', wireColor)
        els.fromDot.style.display = ''
        els.toDot.setAttribute('cx', String(tx))
        els.toDot.setAttribute('cy', String(ty))
        els.toDot.setAttribute('fill', wireColor)
        els.toDot.style.display = ''

        if (i < pStep) {
          // Already-connected wire — steady flowing dashes
          const offset = String(-((now / 22) % 28))
          els.path.setAttribute('stroke-dasharray', '16 12')
          els.path.setAttribute('stroke-dashoffset', offset)
          els.glow.setAttribute('stroke-dasharray', 'none')
          els.glow.setAttribute('stroke-dashoffset', '0')
          els.toDot.setAttribute('opacity', '1')
        } else {
          // Current wire — draw-in animation then flowing dashes
          const progress = Math.min(1, (now - connAnimStartRef.current) / 700)
          const totalLen = els.path.getTotalLength() || 1
          if (progress < 1) {
            const drawn = progress * totalLen
            els.path.setAttribute('stroke-dasharray', `${drawn} ${totalLen}`)
            els.path.setAttribute('stroke-dashoffset', '0')
            els.glow.setAttribute('stroke-dasharray', `${drawn} ${totalLen}`)
            els.glow.setAttribute('stroke-dashoffset', '0')
          } else {
            const offset = String(-((now / 22) % 28))
            els.path.setAttribute('stroke-dasharray', '16 12')
            els.path.setAttribute('stroke-dashoffset', offset)
            els.glow.setAttribute('stroke-dasharray', 'none')
            els.glow.setAttribute('stroke-dashoffset', '0')
          }
          els.toDot.setAttribute('opacity', String(Math.max(0, (progress - 0.85) / 0.15)))
        }
      })
    }
  }, [])

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    if (lostTimerRef.current) { clearTimeout(lostTimerRef.current); lostTimerRef.current = null }
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null }
    if (modelRafRef3D.current !== null) { cancelAnimationFrame(modelRafRef3D.current); modelRafRef3D.current = null }
    if (modelRendererRef.current) { modelRendererRef.current.dispose(); modelRendererRef.current = null }
    try {
      setRunning(false); setTracked(false)
      setPracticalMode(null); setPracticalStep(0); setShowModeSelect(false)
      moRef.current = []
      flatPracticalConnsRef.current = []
      if (wireSvgRef.current) wireSvgRef.current.style.display = 'none'
      const renderer = rendererRef.current
      if (renderer) { renderer.setAnimationLoop(null); renderer.dispose() }
      rendererRef.current = null; cameraRef.current = null; sceneRef.current = null
      const m = mindarRef.current as { stop?: () => Promise<void>; renderer?: unknown } | null
      if (m) {
        await m.stop?.()
        const r = m.renderer as { setAnimationLoop?: (cb: null) => void } | undefined
        r?.setAnimationLoop?.(null)
      }
      mindarRef.current = null
      if (containerRef.current) containerRef.current.innerHTML = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop AR')
    }
  }, [])

  // ── Start ─────────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null)
    const container = containerRef.current
    if (!container) return
    try {
      await stop()
      selectMarker(null)

      const mod = await loadMindARThree()
      const MindARThree = (mod as { MindARThree?: unknown }).MindARThree as unknown as {
        new(opts: unknown): {
          renderer: unknown; scene: unknown; camera: unknown
          addAnchor: (idx: number) => { group: THREE.Group }
          start: () => Promise<void>; stop: () => Promise<void>
          __cleanup?: () => void
        }
      }
      if (!MindARThree) throw new Error('MindARThree not available from CDN')

      const mindarThree = new MindARThree({
        container,
        imageTargetSrc: config.arTarget,
        uiLoading: 'no',
        uiScanning: 'no',
      })

      const { renderer, scene, camera } = mindarThree as unknown as {
        renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera
      }
      rendererRef.current = renderer; cameraRef.current = camera
      mindarRef.current   = mindarThree

      // Lighting for 3D models
      scene.add(new THREE.HemisphereLight(0xffffff, 0x111827, 1.2))
      const dirLight = new THREE.DirectionalLight(0xffffff, 2.0)
      dirLight.position.set(1.5, 2.0, 2.0)
      scene.add(dirLight)

      const anchor = mindarThree.addAnchor(0) as {
        group: THREE.Group
        onTargetFound?: () => void
        onTargetLost?:  () => void
      }

      // Debounce target-lost so brief occlusions don't flicker labels
      anchor.onTargetFound = () => {
        if (lostTimerRef.current) { clearTimeout(lostTimerRef.current); lostTimerRef.current = null }
        trackedRef.current = true
        setTracked(true)
      }
      anchor.onTargetLost = () => {
        lostTimerRef.current = setTimeout(() => {
          trackedRef.current = false
          setTracked(false)
          lostTimerRef.current = null
        }, 500)
      }

      // Flat connection list — one entry per connection, in config order
      const byId = new Map(config.markers.map((m) => [m.id, m]))
      flatPracticalConnsRef.current = (config.connections ?? [])
        .filter((c) => byId.has(c.fromId) && byId.has(c.toId))
        .map((c) => ({ fromId: c.fromId, toId: c.toId, color: c.color, from: byId.get(c.fromId)!, to: byId.get(c.toId)! }))
      connAnimStartRef.current = Date.now()

      // Build marker objects
      const markerObjects: MarkerObjects[] = []
      for (const m of config.markers) {
        const markerGroup = new THREE.Group()
        markerGroup.position.set(m.x, m.y, 0.001)

        // Bounding-box overlay
        const bboxMat = new THREE.MeshStandardMaterial({
          map: makeBoxTexture(m.color),
          color: new THREE.Color(m.color),
          emissive: new THREE.Color(m.color),
          emissiveIntensity: 0.20,
          transparent: true, opacity: 0.40,
          side: THREE.DoubleSide, depthTest: false,
        })
        const bbox = new THREE.Mesh(new THREE.PlaneGeometry(m.hw * 2, m.hh * 2), bboxMat)
        bbox.visible = false
        markerGroup.add(bbox)

        // 3D rotating component model
        const model = makeComponentModel(m.componentType, m.color)
        model.position.set(0, 0, 0.070)
        markerGroup.add(model)

        // Invisible anchor sprite — sits at the centre of the bbox for label projection
        const anchorSprite = makeAnchorSprite()
        anchorSprite.position.set(0, 0, 0.003)
        markerGroup.add(anchorSprite)

        anchor.group.add(markerGroup)
        markerObjects.push({ anchor: anchorSprite, bbox, model, marker: m })
      }
      moRef.current = markerObjects

      sceneRef.current = scene as THREE.Scene

      await mindarThree.start()
      // MindAR's start() sets its OWN animation loop (tracking + rendering).
      // We must NOT replace it with renderer.setAnimationLoop() or tracking stops.
      // Instead, run our own rAF just for HTML label projection and 3D animations.
      setRunning(true)

      const tick = () => {
        animateMarkers()
        rafIdRef.current = requestAnimationFrame(tick)
      }
      rafIdRef.current = requestAnimationFrame(tick)

      mindarThree.__cleanup = () => { /* cleanup handled in stop() */ }
    } catch (e) {
      let msg = 'Failed to start AR'
      if (e instanceof Error) {
        msg = e.message
      } else if (e && typeof e === 'object') {
        msg = (e as { message?: string }).message ?? JSON.stringify(e)
      } else if (typeof e === 'string') {
        msg = e
      }
      console.error('[AR start error]', e)
      setError(msg)
      setRunning(false)
    }
  }, [config, animateMarkers, stop, selectMarker])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lostTimerRef.current) clearTimeout(lostTimerRef.current)
      void stop()
    }
  }, [stop])

  const totalSteps  = config.steps.length
  const stepMarkers = config.markers.filter((m) => m.step === stepIdx)

  // Flat ordered list of connections — each is one guided step in Practical mode
  const flatPracticalConns = useMemo(() => {
    const byId = new Map(config.markers.map((m) => [m.id, m]))
    return (config.connections ?? [])
      .filter((c) => byId.has(c.fromId) && byId.has(c.toId))
      .map((c): FlatConn => ({ fromId: c.fromId, toId: c.toId, color: c.color, from: byId.get(c.fromId)!, to: byId.get(c.toId)! }))
  }, [config])

  const practicalTotal = flatPracticalConns.length
  const curConn        = flatPracticalConns[practicalStep] ?? null

  // Shared button style
  const btnBase: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.07)',
    color: '#fff',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        flex: 'none', height: 52,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px',
        background: 'rgba(4,6,20,0.85)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 20,
      }}>
        <button
          onClick={() => nav(-1)}
          style={{ ...btnBase, padding: '7px 12px', fontSize: 18, gap: 4 }}
          aria-label="Back"
        >
          ←
        </button>

        <p style={{
          flex: 1, margin: 0, textAlign: 'center',
          color: 'rgba(255,255,255,0.92)', fontWeight: 700,
          fontSize: 13, letterSpacing: '0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {practical.title}
        </p>

        {running ? (
          <button
            onClick={() => void stop()}
            style={{ ...btnBase, padding: '7px 12px', fontSize: 13, fontWeight: 600 }}
          >
            ⏹ Stop
          </button>
        ) : (
          <button
            onClick={() => void start()}
            style={{
              ...btnBase,
              padding: '7px 16px', fontSize: 13, fontWeight: 700,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.92), rgba(34,211,238,0.82))',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            ▶ Start
          </button>
        )}
      </div>

      {/* ── Camera view (fills all remaining height) ── */}
      <div
        ref={cameraWrapRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}
      >
        {/* MindAR mounts its canvas + video here.
            zIndex:0 creates a stacking context so MindAR's internal z-indices
            don't compete with label divs (z-index:10).
            pointerEvents:none lets taps fall through to label divs behind it. */}
        <div
          ref={containerRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
        />

        {/* ── SVG wire overlay — all connections drawn simultaneously ── */}
        <svg
          ref={wireSvgRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 11, overflow: 'visible', display: 'none' }}
        >
          <defs>
            <filter id="ar-wire-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="ar-dot-glow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {config.connections.map((conn, i) => (
            <g key={`wire-${conn.fromId}-${conn.toId}`}>
              <path
                ref={(el: SVGPathElement | null) => {
                  if (!wireElsRef.current[i]) wireElsRef.current[i] = { glow: null, path: null, fromDot: null, toDot: null }
                  wireElsRef.current[i].glow = el
                }}
                fill="none" strokeWidth="14" opacity="0.4" filter="url(#ar-wire-glow)" strokeLinecap="round"
              />
              <path
                ref={(el: SVGPathElement | null) => {
                  if (!wireElsRef.current[i]) wireElsRef.current[i] = { glow: null, path: null, fromDot: null, toDot: null }
                  wireElsRef.current[i].path = el
                }}
                fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter="url(#ar-wire-glow)"
              />
              <circle
                ref={(el: SVGCircleElement | null) => {
                  if (!wireElsRef.current[i]) wireElsRef.current[i] = { glow: null, path: null, fromDot: null, toDot: null }
                  wireElsRef.current[i].fromDot = el
                }}
                r="9" filter="url(#ar-dot-glow)"
              />
              <circle
                ref={(el: SVGCircleElement | null) => {
                  if (!wireElsRef.current[i]) wireElsRef.current[i] = { glow: null, path: null, fromDot: null, toDot: null }
                  wireElsRef.current[i].toDot = el
                }}
                r="9" opacity="0" filter="url(#ar-dot-glow)"
              />
            </g>
          ))}
        </svg>

        {/* ── HTML label overlays — positioned each frame via 3D→screen projection ── */}
        {config.markers.map((m) => (
          <div
            key={m.id}
            ref={(el) => { if (el) labelDivRefs.current.set(m.id, el) }}
            onClick={() => selectMarker(selectedIdRef.current === m.id ? null : m.id)}
            style={{
              position: 'absolute',
              display: 'none',                    // shown/positioned in animateMarkers
              transform: 'translate(-50%, -100%)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              zIndex: 10,
              paddingBottom: 6,                   // small gap between label and marker
            }}
          >
            {/* Card — borderColor / boxShadow / opacity updated by animation loop */}
            <div style={{
              background: 'rgba(4,6,18,0.90)',
              border: `2px solid ${m.color}`,
              borderRadius: 9,
              padding: '5px 10px 5px 8px',
              boxShadow: `0 2px 10px rgba(0,0,0,0.55)`,
              minWidth: 88,
              maxWidth: 160,
              transition: 'box-shadow 0.15s, opacity 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 2,
                  background: m.color, flexShrink: 0, display: 'inline-block',
                }} />
                <span style={{
                  color: '#fff', fontWeight: 700, fontSize: 12,
                  whiteSpace: 'nowrap', letterSpacing: '0.01em',
                }}>
                  {m.label}
                </span>
              </div>
              <p style={{
                margin: '2px 0 0', fontSize: 10,
                color: 'rgba(255,255,255,0.50)',
                paddingLeft: 12, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 140, lineHeight: 1.3,
              }}>
                {m.description}
              </p>
              <p style={{
                margin: '3px 0 0', fontSize: 9, fontWeight: 700,
                color: m.color, paddingLeft: 12,
                letterSpacing: '0.06em',
              }}>
                ▲ TAP FOR 3D
              </p>
            </div>
          </div>
        ))}

        {/* ── Scanning animation (running but not yet detected) ── */}
        {running && !tracked && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 20, pointerEvents: 'none',
          }}>
            <div style={{
              width: 200, height: 200, position: 'relative',
              border: '1.5px solid rgba(99,102,241,0.25)', borderRadius: 18,
            }}>
              {([
                { top: -2,    left: -2,   borderTop:    '3px solid #6366f1', borderLeft:   '3px solid #6366f1' },
                { top: -2,    right: -2,  borderTop:    '3px solid #6366f1', borderRight:  '3px solid #6366f1' },
                { bottom: -2, left: -2,   borderBottom: '3px solid #6366f1', borderLeft:   '3px solid #6366f1' },
                { bottom: -2, right: -2,  borderBottom: '3px solid #6366f1', borderRight:  '3px solid #6366f1' },
              ] as React.CSSProperties[]).map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 24, height: 24, borderRadius: 3, ...s }} />
              ))}
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
                animation: 'scanLine 1.8s ease-in-out infinite',
              }} />
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
              padding: '9px 22px', borderRadius: 28,
              color: 'rgba(255,255,255,0.88)',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
            }}>
              SCANNING — point at the kit board
            </div>
          </div>
        )}

        {/* ── Kit detected badge ── */}
        {running && tracked && (
          <div style={{
            position: 'absolute', top: 10, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(16,132,60,0.88)',
            backdropFilter: 'blur(6px)',
            color: '#fff', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.07em',
            padding: '4px 14px', borderRadius: 20,
            pointerEvents: 'none',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>
            ✓ KIT DETECTED
          </div>
        )}

        {/* ── Error overlay ── */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)', padding: 24, textAlign: 'center',
          }}>
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 16, padding: '22px 26px', maxWidth: 320,
            }}>
              <p style={{ color: '#f87171', fontWeight: 700, margin: '0 0 8px', fontSize: 16 }}>
                AR Error
              </p>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                {error}
              </p>
              <button
                onClick={() => void start()}
                style={{ ...btnBase, marginTop: 16, padding: '9px 22px', fontSize: 13, fontWeight: 600 }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Practical: mode-selector modal ── */}
        {showModeSelect && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,3,14,0.92)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '28px 24px', zIndex: 26,
          }}>
            <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 20, margin: '0 0 6px', textAlign: 'center' }}>
              Choose Guidance Mode
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 28px', textAlign: 'center' }}>
              How would you like to be guided through the practical?
            </p>

            <button
              onClick={() => { setPracticalMode('ar'); setPracticalStep(0); setShowModeSelect(false) }}
              style={{
                width: '100%', maxWidth: 320, marginBottom: 12,
                padding: '18px 20px', borderRadius: 14,
                background: 'rgba(99,102,241,0.15)',
                border: '1.5px solid rgba(99,102,241,0.45)',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <div style={{ color: '#818cf8', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                📡 AR Wire Guidance
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5 }}>
                Point the camera at the kit — coloured AR wires show exactly what to connect.
                Component labels are hidden for clarity.
              </div>
            </button>

            <button
              onClick={() => { setPracticalMode('text'); setPracticalStep(0); setShowModeSelect(false) }}
              style={{
                width: '100%', maxWidth: 320, marginBottom: 24,
                padding: '18px 20px', borderRadius: 14,
                background: 'rgba(34,211,238,0.10)',
                border: '1.5px solid rgba(34,211,238,0.35)',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <div style={{ color: '#22d3ee', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                📋 Step-by-Step Text Guide
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5 }}>
                Clear numbered instructions with wire connection details.
                Great for learning the circuit systematically.
              </div>
            </button>

            <button
              onClick={() => setShowModeSelect(false)}
              style={{ ...btnBase, padding: '10px 28px', fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Practical: AR wire guidance HUD ── */}
        {running && practicalMode === 'ar' && curConn && (
          <>
            {/* Exit button */}
            <button
              onClick={() => setPracticalMode(null)}
              style={{
                ...btnBase,
                position: 'absolute', top: 10, right: 10,
                padding: '6px 14px', fontSize: 11, fontWeight: 700, zIndex: 13,
              }}
            >
              ✕ Exit
            </button>

            {/* Step + connection card */}
            <div style={{
              position: 'absolute', bottom: 12, left: 12, right: 12,
              background: 'rgba(0,3,14,0.92)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              borderRadius: 16, border: '1px solid rgba(99,102,241,0.35)',
              padding: '12px 14px', zIndex: 12,
            }}>
              {/* Step counter badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, letterSpacing: '0.07em' }}>
                  STEP {practicalStep + 1} / {practicalTotal}
                </span>
              </div>

              {/* Connection instruction — large and prominent */}
              <div style={{
                background: `linear-gradient(135deg, ${curConn.color}22, ${curConn.color}11)`,
                border: `1px solid ${curConn.color}55`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 10,
              }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>CONNECT</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: curConn.color, boxShadow: `0 0 8px ${curConn.color}`, flexShrink: 0 }} />
                  <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{curConn.from.label}</span>
                  <span style={{ color: curConn.color, fontSize: 18, fontWeight: 900 }}>→</span>
                  <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{curConn.to.label}</span>
                </div>
              </div>

              {/* Navigation */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPracticalStep((v) => Math.max(0, v - 1))}
                  disabled={practicalStep === 0}
                  style={{ ...btnBase, flex: 1, height: 36, fontSize: 13, opacity: practicalStep === 0 ? 0.3 : 1 }}
                >
                  ← Prev
                </button>
                {practicalStep < practicalTotal - 1 ? (
                  <button
                    onClick={() => setPracticalStep((v) => v + 1)}
                    style={{
                      ...btnBase, flex: 2, height: 36, fontSize: 13, fontWeight: 700,
                      background: 'linear-gradient(135deg, rgba(124,58,237,0.85), rgba(34,211,238,0.75))',
                      border: '1px solid rgba(255,255,255,0.18)',
                    }}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={() => setPracticalMode(null)}
                    style={{
                      ...btnBase, flex: 2, height: 36, fontSize: 13, fontWeight: 700,
                      background: 'rgba(16,132,60,0.75)', border: '1px solid rgba(16,200,80,0.4)',
                    }}
                  >
                    ✓ Done
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Practical: text guide overlay ── */}
        {practicalMode === 'text' && curConn && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,3,14,0.97)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column',
            padding: '20px 20px 24px',
            zIndex: 22, overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>
                  WIRING GUIDE
                </div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
                  Step {practicalStep + 1} of {practicalTotal}
                </div>
              </div>
              <button
                onClick={() => setPracticalMode(null)}
                style={{ ...btnBase, padding: '7px 14px', fontSize: 12 }}
              >
                ✕ Exit
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 18 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${((practicalStep + 1) / practicalTotal) * 100}%`,
                background: 'linear-gradient(90deg, #6366f1, #22d3ee)',
                transition: 'width 0.3s ease',
              }} />
            </div>

            {/* Current connection card */}
            <div style={{
              background: `linear-gradient(135deg, ${curConn.color}18, ${curConn.color}09)`,
              border: `1.5px solid ${curConn.color}44`,
              borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ color: curConn.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>
                CONNECT
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: curConn.color, boxShadow: `0 0 10px ${curConn.color}`, flexShrink: 0 }} />
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{curConn.from.label}</span>
                <span style={{ color: curConn.color, fontSize: 20, fontWeight: 900 }}>→</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{curConn.to.label}</span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>
                {curConn.from.description}
              </p>
            </div>

            {/* All steps overview */}
            <div style={{ flex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
                ALL CONNECTIONS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {flatPracticalConns.map((fc, i) => (
                  <div
                    key={i}
                    onClick={() => setPracticalStep(i)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'center',
                      padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
                      background: i === practicalStep ? 'rgba(99,102,241,0.15)' : 'transparent',
                      border: `1px solid ${i === practicalStep ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
                    }}
                  >
                    <span style={{
                      minWidth: 22, height: 22, borderRadius: '50%',
                      background: i < practicalStep ? '#16a34a' : i === practicalStep ? '#6366f1' : 'rgba(255,255,255,0.09)',
                      color: '#fff', fontSize: 10, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {i < practicalStep ? '✓' : i + 1}
                    </span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: fc.color, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 12, lineHeight: 1.4,
                      color: i === practicalStep ? 'rgba(255,255,255,0.95)' : i < practicalStep ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.35)',
                    }}>
                      {fc.from.label} → {fc.to.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setPracticalStep((v) => Math.max(0, v - 1))}
                disabled={practicalStep === 0}
                style={{ ...btnBase, flex: 1, height: 44, fontSize: 14, opacity: practicalStep === 0 ? 0.3 : 1 }}
              >
                ← Prev
              </button>
              {practicalStep < practicalTotal - 1 ? (
                <button
                  onClick={() => setPracticalStep((v) => v + 1)}
                  style={{
                    ...btnBase, flex: 2, height: 44, fontSize: 14, fontWeight: 700,
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.9), rgba(34,211,238,0.8))',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => setPracticalMode(null)}
                  style={{
                    ...btnBase, flex: 2, height: 44, fontSize: 14, fontWeight: 700,
                    background: 'rgba(16,132,60,0.75)',
                    border: '1px solid rgba(16,200,80,0.4)',
                  }}
                >
                  ✓ Complete!
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Selected component — full-screen 3D overlay ── */}
        {running && tracked && selectedMarker && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,3,14,0.93)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-start',
            padding: '28px 20px 24px',
            zIndex: 20,
            overflowY: 'auto',
          }}>

            {/* 3D model canvas */}
            <div style={{
              width: 'min(78vw, 300px)',
              height: 'min(78vw, 300px)',
              flexShrink: 0,
              borderRadius: 16,
              background: hexToRgba(selectedMarker.color, 0.08),
              border: `2px solid ${selectedMarker.color}66`,
              overflow: 'hidden',
              boxShadow: `0 0 40px ${selectedMarker.color}28`,
            }}>
              <canvas
                ref={(el) => { modelCanvasRef.current = el }}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>

            {/* Info below the model */}
            <div style={{ marginTop: 20, textAlign: 'center', width: '100%', maxWidth: 340 }}>

              {/* Component name */}
              <h2 style={{
                color: selectedMarker.color,
                fontWeight: 800, fontSize: 22,
                margin: '0 0 4px', letterSpacing: '-0.01em',
              }}>
                {selectedMarker.label}
              </h2>

              {/* Type + step badges */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                {selectedMarker.componentType && (
                  <span style={{
                    background: selectedMarker.color + '22',
                    color: selectedMarker.color,
                    fontSize: 11, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 8,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                  }}>
                    {selectedMarker.componentType.replace(/-/g, ' ')}
                  </span>
                )}
                <span style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 11, padding: '3px 10px', borderRadius: 8,
                }}>
                  Step {selectedMarker.step + 1}
                </span>
              </div>

              {/* Description */}
              <p style={{
                color: 'rgba(255,255,255,0.70)',
                fontSize: 13, lineHeight: 1.6,
                margin: '0 0 26px',
                textAlign: 'center',
              }}>
                {selectedMarker.description}
              </p>

              {/* Close button */}
              <button
                onClick={() => selectMarker(null)}
                style={{
                  ...btnBase,
                  width: '100%', maxWidth: 280, height: 48,
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.07em',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.20)',
                  borderRadius: 12,
                }}
              >
                ✕ CLOSE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom guide panel ── */}
      <div style={{
        flex: 'none',
        background: 'rgba(4,6,20,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.09)',
      }}>

        {/* Collapsed bar — always visible, tap to expand */}
        <div
          onClick={() => setPanelOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px', cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'rgba(99,102,241,0.18)',
            color: '#818cf8', fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transform: panelOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.22s ease',
            flexShrink: 0,
          }}>▲</span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              color: 'rgba(255,255,255,0.38)', fontSize: 10,
              fontWeight: 700, letterSpacing: '0.09em',
              textTransform: 'uppercase',
            }}>
              Step {stepIdx + 1}/{totalSteps}&nbsp;&nbsp;
            </span>
            <span style={{
              color: 'rgba(255,255,255,0.82)', fontSize: 12,
            }}>
              {config.steps[stepIdx]}
            </span>
          </div>

          {/* Prev / Next buttons — stopPropagation so they don't toggle panel */}
          <div
            style={{ display: 'flex', gap: 6 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setStepIdx((v) => Math.max(0, v - 1))}
              disabled={stepIdx === 0}
              style={{
                ...btnBase, width: 34, height: 34, fontSize: 16,
                opacity: stepIdx === 0 ? 0.32 : 1,
              }}
            >←</button>
            <button
              onClick={() => setStepIdx((v) => Math.min(totalSteps - 1, v + 1))}
              disabled={stepIdx === totalSteps - 1}
              style={{
                ...btnBase, width: 34, height: 34, fontSize: 16,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.8), rgba(34,211,238,0.7))',
                border: '1px solid rgba(255,255,255,0.18)',
                opacity: stepIdx === totalSteps - 1 ? 0.32 : 1,
              }}
            >→</button>
          </div>
        </div>

        {/* ── Start Practical button ── */}
        {!practicalMode && (
          <div style={{ padding: '6px 14px 10px' }}>
            <button
              onClick={() => { if (!running) void start(); setShowModeSelect(true) }}
              style={{
                ...btnBase, width: '100%', height: 46, fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.92), rgba(34,211,238,0.82))',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 12,
                boxShadow: '0 0 22px rgba(99,102,241,0.28)',
                letterSpacing: '0.05em',
              }}
            >
              ▶ Start Practical
            </button>
          </div>
        )}

        {/* Expanded content */}
        {panelOpen && (
          <div style={{
            maxHeight: '40vh', overflowY: 'auto',
            padding: '0 14px 18px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>

            {/* Step list — tap to jump */}
            <div style={{ marginBottom: 14, paddingTop: 8 }}>
              {config.steps.map((txt, i) => (
                <div
                  key={i}
                  onClick={() => setStepIdx(i)}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '7px 10px', borderRadius: 9, cursor: 'pointer',
                    background: i === stepIdx ? 'rgba(99,102,241,0.12)' : 'transparent',
                    marginBottom: 3,
                  }}
                >
                  <span style={{
                    minWidth: 20, height: 20, borderRadius: '50%',
                    background: i === stepIdx ? '#6366f1' : 'rgba(255,255,255,0.09)',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    fontSize: 13, lineHeight: 1.45,
                    color: i === stepIdx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.42)',
                  }}>
                    {txt}
                  </span>
                </div>
              ))}
            </div>

            {/* Components for the selected step */}
            {stepMarkers.length > 0 && (
              <>
                <p style={{
                  margin: '0 0 8px', fontSize: 10, fontWeight: 700,
                  color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  Components — step {stepIdx + 1}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {stepMarkers.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        selectMarker(selectedId === m.id ? null : m.id)
                        setPanelOpen(false)
                      }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                        background: selectedId === m.id ? m.color + '1e' : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${selectedId === m.id ? m.color : 'rgba(255,255,255,0.07)'}`,
                        textAlign: 'left', fontFamily: 'inherit', color: '#fff',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >
                      <span style={{
                        width: 9, height: 9, marginTop: 3, borderRadius: 2,
                        background: m.color, flexShrink: 0, display: 'inline-block',
                      }} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
                          {m.label}
                        </p>
                        <p style={{
                          margin: '2px 0 0', color: 'rgba(255,255,255,0.42)',
                          fontSize: 11, lineHeight: 1.35,
                        }}>
                          {m.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 0 }
          50%  { top: calc(100% - 2px) }
          100% { top: 0 }
        }
        @keyframes slideUp {
          from { transform: translateY(14px); opacity: 0 }
          to   { transform: translateY(0);   opacity: 1 }
        }
      `}</style>
    </div>
  )
}
