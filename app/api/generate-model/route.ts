import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Part = "brick_1x1" | "brick_1x2" | "brick_2x2" | "brick_2x4";
type PaletteColor = { id: string; hex: string; name: string };
type Brick = {
  id: string;
  part: Part;
  colorId: string;
  pos: { x: number; y: number; z: number };
  rot: 0 | 90;
  size: { w: number; l: number; h: 3 };
};
type Layer = { z: number; brickIds: string[]; add: string[] };
type BomItem = { part: Part; colorId: string; qty: number };
type Step = {
  index: number;
  z: number;
  add: Array<{ part: Part; colorId: string; qty: number }>;
  layerTopViewSvg: string;
  note: string;
};

const palette: PaletteColor[] = [
  { id: "C01", hex: "#C2410C", name: "terracotta" },
  { id: "C02", hex: "#27272A", name: "charcoal" },
  { id: "C03", hex: "#A1A1AA", name: "fog-gray" },
  { id: "C04", hex: "#52525B", name: "graphite" },
];

function pickColor(x: number, y: number, z: number) {
  const idx = (x * 31 + y * 17 + z * 13) % palette.length;
  return palette[idx];
}

function buildLayerSvg(z: number, bricks: Brick[]) {
  const cell = 16;
  const width = 16 * cell;
  const height = 16 * cell;
  const layer = bricks.filter((brick) => brick.pos.z === z);
  const rects = layer
    .map((brick) => {
      const color = palette.find((item) => item.id === brick.colorId)?.hex ?? "#71717A";
      const x = brick.pos.x * cell;
      const y = height - (brick.pos.y + 1) * cell;
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${color}" rx="3"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#FAF9F6"/>
    ${rects}
  </svg>`;
}

function buildModel() {
  const bricks: Brick[] = [];
  const layers: Layer[] = [];
  const part = "brick_1x1";
  let idCount = 1;

  for (let z = 0; z < 6; z += 1) {
    const layerIds: string[] = [];
    for (let x = 2 + z; x < 14 - z; x += 1) {
      for (let y = 2 + z; y < 14 - z; y += 1) {
        if ((x + y + z) % 3 === 0) continue;
        const id = `b_${String(idCount).padStart(4, "0")}`;
        idCount += 1;
        bricks.push({
          id,
          part,
          colorId: pickColor(x, y, z).id,
          pos: { x, y, z },
          rot: 0,
          size: { w: 1, l: 1, h: 3 },
        });
        layerIds.push(id);
      }
    }
    layers.push({ z, brickIds: layerIds, add: layerIds });
  }

  return { bricks, layers };
}

function buildBom(bricks: Brick[]): BomItem[] {
  const map = new Map<string, BomItem>();
  for (const brick of bricks) {
    const key = `${brick.part}:${brick.colorId}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += 1;
      continue;
    }
    map.set(key, { part: brick.part, colorId: brick.colorId, qty: 1 });
  }
  return Array.from(map.values());
}

function buildSteps(bricks: Brick[], layers: Layer[]): Step[] {
  return layers.map((layer, idx) => {
    const addMap = new Map<string, { part: Part; colorId: string; qty: number }>();
    for (const id of layer.add) {
      const brick = bricks.find((item) => item.id === id);
      if (!brick) continue;
      const key = `${brick.part}:${brick.colorId}`;
      const existing = addMap.get(key);
      if (existing) {
        existing.qty += 1;
      } else {
        addMap.set(key, { part: brick.part, colorId: brick.colorId, qty: 1 });
      }
    }
    return {
      index: idx + 1,
      z: layer.z,
      add: Array.from(addMap.values()),
      layerTopViewSvg: buildLayerSvg(layer.z, bricks),
      note: `${layer.z + 1}층을 평평하게 맞추며 조립하세요.`,
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { inputImageUrl?: string };
    if (!body.inputImageUrl || typeof body.inputImageUrl !== "string") {
      return NextResponse.json({ error: "inputImageUrl이 필요합니다." }, { status: 400 });
    }

    const { bricks, layers } = buildModel();
    const bom = buildBom(bricks);
    const steps = buildSteps(bricks, layers);

    return NextResponse.json({
      jobId: randomUUID(),
      model: {
        units: "stud",
        grid: { width: 16, height: 16, layers: 6 },
        palette,
        bricks,
        layers,
      },
      bom,
      steps,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "모델 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
