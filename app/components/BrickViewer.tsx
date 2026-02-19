"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Environment } from "@react-three/drei";
import * as THREE from "three";

type BrickData = {
  position: [number, number, number];
  color: string;
};

interface BrickViewerProps {
  imageUrl: string;
  onPartsCalculated?: (count: number, parts: Record<string, number>) => void;
}

// 🧱 개별 브릭을 그리는 대신, 성능을 위해 'InstancedMesh'를 사용합니다.
function Bricks({ imageUrl, onPartsCalculated }: BrickViewerProps) {
  const [bricks, setBricks] = useState<BrickData[]>([]);
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    
    img.onload = () => {
      // 1. 이미지를 캔버스에 그려서 픽셀 데이터 추출
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      // 해상도를 낮춰야 브릭 느낌이 나고 성능이 유지됨 (예: 64x64)
      const size = 64; 
      canvas.width = size;
      canvas.height = size;
      
      if (ctx) {
        // 이미지를 캔버스 크기에 맞춰 그림
        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;

        const newBricks: BrickData[] = [];
        const partsCount: Record<string, number> = {};

        // 2. 픽셀 루프: 색상과 밝기를 분석해 위치 결정
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // 투명하면 건너뜀
            if (a < 20) continue;

            // 밝기 계산 (Height Map)
            const brightness = (r + g + b) / 3;
            // 밝을수록 튀어나오게 (0 ~ 5층 높이)
            const height = Math.floor((brightness / 255) * 5) + 1; 

            const colorHex = new THREE.Color(`rgb(${r},${g},${b})`).getHexString();
            
            // 부품 집계
            if (!partsCount[colorHex]) partsCount[colorHex] = 0;
            partsCount[colorHex] += height; // 높이만큼 1x1 플레이트가 필요하다고 가정

            // 높이만큼 브릭 쌓기 (복셀화)
            for (let h = 0; h < height; h++) {
              newBricks.push({
                position: [x - size / 2, h, y - size / 2], // 중앙 정렬
                color: `#${colorHex}`,
              });
            }
          }
        }

        setBricks(newBricks);
        // 부모 컴포넌트에 부품 수 전달
        if (onPartsCalculated) {
          const total = Object.values(partsCount).reduce((a, b) => a + b, 0);
          onPartsCalculated(total, partsCount);
        }
      }
    };
  }, [imageUrl, onPartsCalculated]);

  // 3. Three.js 인스턴스 업데이트
  useEffect(() => {
    if (meshRef.current && bricks.length > 0) {
      bricks.forEach((brick, i) => {
        dummy.position.set(brick.position[0], brick.position[1], brick.position[2]);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        meshRef.current!.setColorAt(i, new THREE.Color(brick.color));
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [bricks, dummy]);

  if (bricks.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, bricks.length]}>
      <boxGeometry args={[0.9, 1.1, 0.9]} /> {/* 브릭 크기와 간격 */}
      <meshStandardMaterial />
    </instancedMesh>
  );
}

// 📺 메인 뷰어 컴포넌트
export default function BrickViewer({ imageUrl }: { imageUrl: string }) {
  const [totalParts, setTotalParts] = useState(0);

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200">
        <Canvas shadows camera={{ position: [50, 50, 50], fov: 45 }}>
          <color attach="background" args={['#f0f0f0']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          
          <Center>
            <Bricks 
              imageUrl={imageUrl} 
              onPartsCalculated={(total) => setTotalParts(total)} 
            />
          </Center>

          <OrbitControls 
            autoRotate 
            autoRotateSpeed={2} 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 2} 
          />
          <Environment preset="city" />
        </Canvas>

        {/* 3D 로딩 중이거나 아직 이미지가 없을 때 */}
        {totalParts === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
            <span className="text-sm font-bold text-slate-500 animate-pulse">
              브릭 설계도 생성 중...
            </span>
          </div>
        )}
      </div>

      {/* 부품 정보 요약 패널 */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">총 부품 수</span>
          <span className="text-2xl font-black text-[#C2410C]">
            {totalParts.toLocaleString()} pcs
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          * 현재 1x1 플레이트 기준으로 계산된 견적입니다.
        </p>
      </div>
    </div>
  );
}