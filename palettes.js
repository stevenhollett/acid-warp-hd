/* Acid Warp HD - Curated Palettes & Custom Palette Engine */
(function () {
  'use strict';

  const STORAGE_KEY = 'acid_warp_hd_custom_palettes_v1';

  /**
   * Built-in curated palettes inspired by classic Acid Warp + modern neon aesthetics.
   * Each stop has { pos: 0..1, color: '#rrggbb' }.
   * mode: 'smooth' (cosine-eased loop), 'linear' (linear RGB loop), 'bands' (crisp posterized steps)
   */
  const PRESET_PALETTES = [
    {
      id: 'acid-rainbow',
      name: 'Acid Rainbow',
      category: 'Classic',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#ff0055' },
        { pos: 0.17, color: '#ff9900' },
        { pos: 0.33, color: '#eeff00' },
        { pos: 0.5, color: '#00ff88' },
        { pos: 0.67, color: '#00ccff' },
        { pos: 0.83, color: '#7722ff' }
      ]
    },
    {
      id: 'neon-electric',
      name: 'Neon Electric',
      category: 'Modern',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#090226' },
        { pos: 0.22, color: '#3b00b3' },
        { pos: 0.44, color: '#00e5ff' },
        { pos: 0.62, color: '#ff00aa' },
        { pos: 0.8, color: '#ffe600' },
        { pos: 0.92, color: '#2b0066' }
      ]
    },
    {
      id: 'solar-flare',
      name: 'Solar Flare',
      category: 'Classic',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#0a0204' },
        { pos: 0.2, color: '#6b0014' },
        { pos: 0.42, color: '#e62e00' },
        { pos: 0.64, color: '#ffaa00' },
        { pos: 0.82, color: '#fff8c9' },
        { pos: 0.92, color: '#991400' }
      ]
    },
    {
      id: 'deep-abyss',
      name: 'Deep Abyss',
      category: 'Classic',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#020817' },
        { pos: 0.24, color: '#003566' },
        { pos: 0.48, color: '#00b4d8' },
        { pos: 0.68, color: '#90f1ef' },
        { pos: 0.84, color: '#ffffff' },
        { pos: 0.93, color: '#032040' }
      ]
    },
    {
      id: 'ultraviolet-dream',
      name: 'Ultraviolet Dream',
      category: 'Modern',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#0d001a' },
        { pos: 0.2, color: '#5a00b8' },
        { pos: 0.45, color: '#ff1e9c' },
        { pos: 0.68, color: '#ff9ce6' },
        { pos: 0.84, color: '#3df2ff' }
      ]
    },
    {
      id: 'sunset-vapor',
      name: 'Sunset Vapor',
      category: 'Modern',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#1a0933' },
        { pos: 0.22, color: '#a81c74' },
        { pos: 0.45, color: '#ff6b4a' },
        { pos: 0.65, color: '#ffd166' },
        { pos: 0.84, color: '#06d6a0' }
      ]
    },
    {
      id: 'emerald-matrix',
      name: 'Emerald Pulse',
      category: 'Classic',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#020d05' },
        { pos: 0.25, color: '#004d1f' },
        { pos: 0.52, color: '#00d95a' },
        { pos: 0.74, color: '#b5ff3b' },
        { pos: 0.88, color: '#e8ffe0' }
      ]
    },
    {
      id: 'liquid-chrome',
      name: 'Liquid Chrome',
      category: 'Modern',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#080c14' },
        { pos: 0.18, color: '#455a75' },
        { pos: 0.34, color: '#e8f4ff' },
        { pos: 0.5, color: '#1b2838' },
        { pos: 0.68, color: '#7dd3fc' },
        { pos: 0.84, color: '#fde68a' }
      ]
    },
    {
      id: 'prismatic-pastel',
      name: 'Opalescent Pearl',
      category: 'Classic',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#ff99c8' },
        { pos: 0.2, color: '#fcf6bd' },
        { pos: 0.4, color: '#d0f4de' },
        { pos: 0.6, color: '#a9def9' },
        { pos: 0.8, color: '#e4c1f9' }
      ]
    },
    {
      id: 'toxic-acid',
      name: 'Toxic Acid',
      category: 'Classic',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#140024' },
        { pos: 0.25, color: '#6e00cc' },
        { pos: 0.5, color: '#14ff00' },
        { pos: 0.72, color: '#eaff00' },
        { pos: 0.88, color: '#00ffa6' }
      ]
    },
    {
      id: 'infrared-heat',
      name: 'Infrared Thermal',
      category: 'Classic',
      mode: 'linear',
      stops: [
        { pos: 0.0, color: '#000018' },
        { pos: 0.18, color: '#2b0099' },
        { pos: 0.36, color: '#b8008a' },
        { pos: 0.56, color: '#ff3300' },
        { pos: 0.76, color: '#ffdd00' },
        { pos: 0.9, color: '#ffffff' }
      ]
    },
    {
      id: 'nordic-aurora',
      name: 'Nordic Aurora',
      category: 'Modern',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#030712' },
        { pos: 0.22, color: '#0c4a6e' },
        { pos: 0.45, color: '#00f5a0' },
        { pos: 0.68, color: '#00d9f5' },
        { pos: 0.85, color: '#a855f7' }
      ]
    },
    {
      id: 'obsidian-gold',
      name: 'Obsidian Gold',
      category: 'Modern',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#080604' },
        { pos: 0.28, color: '#3b2408' },
        { pos: 0.5, color: '#d4941e' },
        { pos: 0.68, color: '#fff0a8' },
        { pos: 0.82, color: '#8a520a' }
      ]
    },
    {
      id: 'cyberpunk-2099',
      name: 'Cyberpunk 2099',
      category: 'Modern',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#060318' },
        { pos: 0.2, color: '#ff006e' },
        { pos: 0.4, color: '#ffbe0b' },
        { pos: 0.6, color: '#00f5d4' },
        { pos: 0.8, color: '#3a86ff' }
      ]
    },
    {
      id: 'psychedelic-zebra',
      name: 'Optical Waves',
      category: 'Classic',
      mode: 'bands',
      stops: [
        { pos: 0.0, color: '#08080c' },
        { pos: 0.14, color: '#ffffff' },
        { pos: 0.28, color: '#00e5ff' },
        { pos: 0.42, color: '#08080c' },
        { pos: 0.56, color: '#ff0077' },
        { pos: 0.72, color: '#ffee00' },
        { pos: 0.86, color: '#ffffff' }
      ]
    },
    {
      id: 'coral-reef',
      name: 'Coral Reef',
      category: 'Modern',
      mode: 'smooth',
      stops: [
        { pos: 0.0, color: '#062c43' },
        { pos: 0.24, color: '#054a91' },
        { pos: 0.46, color: '#3e7cb1' },
        { pos: 0.65, color: '#ff6f59' },
        { pos: 0.82, color: '#ffe57f' }
      ]
    }
  ];

  function hexToRgb(hex) {
    const clean = (hex || '#000000').replace('#', '').trim();
    const full = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean.padEnd(6, '0').slice(0, 6);
    const num = parseInt(full, 16);
    return [
      (num >> 16) & 255,
      (num >> 8) & 255,
      num & 255
    ];
  }

  function rgbToHex(r, g, b) {
    const toHex = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  /**
   * Rasterizes a palette into a seamless cyclic 256-pixel RGBA Uint8Array for WebGL 1D lookup.
   */
  function rasterizePalette(palette, size) {
    const N = size || 256;
    const out = new Uint8Array(N * 4);
    const stops = (palette.stops || []).slice().sort((a, b) => a.pos - b.pos);
    if (stops.length === 0) {
      return out;
    }
    if (stops.length === 1) {
      const rgb = hexToRgb(stops[0].color);
      for (let i = 0; i < N; i++) {
        out[i * 4] = rgb[0];
        out[i * 4 + 1] = rgb[1];
        out[i * 4 + 2] = rgb[2];
        out[i * 4 + 3] = 255;
      }
      return out;
    }

    const mode = palette.mode || 'smooth';
    // Build cyclic extended stop array so pos wraps seamlessly around 0..1
    const last = stops[stops.length - 1];
    const first = stops[0];
    const extended = [
      { pos: last.pos - 1.0, rgb: hexToRgb(last.color) },
      ...stops.map(s => ({ pos: s.pos, rgb: hexToRgb(s.color) })),
      { pos: first.pos + 1.0, rgb: hexToRgb(first.color) }
    ];

    for (let i = 0; i < N; i++) {
      const t = i / N;
      // Find surrounding stops
      let idx = 0;
      while (idx < extended.length - 2 && extended[idx + 1].pos <= t) {
        idx++;
      }
      const a = extended[idx];
      const b = extended[idx + 1];
      const span = Math.max(1e-5, b.pos - a.pos);
      let f = Math.max(0, Math.min(1, (t - a.pos) / span));

      if (mode === 'smooth') {
        // Cosine ease for silky organic Acid Warp transitions
        f = 0.5 - 0.5 * Math.cos(f * Math.PI);
      } else if (mode === 'bands') {
        // Crisp optical stripes with tiny anti-aliased edge
        f = f < 0.85 ? 0.0 : (f - 0.85) / 0.15;
      }

      out[i * 4] = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f);
      out[i * 4 + 1] = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f);
      out[i * 4 + 2] = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f);
      out[i * 4 + 3] = 255;
    }
    return out;
  }

  /**
   * Builds a CSS linear-gradient string that accurately previews a cyclic palette.
   */
  function paletteToCssGradient(palette) {
    const stops = (palette.stops || []).slice().sort((a, b) => a.pos - b.pos);
    if (stops.length === 0) return 'linear-gradient(90deg, #000, #fff)';
    if (stops.length === 1) return stops[0].color;
    const parts = stops.map(s => `${s.color} ${(s.pos * 100).toFixed(1)}%`);
    // Close the loop visually
    parts.push(`${stops[0].color} 100%`);
    return `linear-gradient(90deg, ${parts.join(', ')})`;
  }

  /**
   * Generates a harmonious random psychedelic palette.
   */
  function generateRandomPalette() {
    const baseHue = Math.random() * 360;
    const schemes = ['triadic', 'analogous', 'split', 'neon-dark', 'rainbow-shift'];
    const scheme = schemes[Math.floor(Math.random() * schemes.length)];
    const stopCount = 4 + Math.floor(Math.random() * 3); // 4..6 stops
    const stops = [];

    for (let i = 0; i < stopCount; i++) {
      const pos = Number((i / stopCount).toFixed(2));
      let h = baseHue;
      let s = 0.85 + Math.random() * 0.15;
      let l = 0.45 + Math.random() * 0.25;

      if (scheme === 'triadic') {
        h = baseHue + (i % 3) * 120 + (Math.random() * 24 - 12);
        if (i === 0) l = 0.08 + Math.random() * 0.08;
      } else if (scheme === 'analogous') {
        h = baseHue + i * 38;
        l = i === 0 ? 0.09 : (i === stopCount - 1 ? 0.78 : 0.42 + (i / stopCount) * 0.3);
      } else if (scheme === 'split') {
        const offsets = [0, 150, 210, 30, 180, 330];
        h = baseHue + offsets[i % offsets.length];
        if (i === 0) l = 0.07;
      } else if (scheme === 'neon-dark') {
        h = baseHue + i * 72;
        s = 0.95;
        l = i % 2 === 0 ? 0.08 + Math.random() * 0.1 : 0.55 + Math.random() * 0.18;
      } else {
        h = baseHue + (i / stopCount) * 360;
        s = 0.9;
        l = 0.52 + Math.sin(i * 1.4) * 0.15;
      }

      stops.push({ pos, color: hslToHex(h, s, l) });
    }

    const adjectives = ['Cosmic', 'Hyper', 'Velvet', 'Prism', 'Electric', 'Lucid', 'Nova', 'Astral', 'Neon', 'Chroma'];
    const nouns = ['Drift', 'Pulse', 'Mirage', 'Wave', 'Dream', 'Vortex', 'Bloom', 'Flux', 'Aura', 'Spark'];
    const name = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;

    return {
      id: 'custom-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name,
      category: 'Custom',
      mode: 'smooth',
      custom: true,
      stops
    };
  }

  function loadCustomPalettes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(p => p && p.id && Array.isArray(p.stops) && p.stops.length >= 2).map(p => ({
        ...p,
        category: 'Custom',
        custom: true
      }));
    } catch (e) {
      return [];
    }
  }

  function saveCustomPalettes(list) {
    try {
      const customOnly = list.filter(p => p.custom);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    } catch (e) {
      console.warn('Could not save custom palettes:', e);
    }
  }

  function clonePalette(p) {
    return {
      id: p.id,
      name: p.name,
      category: p.category || 'Custom',
      mode: p.mode || 'smooth',
      custom: !!p.custom,
      stops: (p.stops || []).map(s => ({ pos: s.pos, color: s.color }))
    };
  }

  /**
   * Blend two 256-entry Uint8Array palettes into `target` at factor `mix` (0..1).
   */
  function blendRasterPalettes(bufA, bufB, mix, target) {
    const m = Math.max(0, Math.min(1, mix));
    const inv = 1 - m;
    for (let i = 0; i < target.length; i += 4) {
      target[i] = Math.round(bufA[i] * inv + bufB[i] * m);
      target[i + 1] = Math.round(bufA[i + 1] * inv + bufB[i + 1] * m);
      target[i + 2] = Math.round(bufA[i + 2] * inv + bufB[i + 2] * m);
      target[i + 3] = 255;
    }
  }

  window.AcidWarp = window.AcidWarp || {};
  window.AcidWarp.Palettes = {
    PRESETS: PRESET_PALETTES,
    rasterizePalette,
    paletteToCssGradient,
    generateRandomPalette,
    loadCustomPalettes,
    saveCustomPalettes,
    clonePalette,
    blendRasterPalettes,
    hexToRgb,
    rgbToHex
  };
})();
