// lib/bom-client.ts
export type BomItem = { part: string; color: string; count: number };
export type Mask64 = number[][];

export type BomResult = {
  bom: BomItem[];
  totalPieces: number;  // "브릭 수(피스 수)" = sum(count)
  totalStuds: number;   // 64x64면 보통 4096 (면적합)
  uniqueItems: number;  // bom.length
};

const BRICKS = [
  { w: 2, h: 8, part: "plate_2x8" },
  { w: 1, h: 8, part: "plate_1x8" },
  { w: 2, h: 6, part: "plate_2x6" },
  { w: 1, h: 6, part: "plate_1x6" },
  { w: 2, h: 4, part: "plate_2x4" },
  { w: 1, h: 4, part: "plate_1x4" },
  { w: 3, h: 4, part: "plate_3x4" },
  { w: 3, h: 3, part: "plate_3x3" },
  { w: 2, h: 3, part: "plate_2x3" },
  { w: 1, h: 3, part: "plate_1x3" },
  { w: 4, h: 4, part: "plate_4x4" },
  { w: 4, h: 3, part: "plate_4x3" },
  { w: 4, h: 2, part: "plate_4x2" },
  { w: 2, h: 2, part: "plate_2x2" },
  { w: 1, h: 2, part: "plate_1x2" },
  { w: 1, h: 1, part: "plate_1x1" },
].sort((a, b) => b.w * b.h - a.w * a.h);

const AREA = new Map(BRICKS.map(b => [b.part, b.w * b.h]));

const HEX = /^#[0-9A-F]{6}$/;
const normHex = (s: string) => (HEX.test(s?.toUpperCase?.()) ? s.toUpperCase() : null);

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function nearestPaletteColor(r: number, g: number, b: number, palette: string[]) {
  let best = palette[0], bestD = Infinity;
  for (const p of palette) {
    const rgb = hexToRgb(p);
    const dr = r - rgb.r, dg = g - rgb.g, db = b - rgb.b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const shouldUseProxy =
    !dataUrl.startsWith("data:") &&
    !dataUrl.startsWith("/api/image-proxy");

  const src = shouldUseProxy
    ? `/api/image-proxy?url=${encodeURIComponent(dataUrl)}`
    : dataUrl;

  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function computeBomFromPreview(
  previewImageUrl: string,
  palette8: string[],
  gridW = 64,
  gridH = 64,
  mask64?: Mask64
): Promise<BomResult> {
  const palette = palette8.map(normHex).filter(Boolean) as string[];
  if (palette.length !== 8) throw new Error("palette8 must be 8 valid #RRGGBB");

  const img = await loadImage(previewImageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = gridW;
  canvas.height = gridH;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context not available");

  ctx.drawImage(img, 0, 0, gridW, gridH);
  const { data } = ctx.getImageData(0, 0, gridW, gridH);

  const grid: string[][] = Array.from({ length: gridH }, () => Array(gridW).fill(palette[0]));
  const active: boolean[][] = Array.from({ length: gridH }, () => Array(gridW).fill(true));

  const hasValidMask =
    Array.isArray(mask64) &&
    mask64.length === 64 &&
    mask64.every((row) => Array.isArray(row) && row.length === 64);

  const maskValueAt = (x: number, y: number) => {
    if (!hasValidMask || !mask64) return 1;
    const mx = Math.min(63, Math.floor((x * 64) / gridW));
    const my = Math.min(63, Math.floor((y * 64) / gridH));
    return mask64[my][mx] === 1 ? 1 : 0;
  };

  for (let y = 0, idx = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const r = data[idx++], g = data[idx++], b = data[idx++], a = data[idx++];
      const inMask = maskValueAt(x, y) === 1;
      active[y][x] = inMask;
      grid[y][x] = a < 10 ? palette[0] : nearestPaletteColor(r, g, b, palette);
    }
  }

  const used = Array.from({ length: gridH }, () => Array(gridW).fill(false));
  const map = new Map<string, number>(); // part|color -> count

  const canPlace = (x: number, y: number, w: number, h: number) => {
    const c = grid[y][x];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      if (x + dx >= gridW || y + dy >= gridH) return false;
      if (used[y + dy][x + dx]) return false;
      if (!active[y + dy][x + dx]) return false;
      if (grid[y + dy][x + dx] !== c) return false;
    }
    return true;
  };

  const mark = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) used[y + dy][x + dx] = true;
  };

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (used[y][x]) continue;
      if (!active[y][x]) {
        used[y][x] = true;
        continue;
      }

      let placed = false;
      for (const b of BRICKS) {
        const tries = b.w === b.h ? [[b.w, b.h]] : [[b.w, b.h], [b.h, b.w]];
        for (const [w, h] of tries) {
          if (!canPlace(x, y, w, h)) continue;
          mark(x, y, w, h);
          const key = `${b.part}|${grid[y][x]}`;
          map.set(key, (map.get(key) ?? 0) + 1);
          placed = true;
          break;
        }
        if (placed) break;
      }

      if (!placed) {
        used[y][x] = true;
        const key = `plate_1x1|${grid[y][x]}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
  }

  const bom: BomItem[] = Array.from(map.entries()).map(([k, count]) => {
    const [part, color] = k.split("|");
    return { part, color, count };
  }).sort((a, b) => b.count - a.count);

  const totalPieces = bom.reduce((s, i) => s + i.count, 0);
  const totalStuds = bom.reduce((s, i) => s + i.count * (AREA.get(i.part) ?? 1), 0);

  return { bom, totalPieces, totalStuds, uniqueItems: bom.length };
}
