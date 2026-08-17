/**
 * session-cookies.ts
 * Solo los nombres de las cookies de sesión.
 *
 * Viven acá y no en auth.ts porque el cliente necesita el nombre de la cookie
 * de interfaz, y auth.ts tiene el array de usuarios con sus contraseñas: no
 * puede terminar en el bundle del navegador ni por accidente.
 */

/** Cookie de sesión: token firmado y httpOnly. Es la única que el server cree. */
export const SESSION_COOKIE = 'session';

/**
 * Cookie paralela, legible por el cliente, SOLO para pintar la interfaz
 * (nombre en el sidebar, qué items mostrar, qué local pedir por defecto).
 *
 * El servidor la ignora por completo. Si alguien la edita a mano, lo único que
 * consigue es una interfaz mentirosa: el middleware y las rutas API siguen
 * resolviendo el rol desde la cookie firmada.
 */
export const SESSION_UI_COOKIE = 'session_ui';
