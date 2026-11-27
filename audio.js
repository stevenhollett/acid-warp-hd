/* Acid Warp HD - Generative Psychedelic Web Audio Engine & Local Audio Player */
(function () {
  'use strict';

  const TRACKS = [
    {
      id: 'cosmic-shimmer',
      name: 'Cosmic Shimmer',
      vibe: 'Psy-Progressive · 122 BPM',
      desc: 'Driving four-on-the-floor groove, lush Lydian pads, rolling bass & shimmering arps',
      bpm: 122
    },
    {
      id: 'acid-goa',
      name: 'Acid Goa Trance',
      vibe: '90s Psy / 303 · 132 BPM',
      desc: 'Squelchy resonant 303 acid lines, driving kick & hypnotic Phrygian leads',
      bpm: 132
    },
    {
      id: 'sitar-tanpura',
      name: 'Psy-Raga Fusion',
      vibe: 'Tribal Psy-Dance · 116 BPM',
      desc: 'Tanpura drone & gliding Raga sitar over driving tribal kicks, tabla rolls & bass',
      bpm: 116
    },
    {
      id: 'liquid-dub',
      name: 'Liquid Dub',
      vibe: 'Dub Techno · 118 BPM',
      desc: 'Club-ready four-on-the-floor kick, bouncing sub bass & tape-delayed dub chord stabs',
      bpm: 118
    },
    {
      id: 'binaural-astral',
      name: 'Astral Pulse',
      vibe: 'Melodic Techno · 124 BPM',
      desc: 'Binaural harmonic shimmer & singing bowls locked to a hypnotic rolling techno beat',
      bpm: 124
    },
    {
      id: 'synthwave-trip',
      name: 'Synthwave Trip',
      vibe: 'Neon Electro · 126 BPM',
      desc: 'Punchy outrun beat, gated snares, driving octave synth bass & neon stereo arps',
      bpm: 126
    }
  ];

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  class PsychedelicAudioEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.compressor = null;
      this.analyser = null;
      this.reverbNode = null;
      this.reverbSend = null;
      this.delaySend = null;
      this.delayL = null;
      this.delayR = null;
      this.delayFeedback = null;
      this.noiseBuffer = null;

      this.isPlaying = false;
      this.mode = 'synth'; // 'synth' | 'file'
      this.currentTrackId = TRACKS[0].id;
      this.volume = 0.65;

      // Scheduler state
      this.schedulerTimer = null;
      this.nextStepTime = 0;
      this.stepIndex = 0;

      // Continuous drone nodes to tear down cleanly on track switch/stop
      this.activeDrones = [];

      // Local audio file playback state
      this.audioEl = null;
      this.mediaSource = null;
      this.fileName = '';
      this.fileObjectUrl = null;

      // Live frequency analysis
      this.freqData = null;
      this.bands = { bass: 0, mid: 0, high: 0, energy: 0 };
    }

    _ensureContext() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Master bus: Compressor -> MasterGain -> Analyser -> Destination
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -13;
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 4.5;
      this.compressor.attack.value = 0.008;
      this.compressor.release.value = 0.16;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0.0001;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      // Build lush stereo cosmic reverb
      this.reverbNode = ctx.createConvolver();
      this.reverbNode.buffer = this._createReverbImpulse(3.2, 2.5);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.36;
      const reverbFilter = ctx.createBiquadFilter();
      reverbFilter.type = 'lowpass';
      reverbFilter.frequency.value = 3400;
      this.reverbSend.connect(reverbFilter);
      reverbFilter.connect(this.reverbNode);
      this.reverbNode.connect(this.compressor);

      // Build warm stereo ping-pong dub delay
      this.delaySend = ctx.createGain();
      this.delaySend.gain.value = 0.32;
      this.delayL = ctx.createDelay(2.0);
      this.delayR = ctx.createDelay(2.0);
      this.delayL.delayTime.value = 0.375;
      this.delayR.delayTime.value = 0.5;

      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2400;

      this.delayFeedback = ctx.createGain();
      this.delayFeedback.gain.value = 0.44;

      const panL = ctx.createStereoPanner();
      panL.pan.value = -0.68;
      const panR = ctx.createStereoPanner();
      panR.pan.value = 0.68;

      this.delaySend.connect(delayFilter);
      delayFilter.connect(this.delayL);
      this.delayL.connect(panL);
      panL.connect(this.compressor);
      this.delayL.connect(this.delayR);
      this.delayR.connect(panR);
      panR.connect(this.compressor);
      this.delayR.connect(this.delayFeedback);
      this.delayFeedback.connect(delayFilter);

      // Shared white noise buffer for hats/claps/snares
      this.noiseBuffer = this._createNoiseBuffer(2.0);
    }

    _createReverbImpulse(seconds, decay) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const impulse = this.ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const env = Math.pow(1 - i / len, decay);
          const white = Math.random() * 2 - 1;
          lp = lp * 0.65 + white * 0.35;
          data[i] = lp * env;
        }
      }
      return impulse;
    }

    _createNoiseBuffer(seconds) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(1, len, rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buf;
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.ctx && this.masterGain && this.isPlaying) {
        this.masterGain.gain.setTargetAtTime(Math.max(0.0001, this.volume), this.ctx.currentTime, 0.06);
      }
    }

    selectTrack(trackId) {
      const exists = TRACKS.some(t => t.id === trackId);
      if (!exists) return;
      this.currentTrackId = trackId;
      this.mode = 'synth';
      if (this.audioEl) {
        this.audioEl.pause();
      }
      if (this.isPlaying) {
        this._restartSynth();
      }
    }

    loadLocalFile(file) {
      if (!file) return;
      this._ensureContext();
      this._stopSynth();

      if (this.fileObjectUrl) {
        URL.revokeObjectURL(this.fileObjectUrl);
      }
      this.fileObjectUrl = URL.createObjectURL(file);
      this.fileName = file.name;
      this.mode = 'file';

      if (!this.audioEl) {
        this.audioEl = new Audio();
        this.audioEl.loop = true;
        this.audioEl.crossOrigin = 'anonymous';
        this.mediaSource = this.ctx.createMediaElementSource(this.audioEl);
        this.mediaSource.connect(this.compressor);
      }

      this.audioEl.src = this.fileObjectUrl;
      this.play();
    }

    play() {
      this._ensureContext();
      const now = this.ctx.currentTime;
      this.isPlaying = true;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(Math.max(0.0001, this.volume), now, 0.1);

      if (this.mode === 'file' && this.audioEl && this.audioEl.src) {
        this._stopSynth();
        this.audioEl.play().catch(() => {});
      } else {
        this.mode = 'synth';
        if (this.audioEl) this.audioEl.pause();
        this._restartSynth();
      }
    }

    stop() {
      this.isPlaying = false;
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.08);
      this._stopSynth();
      if (this.audioEl) {
        this.audioEl.pause();
      }
    }

    toggle() {
      if (this.isPlaying) {
        this.stop();
      } else {
        this.play();
      }
      return this.isPlaying;
    }

    _stopSynth() {
      if (this.schedulerTimer) {
        clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
      }
      this._stopDrones();
    }

    _stopDrones() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.activeDrones.forEach(d => {
        try {
          if (d.gain) {
            d.gain.gain.cancelScheduledValues(now);
            d.gain.gain.setTargetAtTime(0.0001, now, 0.08);
          }
          if (d.stop) d.stop(now + 0.35);
        } catch (e) {}
      });
      this.activeDrones = [];
    }

    _restartSynth() {
      this._stopSynth();
      const track = TRACKS.find(t => t.id === this.currentTrackId) || TRACKS[0];
      const ctx = this.ctx;
      const now = ctx.currentTime;

      // Sync stereo ping-pong delay to track tempo
      const beatSec = 60 / track.bpm;
      this.delayL.delayTime.setTargetAtTime(beatSec * 0.75, now, 0.05);
      this.delayR.delayTime.setTargetAtTime(beatSec * 1.0, now, 0.05);

      if (track.id === 'liquid-dub') {
        this.delaySend.gain.setTargetAtTime(0.46, now, 0.08);
        this.delayFeedback.gain.setTargetAtTime(0.54, now, 0.08);
        this.reverbSend.gain.setTargetAtTime(0.38, now, 0.08);
      } else if (track.id === 'acid-goa') {
        this.delaySend.gain.setTargetAtTime(0.28, now, 0.08);
        this.delayFeedback.gain.setTargetAtTime(0.38, now, 0.08);
        this.reverbSend.gain.setTargetAtTime(0.26, now, 0.08);
      } else if (track.id === 'binaural-astral') {
        this.delaySend.gain.setTargetAtTime(0.38, now, 0.08);
        this.delayFeedback.gain.setTargetAtTime(0.46, now, 0.08);
        this.reverbSend.gain.setTargetAtTime(0.48, now, 0.08);
      } else {
        this.delaySend.gain.setTargetAtTime(0.34, now, 0.08);
        this.delayFeedback.gain.setTargetAtTime(0.44, now, 0.08);
        this.reverbSend.gain.setTargetAtTime(0.38, now, 0.08);
      }

      // Start subtle continuous drone beds where appropriate
      if (track.id === 'sitar-tanpura') {
        this._startTanpuraDrone(38); // D2
      } else if (track.id === 'binaural-astral') {
        this._startBinauralDrone(110); // A2 binaural harmonic bed
      } else if (track.id === 'cosmic-shimmer') {
        this._startSpaceDrone(36); // C2 sub shimmer
      }

      this.stepIndex = 0;
      this.nextStepTime = now + 0.05;

      const stepDur = beatSec / 4; // 16th-note resolution
      this.schedulerTimer = setInterval(() => {
        if (!this.isPlaying || !this.ctx) return;
        const lookahead = 0.16;
        // Prevent burst of backlog notes after tab backgrounding
        if (this.nextStepTime < this.ctx.currentTime - 0.1) {
          this.nextStepTime = this.ctx.currentTime + 0.04;
        }
        while (this.nextStepTime < this.ctx.currentTime + lookahead) {
          this._scheduleStep(track.id, this.stepIndex, this.nextStepTime, stepDur);
          this.nextStepTime += stepDur;
          this.stepIndex++;
        }
      }, 40);
    }

    /* ------------------------------------------------------------------------
     * Continuous Drone Layers (kept balanced under driving drums & bass)
     * ---------------------------------------------------------------------- */
    _startSpaceDrone(rootMidi) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const freqs = [midiToFreq(rootMidi), midiToFreq(rootMidi + 7), midiToFreq(rootMidi + 12) * 1.003];
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      filter.Q.value = 2.0;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.09;
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.09, now + 1.4);

      filter.connect(g);
      g.connect(this.compressor);
      g.connect(this.reverbSend);

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;
        osc.connect(filter);
        osc.start(now);
        this.activeDrones.push({ stop: t => osc.stop(t), gain: g });
      });
      this.activeDrones.push({ stop: t => lfo.stop(t) });
    }

    _startTanpuraDrone(rootMidi) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const notes = [rootMidi, rootMidi + 7, rootMidi + 12, rootMidi + 12.06];
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 560;
      filter.Q.value = 1.3;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.14;
      lfoGain.gain.value = 280;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.1, now + 1.2);

      filter.connect(g);
      g.connect(this.compressor);
      g.connect(this.reverbSend);

      notes.forEach((m, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToFreq(m);
        const og = ctx.createGain();
        og.gain.value = i === 0 ? 0.32 : 0.2;
        osc.connect(og);
        og.connect(filter);
        osc.start(now);
        this.activeDrones.push({ stop: t => osc.stop(t), gain: g });
      });
      this.activeDrones.push({ stop: t => lfo.stop(t) });
    }

    _startBinauralDrone(baseHz) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const pairs = [
        [baseHz, baseHz + 4.5, 0.085],
        [baseHz * 1.5, baseHz * 1.5 + 3.0, 0.045],
        [baseHz * 2.0, baseHz * 2.0 + 5.2, 0.03]
      ];

      pairs.forEach(([fL, fR, amp]) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(amp, now + 1.6);

        const oscL = ctx.createOscillator();
        const panL = ctx.createStereoPanner();
        oscL.type = 'sine';
        oscL.frequency.value = fL;
        panL.pan.value = -0.75;
        oscL.connect(panL);
        panL.connect(g);

        const oscR = ctx.createOscillator();
        const panR = ctx.createStereoPanner();
        oscR.type = 'sine';
        oscR.frequency.value = fR;
        panR.pan.value = 0.75;
        oscR.connect(panR);
        panR.connect(g);

        g.connect(this.compressor);
        g.connect(this.reverbSend);

        oscL.start(now);
        oscR.start(now);
        this.activeDrones.push({ stop: t => oscL.stop(t), gain: g });
        this.activeDrones.push({ stop: t => oscR.stop(t), gain: g });
      });
    }

    /* ------------------------------------------------------------------------
     * Instrument & Drum Voices
     * ---------------------------------------------------------------------- */
    _playKick(t, punch, gainVal, tail) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const dur = tail || 0.26;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(punch || 155, t);
      osc.frequency.exponentialRampToValueAtTime(46, t + 0.075);
      osc.frequency.exponentialRampToValueAtTime(36, t + dur);

      g.gain.setValueAtTime(gainVal || 0.54, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.02);

      osc.connect(g);
      g.connect(this.compressor);
      osc.start(t);
      osc.stop(t + dur + 0.04);
    }

    _playHat(t, open, gainVal) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = open ? 6200 : 8800;

      const g = ctx.createGain();
      const dur = open ? 0.16 : 0.045;
      g.gain.setValueAtTime(gainVal || 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);

      src.connect(hp);
      hp.connect(g);
      g.connect(this.compressor);
      src.start(t);
      src.stop(t + dur + 0.02);
    }

    _playClap(t, gainVal, sendToDelay) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1650;
      bp.Q.value = 1.4;

      const g = ctx.createGain();
      const amp = gainVal || 0.19;
      // Layered flam attack for snappy electronic dance clap
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(amp * 0.75, t + 0.004);
      g.gain.linearRampToValueAtTime(amp * 0.25, t + 0.012);
      g.gain.linearRampToValueAtTime(amp, t + 0.022);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);

      src.connect(bp);
      bp.connect(g);
      g.connect(this.compressor);
      g.connect(this.reverbSend);
      if (sendToDelay) g.connect(this.delaySend);
      src.start(t);
      src.stop(t + 0.2);
    }

    _playPercTom(t, startHz, endHz, pan, gainVal) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan || 0;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(startHz, t);
      osc.frequency.exponentialRampToValueAtTime(endHz, t + 0.09);

      g.gain.setValueAtTime(gainVal || 0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(g);
      g.connect(panner);
      panner.connect(this.compressor);
      panner.connect(this.delaySend);
      osc.start(t);
      osc.stop(t + 0.16);
    }

    _playGrooveBass(t, midi, dur, cutoff, res, gainVal, wave) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = wave || 'sawtooth';
      osc.frequency.setValueAtTime(midiToFreq(midi), t);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = res || 5.0;
      const peak = cutoff || 1400;
      filter.frequency.setValueAtTime(peak, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(110, peak * 0.18), t + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(gainVal || 0.24, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.compressor);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }

    _playAcid303(t, midi, dur, accent, sweepPhase) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(midiToFreq(midi), t);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const baseCut = 260 + 480 * (0.5 + 0.5 * Math.sin(sweepPhase));
      const peakCut = baseCut + (accent ? 2800 : 1200);
      filter.Q.value = accent ? 11.5 : 7.5;
      filter.frequency.setValueAtTime(peakCut, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(120, baseCut), t + dur * 0.9);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(accent ? 0.24 : 0.16, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.compressor);
      g.connect(this.delaySend);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }

    _playPadChord(t, midiNotes, dur, cutoff, gainVal) {
      const ctx = this.ctx;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff * 0.5, t);
      filter.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.45);
      filter.frequency.linearRampToValueAtTime(cutoff * 0.4, t + dur);
      filter.Q.value = 1.6;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gainVal || 0.1, t + dur * 0.25);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);

      filter.connect(g);
      g.connect(this.compressor);
      g.connect(this.reverbSend);
      g.connect(this.delaySend);

      midiNotes.forEach((m, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.value = midiToFreq(m) * (1 + (i - 1.5) * 0.003);
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + dur + 0.08);
      });
    }

    _playPluck(t, midi, dur, pan, wave, filterPeak, gainVal, glideFromMidi) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = wave || 'triangle';
      const freq = midiToFreq(midi);
      if (glideFromMidi) {
        osc.frequency.setValueAtTime(midiToFreq(glideFromMidi), t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + 0.075);
      } else {
        osc.frequency.setValueAtTime(freq, t);
      }

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 4.2;
      filter.frequency.setValueAtTime(filterPeak || 3200, t);
      filter.frequency.exponentialRampToValueAtTime(360, t + dur);

      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.85, Math.min(0.85, pan || 0));

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(gainVal || 0.14, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);

      osc.connect(filter);
      filter.connect(panner);
      panner.connect(g);
      g.connect(this.compressor);
      g.connect(this.delaySend);
      g.connect(this.reverbSend);

      osc.start(t);
      osc.stop(t + dur + 0.04);
    }

    _playSingingBowl(t, midi, pan) {
      const ctx = this.ctx;
      const base = midiToFreq(midi);
      const ratios = [1.0, 2.756, 5.404];
      const amps = [0.09, 0.04, 0.016];
      const dur = 3.8;

      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      panner.connect(this.compressor);
      panner.connect(this.reverbSend);
      panner.connect(this.delaySend);

      ratios.forEach((r, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = base * r;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(amps[i], t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (i + 1));
        osc.connect(g);
        g.connect(panner);
        osc.start(t);
        osc.stop(t + dur + 0.1);
      });
    }

    /* ------------------------------------------------------------------------
     * Per-Soundscape Generative Sequencers
     * ---------------------------------------------------------------------- */
    _scheduleStep(trackId, step, t, stepDur) {
      const bar = Math.floor(step / 16);
      const s16 = step % 16;

      // 1. COSMIC SHIMMER (Psy-Progressive House/Trance · 122 BPM)
      if (trackId === 'cosmic-shimmer') {
        const prog = [
          { root: 36, chord: [48, 55, 59, 62, 66] }, // Cmaj7#11
          { root: 38, chord: [50, 57, 60, 64, 67] }, // Dm11
          { root: 33, chord: [45, 52, 57, 59, 64] }, // Am9
          { root: 41, chord: [53, 57, 60, 64, 69] }  // Fmaj9
        ];
        const cur = prog[Math.floor(bar / 2) % prog.length];

        // Four-on-the-floor progressive kick
        if (s16 % 4 === 0) {
          this._playKick(t, 150, 0.5, 0.25);
        }
        // Crisp dance clap on 2 & 4
        if (s16 === 4 || s16 === 12) {
          this._playClap(t, 0.16, false);
        }
        // Driving offbeat open hats + 16th ghost shakers
        if (s16 % 4 === 2) {
          this._playHat(t, true, 0.095);
        } else if (s16 % 2 === 1) {
          this._playHat(t, false, 0.045);
        }
        // Pumping progressive offbeat bassline
        const bassMask = [0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1];
        if (bassMask[s16]) {
          const oct = (s16 === 10 || s16 === 15) ? 12 : 0;
          const sweep = 900 + 850 * (0.5 + 0.5 * Math.sin(step * 0.05));
          this._playGrooveBass(t, cur.root + oct, stepDur * 1.6, sweep, 4.5, 0.24, 'sawtooth');
        }
        // Lush Lydian pad chords
        if (s16 === 0 && bar % 2 === 0) {
          this._playPadChord(t, cur.chord, stepDur * 30, 1500, 0.085);
        }
        // Uplifting stereo shimmering arpeggio plucks
        if (s16 % 2 === 0 || s16 === 15) {
          const note = cur.chord[(s16 + bar) % cur.chord.length] + (s16 >= 8 ? 12 : 0);
          const pan = Math.sin(step * 0.65) * 0.72;
          this._playPluck(t, note, stepDur * 3.2, pan, 'triangle', 4000, 0.11);
        }
        return;
      }

      // 2. ACID GOA TRANCE (90s resonant 303 + driving psy kick + Phrygian leads · 132 BPM)
      if (trackId === 'acid-goa') {
        const phrygian = [33, 34, 37, 38, 40, 41, 43, 45]; // A Phrygian Dominant
        if (s16 % 4 === 0) {
          this._playKick(t, 160, 0.52);
        }
        if (s16 % 4 === 2) {
          this._playHat(t, true, 0.09);
        } else if (s16 % 2 === 1) {
          this._playHat(t, false, 0.055);
        }
        const bassPattern = [0, 0, 0, 1, 0, 0, 3, 0, 0, 2, 0, 1, 0, 4, 0, 5];
        if (s16 % 4 !== 0) {
          const degree = bassPattern[s16];
          const accent = s16 === 3 || s16 === 10 || s16 === 14;
          const oct = (bar % 4 === 3 && s16 > 8) ? 12 : 0;
          this._playAcid303(t, phrygian[degree] + oct, stepDur * 1.4, accent, step * 0.065);
        }
        if ((s16 % 2 === 0 || s16 === 15) && Math.random() < 0.58) {
          const leadScale = [57, 58, 61, 62, 64, 65, 67, 69, 70];
          const idx = (s16 + bar * 3) % leadScale.length;
          const pan = Math.cos(step * 0.45) * 0.65;
          this._playPluck(t, leadScale[idx], stepDur * 2.5, pan, 'sawtooth', 4200, 0.085);
        }
        return;
      }

      // 3. PSY-RAGA FUSION (Tribal Psy-Dance · 116 BPM)
      if (trackId === 'sitar-tanpura') {
        // D Bhairav: D, Eb, F#, G, A, Bb, C#, D
        const raga = [50, 51, 54, 55, 57, 58, 61, 62, 63, 66, 67, 69];
        // Punchy tribal four-on-the-floor kick + syncopated ghost kick
        if (s16 % 4 === 0 || s16 === 14) {
          this._playKick(t, 148, s16 === 14 ? 0.32 : 0.52);
        }
        // Crisp offbeat open hat & rolling 16th percussion
        if (s16 % 4 === 2) {
          this._playHat(t, true, 0.085);
        } else if (s16 % 2 === 1) {
          this._playHat(t, false, 0.05);
        }
        // Snappy clap on 2 & 4
        if (s16 === 4 || s16 === 12) {
          this._playClap(t, 0.14, true);
        }
        // Syncopated tabla-inspired pitched tribal toms
        if (s16 === 3 || s16 === 6 || s16 === 11 || s16 === 15) {
          const highHit = s16 === 6 || s16 === 15;
          this._playPercTom(t, highHit ? 340 : 210, highHit ? 190 : 110, highHit ? 0.45 : -0.45, 0.18);
        }
        // Driving modal psy-bass pulse
        if (s16 % 4 !== 0) {
          const bassNotes = [38, 38, 39, 38, 43, 38, 45, 42];
          const bn = bassNotes[(s16 + bar) % bassNotes.length];
          const sweep = 750 + 900 * (0.5 + 0.5 * Math.sin(step * 0.07));
          this._playGrooveBass(t, bn, stepDur * 1.45, sweep, 6.2, 0.22, 'sawtooth');
        }
        // Expressive gliding Raga sitar lead
        const phraseMask = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0];
        if (phraseMask[s16] && Math.random() < 0.78) {
          const idx = Math.floor((Math.sin(step * 0.31) * 0.5 + 0.5) * (raga.length - 1));
          const target = raga[idx];
          const prev = raga[Math.max(0, idx - 1)];
          const pan = Math.sin(step * 0.55) * 0.6;
          this._playPluck(t, target, stepDur * 4.5, pan, 'sawtooth', 3400, 0.12, Math.random() < 0.55 ? prev : null);
        }
        return;
      }

      // 4. LIQUID DUB (Club Dub Techno Groove · 118 BPM)
      if (trackId === 'liquid-dub') {
        const subNotes = [36, 36, 39, 41, 34, 34, 39, 36]; // C minor dub progression
        const root = subNotes[Math.floor(bar / 2) % subNotes.length];
        // Solid four-on-the-floor dub techno kick
        if (s16 % 4 === 0) {
          this._playKick(t, 146, 0.54, 0.28);
        }
        // Echoing dub clap on 2 & 4
        if (s16 === 4 || s16 === 12) {
          this._playClap(t, 0.18, true);
        }
        // Swinging 16th hi-hat groove
        if (s16 % 4 === 2) {
          this._playHat(t, true, 0.095);
        } else if (s16 % 2 === 1) {
          this._playHat(t, false, 0.055);
        }
        // Bouncing syncopated sub-acid bassline
        const dubBass = [0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0];
        if (dubBass[s16]) {
          const accent = s16 === 3 || s16 === 11 || s16 === 14;
          const note = root + (s16 === 14 ? 7 : (s16 === 7 ? 3 : 0));
          this._playGrooveBass(t, note, stepDur * 1.9, accent ? 1300 : 620, 5.5, 0.28, 'sawtooth');
        }
        // Classic cavernous dub echoing minor-7th chord stabs
        if (s16 === 3 || s16 === 10 || (bar % 2 === 1 && s16 === 14)) {
          const stab = [root + 24, root + 27, root + 31, root + 34];
          const cut = 1400 + 1200 * (0.5 + 0.5 * Math.sin(step * 0.08));
          this._playPadChord(t, stab, stepDur * 1.8, cut, 0.13);
        }
        return;
      }

      // 5. ASTRAL PULSE (Hypnotic Melodic Techno + Binaural Shimmer · 124 BPM)
      if (trackId === 'binaural-astral') {
        const scale = [57, 60, 64, 67, 69, 71, 72, 76]; // A minor / Dorian astral
        // Deep hypnotic four-on-the-floor techno kick
        if (s16 % 4 === 0) {
          this._playKick(t, 152, 0.52, 0.27);
        }
        // Crisp techno offbeat open hats + rolling closed hats
        if (s16 % 4 === 2) {
          this._playHat(t, true, 0.09);
        } else if (s16 % 2 === 1) {
          this._playHat(t, false, 0.05);
        }
        if (s16 === 4 || s16 === 12) {
          this._playClap(t, 0.15, true);
        }
        // Hypnotic rolling 16th melodic techno bassline
        const bassSteps = [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1];
        if (bassSteps[s16]) {
          const roots = [33, 33, 36, 31]; // A, A, C, G
          const bRoot = roots[Math.floor(bar / 2) % roots.length];
          const oct = s16 % 4 === 3 ? 12 : 0;
          const cut = 550 + 950 * (0.5 + 0.5 * Math.sin(step * 0.045));
          this._playGrooveBass(t, bRoot + oct, stepDur * 1.35, cut, 6.8, 0.21, 'sawtooth');
        }
        // Sparkling hypnotic melodic techno arp
        if (s16 % 2 === 0) {
          const note = scale[(s16 / 2 + bar * 2) % scale.length];
          const pan = Math.cos(step * 0.5) * 0.65;
          this._playPluck(t, note, stepDur * 2.6, pan, 'triangle', 3200, 0.095);
        }
        // Floating Tibetan singing-bowl harmonic accents every 2 bars
        if (s16 === 0 && bar % 2 === 0) {
          const bowl = scale[(bar / 2) % scale.length];
          this._playSingingBowl(t, bowl, (bar % 4 === 0 ? -0.55 : 0.55));
        }
        return;
      }

      // 6. SYNTHWAVE TRIP (High-Energy Neon Dance Electro · 126 BPM)
      if (trackId === 'synthwave-trip') {
        const prog = [
          { root: 45, chord: [57, 60, 64, 67] }, // Am7
          { root: 41, chord: [53, 57, 60, 64] }, // Fmaj7
          { root: 48, chord: [60, 64, 67, 71] }, // Cmaj7
          { root: 43, chord: [55, 59, 62, 67] }  // G6
        ];
        const cur = prog[Math.floor(bar / 2) % prog.length];

        // Punchy four-on-the-floor electro kick
        if (s16 % 4 === 0) {
          this._playKick(t, 158, 0.52);
        }
        // Big retro clap/snare on 2 & 4
        if (s16 === 4 || s16 === 12) {
          this._playClap(t, 0.21, false);
        }
        // Crisp driving hats
        if (s16 % 4 === 2) {
          this._playHat(t, true, 0.09);
        } else if (s16 % 2 === 1) {
          this._playHat(t, false, 0.05);
        }
        // Warm soaring synth pads
        if (s16 === 0 && bar % 2 === 0) {
          this._playPadChord(t, cur.chord, stepDur * 30, 1550, 0.09);
        }
        // Driving 16th-note octave outrun synth bass
        const bassNote = cur.root - 12 + (s16 % 2 === 1 ? 12 : 0);
        const bassCut = 900 + 700 * (0.5 + 0.5 * Math.sin(step * 0.06));
        this._playGrooveBass(t, bassNote, stepDur * 1.25, bassCut, 4.0, 0.22, 'sawtooth');

        // Sparkling neon stereo 16th-note arpeggio lead
        const arpNote = cur.chord[s16 % cur.chord.length] + (s16 >= 8 ? 12 : 0);
        const pan = ((s16 % 4) / 3 - 0.5) * 1.2;
        this._playPluck(t, arpNote, stepDur * 1.9, pan, 'sawtooth', 3200, 0.088);
      }
    }

    /**
     * Updates and returns smoothed normalized { bass, mid, high, energy } (0..1)
     * plus raw frequency array for mini visualizer rendering.
     */
    sampleBands() {
      if (!this.analyser || !this.isPlaying || !this.freqData) {
        this.bands.bass *= 0.88;
        this.bands.mid *= 0.88;
        this.bands.high *= 0.88;
        this.bands.energy *= 0.88;
        return this.bands;
      }

      this.analyser.getByteFrequencyData(this.freqData);

      let bassSum = 0, midSum = 0, highSum = 0;
      const bassEnd = 10;
      const midEnd = 42;
      const highEnd = 96;

      for (let i = 0; i < bassEnd; i++) bassSum += this.freqData[i];
      for (let i = bassEnd; i < midEnd; i++) midSum += this.freqData[i];
      for (let i = midEnd; i < highEnd; i++) highSum += this.freqData[i];

      const rawBass = Math.min(1, (bassSum / (bassEnd * 255)) * 1.45);
      const rawMid = Math.min(1, (midSum / ((midEnd - bassEnd) * 255)) * 1.75);
      const rawHigh = Math.min(1, (highSum / ((highEnd - midEnd) * 255)) * 2.2);
      const rawEnergy = rawBass * 0.5 + rawMid * 0.35 + rawHigh * 0.15;

      // Smooth fast attack, gentle organic release
      const smooth = (cur, target) => cur + (target - cur) * (target > cur ? 0.38 : 0.14);
      this.bands.bass = smooth(this.bands.bass, rawBass);
      this.bands.mid = smooth(this.bands.mid, rawMid);
      this.bands.high = smooth(this.bands.high, rawHigh);
      this.bands.energy = smooth(this.bands.energy, rawEnergy);

      return this.bands;
    }
  }

  window.AcidWarp = window.AcidWarp || {};
  window.AcidWarp.Audio = {
    TRACKS,
    Engine: PsychedelicAudioEngine
  };
})();
