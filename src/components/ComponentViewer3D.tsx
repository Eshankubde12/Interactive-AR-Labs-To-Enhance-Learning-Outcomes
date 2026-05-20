import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

type ModelKind = 'xor' | 'and' | 'not' | 'ic' | 'probe' | 'resistor' | 'npn' | 'meter'

function Gate({
  kind,
}: {
  kind: Exclude<ModelKind, 'ic' | 'probe'>
}) {
  const color =
    kind === 'xor'
      ? new THREE.Color('#22d3ee')
      : kind === 'and'
        ? new THREE.Color('#7c3aed')
        : new THREE.Color('#f59e0b')

  return (
    <group>
      <mesh>
        <boxGeometry args={[2.2, 1.2, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[-1.25, 0, 0.25]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color={'white'} />
      </mesh>
      <mesh position={[1.25, 0, 0.25]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color={'white'} />
      </mesh>
      {kind === 'not' ? (
        <mesh position={[1.55, 0, 0.25]}>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshStandardMaterial color={'#ffffff'} emissive={'#ffffff'} emissiveIntensity={0.35} />
        </mesh>
      ) : null}
    </group>
  )
}

function IcChip() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[2.6, 1.4, 0.45]} />
        <meshStandardMaterial color={'#111827'} roughness={0.4} metalness={0.1} />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={`l-${i}`} position={[-1.3 + i * 0.42, -0.8, 0]}>
          <boxGeometry args={[0.18, 0.35, 0.12]} />
          <meshStandardMaterial color={'#d1d5db'} roughness={0.3} metalness={0.7} />
        </mesh>
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={`r-${i}`} position={[-1.3 + i * 0.42, 0.8, 0]}>
          <boxGeometry args={[0.18, 0.35, 0.12]} />
          <meshStandardMaterial color={'#d1d5db'} roughness={0.3} metalness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Probe() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 20]} />
        <meshStandardMaterial color={'#ef4444'} roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[0.12, 0.4, 24]} />
        <meshStandardMaterial color={'#e5e7eb'} />
      </mesh>
    </group>
  )
}

function Resistor() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 2.2, 24]} />
        <meshStandardMaterial color={'#d4a373'} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[-1.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 16]} />
        <meshStandardMaterial color={'#9ca3af'} roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh position={[1.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 16]} />
        <meshStandardMaterial color={'#9ca3af'} roughness={0.25} metalness={0.8} />
      </mesh>
      {[-0.35, -0.1, 0.15, 0.4].map((x) => (
        <mesh key={x} position={[x, 0, 0.19]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.06, 0.28, 0.02]} />
          <meshStandardMaterial color={'#111827'} />
        </mesh>
      ))}
    </group>
  )
}

function TransistorNpn() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.55, 0.55, 1.1, 32]} />
        <meshStandardMaterial color={'#111827'} roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.58, 32, 32]} />
        <meshStandardMaterial color={'#0f172a'} roughness={0.35} metalness={0.15} />
      </mesh>
      {[-0.35, 0, 0.35].map((x) => (
        <mesh key={x} position={[x, -0.9, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.3, 18]} />
          <meshStandardMaterial color={'#9ca3af'} roughness={0.25} metalness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function Meter() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[2.3, 1.5, 0.5]} />
        <meshStandardMaterial color={'#0b1224'} roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.2, 0.26]}>
        <boxGeometry args={[1.8, 0.8, 0.02]} />
        <meshStandardMaterial color={'#0ea5e9'} emissive={'#0ea5e9'} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[-0.7, -0.55, 0.26]}>
        <cylinderGeometry args={[0.08, 0.08, 0.08, 16]} />
        <meshStandardMaterial color={'#ef4444'} />
      </mesh>
      <mesh position={[0.7, -0.55, 0.26]}>
        <cylinderGeometry args={[0.08, 0.08, 0.08, 16]} />
        <meshStandardMaterial color={'#111827'} />
      </mesh>
    </group>
  )
}

function Model({ kind }: { kind: ModelKind }) {
  if (kind === 'ic') return <IcChip />
  if (kind === 'probe') return <Probe />
  if (kind === 'resistor') return <Resistor />
  if (kind === 'npn') return <TransistorNpn />
  if (kind === 'meter') return <Meter />
  return <Gate kind={kind} />
}

export function ComponentViewer3D({ kind }: { kind: ModelKind }) {
  return (
    <div style={{ height: 420, width: '100%', borderRadius: 14, overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 4, 4]} intensity={1.1} />
        <group rotation={[0.2, 0.6, 0]}>
          <Model kind={kind} />
        </group>
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  )
}

