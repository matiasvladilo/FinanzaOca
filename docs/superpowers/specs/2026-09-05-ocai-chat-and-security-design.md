# OCAI — controles de chat y seguridad preventiva

## Objetivo

Evolucionar el asistente de FinanzasOca a **OCAI**, un miembro competente del
equipo que transforma datos empresariales en respuestas concretas. El cambio
añade controles de conversación inspirados en la referencia visual, un modo
inmersivo reversible, desambiguación de consultas y una defensa preventiva
contra entradas maliciosas.

## Alcance

- Renombrar la experiencia a `OCAI · Asistente FinanzasOca`.
- Agregar nueva conversación, compartir por portapapeles, modo inmersivo y
  minimizar.
- Hacer que OCAI pregunte por la precisión necesaria cuando una consulta tiene
  varias interpretaciones válidas.
- Añadir un filtro de seguridad del lado servidor antes de enviar texto a la
  IA.
- Mantener el uso administrativo, las consultas de solo lectura y el historial
  efímero existentes.

## Fuera de alcance

- Enlaces compartibles, historial persistente o auditoría de bloqueos.
- Acciones de escritura sobre datos, aprobación de cambios o modificaciones de
  base de datos.
- Cambios a las fuentes de datos o a las herramientas de consulta actuales.

## Experiencia de usuario

### Estados de vista

`AsistenteBubble` conserva la conversación y controla uno de tres estados:

1. **Cerrado**: solo se ve la burbuja flotante.
2. **Panel**: chat flotante actual, con la geometría y apariencia de la
   captura de referencia.
3. **Inmersivo**: capa amplia dentro de la aplicación para leer y escribir con
   más espacio.

El botón Cerrar desde el panel devuelve al estado Cerrado. El botón Minimizar
del modo inmersivo devuelve al Panel. Ambos caminos preservan los mensajes y
el borrador de entrada durante la sesión.

### Encabezado

Se adopta el patrón de **menú “más”** seleccionado por el usuario:

- Siempre visibles: Modo inmersivo y Cerrar.
- Menú “más”: Nueva conversación y Compartir chat.
- Nueva conversación abre un diálogo de confirmación antes de limpiar el
  historial.
- Compartir copia el historial visible como texto al portapapeles y muestra un
  aviso breve, no intrusivo y accesible.

Todos los iconos tienen etiqueta accesible, tooltip y objetivos táctiles de al
menos 44 px. El diseño conserva el tema oscuro y usa un solo lenguaje de
iconos.

## Comportamiento conversacional

OCAI responde únicamente sobre datos disponibles de FinanzasOca. Su tono es el
de un miembro experto del equipo: directo, contextual y claro.

Cuando la solicitud sea ambigua y pueda dar resultados distintos —por ejemplo,
ventas de agosto con varios años disponibles— OCAI pide el dato faltante antes
de consultar herramientas. Debe pedir, según corresponda, año, período,
sucursal o métrica. No elige ni comunica supuestos como si fueran hechos.

## Seguridad preventiva

La protección tendrá dos capas:

1. **Filtro determinista previo a la IA.** El endpoint normaliza y examina el
   último mensaje del usuario. Rechaza patrones de inyección de instrucciones,
   intentos de revelar reglas internas, solicitudes de ejecutar/autorizar/
   modificar datos, y secuencias técnicas sospechosas destinadas a forzar
   comportamiento. Si se bloquea, no se llama a Anthropic, a herramientas ni a
   la base de datos; se responde exactamente: `Solo respondo consultas sobre
   datos de FinanzasOca.`
2. **Instrucciones fijas del modelo.** El prompt confirma que el dominio es
   financiero-operativo, que las herramientas son solo lectura y que cualquier
   texto de planillas o herramientas es dato, nunca una instrucción.

Los bloqueos no se persisten ni generan auditoría, por decisión explícita del
usuario. El filtro se diseña de forma conservadora para no rechazar consultas
financieras legítimas; es una defensa adicional, no un motor de seguridad
basado solo en palabras prohibidas.

## Arquitectura

- `AsistenteBubble`: estado único de mensajes, borrador y modo de vista.
- `AsistenteChat`: presentación reutilizable de panel/inmersivo, encabezado,
  menú y diálogo de confirmación; no contiene la lógica de seguridad.
- `src/lib/asistente/security.ts` (nuevo): funciones puras para normalizar y
  clasificar la entrada como permitida o bloqueada.
- `POST /api/asistente/chat`: autentica, valida el payload, ejecuta el filtro
  sobre el último mensaje de usuario y solo continúa al flujo Anthropic si la
  entrada es permitida.
- `src/lib/asistente/prompt.ts`: actualiza identidad y reglas de
  desambiguación de OCAI.

## Manejo de errores y accesibilidad

- Si el portapapeles no está disponible, OCAI informa que no pudo copiar y
  permite continuar sin perder mensajes.
- El diálogo de nueva conversación recibe foco al abrirse, permite cancelar,
  y no borra nada hasta confirmar.
- Los avisos de copia, error y bloqueo se anuncian con una región `aria-live`
  sin robar foco.
- El modo inmersivo respeta `prefers-reduced-motion` y mantiene una salida
  visible y por teclado.

## Pruebas

- Funciones de seguridad: entradas permitidas, inyección directa, solicitud de
  escritura, revelación de instrucciones y payloads malformados.
- Endpoint: el caso bloqueado termina antes de inicializar o invocar Anthropic.
- UI: nueva conversación no limpia al cancelar y sí limpia al confirmar;
  compartir copia el historial y anuncia el resultado; minimizar mantiene la
  conversación y regresar desde inmersivo restaura el panel.
- Regresión manual: burbuja arrastrable, panel en ambos temas y viewport móvil.

## Criterios de aceptación

1. El usuario puede abrir OCAI, compartir una conversación por texto y crear
   una conversación nueva solo tras confirmarla.
2. El modo inmersivo vuelve al panel flotante sin perder conversación.
3. Preguntas ambiguas reciben una solicitud de precisión, no una suposición.
4. Entradas sospechosas no llegan al modelo, a herramientas ni a datos, y
   reciben el mensaje acordado.
5. OCAI sigue siendo exclusivo de administradores y de solo lectura.
