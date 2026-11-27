# Acid Warp HD

A modern, GPU-accelerated psychedelic visualizer inspired by Noah Spurrier's classic 1990s **Acid Warp** screensaver.

## Quick Start

Double-click [`index.html`](index.html) to launch directly in any modern browser (Chrome, Edge, Firefox, or Safari) — zero build step or installation required.

Press **`F`** (or double-click the canvas) for fullscreen screensaver mode. All controls automatically fade out after 3.5 seconds of mouse inactivity.

## Features

- **24 Real-Time WebGL2 Patterns**: 12 classic Acid Warp inspirations (*Acid Eye, Polar Ripples, Spiral Vortex, Interference Grid, Hyper Tunnel, Twin Dipole, Rose Mandala*, etc.) and 12 modern GPU shader patterns (*Liquid Plasma, Julia Fractal, Seahorse Valley, Voronoi Cells, Kaleido Crystal, Mobius Torus, Quasicrystal, Cosmic Nebula*, etc.).
- **Smooth Pattern & Palette Morphing**: Continuous scalar-field cross-fading between patterns and seamless cyclic 256-step palette rotation & blending.
- **Custom Palette Studio**: Interactive gradient track to add, drag, edit, and delete color stops live on the GPU, choose blend modes (*Smooth Loop, Linear RGB, Optical Bands*), randomize harmonious psychedelic palettes, and save custom palettes locally.
- **Modern Shader Post-FX & Retro Mode**: Tunable Neon Bloom Glow, 3D Contour Sheen, Chromatic Prism, Liquid Domain Warp, Kaleidoscope Symmetry (3–12 folds), and an optional **Retro Pixel Mode** to recreate classic DOS VGA aesthetics.
- **Psychedelic Music & Audio Reactivity**: Built-in Web Audio API generative synthesizer with 6 soundscapes (*Cosmic Shimmer, Acid Goa Trance, Sitar & Tanpura, Liquid Dub, Binaural Astral*, and *Synthwave Trip*), support for loading your own local audio files (`.mp3`/`.wav`/`.ogg`), live spectrum visualizer, and optional audio-reactive visuals.
- **HD Snapshot Capture**: Press **`C`** or click the camera button to save a PNG of any frame.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Pause / Resume |
| `←` / `→` | Previous / Next Pattern |
| `↑` / `↓` | Previous / Next Music Track |
| `Shift + ↑` / `↓` | Next / Previous Palette |
| `[` / `]` | Slower / Faster Palette Cycling |
| `R` | Reverse Cycle Direction |
| `L` | Lock / Unlock Pattern |
| `P` | Lock / Unlock Palette |
| `S` | Shuffle Pattern & Palette |
| `M` | Toggle Psychedelic Music |
| `E` | Cycle Projection Edge Mask |
| `H` | Toggle Studio Control Drawer |
| `F` | Toggle Fullscreen |
| `C` | Save HD PNG Screenshot |
| `?` | Show Shortcuts Overlay |
