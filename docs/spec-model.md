# Brickify Model Spec (2.5D Depth Build Model)

## Overview
This spec defines the buildable model representation used for:
- Layered build steps (Z layers)
- Bill of Materials (BOM)
- Instruction rendering (SVG/PNG per step)
- Optional export to external formats later (LDraw/Studio)

We represent the model in "stud units" on a regular grid:
- X: left → right
- Y: bottom → top (screen coordinate can be inverted in render)
- Z: layers from base(0) upward

## Coordinate System
- pos.x, pos.y, pos.z are integer grid coordinates
- rot is 0 or 90 degrees for rectangular bricks (swap w/l)

## Palette
Palette defines allowed colors used in the model.
- colorId: string stable identifier
- hex: display color for previews/instructions
- name: optional

Example:
palette = [
  { id: "C01", hex: "#C2410C", name: "terracotta" },
  { id: "C02", hex: "#27272A", name: "charcoal" }
]

## Part Library (MVP)
For MVP we limit parts to simplify packing.
- brick_1x1 (h=3)
- brick_1x2 (h=3)
- brick_2x2 (h=3)
- brick_2x4 (h=3)
- plate_1x1 (h=1)
- plate_1x2 (h=1)
- plate_2x2 (h=1)
- tile_1x1 (h=1, optional)

Conventions:
- size.w = studs across X
- size.l = studs across Y
- size.h = height in "plate units" (brick=3, plate=1)

## Brick Entity
A Brick is a placed part instance:
- id: unique
- part: part key from library
- colorId: palette color id
- pos: {x,y,z} bottom-left anchor in studs
- rot: 0|90 degrees
- size: {w,l,h} derived from part + rot

Example:
{
  "id": "b_001",
  "part": "brick_2x4",
  "colorId": "C02",
  "pos": { "x": 10, "y": 3, "z": 2 },
  "rot": 90,
  "size": { "w": 4, "l": 2, "h": 3 }
}

## Layer Entity
A Layer describes incremental assembly steps.
MVP: one step = one Z-layer.
- z: integer
- brickIds: all bricks whose bottom z equals this z (or bricks present in this layer)
- add: bricks added at this step

Example:
{ "z": 0, "brickIds": ["b_001","b_002"], "add": ["b_001","b_002"] }

## Steps Entity
Steps is a user-friendly sequence built from layers.
- index: 1-based step number
- z: layer index
- add: summary list grouped by (part,colorId)
- layerTopViewSvg: 2D top-down visualization for this step (MVP)
- note: human text instruction (OpenAI may assist)

Example:
{
  "index": 1,
  "z": 0,
  "add": [
    { "part": "brick_2x4", "colorId": "C02", "qty": 2 }
  ],
  "layerTopViewSvg": "<svg .../>",
  "note": "Build the base layer. Align the long side horizontally."
}

## BOM Entity
BOM is a global inventory list grouped by (part,colorId).
Example:
{ "part": "brick_2x4", "colorId": "C02", "qty": 12 }

## 2.5D Build Algorithm (MVP)
Input: image + depth map + mask
Output: layered occupancy + colors

### Step 1: Grid sizing
Choose grid W,H (e.g., 48x48 or 64x64) based on image aspect ratio.

### Step 2: Masking
- If segmentation is available, only consider subject pixels.
- Otherwise, consider full frame but bias center.

### Step 3: Depth normalization
- depth normalized to [0..1] inside mask
- quantize into Z layers: z = round(depth * (Zmax-1))

### Step 4: Color mapping
- Downsample image to W,H
- Map each pixel to nearest palette color (k-means optional later)

### Step 5: Occupancy
For each (x,y):
- if masked: occupy from z=0..zDepth (solid stack) OR just occupy at zDepth (shell)
MVP recommended: solid stack for stability.

### Step 6: Brick packing
Start MVP with 1x1 bricks/plates only.
Then add greedy packing:
- For each layer z, try placing largest bricks first (2x4,2x2,1x2,1x1)
- Avoid overlaps, maintain occupied map.
Packing should preserve layer surfaces and structural support.

## Instruction Rendering (SVG)
For each layer z:
- Render top view grid
- Draw rectangles for bricks added in this step
- Optional: label part sizes (avoid text in MVP if needed)
- Color by palette hex

SVG is used because:
- lightweight
- easy to embed in PDF
- easy to export or rasterize later

## Export Notes
Later we can export to:
- LDraw (.ldr): widely supported
- Bricklink Studio (.io): user-friendly
But MVP only needs SVG + PDF + CSV.
