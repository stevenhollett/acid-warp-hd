/* Acid Warp HD - WebGL2 Dual-Pass Renderer & Thumbnail Generator */
(function () {
  'use strict';

  class AcidWarpRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });

      if (!this.gl) {
        throw new Error('WebGL2 is not supported in this browser.');
      }

      this.width = 1;
      this.height = 1;
      this.fboWidth = 1;
      this.fboHeight = 1;
      this.maxDpr = 2.0;

      this._initPrograms();
      this._initPaletteTexture();
      this._initSceneFBO();

      // Create empty VAO (required by WebGL2 core profile for vertex-less fullscreen triangle)
      this.vao = this.gl.createVertexArray();
    }

    _compileShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation failed:\n${log}`);
      }
      return shader;
    }

    _createProgram(vsSource, fsSource) {
      const gl = this.gl;
      const vs = this._compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSource);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog);
        gl.deleteProgram(prog);
        throw new Error(`Program link failed:\n${log}`);
      }
      return prog;
    }

    _initPrograms() {
      const gl = this.gl;
      const S = window.AcidWarp.Shaders;

      this.patternProg = this._createProgram(S.FULLSCREEN_VERTEX_SHADER, S.PATTERN_FRAGMENT_SHADER);
      this.postProg = this._createProgram(S.FULLSCREEN_VERTEX_SHADER, S.POST_FRAGMENT_SHADER);

      this.patternUniforms = {
        uResolution: gl.getUniformLocation(this.patternProg, 'uResolution'),
        uTime: gl.getUniformLocation(this.patternProg, 'uTime'),
        uCyclePhase: gl.getUniformLocation(this.patternProg, 'uCyclePhase'),
        uColorScale: gl.getUniformLocation(this.patternProg, 'uColorScale'),
        uWarpAmount: gl.getUniformLocation(this.patternProg, 'uWarpAmount'),
        uKaleido: gl.getUniformLocation(this.patternProg, 'uKaleido'),
        uSheen: gl.getUniformLocation(this.patternProg, 'uSheen'),
        uPatternA: gl.getUniformLocation(this.patternProg, 'uPatternA'),
        uPatternB: gl.getUniformLocation(this.patternProg, 'uPatternB'),
        uPatternMix: gl.getUniformLocation(this.patternProg, 'uPatternMix'),
        uPaletteTex: gl.getUniformLocation(this.patternProg, 'uPaletteTex')
      };

      this.postUniforms = {
        uSceneTex: gl.getUniformLocation(this.postProg, 'uSceneTex'),
        uResolution: gl.getUniformLocation(this.postProg, 'uResolution'),
        uTime: gl.getUniformLocation(this.postProg, 'uTime'),
        uBloom: gl.getUniformLocation(this.postProg, 'uBloom'),
        uChroma: gl.getUniformLocation(this.postProg, 'uChroma'),
        uPixelSize: gl.getUniformLocation(this.postProg, 'uPixelSize'),
        uVignette: gl.getUniformLocation(this.postProg, 'uVignette'),
        uEdgeMaskMode: gl.getUniformLocation(this.postProg, 'uEdgeMaskMode'),
        uEdgeInset: gl.getUniformLocation(this.postProg, 'uEdgeInset'),
        uEdgeSoft: gl.getUniformLocation(this.postProg, 'uEdgeSoft')
      };
    }

    _initPaletteTexture() {
      const gl = this.gl;
      this.paletteTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const initial = new Uint8Array(256 * 4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, initial);
    }

    _initSceneFBO() {
      const gl = this.gl;
      this.sceneFBO = gl.createFramebuffer();
      this.sceneTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    updatePalette(rgbaBytes256) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgbaBytes256);
    }

    resize(cssWidth, cssHeight, qualityScale) {
      const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr) * (qualityScale || 1.0);
      const w = Math.max(1, Math.floor(cssWidth * dpr));
      const h = Math.max(1, Math.floor(cssHeight * dpr));

      if (w === this.width && h === this.height) return;
      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;

      // Resize scene FBO texture
      const gl = this.gl;
      this.fboWidth = w;
      this.fboHeight = h;
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    render(params) {
      const gl = this.gl;
      gl.bindVertexArray(this.vao);

      // PASS 1: Render mathematical pattern + cyclic palette into offscreen FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO);
      gl.viewport(0, 0, this.fboWidth, this.fboHeight);
      gl.useProgram(this.patternProg);

      const pu = this.patternUniforms;
      gl.uniform2f(pu.uResolution, this.fboWidth, this.fboHeight);
      gl.uniform1f(pu.uTime, params.fieldTime);
      gl.uniform1f(pu.uCyclePhase, params.cyclePhase);
      gl.uniform1f(pu.uColorScale, params.colorScale);
      gl.uniform1f(pu.uWarpAmount, params.warpAmount);
      gl.uniform1f(pu.uKaleido, params.kaleido);
      gl.uniform1f(pu.uSheen, params.sheen);
      gl.uniform1i(pu.uPatternA, params.patternA);
      gl.uniform1i(pu.uPatternB, params.patternB);
      gl.uniform1f(pu.uPatternMix, params.patternMix);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
      gl.uniform1i(pu.uPaletteTex, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // PASS 2: Post-processing composite (Bloom, Chromatic Prism, Retro Pixelation, Vignette)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      gl.useProgram(this.postProg);

      const postU = this.postUniforms;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
      gl.uniform1i(postU.uSceneTex, 0);
      gl.uniform2f(postU.uResolution, this.width, this.height);
      gl.uniform1f(postU.uTime, params.maskTime || 0);
      gl.uniform1f(postU.uBloom, params.bloom);
      gl.uniform1f(postU.uChroma, params.chroma);
      gl.uniform1f(postU.uPixelSize, params.pixelSize);
      gl.uniform1f(postU.uVignette, params.vignette);
      gl.uniform1i(postU.uEdgeMaskMode, params.edgeMaskMode ?? 0);
      gl.uniform1f(postU.uEdgeInset, params.edgeInset ?? 0.35);
      gl.uniform1f(postU.uEdgeSoft, params.edgeSoft ?? 0.55);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }

    /**
     * Generates authentic GPU-rendered PNG data URL thumbnails for every pattern.
     */
    generatePatternThumbnails(patterns, paletteBytes) {
      const gl = this.gl;
      const thumbW = 128;
      const thumbH = 76;

      // Temporary tiny FBO + texture
      const fbo = gl.createFramebuffer();
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, thumbW, thumbH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

      // Upload preview palette
      this.updatePalette(paletteBytes);

      gl.bindVertexArray(this.vao);
      gl.viewport(0, 0, thumbW, thumbH);
      gl.useProgram(this.patternProg);

      const pu = this.patternUniforms;
      gl.uniform2f(pu.uResolution, thumbW, thumbH);
      gl.uniform1f(pu.uTime, 1.8);
      gl.uniform1f(pu.uCyclePhase, 0.15);
      gl.uniform1f(pu.uColorScale, 0.85);
      gl.uniform1f(pu.uWarpAmount, 0.08);
      gl.uniform1f(pu.uKaleido, 0.0);
      gl.uniform1f(pu.uSheen, 0.22);
      gl.uniform1f(pu.uPatternMix, 0.0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
      gl.uniform1i(pu.uPaletteTex, 0);

      const pixels = new Uint8Array(thumbW * thumbH * 4);
      const offCanvas = document.createElement('canvas');
      offCanvas.width = thumbW;
      offCanvas.height = thumbH;
      const ctx = offCanvas.getContext('2d');
      const imgData = ctx.createImageData(thumbW, thumbH);

      const results = {};
      for (let i = 0; i < patterns.length; i++) {
        const pat = patterns[i];
        gl.uniform1i(pu.uPatternA, pat.id);
        gl.uniform1i(pu.uPatternB, pat.id);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, thumbW, thumbH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Flip Y from WebGL bottom-up to 2D canvas top-down
        for (let y = 0; y < thumbH; y++) {
          const srcRow = (thumbH - 1 - y) * thumbW * 4;
          const dstRow = y * thumbW * 4;
          imgData.data.set(pixels.subarray(srcRow, srcRow + thumbW * 4), dstRow);
        }
        ctx.putImageData(imgData, 0, 0);
        results[pat.id] = offCanvas.toDataURL('image/png');
      }

      // Cleanup
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindVertexArray(null);
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);

      return results;
    }
  }

  window.AcidWarp = window.AcidWarp || {};
  window.AcidWarp.Renderer = AcidWarpRenderer;
})();
