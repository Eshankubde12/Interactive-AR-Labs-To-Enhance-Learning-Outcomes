import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Practical } from '../data/practicals'
import { loadMindARThree } from './mindar'
import { Modal3D } from '../components/Modal3D'
import { ComponentViewer3D } from '../components/ComponentViewer3D'

type Marker = {
  id: string
  label: string
  model: 'xor' | 'and' | 'not' | 'ic' | 'probe'
  description: string
  position: [number, number, number]
  color: string
}

const SUBTRACTOR_AR_MARKERS: Marker[] = [
  {
    id: 'A',
    label: 'Input A',
    model: 'probe',
    description: 'Input A terminal (0/1). Use kit switch/jumper physically.',
    position: [-0.35, -0.05, 0],
    color: '#22d3ee',
  },
  {
    id: 'B',
    label: 'Input B',
    model: 'probe',
    description: 'Input B terminal (0/1). Use kit switch/jumper physically.',
    position: [-0.35, -0.22, 0],
    color: '#22d3ee',
  },
  {
    id: 'C',
    label: 'Borrow In (C)',
    model: 'probe',
    description: 'Borrow-in terminal (0/1).',
    position: [-0.35, 0.12, 0],
    color: '#22d3ee',
  },
  {
    id: 'D',
    label: 'Difference O/P',
    model: 'xor',
    description: 'Difference output point. Measure against GND.',
    position: [0.34, 0.04, 0],
    color: '#7c3aed',
  },
  {
    id: 'BORROW',
    label: 'Borrow O/P',
    model: 'and',
    description: 'Borrow output point. Measure against GND.',
    position: [0.34, -0.22, 0],
    color: '#7c3aed',
  },
  {
    id: 'IC',
    label: 'TTL IC logic',
    model: 'ic',
    description: 'Underlying TTL logic ICs on the board.',
    position: [0.02, -0.02, 0],
    color: '#f59e0b',
  },
]

export function SubtractorArExperience({ practical }: { practical: Practical }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mindarRef = useRef<unknown>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointer = useMemo(() => new THREE.Vector2(), [])
  const pickablesRef = useRef<THREE.Object3D[]>([])
  const markerGroupsRef = useRef<Map<string, THREE.Group>>(new Map())
  const activeModelRef = useRef<THREE.Object3D | null>(null)

  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<null | Marker>(null)
  const [stepIdx, setStepIdx] = useState(0)

  const pulseCurrentStep = useCallback(() => {
    const map = markerGroupsRef.current
    const highlightId =
      stepIdx === 1 ? 'A' : stepIdx === 2 ? 'IC' : stepIdx === 3 ? 'D' : null
    const t = performance.now() / 1000
    for (const [id, g] of map.entries()) {
      const is = highlightId === id
      const s = is ? 1 + Math.sin(t * 4) * 0.08 : 1
      g.scale.setScalar(s)
    }
  }, [stepIdx])

  const spawnAnchoredModel = useCallback((marker: Marker) => {
    const group = markerGroupsRef.current.get(marker.id)
    if (!group) return

    if (activeModelRef.current) {
      activeModelRef.current.removeFromParent()
      activeModelRef.current = null
    }

    const model = makeAnchoredModel(marker.model, marker.color)
    model.position.set(0, 0.12, 0.03)
    group.add(model)
    activeModelRef.current = model
  }, [])

  const stop = useCallback(async () => {
    try {
      setRunning(false)
      pickablesRef.current = []
      markerGroupsRef.current.clear()
      activeModelRef.current = null

      const renderer = rendererRef.current
      if (renderer) {
        renderer.setAnimationLoop(null)
        renderer.dispose()
      }
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null

      const mindarAny = mindarRef.current as unknown as { stop?: () => Promise<void>; renderer?: unknown }
      if (mindarAny) {
        await mindarAny.stop?.()
        const r = mindarAny.renderer as
          | { setAnimationLoop?: (cb: ((...args: unknown[]) => void) | null) => void }
          | undefined
        r?.setAnimationLoop?.(null)
      }
      mindarRef.current = null

      const container = containerRef.current
      if (container) container.innerHTML = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop AR')
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    const container = containerRef.current
    if (!container) return

    try {
      // Clean if restarted
      await stop()

      const mod = await loadMindARThree()
      const MindARThree = mod.MindARThree as unknown as {
        new (opts: unknown): {
          renderer: unknown
          scene: unknown
          camera: unknown
          addAnchor: (idx: number) => { group: THREE.Group }
          start: () => Promise<void>
          stop: () => Promise<void>
          __cleanup?: () => void
        }
      }
      if (!MindARThree) throw new Error('MindARThree not available')

      const imageTargetSrc = practical.arTarget ?? '/targets/half-full-subtractor.mind'

      const mindarThree = new MindARThree({
        container,
        imageTargetSrc,
        uiLoading: 'no',
        uiScanning: 'no',
      })

      const { renderer, scene, camera } = mindarThree as unknown as {
        renderer: THREE.WebGLRenderer
        scene: THREE.Scene
        camera: THREE.Camera
      }
      rendererRef.current = renderer
      sceneRef.current = scene
      cameraRef.current = camera
      mindarRef.current = mindarThree

      const light = new THREE.HemisphereLight(0xffffff, 0x111827, 1.2)
      scene.add(light)

      // Anchor on first target image
      const anchor = mindarThree.addAnchor(0)

      const pickables: THREE.Object3D[] = []
      for (const m of SUBTRACTOR_AR_MARKERS) {
        const group = new THREE.Group()
        group.position.set(m.position[0], m.position[1], m.position[2])
        group.userData = { markerId: m.id }

        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.025, 20, 20),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(m.color),
            emissive: new THREE.Color(m.color),
            emissiveIntensity: 0.35,
          }),
        )
        group.add(dot)

        const label = makeLabelSprite(m.label)
        label.position.set(0, 0.06, 0)
        group.add(label)

        anchor.group.add(group)
        pickables.push(group)
        markerGroupsRef.current.set(m.id, group)
      }

      pickablesRef.current = pickables

      const onPointerDown = (ev: PointerEvent) => {
        const r = rendererRef.current
        const cam = cameraRef.current
        const scn = sceneRef.current
        if (!r || !cam || !scn) return

        const rect = r.domElement.getBoundingClientRect()
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
        raycaster.setFromCamera(pointer, cam as THREE.Camera)
        const hits = raycaster.intersectObjects(pickablesRef.current, true)
        const hit = hits[0]
        if (!hit) return

        let o: THREE.Object3D | null = hit.object
        while (o && !o.userData?.markerId) o = o.parent
        const markerId = o?.userData?.markerId as string | undefined
        const marker = SUBTRACTOR_AR_MARKERS.find((x) => x.id === markerId) ?? null
        if (marker) {
          setSelected(marker)
          spawnAnchoredModel(marker)
          // advance guide heuristically
          if (stepIdx < 3) setStepIdx((v) => Math.min(v + 1, 3))
        }
      }

      renderer.domElement.addEventListener('pointerdown', onPointerDown)

      await mindarThree.start()
      setRunning(true)

      renderer.setAnimationLoop(() => {
        pulseCurrentStep()
        renderer.render(scene, camera)
      })

      // Cleanup handler stored on mindar instance
      mindarThree.__cleanup = () => {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start AR')
      setRunning(false)
    }
  }, [practical.arTarget, pulseCurrentStep, raycaster, pointer, spawnAnchoredModel, stepIdx, stop])

  useEffect(() => {
    return () => {
      try {
        const mindarAny = mindarRef.current as unknown as { __cleanup?: () => void }
        mindarAny?.__cleanup?.()
      } catch {
        // ignore
      }
      void stop()
    }
  }, [stop])

  return (
    <div className="two-col">
      <div className="panel">
        <h2 className="h1" style={{ fontSize: 28, marginBottom: 8 }}>
          Physical + AR (scan the real kit)
        </h2>
        <p className="p">
          Point your phone camera at the kit. When recognized, component labels
          will overlay the kit. Tap a label to see a 3D component and guidance.
        </p>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => void start()} disabled={running}>
            Start camera
          </button>
          <button className="btn" onClick={() => void stop()} disabled={!running}>
            Stop
          </button>
          <a className="btn" href={practical.kitImage ?? '/kits/half-full-subtractor.jpeg'} target="_blank">
            Open kit photo
          </a>
        </div>

        {error ? (
          <div className="panel" style={{ marginTop: 12, borderColor: 'rgba(239,68,68,0.35)' }}>
            <p className="card-title" style={{ color: 'rgba(255,255,255,0.9)' }}>
              AR not started
            </p>
            <p className="p" style={{ marginTop: 8 }}>
              {error}
            </p>
            <p className="p" style={{ marginTop: 8 }}>
              If this mentions a missing <span className="kbd">.mind</span> file,
              generate it using the MindAR online compiler, then place it in{' '}
              <span className="kbd">public/targets</span>.
            </p>
          </div>
        ) : (
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="row">
              <p className="card-title">Guide (physical + AR)</p>
              <span className="pill">
                Step {stepIdx + 1}/4
              </span>
            </div>
            <ol style={{ margin: '8px 0 0', paddingLeft: 18, color: 'rgba(255,255,255,0.78)' }}>
              <li style={{ opacity: stepIdx === 0 ? 1 : 0.65 }}>
                Power ON the kit.
              </li>
              <li style={{ opacity: stepIdx === 1 ? 1 : 0.65 }}>
                Set inputs A/B/C (Borrow‑in) and observe LEDs on the kit.
              </li>
              <li style={{ opacity: stepIdx === 2 ? 1 : 0.65 }}>
                Use AR labels to locate terminals quickly; tap a label to overlay its 3D component.
              </li>
              <li style={{ opacity: stepIdx === 3 ? 1 : 0.65 }}>
                Measure Difference and Borrow against GND using a real multimeter.
              </li>
            </ol>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setStepIdx((v) => Math.max(0, v - 1))}>
                Previous
              </button>
              <button className="btn primary" onClick={() => setStepIdx((v) => Math.min(3, v + 1))}>
                Next
              </button>
              <button className="btn" onClick={() => setSelected(null)}>
                Clear selection
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            aspectRatio: '3 / 4',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 18,
            position: 'relative',
          }}
        />
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <p className="card-sub">
            Tip: Use a front-facing photo target with good lighting.
          </p>
        </div>
      </div>

      {selected ? (
        <Modal3D title={selected.label} onClose={() => setSelected(null)}>
          <p className="p" style={{ marginBottom: 10 }}>
            {selected.description}
          </p>
          <ComponentViewer3D kind={selected.model} />
        </Modal3D>
      ) : null}
    </div>
  )
}

function makeAnchoredModel(kind: Marker['model'], color: string) {
  const g = new THREE.Group()
  const c = new THREE.Color(color)
  const mat = new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.35,
    metalness: 0.15,
    emissive: c,
    emissiveIntensity: 0.15,
  })

  if (kind === 'ic') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.03), new THREE.MeshStandardMaterial({ color: 0x111827 }))
    g.add(body)
    return g
  }
  if (kind === 'probe') {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 18), mat)
    cyl.rotation.x = Math.PI / 2
    g.add(cyl)
    return g
  }
  // logic gate block
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.03), mat)
  g.add(gate)
  return g
}

function makeLabelSprite(text: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const paddingX = 18
  ctx.font = '600 28px system-ui, -apple-system, Segoe UI, Roboto, Arial'
  const metrics = ctx.measureText(text)
  const w = Math.ceil(metrics.width + paddingX * 2)
  const h = 56
  canvas.width = w
  canvas.height = h

  const ctx2 = canvas.getContext('2d')!
  ctx2.clearRect(0, 0, w, h)
  ctx2.fillStyle = 'rgba(0,0,0,0.55)'
  roundRect(ctx2, 0, 0, w, h, 18)
  ctx2.fill()
  ctx2.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx2.lineWidth = 2
  roundRect(ctx2, 1, 1, w - 2, h - 2, 18)
  ctx2.stroke()
  ctx2.fillStyle = 'rgba(255,255,255,0.92)'
  ctx2.font = '600 28px system-ui, -apple-system, Segoe UI, Roboto, Arial'
  ctx2.textBaseline = 'middle'
  ctx2.fillText(text, paddingX, h / 2 + 1)

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true })
  const spr = new THREE.Sprite(mat)
  spr.scale.set(0.32, 0.085, 1)
  return spr
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

