/* Acid Warp HD - Application Controller, Auto-Hiding UI & Custom Palette Studio */
(function () {
  'use strict';

  const Palettes = window.AcidWarp.Palettes;
  const Shaders = window.AcidWarp.Shaders;
  const Renderer = window.AcidWarp.Renderer;
  const AudioMod = window.AcidWarp.Audio;

  const IDLE_HIDE_MS = 1800;
  const FULLSCREEN_IDLE_HIDE_MS = 1200;

  // Application State
  const state = {
    paused: false,
    drawerOpen: false,
    drawerPinned: false,
    activeTab: 'patterns',
    patternFilter: 'All',
    paletteFilter: 'All',

    // Pattern morph state
    patternA: 0,
    patternB: 0,
    patternMix: 1.0,
    patternMorphing: false,
    patternHoldElapsed: 0,
    patternMorphElapsed: 0,
    patternHoldDuration: 18,
    patternMorphDuration: 4.5,
    lockPattern: false,

    // Palette list & morph state
    palettes: [],
    activePaletteIndex: 0,
    paletteFromBuf: new Uint8Array(256 * 4),
    paletteToBuf: new Uint8Array(256 * 4),
    paletteLiveBuf: new Uint8Array(256 * 4),
    paletteMorphing: false,
    paletteMorphElapsed: 0,
    paletteMorphDuration: 3.5,
    paletteHoldElapsed: 0,
    paletteHoldDuration: 14,
    lockPalette: false,

    // Custom Palette Editor working copy
    editorPalette: null,
    editorSelectedStop: 0,
    editorCollapsed: false,
    draggingStopIdx: -1,

    // Shader parameters
    cycleSpeed: 0.35,
    cyclePhase: 0.0,
    colorScale: 0.85,
    motionSpeed: 0.55,
    fieldTime: 1.2,
    warpAmount: 0.18,
    kaleido: 0,
    bloom: 0.35,
    sheen: 0.28,
    chroma: 0.15,
    pixelSize: 0.0,
    vignette: 0.25,
    edgeMaskMode: 0,
    edgeInset: 0.35,
    edgeSoft: 0.55,
    maskTime: 0.0,

    // Pattern thumbnails cache
    thumbnails: {},

    // Psychedelic Music & Audio Reactivity
    audioReactive: true,
    audioReactivity: 0.5,
    audioVolume: 0.65
  };

  let renderer = null;
  let audioEngine = null;
  let spectrumCtx = null;
  let lastAudioBands = { bass: 0, mid: 0, high: 0, energy: 0 };
  let lastFrameTime = performance.now();
  let fpsFrames = 0;
  let fpsLastCheck = performance.now();
  let idleTimer = null;
  let toastTimer = null;
  let pointerInsideChrome = false;
  let lastMouseX = null;
  let lastMouseY = null;
  let suppressWakeUntil = 0;
  let wasFullscreen = false;

  // DOM helpers
  const $ = id => document.getElementById(id);

  function isFullscreen() {
    return !!(document.fullscreenElement || window.matchMedia('(display-mode: fullscreen)').matches);
  }

  function showToast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 2000);
  }

  /* --------------------------------------------------------------------------
   * Auto-Hide HUD Logic
   * ------------------------------------------------------------------------ */
  function wakeUI() {
    document.body.classList.remove('ui-idle');
    scheduleIdleHide();
  }

  function hideUIImmediately() {
    clearTimeout(idleTimer);
    document.body.classList.add('ui-idle');
    $('toast').classList.remove('visible');
  }

  function syncFullscreenState() {
    const isFs = isFullscreen();
    document.body.classList.toggle('is-fullscreen', isFs);
    $('icon-fs-enter').classList.toggle('hidden', isFs);
    $('icon-fs-exit').classList.toggle('hidden', !isFs);

    if (isFs && !wasFullscreen) {
      // Entered fullscreen: reset hover/focus state and hide all controls immediately
      pointerInsideChrome = false;
      lastMouseX = null;
      lastMouseY = null;
      suppressWakeUntil = performance.now() + 450;
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      hideUIImmediately();
    } else if (!isFs && wasFullscreen) {
      // Exited fullscreen: restore controls cleanly
      suppressWakeUntil = 0;
      wakeUI();
    }
    wasFullscreen = isFs;
  }

  function scheduleIdleHide() {
    clearTimeout(idleTimer);
    if (shouldKeepUIVisible()) return;
    const delay = isFullscreen() ? FULLSCREEN_IDLE_HIDE_MS : IDLE_HIDE_MS;
    idleTimer = setTimeout(() => {
      if (!shouldKeepUIVisible()) {
        document.body.classList.add('ui-idle');
      }
    }, delay);
  }

  function shouldKeepUIVisible() {
    if (state.draggingStopIdx >= 0) return true;
    if (!$('shortcuts-modal').classList.contains('hidden')) return true;
    const active = document.activeElement;
    if (active && ((active.tagName === 'INPUT' && active.type === 'text') || active.tagName === 'SELECT')) {
      return true;
    }
    // In fullscreen mode, never keep UI stuck visible on hover/pin when the mouse stops moving
    if (isFullscreen()) return false;
    if (state.drawerPinned && state.drawerOpen) return true;
    if (pointerInsideChrome) return true;
    return false;
  }

  /* --------------------------------------------------------------------------
   * Pattern Switching & Morphing
   * ------------------------------------------------------------------------ */
  function selectPattern(targetId, instant) {
    const patterns = Shaders.PATTERNS;
    const clamped = ((targetId % patterns.length) + patterns.length) % patterns.length;
    if (instant || (!state.patternMorphing && clamped === state.patternB)) {
      state.patternA = clamped;
      state.patternB = clamped;
      state.patternMix = 1.0;
      state.patternMorphing = false;
      state.patternHoldElapsed = 0;
    } else {
      // Capture current displayed pattern as source
      state.patternA = state.patternMix > 0.5 ? state.patternB : state.patternA;
      state.patternB = clamped;
      state.patternMix = 0.0;
      state.patternMorphElapsed = 0;
      state.patternMorphing = true;
      state.patternHoldElapsed = 0;
    }
    updateNowPlayingUI();
    highlightActivePatternCard();
  }

  function stepPattern(delta) {
    selectPattern(state.patternB + delta, false);
    showToast(`Pattern: ${Shaders.PATTERNS[state.patternB].name}`);
  }

  function pickRandomPatternId() {
    const count = Shaders.PATTERNS.length;
    let next = Math.floor(Math.random() * count);
    if (next === state.patternB) next = (next + 1) % count;
    return next;
  }

  /* --------------------------------------------------------------------------
   * Palette Switching, Morphing & Live Editor Sync
   * ------------------------------------------------------------------------ */
  function initPalettes() {
    const presets = Palettes.PRESETS.map(p => Palettes.clonePalette(p));
    const customs = Palettes.loadCustomPalettes();
    state.palettes = [...presets, ...customs];
    state.activePaletteIndex = 0;

    const firstBuf = Palettes.rasterizePalette(state.palettes[0], 256);
    state.paletteFromBuf.set(firstBuf);
    state.paletteToBuf.set(firstBuf);
    state.paletteLiveBuf.set(firstBuf);
    renderer.updatePalette(state.paletteLiveBuf);

    loadPaletteIntoEditor(state.palettes[0]);
  }

  function selectPaletteByIndex(index, instant) {
    const count = state.palettes.length;
    if (count === 0) return;
    const nextIdx = ((index % count) + count) % count;
    state.activePaletteIndex = nextIdx;
    const pal = state.palettes[nextIdx];
    const targetBuf = Palettes.rasterizePalette(pal, 256);

    if (instant) {
      state.paletteFromBuf.set(targetBuf);
      state.paletteToBuf.set(targetBuf);
      state.paletteLiveBuf.set(targetBuf);
      state.paletteMorphing = false;
      renderer.updatePalette(state.paletteLiveBuf);
    } else {
      state.paletteFromBuf.set(state.paletteLiveBuf);
      state.paletteToBuf.set(targetBuf);
      state.paletteMorphElapsed = 0;
      state.paletteMorphing = true;
    }
    state.paletteHoldElapsed = 0;

    loadPaletteIntoEditor(pal);
    updateNowPlayingUI();
    highlightActivePaletteCard();
  }

  function stepPalette(delta) {
    selectPaletteByIndex(state.activePaletteIndex + delta, false);
    showToast(`Palette: ${state.palettes[state.activePaletteIndex].name}`);
  }

  function pickRandomPaletteIndex() {
    const count = state.palettes.length;
    if (count <= 1) return 0;
    let next = Math.floor(Math.random() * count);
    if (next === state.activePaletteIndex) next = (next + 1) % count;
    return next;
  }

  function applyEditorPaletteLive() {
    if (!state.editorPalette) return;
    const buf = Palettes.rasterizePalette(state.editorPalette, 256);
    state.paletteFromBuf.set(buf);
    state.paletteToBuf.set(buf);
    state.paletteLiveBuf.set(buf);
    state.paletteMorphing = false;
    state.paletteHoldElapsed = 0;
    renderer.updatePalette(state.paletteLiveBuf);
    renderEditorTrack();
    updateNowPlayingUI(state.editorPalette);
  }

  function loadPaletteIntoEditor(palette) {
    state.editorPalette = Palettes.clonePalette(palette);
    state.editorSelectedStop = 0;
    $('editor-palette-name').value = palette.custom ? palette.name : `${palette.name} Remix`;
    $('editor-blend-mode').value = state.editorPalette.mode || 'smooth';
    renderEditorTrack();
  }

  function renderEditorTrack() {
    const pal = state.editorPalette;
    if (!pal) return;

    const track = $('editor-gradient-track');
    const stopsLayer = $('editor-stops-layer');
    track.style.background = Palettes.paletteToCssGradient(pal);

    // Ensure selected index is valid
    if (state.editorSelectedStop >= pal.stops.length) {
      state.editorSelectedStop = Math.max(0, pal.stops.length - 1);
    }

    stopsLayer.innerHTML = '';
    pal.stops.forEach((stop, idx) => {
      const handle = document.createElement('div');
      handle.className = 'stop-handle' + (idx === state.editorSelectedStop ? ' selected' : '');
      handle.style.left = `${(stop.pos * 100).toFixed(2)}%`;
      handle.style.backgroundColor = stop.color;
      handle.dataset.index = String(idx);
      handle.title = `${stop.color.toUpperCase()} (${Math.round(stop.pos * 100)}%)`;

      handle.addEventListener('pointerdown', e => {
        e.stopPropagation();
        state.editorSelectedStop = idx;
        state.draggingStopIdx = idx;
        handle.setPointerCapture(e.pointerId);
        updateStopInspector();
        renderEditorTrackSelection();
      });

      handle.addEventListener('pointermove', e => {
        if (state.draggingStopIdx !== idx) return;
        const rect = track.getBoundingClientRect();
        const rawPos = (e.clientX - rect.left) / Math.max(1, rect.width);
        const clamped = Math.max(0, Math.min(0.98, rawPos));
        pal.stops[idx].pos = Number(clamped.toFixed(3));
        handle.style.left = `${(clamped * 100).toFixed(2)}%`;
        $('editor-stop-pos').textContent = `${Math.round(clamped * 100)}%`;
        track.style.background = Palettes.paletteToCssGradient(pal);

        // Live GPU upload without re-creating DOM nodes mid-drag
        const buf = Palettes.rasterizePalette(pal, 256);
        state.paletteFromBuf.set(buf);
        state.paletteToBuf.set(buf);
        state.paletteLiveBuf.set(buf);
        state.paletteMorphing = false;
        renderer.updatePalette(state.paletteLiveBuf);
        updateNowPlayingUI(pal);
      });

      const endDrag = () => {
        if (state.draggingStopIdx === idx) {
          state.draggingStopIdx = -1;
          scheduleIdleHide();
        }
      };
      handle.addEventListener('pointerup', endDrag);
      handle.addEventListener('pointercancel', endDrag);

      stopsLayer.appendChild(handle);
    });

    updateStopInspector();
  }

  function renderEditorTrackSelection() {
    const handles = $('editor-stops-layer').querySelectorAll('.stop-handle');
    handles.forEach(h => {
      h.classList.toggle('selected', Number(h.dataset.index) === state.editorSelectedStop);
    });
  }

  function updateStopInspector() {
    const pal = state.editorPalette;
    if (!pal || !pal.stops.length) return;
    const stop = pal.stops[state.editorSelectedStop] || pal.stops[0];
    $('editor-stop-color').value = stop.color;
    $('editor-stop-hex').textContent = stop.color.toUpperCase();
    $('editor-stop-pos').textContent = `${Math.round(stop.pos * 100)}%`;
    $('btn-delete-stop').disabled = pal.stops.length <= 2;
  }

  /* --------------------------------------------------------------------------
   * UI Rendering (Pattern Grid, Palette Grid, Now Playing)
   * ------------------------------------------------------------------------ */
  function updateNowPlayingUI(overridePalette) {
    const pat = Shaders.PATTERNS[state.patternB] || Shaders.PATTERNS[0];
    const pal = overridePalette || state.palettes[state.activePaletteIndex] || Palettes.PRESETS[0];
    $('np-pattern-name').textContent = pat.name;
    $('np-palette-name').textContent = pal.name;
    $('np-palette-dot').style.background = Palettes.paletteToCssGradient(pal);
  }

  function renderPatternGrid() {
    const grid = $('pattern-grid');
    grid.innerHTML = '';

    Shaders.PATTERNS.forEach(pat => {
      if (state.patternFilter !== 'All' && pat.category !== state.patternFilter) return;

      const card = document.createElement('button');
      card.className = 'pattern-card' + (pat.id === state.patternB ? ' active' : '');
      card.dataset.patternId = String(pat.id);
      card.title = pat.desc;

      const img = document.createElement('img');
      img.className = 'pattern-thumb';
      img.alt = pat.name;
      if (state.thumbnails[pat.id]) {
        img.src = state.thumbnails[pat.id];
      }

      const info = document.createElement('div');
      info.className = 'pattern-info';
      info.innerHTML = `
        <div class="pattern-title-row">
          <span class="pattern-name">${pat.name}</span>
          <span class="pattern-cat ${pat.category === 'Modern' ? 'modern' : ''}">${pat.category === 'Modern' ? 'GPU' : 'DOS'}</span>
        </div>
      `;

      card.appendChild(img);
      card.appendChild(info);
      card.addEventListener('click', () => {
        selectPattern(pat.id, false);
        showToast(`Pattern: ${pat.name}`);
      });
      grid.appendChild(card);
    });
  }

  function highlightActivePatternCard() {
    $('pattern-grid').querySelectorAll('.pattern-card').forEach(card => {
      card.classList.toggle('active', Number(card.dataset.patternId) === state.patternB);
    });
  }

  function renderPaletteGrid() {
    const grid = $('palette-grid');
    grid.innerHTML = '';

    state.palettes.forEach((pal, idx) => {
      if (state.paletteFilter !== 'All') {
        if (state.paletteFilter === 'Custom' && !pal.custom) return;
        if (state.paletteFilter !== 'Custom' && pal.category !== state.paletteFilter) return;
      }

      const card = document.createElement('div');
      card.className = 'palette-card' + (idx === state.activePaletteIndex ? ' active' : '');
      card.dataset.paletteIdx = String(idx);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');

      const bar = document.createElement('div');
      bar.className = 'palette-bar';
      bar.style.background = Palettes.paletteToCssGradient(pal);

      const meta = document.createElement('div');
      meta.className = 'palette-card-meta';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'palette-card-name';
      nameSpan.textContent = pal.name;
      meta.appendChild(nameSpan);

      if (pal.custom) {
        const delBtn = document.createElement('button');
        delBtn.className = 'palette-delete-btn';
        delBtn.title = 'Delete custom palette';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          deleteCustomPalette(idx);
        });
        meta.appendChild(delBtn);
      }

      card.appendChild(bar);
      card.appendChild(meta);

      card.addEventListener('click', () => {
        selectPaletteByIndex(idx, false);
        showToast(`Palette: ${pal.name}`);
      });

      grid.appendChild(card);
    });

    if (grid.children.length === 0) {
      const empty = document.createElement('div');
      empty.style.gridColumn = '1 / -1';
      empty.style.padding = '16px 8px';
      empty.style.textAlign = 'center';
      empty.style.fontSize = '12px';
      empty.style.color = 'var(--text-muted)';
      empty.textContent = 'No custom palettes saved yet. Edit stops above and click Save!';
      grid.appendChild(empty);
    }
  }

  function highlightActivePaletteCard() {
    $('palette-grid').querySelectorAll('.palette-card').forEach(card => {
      card.classList.toggle('active', Number(card.dataset.paletteIdx) === state.activePaletteIndex);
    });
  }

  function deleteCustomPalette(idx) {
    const pal = state.palettes[idx];
    if (!pal || !pal.custom) return;
    state.palettes.splice(idx, 1);
    Palettes.saveCustomPalettes(state.palettes);
    if (state.activePaletteIndex >= state.palettes.length) {
      state.activePaletteIndex = 0;
    }
    selectPaletteByIndex(state.activePaletteIndex, true);
    renderPaletteGrid();
    showToast(`Deleted "${pal.name}"`);
  }

  /* --------------------------------------------------------------------------
   * Psychedelic Music UI & Spectrum Visualizer
   * ------------------------------------------------------------------------ */
  function renderMusicTrackList() {
    const container = $('music-track-list');
    if (!container || !AudioMod) return;
    container.innerHTML = '';

    AudioMod.TRACKS.forEach(track => {
      const card = document.createElement('button');
      card.className = 'music-track-card' + (audioEngine.mode === 'synth' && audioEngine.currentTrackId === track.id ? ' active' : '');
      card.dataset.trackId = track.id;
      card.innerHTML = `
        <div class="track-card-top">
          <span class="track-card-name">${track.name}</span>
          <span class="track-card-vibe">${track.vibe}</span>
        </div>
        <div class="track-card-desc">${track.desc}</div>
      `;
      card.addEventListener('click', () => {
        audioEngine.selectTrack(track.id);
        if (!audioEngine.isPlaying) {
          audioEngine.play();
        }
        updateMusicUI();
        showToast(`Music: ${track.name}`);
      });
      container.appendChild(card);
    });
  }

  function updateMusicUI() {
    if (!audioEngine) return;
    const playing = audioEngine.isPlaying;

    $('btn-music-toggle').classList.toggle('active', playing);
    $('btn-music-play-big').classList.toggle('playing', playing);
    $('icon-music-play').classList.toggle('hidden', playing);
    $('icon-music-stop').classList.toggle('hidden', !playing);
    $('music-play-label').textContent = playing ? 'Stop Music' : 'Play Music';

    if (audioEngine.mode === 'file' && audioEngine.fileName) {
      $('music-active-title').textContent = audioEngine.fileName;
      $('music-active-sub').textContent = playing ? 'Playing Local Track' : 'Local Track (Paused)';
      $('local-audio-name').textContent = `Loaded: ${audioEngine.fileName}`;
    } else {
      const track = AudioMod.TRACKS.find(t => t.id === audioEngine.currentTrackId) || AudioMod.TRACKS[0];
      $('music-active-title').textContent = track.name;
      $('music-active-sub').textContent = playing ? `${track.vibe} · Playing` : track.vibe;
    }

    $('music-track-list').querySelectorAll('.music-track-card').forEach(card => {
      const isAct = audioEngine.mode === 'synth' && card.dataset.trackId === audioEngine.currentTrackId;
      card.classList.toggle('active', isAct);
    });

    $('sl-music-volume').value = state.audioVolume;
    $('val-music-volume').textContent = `${Math.round(state.audioVolume * 100)}%`;
    $('chk-audio-reactive').checked = state.audioReactive;
    $('sl-audio-reactivity').value = state.audioReactivity;
    $('val-audio-reactivity').textContent = `${Math.round(state.audioReactivity * 100)}%`;
  }

  function toggleMusic() {
    if (!audioEngine) return;
    const playing = audioEngine.toggle();
    updateMusicUI();
    if (playing) {
      const name = audioEngine.mode === 'file' && audioEngine.fileName
        ? audioEngine.fileName
        : (AudioMod.TRACKS.find(t => t.id === audioEngine.currentTrackId)?.name || 'Psychedelic Synth');
      showToast(`Music: ${name}`);
    } else {
      showToast('Music Paused');
    }
  }

  function stepMusicTrack(delta) {
    if (!audioEngine || !AudioMod || !AudioMod.TRACKS.length) return;
    const tracks = AudioMod.TRACKS;
    const currentIdx = tracks.findIndex(t => t.id === audioEngine.currentTrackId);
    const baseIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = ((baseIdx + delta) % tracks.length + tracks.length) % tracks.length;
    const nextTrack = tracks[nextIdx];
    audioEngine.selectTrack(nextTrack.id);
    if (!audioEngine.isPlaying) {
      audioEngine.play();
    }
    updateMusicUI();
    showToast(`Music: ${nextTrack.name}`);
  }

  function drawAudioSpectrum() {
    if (!spectrumCtx || !state.drawerOpen || state.activeTab !== 'music') return;
    const canvas = spectrumCtx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    spectrumCtx.clearRect(0, 0, w, h);

    const bars = 36;
    const gap = 3;
    const barW = (w - gap * (bars + 1)) / bars;
    const data = audioEngine && audioEngine.isPlaying ? audioEngine.freqData : null;

    const grad = spectrumCtx.createLinearGradient(0, h, w, 0);
    grad.addColorStop(0, '#00e5ff');
    grad.addColorStop(0.5, '#a855f7');
    grad.addColorStop(1, '#ff2a85');
    spectrumCtx.fillStyle = grad;

    for (let i = 0; i < bars; i++) {
      let val = 0.06;
      if (data && data.length > 0) {
        const bin = Math.min(data.length - 1, Math.floor((i / bars) * 86));
        val = Math.max(0.06, data[bin] / 255);
      }
      const bh = val * (h - 8);
      const x = gap + i * (barW + gap);
      const y = h - bh - 4;
      spectrumCtx.fillRect(x, y, barW, bh);
    }
  }

  /* --------------------------------------------------------------------------
   * Quick Mode Presets & Slider Sync
   * ------------------------------------------------------------------------ */
  function applyQuickPreset(name) {
    if (name === 'classic') {
      state.cycleSpeed = 0.48;
      state.colorScale = 1.05;
      state.motionSpeed = 0.0; // Authentic static Acid Warp field!
      state.warpAmount = 0.0;
      state.kaleido = 0;
      state.bloom = 0.0;
      state.sheen = 0.0;
      state.chroma = 0.0;
      state.pixelSize = 4.0;
      state.vignette = 0.15;
      showToast('Mode: Classic Retro DOS');
    } else if (name === 'modern') {
      state.cycleSpeed = 0.35;
      state.colorScale = 0.85;
      state.motionSpeed = 0.55;
      state.warpAmount = 0.22;
      state.kaleido = 0;
      state.bloom = 0.42;
      state.sheen = 0.32;
      state.chroma = 0.18;
      state.pixelSize = 0.0;
      state.vignette = 0.25;
      showToast('Mode: Liquid Neon HD');
    } else if (name === 'kaleido') {
      state.cycleSpeed = 0.42;
      state.colorScale = 1.1;
      state.motionSpeed = 0.65;
      state.warpAmount = 0.26;
      state.kaleido = 8;
      state.bloom = 0.45;
      state.sheen = 0.45;
      state.chroma = 0.32;
      state.pixelSize = 0.0;
      state.vignette = 0.3;
      showToast('Mode: Prismatic Kaleido');
    } else if (name === 'zen') {
      state.cycleSpeed = 0.12;
      state.colorScale = 0.65;
      state.motionSpeed = 0.22;
      state.warpAmount = 0.34;
      state.kaleido = 0;
      state.bloom = 0.3;
      state.sheen = 0.18;
      state.chroma = 0.08;
      state.pixelSize = 0.0;
      state.vignette = 0.35;
      showToast('Mode: Zen Slow Drift');
    }
    syncSlidersFromState();
  }

  function syncSlidersFromState() {
    $('sl-cycle-speed').value = state.cycleSpeed;
    $('val-cycle-speed').textContent = `${state.cycleSpeed >= 0 ? '+' : ''}${state.cycleSpeed.toFixed(2)}x`;

    $('sl-color-scale').value = state.colorScale;
    $('val-color-scale').textContent = `${state.colorScale.toFixed(2)}x`;

    $('sl-motion-speed').value = state.motionSpeed;
    $('val-motion-speed').textContent = state.motionSpeed === 0 ? 'Static' : `${Math.round(state.motionSpeed * 100)}%`;

    $('sl-warp').value = state.warpAmount;
    $('val-warp').textContent = `${Math.round(state.warpAmount * 100)}%`;

    $('val-kaleido').textContent = state.kaleido === 0 ? 'Off' : `${state.kaleido}-Fold`;
    $('kaleido-group').querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.kaleido) === state.kaleido);
    });

    $('sl-bloom').value = state.bloom;
    $('val-bloom').textContent = `${Math.round(state.bloom * 100)}%`;

    $('sl-sheen').value = state.sheen;
    $('val-sheen').textContent = `${Math.round(state.sheen * 100)}%`;

    $('sl-chroma').value = state.chroma;
    $('val-chroma').textContent = `${Math.round(state.chroma * 100)}%`;

    $('sl-pixel').value = state.pixelSize;
    $('val-pixel').textContent = state.pixelSize < 1.5 ? 'Crisp HD' : `${state.pixelSize.toFixed(1)}px Retro`;

    $('sl-vignette').value = state.vignette;
    $('val-vignette').textContent = `${Math.round(state.vignette * 100)}%`;

    const edgeLabels = ['Off', 'Organic Cloud', 'Liquid Wave', 'Soft Oval', 'Petal Halo'];
    $('val-edge-mode').textContent = edgeLabels[state.edgeMaskMode] || 'Off';
    $('edge-mask-group').querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.edge) === state.edgeMaskMode);
    });
    $('sl-edge-inset').value = state.edgeInset;
    $('val-edge-inset').textContent = `${Math.round(state.edgeInset * 100)}%`;
    $('sl-edge-soft').value = state.edgeSoft;
    $('val-edge-soft').textContent = `${Math.round(state.edgeSoft * 100)}%`;

    $('sl-pattern-hold').value = state.patternHoldDuration;
    $('val-pattern-hold').textContent = `${state.patternHoldDuration}s`;

    $('sl-pattern-morph').value = state.patternMorphDuration;
    $('val-pattern-morph').textContent = `${state.patternMorphDuration.toFixed(1)}s`;

    $('sl-palette-hold').value = state.paletteHoldDuration;
    $('val-palette-hold').textContent = `${state.paletteHoldDuration}s`;

    $('chk-lock-pattern').checked = state.lockPattern;
    $('chk-lock-palette').checked = state.lockPalette;
    updateLockButtons();
  }

  function updateLockButtons() {
    const locked = state.lockPattern;
    $('btn-lock-all').classList.toggle('active', locked);
    $('icon-locked').classList.toggle('hidden', !locked);
    $('icon-unlocked').classList.toggle('hidden', locked);
  }

  function togglePlayPause() {
    state.paused = !state.paused;
    $('icon-pause').classList.toggle('hidden', state.paused);
    $('icon-play').classList.toggle('hidden', !state.paused);
    showToast(state.paused ? 'Paused' : 'Resumed');
  }

  function toggleDrawer(forceState) {
    state.drawerOpen = typeof forceState === 'boolean' ? forceState : !state.drawerOpen;
    document.body.classList.toggle('drawer-open', state.drawerOpen);
    $('btn-toggle-drawer').classList.toggle('active', state.drawerOpen);
    wakeUI();
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(b => {
      const active = b.dataset.tab === tabName;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tabName}`);
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function captureScreenshot() {
    // Render one fresh frame right before reading canvas to avoid cleared drawing buffer
    renderer.render(getRenderParams());
    const patName = (Shaders.PATTERNS[state.patternB]?.name || 'pattern').toLowerCase().replace(/\s+/g, '-');
    const link = document.createElement('a');
    link.download = `acid-warp-${patName}.png`;
    link.href = $('warp-canvas').toDataURL('image/png');
    link.click();
    showToast('Saved HD PNG Screenshot');
  }

  /* --------------------------------------------------------------------------
   * Event Wiring
   * ------------------------------------------------------------------------ */
  function bindEvents() {
    // Auto-hide wake triggers (filter synthetic/zero-delta mousemove during fullscreen transitions)
    window.addEventListener('mousemove', e => {
      const now = performance.now();
      if (now < suppressWakeUntil) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
      }
      if (lastMouseX !== null && Math.abs(e.clientX - lastMouseX) < 3 && Math.abs(e.clientY - lastMouseY) < 3) {
        return;
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      wakeUI();
    }, { passive: true });
    window.addEventListener('mousedown', () => {
      if (performance.now() < suppressWakeUntil) return;
      wakeUI();
    }, { passive: true });
    window.addEventListener('touchstart', wakeUI, { passive: true });

    // Keep UI visible while pointer hovers over interactive chrome
    document.querySelectorAll('.ui-chrome').forEach(el => {
      el.addEventListener('mouseenter', () => {
        pointerInsideChrome = true;
        wakeUI();
      });
      el.addEventListener('mouseleave', () => {
        pointerInsideChrome = false;
        scheduleIdleHide();
      });
    });

    // Double-click canvas for fullscreen
    $('warp-canvas').addEventListener('dblclick', toggleFullscreen);

    // Transport buttons
    $('btn-prev-pattern').addEventListener('click', () => stepPattern(-1));
    $('btn-next-pattern').addEventListener('click', () => stepPattern(1));
    $('btn-play-pause').addEventListener('click', togglePlayPause);

    $('btn-reverse').addEventListener('click', () => {
      state.cycleSpeed = -state.cycleSpeed;
      syncSlidersFromState();
      showToast(state.cycleSpeed >= 0 ? 'Direction: Forward' : 'Direction: Reverse');
    });

    $('btn-shuffle').addEventListener('click', () => {
      selectPattern(pickRandomPatternId(), false);
      selectPaletteByIndex(pickRandomPaletteIndex(), false);
      showToast(`Shuffled: ${Shaders.PATTERNS[state.patternB].name}`);
    });

    $('btn-lock-all').addEventListener('click', () => {
      state.lockPattern = !state.lockPattern;
      $('chk-lock-pattern').checked = state.lockPattern;
      updateLockButtons();
      showToast(state.lockPattern ? 'Pattern Locked' : 'Pattern Auto-Cycle Enabled');
    });

    $('btn-now-playing').addEventListener('click', () => {
      toggleDrawer(true);
      switchTab('patterns');
    });

    $('btn-toggle-drawer').addEventListener('click', () => toggleDrawer());
    $('btn-close-drawer').addEventListener('click', () => toggleDrawer(false));
    $('btn-music-toggle').addEventListener('click', toggleMusic);
    $('btn-music-play-big').addEventListener('click', toggleMusic);

    $('sl-music-volume').addEventListener('input', e => {
      state.audioVolume = parseFloat(e.target.value);
      audioEngine.setVolume(state.audioVolume);
      $('val-music-volume').textContent = `${Math.round(state.audioVolume * 100)}%`;
    });

    $('chk-audio-reactive').addEventListener('change', e => {
      state.audioReactive = e.target.checked;
      showToast(state.audioReactive ? 'Audio-Reactive Visuals On' : 'Audio-Reactive Visuals Off');
    });

    $('sl-audio-reactivity').addEventListener('input', e => {
      state.audioReactivity = parseFloat(e.target.value);
      $('val-audio-reactivity').textContent = `${Math.round(state.audioReactivity * 100)}%`;
    });

    $('btn-load-local-audio').addEventListener('click', () => {
      $('input-local-audio').click();
    });

    $('input-local-audio').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      audioEngine.loadLocalFile(file);
      updateMusicUI();
      showToast(`Playing: ${file.name}`);
      e.target.value = '';
    });

    $('btn-pin-drawer').addEventListener('click', () => {
      state.drawerPinned = !state.drawerPinned;
      $('btn-pin-drawer').classList.toggle('active', state.drawerPinned);
      $('studio-drawer').classList.toggle('pinned', state.drawerPinned);
      showToast(state.drawerPinned ? 'Studio Panel Pinned' : 'Auto-Hide Enabled');
      scheduleIdleHide();
    });

    // Top-right utilities
    $('btn-fullscreen').addEventListener('click', toggleFullscreen);
    $('btn-screenshot').addEventListener('click', captureScreenshot);
    $('btn-shortcuts').addEventListener('click', () => {
      $('shortcuts-modal').classList.remove('hidden');
      wakeUI();
    });
    $('btn-close-shortcuts').addEventListener('click', () => {
      $('shortcuts-modal').classList.add('hidden');
      scheduleIdleHide();
    });
    $('shortcuts-modal').addEventListener('click', e => {
      if (e.target === $('shortcuts-modal')) {
        $('shortcuts-modal').classList.add('hidden');
        scheduleIdleHide();
      }
    });

    document.addEventListener('fullscreenchange', syncFullscreenState);

    // Drawer Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Pattern Category Filters
    $('pattern-filter-group').querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.patternFilter = btn.dataset.filter;
        $('pattern-filter-group').querySelectorAll('.filter-pill').forEach(b => b.classList.toggle('active', b === btn));
        renderPatternGrid();
      });
    });

    $('chk-lock-pattern').addEventListener('change', e => {
      state.lockPattern = e.target.checked;
      updateLockButtons();
    });

    // Palette Category Filters
    $('palette-filter-group').querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.paletteFilter = btn.dataset.filter;
        $('palette-filter-group').querySelectorAll('.filter-pill').forEach(b => b.classList.toggle('active', b === btn));
        renderPaletteGrid();
      });
    });

    $('chk-lock-palette').addEventListener('change', e => {
      state.lockPalette = e.target.checked;
    });

    // Custom Palette Editor interactions
    $('btn-toggle-editor').addEventListener('click', () => {
      state.editorCollapsed = !state.editorCollapsed;
      $('palette-editor-body').classList.toggle('hidden', state.editorCollapsed);
      $('btn-toggle-editor').textContent = state.editorCollapsed ? 'Edit' : 'Hide';
    });

    $('editor-gradient-track').addEventListener('click', e => {
      const pal = state.editorPalette;
      if (!pal || pal.stops.length >= 12) {
        if (pal && pal.stops.length >= 12) showToast('Maximum 12 color stops');
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = Math.max(0, Math.min(0.98, (e.clientX - rect.left) / Math.max(1, rect.width)));

      // Sample interpolated color at that position from current rasterized palette
      const buf = Palettes.rasterizePalette(pal, 256);
      const sampleIdx = Math.min(255, Math.floor(pos * 256)) * 4;
      const color = Palettes.rgbToHex(buf[sampleIdx], buf[sampleIdx + 1], buf[sampleIdx + 2]);

      pal.stops.push({ pos: Number(pos.toFixed(3)), color });
      state.editorSelectedStop = pal.stops.length - 1;
      applyEditorPaletteLive();
    });

    $('editor-stop-color').addEventListener('input', e => {
      const pal = state.editorPalette;
      if (!pal || !pal.stops[state.editorSelectedStop]) return;
      pal.stops[state.editorSelectedStop].color = e.target.value;
      $('editor-stop-hex').textContent = e.target.value.toUpperCase();
      applyEditorPaletteLive();
    });

    $('editor-blend-mode').addEventListener('change', e => {
      if (!state.editorPalette) return;
      state.editorPalette.mode = e.target.value;
      applyEditorPaletteLive();
    });

    $('btn-delete-stop').addEventListener('click', () => {
      const pal = state.editorPalette;
      if (!pal || pal.stops.length <= 2) return;
      pal.stops.splice(state.editorSelectedStop, 1);
      state.editorSelectedStop = Math.max(0, state.editorSelectedStop - 1);
      applyEditorPaletteLive();
    });

    $('btn-random-palette').addEventListener('click', () => {
      const rnd = Palettes.generateRandomPalette();
      state.editorPalette = rnd;
      state.editorSelectedStop = 0;
      $('editor-palette-name').value = rnd.name;
      $('editor-blend-mode').value = rnd.mode;
      applyEditorPaletteLive();
      showToast(`Generated "${rnd.name}"`);
    });

    $('btn-save-palette').addEventListener('click', () => {
      if (!state.editorPalette) return;
      const nameInput = $('editor-palette-name').value.trim();
      const name = nameInput || `Custom ${state.palettes.filter(p => p.custom).length + 1}`;
      const saved = Palettes.clonePalette(state.editorPalette);
      saved.name = name;
      saved.category = 'Custom';
      saved.custom = true;
      saved.stops.sort((a, b) => a.pos - b.pos);

      // Update existing custom palette with same name or add new
      const existingIdx = state.palettes.findIndex(p => p.custom && p.name.toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) {
        saved.id = state.palettes[existingIdx].id;
        state.palettes[existingIdx] = saved;
        state.activePaletteIndex = existingIdx;
      } else {
        saved.id = 'custom-' + Date.now();
        state.palettes.push(saved);
        state.activePaletteIndex = state.palettes.length - 1;
      }

      Palettes.saveCustomPalettes(state.palettes);
      selectPaletteByIndex(state.activePaletteIndex, true);
      renderPaletteGrid();
      showToast(`Saved palette "${name}"`);
    });

    // Effects Tab Quick Presets
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => applyQuickPreset(btn.dataset.preset));
    });

    // Sliders
    $('sl-cycle-speed').addEventListener('input', e => {
      state.cycleSpeed = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-color-scale').addEventListener('input', e => {
      state.colorScale = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-motion-speed').addEventListener('input', e => {
      state.motionSpeed = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-warp').addEventListener('input', e => {
      state.warpAmount = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('kaleido-group').querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.kaleido = Number(btn.dataset.kaleido);
        syncSlidersFromState();
      });
    });
    $('sl-bloom').addEventListener('input', e => {
      state.bloom = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-sheen').addEventListener('input', e => {
      state.sheen = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-chroma').addEventListener('input', e => {
      state.chroma = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-pixel').addEventListener('input', e => {
      state.pixelSize = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-vignette').addEventListener('input', e => {
      state.vignette = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('edge-mask-group').querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.edgeMaskMode = Number(btn.dataset.edge);
        syncSlidersFromState();
      });
    });
    $('sl-edge-inset').addEventListener('input', e => {
      state.edgeInset = parseFloat(e.target.value);
      if (state.edgeMaskMode === 0) state.edgeMaskMode = 1;
      syncSlidersFromState();
    });
    $('sl-edge-soft').addEventListener('input', e => {
      state.edgeSoft = parseFloat(e.target.value);
      if (state.edgeMaskMode === 0) state.edgeMaskMode = 1;
      syncSlidersFromState();
    });
    $('sl-pattern-hold').addEventListener('input', e => {
      state.patternHoldDuration = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-pattern-morph').addEventListener('input', e => {
      state.patternMorphDuration = parseFloat(e.target.value);
      syncSlidersFromState();
    });
    $('sl-palette-hold').addEventListener('input', e => {
      state.paletteHoldDuration = parseFloat(e.target.value);
      syncSlidersFromState();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', e => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
      }

      if (e.key === 'Escape') {
        if (!$('shortcuts-modal').classList.contains('hidden')) {
          $('shortcuts-modal').classList.add('hidden');
        } else if (state.drawerOpen) {
          toggleDrawer(false);
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepPattern(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepPattern(-1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (e.shiftKey) {
            stepPalette(1);
          } else {
            stepMusicTrack(-1);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (e.shiftKey) {
            stepPalette(-1);
          } else {
            stepMusicTrack(1);
          }
          break;
        case '[':
          state.cycleSpeed = Math.max(-2.0, Number((state.cycleSpeed - 0.1).toFixed(2)));
          syncSlidersFromState();
          showToast(`Cycle Speed: ${state.cycleSpeed.toFixed(2)}x`);
          break;
        case ']':
          state.cycleSpeed = Math.min(2.0, Number((state.cycleSpeed + 0.1).toFixed(2)));
          syncSlidersFromState();
          showToast(`Cycle Speed: ${state.cycleSpeed.toFixed(2)}x`);
          break;
        case 'r':
        case 'R':
          state.cycleSpeed = -state.cycleSpeed;
          syncSlidersFromState();
          showToast(state.cycleSpeed >= 0 ? 'Direction: Forward' : 'Direction: Reverse');
          break;
        case 'l':
        case 'L':
          state.lockPattern = !state.lockPattern;
          syncSlidersFromState();
          showToast(state.lockPattern ? 'Pattern Locked' : 'Pattern Unlocked');
          break;
        case 'p':
        case 'P':
          state.lockPalette = !state.lockPalette;
          syncSlidersFromState();
          showToast(state.lockPalette ? 'Palette Locked' : 'Palette Unlocked');
          break;
        case 's':
        case 'S':
          selectPattern(pickRandomPatternId(), false);
          selectPaletteByIndex(pickRandomPaletteIndex(), false);
          showToast(`Shuffled: ${Shaders.PATTERNS[state.patternB].name}`);
          break;
        case 'm':
        case 'M':
          toggleMusic();
          break;
        case 'e':
        case 'E': {
          const edgeNames = ['Off', 'Organic Cloud', 'Liquid Wave', 'Soft Oval', 'Petal Halo'];
          state.edgeMaskMode = (state.edgeMaskMode + 1) % edgeNames.length;
          syncSlidersFromState();
          showToast(`Edge Mask: ${edgeNames[state.edgeMaskMode]}`);
          break;
        }
        case 'h':
        case 'H':
        case 'Tab':
          e.preventDefault();
          toggleDrawer();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'c':
        case 'C':
          captureScreenshot();
          break;
        case '?':
          $('shortcuts-modal').classList.toggle('hidden');
          wakeUI();
          break;
      }
    });

    // Resize (also detects F11 browser fullscreen transitions)
    window.addEventListener('resize', () => {
      renderer.resize(window.innerWidth, window.innerHeight, 1.0);
      syncFullscreenState();
    });
  }

  /* --------------------------------------------------------------------------
   * Main Animation Loop
   * ------------------------------------------------------------------------ */
  function getRenderParams() {
    const reactAmt = (state.audioReactive && audioEngine && audioEngine.isPlaying)
      ? state.audioReactivity
      : 0;
    return {
      fieldTime: state.fieldTime,
      cyclePhase: state.cyclePhase,
      colorScale: state.colorScale,
      warpAmount: Math.min(1.0, state.warpAmount + lastAudioBands.mid * reactAmt * 0.24),
      kaleido: state.kaleido,
      sheen: Math.min(1.0, state.sheen + lastAudioBands.energy * reactAmt * 0.18),
      patternA: state.patternA,
      patternB: state.patternB,
      patternMix: state.patternMix,
      bloom: Math.min(1.0, state.bloom + lastAudioBands.bass * reactAmt * 0.36),
      chroma: Math.min(1.0, state.chroma + lastAudioBands.high * reactAmt * 0.25),
      pixelSize: state.pixelSize,
      vignette: state.vignette,
      edgeMaskMode: state.edgeMaskMode,
      edgeInset: state.edgeInset,
      edgeSoft: state.edgeSoft,
      maskTime: state.maskTime
    };
  }

  function tick(now) {
    requestAnimationFrame(tick);

    const dt = Math.min(0.08, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    // Sample live psychedelic audio frequencies
    if (audioEngine) {
      lastAudioBands = audioEngine.sampleBands();
      drawAudioSpectrum();
    }

    // FPS counter
    fpsFrames++;
    if (now - fpsLastCheck >= 500) {
      const fps = Math.round((fpsFrames * 1000) / (now - fpsLastCheck));
      $('fps-readout').textContent = `${fps} FPS`;
      fpsFrames = 0;
      fpsLastCheck = now;
    }

    if (!state.paused) {
      // Advance palette cycling & organic field time (with optional audio boost)
      const reactAmt = (state.audioReactive && audioEngine && audioEngine.isPlaying)
        ? state.audioReactivity
        : 0;
      const dir = state.cycleSpeed < 0 ? -1 : 1;
      const effectiveCycleSpeed = state.cycleSpeed + dir * lastAudioBands.bass * reactAmt * 0.72;
      const effectiveMotionSpeed = state.motionSpeed + lastAudioBands.mid * reactAmt * 0.45;

      state.cyclePhase = (state.cyclePhase - dt * effectiveCycleSpeed * 0.42) % 1.0;
      if (state.cyclePhase < 0) state.cyclePhase += 1.0;
      state.fieldTime += dt * effectiveMotionSpeed;
      state.maskTime += dt;

      // Pattern morph / auto-evolve
      if (state.patternMorphing) {
        state.patternMorphElapsed += dt;
        const t = Math.min(1.0, state.patternMorphElapsed / Math.max(0.2, state.patternMorphDuration));
        state.patternMix = t;
        if (t >= 1.0) {
          state.patternA = state.patternB;
          state.patternMorphing = false;
        }
      } else if (!state.lockPattern) {
        state.patternHoldElapsed += dt;
        if (state.patternHoldElapsed >= state.patternHoldDuration) {
          selectPattern(pickRandomPatternId(), false);
        }
      }

      // Palette morph / auto-evolve
      if (state.paletteMorphing) {
        state.paletteMorphElapsed += dt;
        const t = Math.min(1.0, state.paletteMorphElapsed / Math.max(0.2, state.paletteMorphDuration));
        const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);
        Palettes.blendRasterPalettes(state.paletteFromBuf, state.paletteToBuf, eased, state.paletteLiveBuf);
        renderer.updatePalette(state.paletteLiveBuf);
        if (t >= 1.0) {
          state.paletteFromBuf.set(state.paletteToBuf);
          state.paletteMorphing = false;
        }
      } else if (!state.lockPalette && state.draggingStopIdx < 0) {
        state.paletteHoldElapsed += dt;
        if (state.paletteHoldElapsed >= state.paletteHoldDuration) {
          selectPaletteByIndex(pickRandomPaletteIndex(), false);
        }
      }
    }

    renderer.render(getRenderParams());
  }

  /* --------------------------------------------------------------------------
   * Bootstrap
   * ------------------------------------------------------------------------ */
  function init() {
    const canvas = $('warp-canvas');
    try {
      renderer = new Renderer(canvas);
    } catch (err) {
      console.error(err);
      $('webgl-error').classList.remove('hidden');
      return;
    }

    renderer.resize(window.innerWidth, window.innerHeight, 1.0);
    initPalettes();

    // Generate authentic GPU thumbnails for all 24 patterns using Neon Electric palette
    const thumbPal = Palettes.PRESETS[1] || Palettes.PRESETS[0];
    state.thumbnails = renderer.generatePatternThumbnails(
      Shaders.PATTERNS,
      Palettes.rasterizePalette(thumbPal, 256)
    );
    // Restore active live palette after thumbnail generation
    renderer.updatePalette(state.paletteLiveBuf);

    renderPatternGrid();
    renderPaletteGrid();
    audioEngine = new AudioMod.Engine();
    audioEngine.setVolume(state.audioVolume);
    const specCanvas = $('audio-spectrum');
    if (specCanvas) spectrumCtx = specCanvas.getContext('2d');
    renderMusicTrackList();
    updateMusicUI();
    syncSlidersFromState();
    updateNowPlayingUI();
    bindEvents();

    // Start loop and idle hide timer
    syncFullscreenState();
    lastFrameTime = performance.now();
    requestAnimationFrame(tick);
    scheduleIdleHide();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
