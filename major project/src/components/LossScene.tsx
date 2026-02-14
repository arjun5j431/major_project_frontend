import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"

function LossSurface() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[5, 5, 50, 50]} />
      <meshStandardMaterial wireframe color="cyan" />
    </mesh>
  )
}

export default function LossScene() {
  return (
    <div className="h-screen w-full">
      <Canvas camera={{ position: [3, 3, 3] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />
        <LossSurface />
        <OrbitControls />
      </Canvas>
    </div>
  )
}
