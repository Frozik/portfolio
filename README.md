<p align="center">
  <a href="https://github.com/Frozik/portfolio/actions/workflows/ci.yml">
    <img src="https://github.com/Frozik/portfolio/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI">
  </a>
</p>

# [Portfolio](https://frozik.github.io/portfolio)
Portfolio monorepo — interactive demos showcasing React, WebGPU,
TensorFlow.js, and physics simulations.

**Tech stack**: React 19, TypeScript 6, MobX, Tailwind CSS v4, Radix UI, Vite 8,
WebGPU, TensorFlow.js, Matter.js, Dockview.

## Getting Started

```bash
pnpm install    # Install dependencies
pnpm dev        # Start dev server
pnpm check-all  # Run full validation (lint + types + tests + format)
```

## Features

### CV

Resume page with work experience, skills, education, and contacts.
Available in PDF format for download.

### Pendulum

Genetic algorithm evolves neural networks to balance an inverted pendulum.
Uses TensorFlow.js for neural network inference and Matter.js for 2D physics
simulation.

**Fitness Playground** — simulation area for neural networks. The best
candidates are selected using mutation and crossover. Simulation speed adapts
automatically to CPU performance without freezing the UI.

**Generations** — load saved generations or create new ones. Displays a table
with generation numbers and all robots from that generation. Select any robot
to test it.

**Test Playground** — test individual robots by applying external forces.
Click on the area to introduce instability — closer to the weight means
stronger force, longer press means greater effect. Deselect the robot to try
manual control (arrow keys for movement, Shift for boost).

**Neural Network** — visualizes the network structure: weights, biases, layers,
and neuron counts. Hover over a neuron to inspect its weights and biases.

### Sudoku

Sudoku game with pen/notes tool modes, undo history, and field validation.

### Sun

WebGPU particle visualization — 100,000 billboard instances on a sphere with
time-based animation, neon gradient coloring, and 4x MSAA anti-aliasing.
Interactive orbit camera via mouse drag and touch.

### Graphics

GPU-accelerated 2D rendering of graphic primitives with WebGPU — near-zero
CPU usage and minimal GPU overhead. Features:
- Variable line thickness with rounded joins between segments
- Gradient coloring per segment
- Transparent sin-Y wave layer composited over the main scene
- Animated shapes (circles, polygons, stars) with fade-in/fade-out lifecycle
- Multi-pass rendering pipeline with 4x MSAA anti-aliasing

### Timeseries

Interactive time-series chart visualization built with WebGPU. Features:
- Zoom and pan controls for navigating large datasets
- Adaptive axis labels that scale from minutes to years
- Delta-encoded data packing for efficient GPU rendering
- SVG-based axes and grid overlay

### Controls

Showcase of shared UI controls (numeric input, date editor).
