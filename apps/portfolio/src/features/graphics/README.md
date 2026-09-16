# Graphics

GPU-side 2D primitives — variable-width lines, gradients, animated shapes — at near-zero CPU cost.

Live: [https://frozik.github.io/portfolio/graphics](https://frozik.github.io/portfolio/graphics) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/graphics/`.

GPU-accelerated 2D rendering of graphic primitives with WebGPU — near-zero
CPU usage and minimal GPU overhead. Features:
- Variable line thickness with rounded joins between segments
- Gradient coloring per segment
- Transparent sin-Y wave layer composited over the main scene
- Animated shapes (circles, polygons, stars) with fade-in / fade-out lifecycle
- 4× MSAA anti-aliasing across the whole scene
