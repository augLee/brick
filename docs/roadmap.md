# Brickify AI — Roadmap (Layered 2.5D Build)

## Milestone 0: Repo Safety & Baseline
- [ ] .gitignore includes .env, node_modules, .next
- [ ] .env.example contains placeholders only (no real key patterns)
- [ ] Vercel env vars set (OPENAI_API_KEY, SUPABASE_*, STRIPE_*, etc.)

## Milestone 1: UI + Upload E2E
- [ ] Landing page (site)
- [ ] Create page (flow) with:
  - [ ] file picker + drag drop
  - [ ] preview thumbnail
  - [ ] busy state
  - [ ] error handling
- [ ] POST /api/upload returns public URL
- [ ] Create page calls /api/upload successfully

Acceptance:
- Uploading an image returns a valid Supabase public URL and can be opened in browser.

## Milestone 2: Hero Render (1 image)
- [ ] POST /api/generate-render
  - [ ] OpenAI Vision analysis → JSON
  - [ ] Render prompt composed (base + subject addon + camera + negatives)
  - [ ] Generate 1 hero image (data URL in MVP; later store to Supabase)
- [ ] Create page shows returned hero image

Acceptance:
- Any uploaded image produces a single off-white background product render.

## Milestone 3: 2.5D Build Model JSON (No Packing)
- [ ] POST /api/generate-model
  - [ ] depth estimation (local lib or external service)
  - [ ] quantize depth to Z layers
  - [ ] build occupancy grid
  - [ ] map colors to palette
  - [ ] output model JSON (bricks as 1x1 only)
- [ ] Generate BOM
- [ ] Generate layered steps (one step per layer)

Acceptance:
- For a given image, model JSON has non-empty bricks/layers/bom/steps.

## Milestone 4: Brick Packing (Greedy)
- [ ] Implement per-layer greedy packing:
  - [ ] 2x4, 2x2, 1x2, 1x1 priority
  - [ ] respect color regions
  - [ ] avoid overlaps
- [ ] Update BOM accordingly
- [ ] Update step rendering to show packed bricks

Acceptance:
- Brick count decreases significantly vs 1x1 baseline and still renders correctly.

## Milestone 5: Instruction PDF + Package Download
- [ ] Generate per-step SVG top view
- [ ] Build PDF with:
  - [ ] cover page (hero render)
  - [ ] BOM pages
  - [ ] step pages (layer view + add list)
- [ ] CSV export for BOM
- [ ] /api/download returns package link (zip optional)

Acceptance:
- User downloads PDF+CSV+PNG.

## Milestone 6: Quality Improvements
- [ ] Better segmentation / subject mask
- [ ] Better palette selection per subject type
- [ ] “Bust statue” heuristic for persons (head/torso emphasis)
- [ ] Depth smoothing to reduce noise
- [ ] Stability checks (floating bricks, support constraints)

## Milestone 7: Paid Flow (Stripe)
- [ ] Checkout session creation
- [ ] Success callback
- [ ] Access-control for downloads (jobId + payment status)
