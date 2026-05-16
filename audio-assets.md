# Audio Assets - Sound Design Specifications

## Overview

All sounds are short, retro-inspired effects designed to provide immediate feedback without being intrusive. The audio system uses the Web Audio API (AudioContext + AudioBuffer) for low-latency playback.

## Sound Effects

### Flap Sound

| Property | Value |
|----------|-------|
| **File** | `assets/jump.wav` |
| **Description** | Short whoosh — a quick burst of air |
| **Duration** | 0.1 s |
| **Frequency range** | 800–2000 Hz (swept downward) |
| **Waveform** | Noise burst with bandpass filter |
| **Envelope** | Attack: 5 ms, Decay: 95 ms, Sustain: 0, Release: 0 |
| **Volume** | 0.4 (relative to master) |
| **Trigger** | Player executes `jump()` |
| **Concurrency** | Allow overlapping playback (rapid taps) |
| **Style** | Retro arcade, soft and non-jarring |

### Score Sound

| Property | Value |
|----------|-------|
| **File** | `assets/score.wav` (synthesized at runtime if file missing) |
| **Description** | Pleasant chime — ascending two-note tone |
| **Duration** | 0.2 s |
| **Frequency** | Note 1: 880 Hz (A5), Note 2: 1320 Hz (E6) |
| **Waveform** | Sine wave with slight harmonic overtone |
| **Envelope** | Attack: 10 ms, Decay: 50 ms, Sustain: 0.3, Release: 100 ms |
| **Volume** | 0.5 (relative to master) |
| **Trigger** | Player passes a pipe pair (score increments) |
| **Concurrency** | Cancel previous instance, play fresh |
| **Style** | Cheerful, coin-collect feel |

### Collision Sound

| Property | Value |
|----------|-------|
| **File** | `assets/game_over.wav` |
| **Description** | Soft thud — low-frequency impact |
| **Duration** | 0.3 s |
| **Frequency range** | 100–300 Hz |
| **Waveform** | Low sine with noise layer |
| **Envelope** | Attack: 5 ms, Decay: 100 ms, Sustain: 0.1, Release: 150 ms |
| **Volume** | 0.6 (relative to master) |
| **Trigger** | Collision detected (pipe or boundary) → Game_Over state |
| **Concurrency** | Play once, ignore subsequent triggers until reset |
| **Style** | Muted impact, not harsh or startling |

## Audio System Behavior

### Initialization

- Create AudioContext on page load (suspended state)
- Preload all audio buffers during asset loading phase
- Timeout: 10 seconds per file via `Promise.race`

### Autoplay Policy Handling

- AudioContext starts in `suspended` state (browser policy)
- Call `audioContext.resume()` on first user interaction (click/keypress)
- Implement `unlock()` method bound to first input event
- Remove unlock listener after successful resume

### State-Based Audio Rules

| Game State | Audio Behavior |
|------------|----------------|
| Inicio | Silent (no sounds) |
| Playing | All sounds active |
| Paused | Mute all sounds, suspend context |
| Game_Over | Play collision sound once, then silent |

### Error Handling

- Wrap all `play()` calls in try/catch
- If audio file fails to load, game continues without sound
- Log warnings to console, never throw to user
- Graceful degradation: missing audio does not block gameplay

### Format Requirements

| Property | Specification |
|----------|--------------|
| Format | WAV (PCM, 16-bit) |
| Sample rate | 44100 Hz |
| Channels | Mono |
| Bit depth | 16-bit |
| Max file size | 50 KB per sound |

## Volume Levels

| Channel | Level | Notes |
|---------|-------|-------|
| Master | 1.0 | Global multiplier |
| Flap | 0.4 | Frequent, keep subtle |
| Score | 0.5 | Reward feedback |
| Collision | 0.6 | Important event |

## Implementation Notes

- Use `AudioContext.decodeAudioData()` for buffer loading
- Create new `AudioBufferSourceNode` per playback (they are one-shot)
- Connect through a `GainNode` per channel for volume control
- Score sound can be synthesized with OscillatorNode if WAV is unavailable
- No external audio libraries — Web Audio API only
