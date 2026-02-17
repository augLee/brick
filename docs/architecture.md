# Brickify AI — Architecture (2.5D Depth → Layered Instructions)

## Goal
From a user photo (person / vehicle / architecture / object), generate:
1) A single hero 3D product render (off-white background) for preview/marketing
2) A buildable 2.5D brick model represented as layered data (Z-layers)
3) A step-by-step build instruction (layer-by-layer) + BOM (parts list)
4) A downloadable digital package (PNG render + instruction PDF + CSV BOM)

## Key Constraints / Decisions
- Background for hero render is fixed to off-white: #FAF9F6
- People are converted into a brick-built bust statue (not minifigure)
- We will use a 2.5D depth pipeline for build instructions:
  - We do NOT attempt full photoreal 3D reconstruction
  - We do estimate a depth map, then voxelize and compress into bricks
- OpenAI API must be used (at least in analysis/prompt generation and/or instruction narration)
- Output image: 1 hero render only (MVP)
- MVP instruction style: layer-by-layer (Z=0..max), top-down per layer

## High-Level Pipeline
User photo URL (Supabase public URL)
  ↓
A) Subject Analysis (OpenAI Vision → structured JSON)
  - classify subject_type
  - extract key_features
  - decide camera_hint
  - propose negative constraints
  ↓
B) 2.5D Geometry Build (Algorithmic)
  B1) Background removal / segmentation (mask)
  B2) Depth estimation (depth map) on subject area
  B3) Normalize + quantize depth into Z layers
  B4) Voxel/Stud grid creation (x,y,z occupancy with color palette)
  B5) Brick packing/compression (merge 1x1 into bigger bricks)
  ↓
C) Outputs
  C1) Hero Render (image model; off-white product photo)
  C2) Build Model JSON (bricks + layers)
  C3) Instruction Steps (layered steps + BOM)
  C4) Package generation (PDF + CSV + optional JSON)

## System Components (Next.js App Router)
- UI
  - (site)/page.tsx: landing
  - (flow)/create/page.tsx: upload + generate preview + proceed
  - (flow)/checkout/page.tsx: Stripe checkout
  - (flow)/success/page.tsx: download package

- API
  - POST /api/upload: store user image in Supabase Storage → public URL
  - POST /api/generate-render: OpenAI analyze + hero render generation (1 PNG)
  - POST /api/generate-model: 2.5D pipeline → model JSON + BOM + steps
  - POST /api/download: create ZIP or direct links (PNG + PDF + CSV)
  - POST /api/checkout: Stripe session creation

## Data Flow Contracts
### Upload Response
{ "url": "https://.../public/inputs/uuid.png" }

### Generate Render Response (MVP)
{
  "jobId": "uuid",
  "previewImageUrl": "data:image/png;base64,... OR https://...",
  "partsSummary": "string (MVP dummy ok)",
  "storyText": "string",
  "debug": { ...optional }
}

### Generate Model Response (Core for instructions)
{
  "jobId": "uuid",
  "model": {
    "units": "stud",
    "grid": { "width": W, "height": H, "layers": Z },
    "palette": [{ "id": "C01", "hex": "#C2410C", "name": "terracotta" }, ...],
    "bricks": [
      {
        "id": "b_001",
        "part": "brick_2x4",
        "colorId": "C05",
        "pos": { "x": 10, "y": 4, "z": 2 },
        "rot": 0,
        "size": { "w": 2, "l": 4, "h": 3 }
      }
    ],
    "layers": [
      { "z": 0, "brickIds": ["b_001","b_002"], "add": ["b_001","b_002"] },
      { "z": 1, "brickIds": ["b_003"], "add": ["b_003"] }
    ]
  },
  "bom": [
    { "part": "brick_2x4", "colorId": "C05", "qty": 12 },
    { "part": "plate_1x2", "colorId": "C01", "qty": 33 }
  ],
  "steps": [
    {
      "index": 1,
      "z": 0,
      "add": [{ "part": "brick_2x4", "colorId": "C05", "qty": 2 }],
      "layerTopViewSvg": "<svg>...</svg>",
      "note": "string"
    }
  ]
}

## MVP Implementation Order (Do Not Skip)
1) UI states: upload → busy → render preview (even with dummy API)
2) /api/upload end-to-end verified (Supabase)
3) /api/generate-render end-to-end verified (OpenAI analyze + 1 image)
4) Introduce /api/generate-model with a simplified 2.5D pipeline:
   - Start with segmentation=full frame (no mask) and coarse depth quantization
   - Use only 1x1 bricks/plates initially (no packing)
5) Add packing/compression (2x2, 2x4, etc.)
6) Add instruction PDF output (PDFKit)
7) Production hardening: store generated PNG/PDF/CSV in Supabase

## Operational Notes
- Avoid returning huge base64 payloads in production.
  - Prefer storing generated images to Supabase and return a public URL.
- Never commit secrets. .env is ignored. .env.example uses placeholders only.
- If GitHub push protection blocks .env.example: do not use real-looking keys (e.g., sk_test_...).
