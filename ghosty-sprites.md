# Ghosty - Especificaciones del Sprite

## Dimensiones

- **Tamaño del sprite:** 32x32 px
- **Formato:** PNG con transparencia (alpha channel)
- **Archivo fuente:** `assets/ghosty.png`

## Caja de Colisión

- **Forma:** Círculo
- **Radio:** 12 px
- **Centro:** Relativo al centro del sprite (16, 16)
- **Factor de radio:** 0.375 del ancho del sprite (12/32)

## Estados de Animación

### Inactividad (Idle)

| Fotograma | Descripción | Duración |
|-----------|-------------|----------|
| 1 | Ghosty en posición neutral, ojos abiertos | 400 ms |
| 2 | Ghosty con leve movimiento vertical (flotando +1px) | 400 ms |
| 3 | Ghosty regresa a posición neutral | 400 ms |

- **Total de fotogramas:** 3
- **Ciclo:** Loop infinito
- **Velocidad:** 2.5 FPS (un ciclo completo cada 1200 ms)
- **Uso:** Pantalla de inicio (estado Inicio) y estado Paused

### Aleteo (Flap)

| Fotograma | Descripción | Duración |
|-----------|-------------|----------|
| 1 | Ghosty con cuerpo comprimido, preparando impulso | 80 ms |
| 2 | Ghosty expandido, "alas" extendidas hacia arriba | 100 ms |
| 3 | Ghosty en posición de vuelo, "alas" a medio camino | 120 ms |
| 4 | Ghosty regresando a posición neutral | 100 ms |

- **Total de fotogramas:** 4
- **Ciclo:** Se reproduce una vez por salto, luego vuelve al fotograma neutral
- **Velocidad:** ~2.5 FPS por fotograma (ciclo completo en 400 ms)
- **Trigger:** Se activa al ejecutar `jump()`
- **Uso:** Estado Playing cuando el jugador salta

### Muerte (Death)

| Fotograma | Descripción | Duración |
|-----------|-------------|----------|
| 1 | Ghosty con expresión de sorpresa, ojos grandes | 150 ms |
| 2 | Ghosty rotando 15° en sentido horario | 100 ms |
| 3 | Ghosty rotando 30° con efecto de desvanecimiento (opacity 0.8) | 100 ms |
| 4 | Ghosty rotando 45° con mayor desvanecimiento (opacity 0.6) | 150 ms |

- **Total de fotogramas:** 4
- **Ciclo:** Se reproduce una vez y se mantiene en el último fotograma
- **Velocidad:** Ciclo completo en 500 ms
- **Trigger:** Se activa al entrar en estado Game_Over
- **Uso:** Estado Game_Over

## Rotación Visual

- **Subiendo (velocidad < 0):** Rotar sprite -15° (nariz hacia arriba)
- **Neutral (velocidad ≈ 0):** Sin rotación (0°)
- **Cayendo (velocidad > 0):** Rotar proporcionalmente hasta +45° al alcanzar velocidad máxima
- **Fórmula:** `rotación = (velocidad / maxFallSpeed) * 45°`

## Notas de Implementación

- El sprite se carga desde `assets/ghosty.png` como una imagen estática
- Las animaciones se implementan programáticamente con Canvas 2D (escala, rotación, opacidad)
- No se usa sprite sheet; los efectos de animación se logran con transformaciones del canvas
- La caja de colisión circular (radio 12px) es más pequeña que el sprite visual para dar sensación de "perdón" al jugador
