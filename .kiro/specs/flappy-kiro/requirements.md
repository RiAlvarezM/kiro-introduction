# Documento de Requisitos - Flappy Kiro

## Introducción

Flappy Kiro es un juego retro/oldschool estilo side-scroller infinito que corre en el navegador. El jugador controla a un fantasmita llamado "Flappy" que debe navegar a través de un número infinito de tuberías (pipes) que aparecen desde la parte superior e inferior de la pantalla. El fondo del juego presenta una caricatura de la Ciudad de Panamá. El estilo visual es dibujado a mano con una estética retro.

## Glosario

- **Motor_de_Juego**: El sistema principal que ejecuta el loop del juego, gestiona el estado y coordina todos los subsistemas
- **Canvas**: El elemento HTML5 Canvas donde se renderiza el juego
- **Flappy**: El personaje jugable, un fantasmita blanco representado por el sprite ghosty.png
- **Tubería**: Obstáculo vertical que aparece desde arriba y abajo de la pantalla con un espacio (gap) entre ambas secciones
- **Gap**: El espacio libre entre la tubería superior y la tubería inferior por donde Flappy debe pasar
- **Scroller**: El sistema que desplaza continuamente el escenario y los obstáculos de derecha a izquierda
- **HUD**: La interfaz de usuario superpuesta que muestra el puntaje actual y el puntaje máximo
- **Hitbox**: El área de colisión del personaje y de las tuberías utilizada para detectar impactos
- **Game_Over**: El estado del juego cuando Flappy colisiona con una tubería o con los límites de la pantalla
- **Pausa**: El estado del juego donde toda la simulación se congela temporalmente sin perder el progreso
- **Velocidad_Terminal**: La velocidad máxima de caída que Flappy puede alcanzar debido a la resistencia del aire simulada
- **Delta_Time**: El tiempo transcurrido entre el frame actual y el anterior, usado para normalizar el movimiento
- **Dificultad_Progresiva**: El sistema que incrementa la velocidad y reduce los gaps conforme avanza la partida

## Requisitos

### Requisito 1: Inicialización del Juego

**Historia de Usuario:** Como jugador, quiero que el juego se cargue en mi navegador y me muestre una pantalla de inicio, para poder comenzar a jugar cuando esté listo.

#### Criterios de Aceptación

1. THE Motor_de_Juego SHALL renderizar el juego dentro de un elemento Canvas en el navegador, con dimensiones que ocupen el área disponible de la ventana manteniendo una proporción de aspecto consistente
2. WHEN el juego se carga por primera vez, THE Motor_de_Juego SHALL mostrar una pantalla de inicio con el título "Flappy Kiro" centrado en pantalla y un texto indicando al jugador que presione Espacio o haga clic para comenzar
3. WHILE el juego se encuentra en la pantalla de inicio, WHEN el jugador presiona la tecla Espacio o hace clic en la pantalla, THE Motor_de_Juego SHALL iniciar la partida
4. THE Motor_de_Juego SHALL cargar el sprite ghosty.png como imagen del personaje Flappy antes de mostrar la pantalla de inicio
5. THE Motor_de_Juego SHALL cargar los archivos de audio jump.wav y game_over.wav antes de mostrar la pantalla de inicio
6. IF el sprite ghosty.png o alguno de los archivos de audio no se carga en un plazo de 10 segundos, THEN THE Motor_de_Juego SHALL mostrar un mensaje de error indicando que los recursos no pudieron cargarse

### Requisito 2: Sistema Físico del Personaje

**Historia de Usuario:** Como jugador, quiero que Flappy tenga un movimiento físico realista y fluido, para que controlar al personaje se sienta natural y responsivo.

#### Criterios de Aceptación

1. THE Motor_de_Juego SHALL aplicar una constante de gravedad de 980 píxeles/segundo² (normalizada por delta time) a Flappy, incrementando su velocidad de descenso de forma continua
2. WHEN el jugador presiona la tecla Espacio o hace clic en la pantalla, THE Motor_de_Juego SHALL establecer la velocidad vertical de Flappy a un impulso ascendente de -300 píxeles/segundo, independientemente de la velocidad actual
3. THE Motor_de_Juego SHALL limitar la Velocidad_Terminal de descenso de Flappy a 500 píxeles/segundo para evitar que atraviese obstáculos entre frames
4. THE Motor_de_Juego SHALL limitar la velocidad ascendente máxima de Flappy a -300 píxeles/segundo (el valor del impulso de salto)
5. THE Motor_de_Juego SHALL aplicar interpolación lineal (lerp) entre la posición anterior y la posición calculada del frame actual para suavizar el movimiento visible de Flappy
6. THE Motor_de_Juego SHALL conservar el momento de Flappy entre frames, de modo que la velocidad vertical persista y se acumule con la gravedad hasta que un nuevo impulso la reemplace
7. THE Motor_de_Juego SHALL mantener a Flappy en una posición horizontal fija equivalente al 20% del ancho del Canvas mientras el escenario se desplaza
8. WHILE Flappy se encuentra en movimiento, THE Motor_de_Juego SHALL actualizar la posición vertical de Flappy en cada frame usando la fórmula: posición += velocidad * deltaTime

### Requisito 3: Generación de Obstáculos y Dificultad Progresiva

**Historia de Usuario:** Como jugador, quiero que las tuberías aparezcan de forma continua con dificultad creciente, para tener un desafío que escale conforme mejoro.

#### Criterios de Aceptación

1. THE Scroller SHALL generar pares de tuberías (superior e inferior) con una distancia horizontal inicial de 250 píxeles entre cada par
2. THE Scroller SHALL posicionar cada par de tuberías con un Gap inicial de 160 píxeles de altura entre la tubería superior y la tubería inferior
3. THE Scroller SHALL posicionar el centro vertical del Gap de forma aleatoria entre el 20% y el 80% de la altura del Canvas para cada par de tuberías
4. THE Scroller SHALL desplazar las tuberías de derecha a izquierda a una velocidad base inicial de 150 píxeles/segundo (normalizada por delta time)
5. WHEN una tubería sale completamente del lado izquierdo de la pantalla (su coordenada X más su ancho es menor a 0), THE Scroller SHALL eliminar esa tubería del arreglo de tuberías activas
6. THE Scroller SHALL renderizar cada tubería con un ancho de 60 píxeles
7. WHEN el puntaje del jugador se incrementa en 5 puntos, THE Motor_de_Juego SHALL aumentar la velocidad de desplazamiento de las tuberías en un 5%, hasta un máximo del 200% de la velocidad base inicial
8. WHEN el puntaje del jugador se incrementa en 10 puntos, THE Motor_de_Juego SHALL reducir el tamaño del Gap en 5 píxeles, hasta un mínimo de 100 píxeles
9. WHEN el puntaje del jugador se incrementa en 10 puntos, THE Motor_de_Juego SHALL reducir la distancia horizontal entre pares de tuberías en 10 píxeles, hasta un mínimo de 180 píxeles
10. THE Motor_de_Juego SHALL aplicar los incrementos de dificultad de forma gradual sin saltos bruscos perceptibles por el jugador

### Requisito 4: Detección de Colisiones

**Historia de Usuario:** Como jugador, quiero que el juego detecte cuando Flappy choca con una tubería o sale de los límites, para que la partida termine de forma justa.

#### Criterios de Aceptación

1. WHEN la Hitbox rectangular de Flappy se superpone en al menos 1 píxel con la Hitbox rectangular de una Tubería (detección AABB), THE Motor_de_Juego SHALL activar el estado Game_Over
2. WHEN el borde superior de la Hitbox de Flappy alcanza la coordenada y=0 del Canvas, THE Motor_de_Juego SHALL activar el estado Game_Over
3. WHEN el borde inferior de la Hitbox de Flappy alcanza la coordenada y igual a la altura del Canvas, THE Motor_de_Juego SHALL activar el estado Game_Over
4. WHEN se activa el estado Game_Over, THE Motor_de_Juego SHALL reproducir el sonido game_over.wav una única vez
5. THE Motor_de_Juego SHALL evaluar las colisiones en cada frame del loop del juego
6. THE Motor_de_Juego SHALL definir la Hitbox de Flappy como un rectángulo con dimensiones iguales o menores al tamaño del sprite ghosty.png, centrado en la posición del personaje

### Requisito 5: Sistema de Audio

**Historia de Usuario:** Como jugador, quiero escuchar efectos de sonido al saltar y al colisionar, para tener retroalimentación auditiva que enriquezca la experiencia de juego.

#### Criterios de Aceptación

1. WHEN el jugador ejecuta un salto (presiona Espacio o hace clic durante el estado Playing), THE Motor_de_Juego SHALL reproducir el sonido jump.wav inmediatamente
2. WHEN se activa el estado Game_Over por colisión con una tubería o con los límites de la pantalla, THE Motor_de_Juego SHALL reproducir el sonido game_over.wav una única vez
3. THE Motor_de_Juego SHALL permitir la reproducción simultánea de múltiples instancias de jump.wav si el jugador ejecuta saltos rápidos consecutivos
4. THE Motor_de_Juego SHALL no reproducir ningún sonido mientras el juego se encuentra en estado Paused
5. IF el navegador bloquea la reproducción de audio por políticas de autoplay, THEN THE Motor_de_Juego SHALL desbloquear el contexto de audio en la primera interacción del usuario y continuar el juego sin sonido hasta ese momento
6. THE Motor_de_Juego SHALL precargar ambos archivos de audio (jump.wav y game_over.wav) durante la inicialización para evitar latencia en la primera reproducción

### Requisito 6: Sistema de Puntuación y HUD

**Historia de Usuario:** Como jugador, quiero ver mi puntaje actual y mi puntaje máximo en tiempo real, para poder medir mi progreso y competir conmigo mismo.

#### Criterios de Aceptación

1. WHEN el borde trasero de la Hitbox de Flappy sobrepasa el borde trasero del espacio entre un par de tuberías, THE Motor_de_Juego SHALL incrementar el puntaje actual en 1 punto, hasta un valor máximo de 9999
2. THE HUD SHALL mostrar el puntaje actual en tiempo real en la parte inferior izquierda de la pantalla con el formato "Score: [número]", actualizándose inmediatamente al pasar cada tubería
3. THE HUD SHALL mostrar el puntaje máximo histórico en la parte inferior derecha de la pantalla con el formato "High: [número]"
4. WHEN el juego se inicia por primera vez o se reinicia tras un game over, THE Motor_de_Juego SHALL establecer el puntaje actual en 0 y cargar el puntaje máximo desde localStorage, usando 0 como valor por defecto si no existe un valor almacenado
5. WHEN el puntaje actual supera el puntaje máximo almacenado, THE Motor_de_Juego SHALL actualizar el puntaje máximo en memoria, persistirlo en localStorage, y reflejar el nuevo valor en el HUD inmediatamente
6. IF localStorage no está disponible o su contenido no es un número entero válido entre 0 y 9999, THEN THE Motor_de_Juego SHALL usar 0 como puntaje máximo y continuar el juego sin persistencia
7. THE HUD SHALL mostrar el estado actual del juego (Playing, Paused, Game Over) de forma visible en la pantalla

### Requisito 7: Gestión de Estados del Juego (Pausa y Reinicio)

**Historia de Usuario:** Como jugador, quiero poder pausar y reiniciar la partida según sea necesario, para tener control total sobre mi sesión de juego.

#### Criterios de Aceptación

1. THE Motor_de_Juego SHALL gestionar los siguientes estados: Inicio, Playing, Paused, Game_Over
2. WHILE el juego se encuentra en estado Playing, WHEN el jugador presiona la tecla "P" o la tecla Escape, THE Motor_de_Juego SHALL transicionar al estado Paused
3. WHILE el juego se encuentra en estado Paused, THE Motor_de_Juego SHALL congelar toda la simulación física, el desplazamiento de tuberías, el movimiento de nubes y el fondo, preservando las posiciones exactas de todos los elementos
4. WHILE el juego se encuentra en estado Paused, THE Motor_de_Juego SHALL mostrar un overlay semi-transparente con el texto "PAUSED" centrado en el Canvas y una instrucción para reanudar
5. WHILE el juego se encuentra en estado Paused, WHEN el jugador presiona la tecla "P", Escape, o hace clic en la pantalla, THE Motor_de_Juego SHALL transicionar al estado Playing y reanudar la simulación desde el punto exacto donde se pausó
6. WHILE el juego se encuentra en estado Paused, THE Motor_de_Juego SHALL ignorar las entradas de salto (Espacio/clic) para evitar saltos accidentales al reanudar
7. WHEN se activa el estado Game_Over, THE Motor_de_Juego SHALL detener el desplazamiento del escenario y la generación de tuberías
8. WHEN se activa el estado Game_Over, THE Motor_de_Juego SHALL mostrar un mensaje de "Game Over" centrado en el Canvas junto con el puntaje final, el puntaje máximo, y una instrucción para reiniciar
9. WHEN el jugador presiona la tecla Espacio o hace clic transcurrido al menos 1 segundo desde la activación del estado Game_Over, THE Motor_de_Juego SHALL reiniciar la partida con el puntaje actual en cero, la dificultad en su nivel inicial, preservando el puntaje máximo almacenado en localStorage
10. WHEN se reinicia la partida, THE Motor_de_Juego SHALL reposicionar a Flappy en su posición inicial, restablecer su velocidad vertical a cero, eliminar todas las tuberías existentes, y restablecer todos los parámetros de dificultad a sus valores iniciales
11. IF el jugador presiona la tecla Espacio o hace clic antes de transcurrido 1 segundo desde la activación del estado Game_Over, THEN THE Motor_de_Juego SHALL ignorar la entrada y permanecer en el estado Game_Over
12. WHILE el juego se encuentra en estado Paused o Game_Over, THE Motor_de_Juego SHALL continuar renderizando el último frame del juego como fondo estático detrás del overlay

### Requisito 8: Fondo con Caricatura de la Ciudad de Panamá

**Historia de Usuario:** Como jugador, quiero ver un fondo con una caricatura de la Ciudad de Panamá, para tener una experiencia visual atractiva y temática.

#### Criterios de Aceptación

1. THE Motor_de_Juego SHALL renderizar un fondo que represente una caricatura estilizada de la Ciudad de Panamá con edificios y el skyline característico, dibujado programáticamente usando la API Canvas 2D
2. THE Motor_de_Juego SHALL dibujar el fondo utilizando un estilo visual retro y dibujado a mano consistente con la estética general del juego
3. THE Scroller SHALL desplazar el fondo de derecha a izquierda a una velocidad equivalente al 30% de la velocidad de las tuberías para crear un efecto de paralaje (parallax)
4. THE Motor_de_Juego SHALL renderizar el fondo como una imagen continua que se repite sin costuras visibles cuando el desplazamiento completa un ciclo
5. THE Motor_de_Juego SHALL utilizar una paleta de colores con un cielo azul claro (#87CEEB) como color base del fondo
6. THE Motor_de_Juego SHALL renderizar las capas en el siguiente orden de atrás hacia adelante: cielo, fondo de ciudad, tuberías, nubes decorativas, Flappy, HUD

### Requisito 9: Estilo Visual Anime

**Historia de Usuario:** Como jugador, quiero que el juego tenga una estética anime con estilo limpio y colorido, para disfrutar de una experiencia visual atractiva y moderna.

#### Criterios de Aceptación

1. THE Motor_de_Juego SHALL renderizar las tuberías con un color de relleno verde, bordes de color más oscuro con un ancho mínimo de 2 píxeles, y un segmento de remate (cap) en el extremo abierto de cada tubería
2. THE Motor_de_Juego SHALL renderizar al menos 3 elementos decorativos de tipo nubes en pantalla, dibujados con un estilo anime (bordes suaves, formas redondeadas y orgánicas) y con una opacidad entre 40% y 70% (semi-transparentes) para crear un efecto etéreo
3. THE Motor_de_Juego SHALL desplazar las nubes decorativas a velocidades diferentes entre sí (variando entre el 10% y el 50% de la velocidad de las tuberías), de modo que las nubes más lejanas se muevan más lento y las más cercanas más rápido, creando un efecto de profundidad (parallax multicapa)
4. THE HUD SHALL mostrar la información de puntaje dentro de una barra opaca de color oscuro posicionada en la parte inferior de la pantalla, con una altura entre 30 y 60 píxeles
5. THE Motor_de_Juego SHALL utilizar un estilo visual general tipo anime con líneas limpias, colores planos con gradientes suaves, y formas estilizadas para todos los elementos del juego (tuberías, nubes, fondo, HUD)
6. THE Motor_de_Juego SHALL renderizar el juego en una resolución base de 800x600 píxeles con una proporción de aspecto de 4:3
7. WHEN la ventana del navegador cambia de tamaño, THE Motor_de_Juego SHALL escalar el Canvas proporcionalmente manteniendo la proporción de aspecto 4:3 sin distorsionar los elementos visuales

### Requisito 10: Rendimiento y Compatibilidad

**Historia de Usuario:** Como jugador, quiero que el juego funcione de forma fluida en mi navegador, para tener una experiencia de juego sin interrupciones.

#### Criterios de Aceptación

1. THE Motor_de_Juego SHALL ejecutar el loop del juego utilizando requestAnimationFrame, apuntando a una tasa de 60 frames por segundo con una tolerancia mínima de 30 fps antes de considerar degradación de rendimiento
2. THE Motor_de_Juego SHALL utilizar delta time (tiempo transcurrido entre frames) para calcular el movimiento de todos los elementos, garantizando comportamiento consistente independientemente de la tasa de frames real
3. THE Motor_de_Juego SHALL implementarse utilizando HTML5, JavaScript vanilla y la API Canvas 2D sin dependencias externas ni frameworks
4. THE Motor_de_Juego SHALL ser ejecutable abriendo directamente el archivo HTML en el navegador sin necesidad de un servidor web, bundler, o paso de compilación
5. THE Motor_de_Juego SHALL funcionar correctamente en las últimas 2 versiones estables de Chrome, Firefox, Safari y Edge
