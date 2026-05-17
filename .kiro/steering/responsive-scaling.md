---
inclusion: auto
---

# Responsive Canvas Scaling

## Aspect Ratio: 4:3 (800×600 base)

The game renders at a logical resolution of 800×600 pixels. The canvas scales proportionally to fill the browser window without distortion.

## Scaling Algorithm

```javascript
function calculateScaledDimensions(windowWidth, windowHeight, baseWidth, baseHeight) {
  const targetRatio = baseWidth / baseHeight; // 4/3
  const windowRatio = windowWidth / windowHeight;

  let scaledWidth, scaledHeight;

  if (windowRatio > targetRatio) {
    // Window is wider than 4:3 — fit to height
    scaledHeight = windowHeight;
    scaledWidth = Math.round(windowHeight * targetRatio);
  } else {
    // Window is taller than 4:3 — fit to width
    scaledWidth = windowWidth;
    scaledHeight = Math.round(windowWidth / targetRatio);
  }

  return { scaledWidth, scaledHeight };
}
```

## Implementation Pattern

```javascript
class CanvasScaler {
  constructor(canvas, baseWidth = 800, baseHeight = 600) {
    this._canvas = canvas;
    this._baseWidth = baseWidth;
    this._baseHeight = baseHeight;
    this._scale = 1;

    // Logical resolution stays fixed
    canvas.width = baseWidth;
    canvas.height = baseHeight;

    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._handleResize();
  }

  _handleResize() {
    const { innerWidth, innerHeight } = window;
    const { scaledWidth, scaledHeight } = calculateScaledDimensions(
      innerWidth, innerHeight, this._baseWidth, this._baseHeight
    );

    // Scale via CSS (logical resolution unchanged)
    this._canvas.style.width = `${scaledWidth}px`;
    this._canvas.style.height = `${scaledHeight}px`;

    // Store scale factor for input coordinate mapping
    this._scale = scaledWidth / this._baseWidth;
  }

  /**
   * Convert a DOM event's client coordinates to canvas logical coordinates.
   * Required for click/touch input on a scaled canvas.
   */
  clientToCanvas(clientX, clientY) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this._scale,
      y: (clientY - rect.top) / this._scale
    };
  }

  get scale() { return this._scale; }

  destroy() {
    window.removeEventListener('resize', this._onResize);
  }
}
```

## Key Rules

| Rule | Rationale |
|------|-----------|
| Never change `canvas.width`/`canvas.height` on resize | Changing logical resolution clears the canvas and resets context state |
| Scale via CSS `style.width`/`style.height` only | Preserves logical coordinate system (800×600) |
| Map input coordinates through `clientToCanvas()` | Click/touch positions must be in logical space, not display space |
| Use `getBoundingClientRect()` for offset | Accounts for canvas centering and any page margins |
| Round scaled dimensions to integers | Avoids sub-pixel rendering artifacts |

## Input Coordinate Mapping

When the canvas is scaled, DOM event coordinates (clientX/clientY) are in display pixels, not logical pixels. Always convert before using in game logic:

```javascript
// In InputHandler
canvas.addEventListener('click', (e) => {
  // Convert display coordinates to logical 800×600 space
  const { x, y } = this._scaler.clientToCanvas(e.clientX, e.clientY);
  this._actionQueue.push({ type: 'interact', x, y });
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault(); // Prevent scroll and 300ms delay
  const touch = e.touches[0];
  const { x, y } = this._scaler.clientToCanvas(touch.clientX, touch.clientY);
  this._actionQueue.push({ type: 'interact', x, y });
}, { passive: false });
```

## Touch/Mobile Considerations

| Concern | Solution |
|---------|----------|
| 300ms click delay on mobile | Use `touchstart` with `preventDefault` |
| Scroll on touch | `{ passive: false }` + `preventDefault()` on canvas touch events |
| Double-tap zoom | CSS `touch-action: none` on canvas element |
| Viewport meta | Already set in index.html: `<meta name="viewport" content="width=device-width, initial-scale=1.0">` |

```css
canvas {
  touch-action: none; /* Prevents browser gestures on the canvas */
}
```

## CSS Setup (already in index.html)

```css
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

body {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #1a1a2e;
}

canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
```

## Invariants

1. `canvas.width` is always 800, `canvas.height` is always 600 (logical resolution)
2. Display size maintains 4:3 ratio within ±1px rounding
3. All game logic operates in logical coordinates (0–800 x, 0–600 y)
4. Input coordinates are always converted to logical space before use
5. Scaling never distorts — letterboxing is acceptable (handled by CSS centering)
