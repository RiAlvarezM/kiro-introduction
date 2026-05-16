# UI Mockups - Interface Designs

## Canvas Dimensions

- **Base resolution:** 800 x 600 px
- **Aspect ratio:** 4:3 (scales proportionally to viewport)
- **Font family:** Monospace / pixel-style (system fallback: `"Press Start 2P", monospace`)
- **Color palette:** Retro anime-inspired, high contrast for readability

---

## 1. Main Menu (Estado: Inicio)

### Layout

```
┌────────────────────────────────────────────────────┐
│                                                    │
│            [Panama City skyline background]         │
│                  [Clouds floating]                  │
│                                                    │
│                                                    │
│              ╔══════════════════════╗               │
│              ║    FLAPPY KIRO       ║               │
│              ╚══════════════════════╝               │
│                                                    │
│                   [Ghosty sprite]                   │
│                  (idle animation)                   │
│                                                    │
│                                                    │
│            ▸ Press SPACE or Click to Play           │
│                                                    │
│                                                    │
│              High Score: 42                         │
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤
│  [dark bar]                                        │
└────────────────────────────────────────────────────┘
```

### Specifications

| Element | Position | Style |
|---------|----------|-------|
| Title "FLAPPY KIRO" | Center X, 25% from top | Font: 36px, Color: #FFFFFF, Shadow: 2px #000000 |
| Ghosty sprite | Center X, 45% from top | 32x32 px, idle animation loop |
| Play instruction | Center X, 65% from top | Font: 16px, Color: #FFD700, blinking (toggle every 800ms) |
| High Score | Center X, 78% from top | Font: 14px, Color: #AAAAAA |
| Background | Full canvas | Panama City skyline, scrolling at idle speed (30 px/s) |
| Dark bar | Bottom, full width | Height: 40px, Color: rgba(0, 0, 0, 0.8) |

### Interactions

- **Space / Click / Tap:** Transition to Playing state
- No explicit buttons — single action to start

---

## 2. In-Game HUD (Estado: Playing)

### Layout

```
┌────────────────────────────────────────────────────┐
│                                                    │
│                      12                            │
│                                                    │
│                                                    │
│     [Ghosty]          ║║                           │
│        ◯──►           ║║    ║║                     │
│                       ║║    ║║                     │
│                              ║║                    │
│           ║║                 ║║                    │
│           ║║                                      │
│           ║║                                      │
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤
│ Score: 12                          High: 42        │
└────────────────────────────────────────────────────┘
```

### Specifications

| Element | Position | Style |
|---------|----------|-------|
| Current score (large) | Center X, 8% from top | Font: 48px, Color: #FFFFFF, Stroke: 2px #000000 |
| Score bar (bottom) | Bottom-left, inside dark bar | Font: 14px, Color: #FFFFFF |
| High score (bottom) | Bottom-right, inside dark bar | Font: 14px, Color: #FFD700 |
| Dark bar | Bottom, full width | Height: 40px, Color: rgba(0, 0, 0, 0.8) |
| Ghosty | 20% from left, variable Y | 32x32 px, rotation based on velocity |
| Pipes | Variable X, paired top/bottom | Width: 60px, Green fill, dark border |

### Score Display Rules

- Large centered score updates immediately on pipe pass
- Score flash effect: scale to 1.2x for 100ms on increment, then back to 1.0x
- Bottom bar score mirrors the large score (redundant for visibility)
- High score only updates at Game_Over if new record

---

## 3. Pause Overlay (Estado: Paused)

### Layout

```
┌────────────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓ ║ PAUSED ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓ Press P or Click to Resume ▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
├────────────────────────────────────────────────────┤
│ Score: 12                          High: 42        │
└────────────────────────────────────────────────────┘
```

### Specifications

| Element | Position | Style |
|---------|----------|-------|
| Dim overlay | Full canvas | Color: rgba(0, 0, 0, 0.5) |
| "PAUSED" text | Center X, 40% from top | Font: 32px, Color: #FFFFFF, bold |
| Resume instruction | Center X, 55% from top | Font: 14px, Color: #CCCCCC |
| Game scene (frozen) | Behind overlay | All elements visible but dimmed |

### Interactions

- **P / Escape / Click:** Resume → Playing state
- Jump inputs (Space) are ignored during pause

---

## 4. Game Over Screen (Estado: Game_Over)

### Layout

```
┌────────────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓ ║ GAME OVER ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓  Score: 12  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓  Best:  42  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓  ★ NEW RECORD! ★  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓ Press SPACE or Click to Restart ▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
├────────────────────────────────────────────────────┤
│ Score: 12                          High: 42        │
└────────────────────────────────────────────────────┘
```

### Specifications

| Element | Position | Style |
|---------|----------|-------|
| Dim overlay | Full canvas | Color: rgba(0, 0, 0, 0.6) |
| "GAME OVER" text | Center X, 30% from top | Font: 36px, Color: #FF4444, bold, shadow |
| Final score | Center X, 45% from top | Font: 20px, Color: #FFFFFF |
| Best score | Center X, 53% from top | Font: 20px, Color: #FFD700 |
| New record badge | Center X, 63% from top | Font: 16px, Color: #FFD700, only if new high score |
| Restart instruction | Center X, 75% from top | Font: 14px, Color: #CCCCCC, blinking (after 1s delay) |
| Game scene (frozen) | Behind overlay | Final collision frame visible |

### Interactions

- **1-second time gate:** No input accepted for first 1000ms after Game_Over
- After time gate, restart instruction appears with blink animation
- **Space / Click / Tap:** Reset game → Playing state
- On restart: score resets to 0, player returns to initial position, pipes cleared, difficulty reset, high score preserved

### New Record Behavior

- If final score > stored high score:
  - Show "★ NEW RECORD! ★" badge with pulse animation
  - Update high score in localStorage immediately
  - "Best" display shows the new value

---

## 5. Render Layer Order

All screens share the same rendering pipeline:

```
Layer 0: Sky background (#87CEEB fill)
Layer 1: Panama City skyline (parallax at 30% speed)
Layer 2: Pipes (green, with caps and borders)
Layer 3: Clouds (multi-layer parallax, varied opacity)
Layer 4: Ghosty sprite (with rotation and animation)
Layer 5: HUD overlay (score, dark bar)
Layer 6: State overlay (pause/game over screens)
```

---

## 6. Color Reference

| Element | Color | Hex |
|---------|-------|-----|
| Sky | Light blue | #87CEEB |
| Title text | White | #FFFFFF |
| Score text (large) | White with black stroke | #FFFFFF / #000000 |
| High score | Gold | #FFD700 |
| Play instruction | Gold, blinking | #FFD700 |
| Game Over text | Red | #FF4444 |
| Subtitle text | Light gray | #CCCCCC |
| Dark bar background | Black, 80% opacity | rgba(0,0,0,0.8) |
| Pause overlay | Black, 50% opacity | rgba(0,0,0,0.5) |
| Game Over overlay | Black, 60% opacity | rgba(0,0,0,0.6) |
| Pipes | Green | #228B22 |
| Pipe border | Dark green | #145214 |
