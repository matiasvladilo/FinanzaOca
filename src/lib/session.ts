/**
 * session.ts
 * Firma y verificación del token de sesión.
 *
 * El token es `<payload>.<firma>`, ambos en base64url, donde la firma es un
 * HMAC-SHA256 del payload con SESSION_SECRET. El payload sigue siendo legible
 * (no está cifrado) pero no se puede modificar sin invalidar la firma, que es
 * justamente lo que faltaba: antes la cookie era JSON plano y cualquiera podía
 * editarla en el navegador para darse rol admin.
 *
 * Se usa Web Crypto (no el módulo `crypto` de Node) porque este código corre
 * también en el middleware, que va sobre el runtime Edge.
 *
 * La caducidad viaja firmada dentro del payload: el `maxAge` de la cookie lo
 * controla el cliente, así que por sí solo no sirve para expirar una sesión.
 */

import type { SessionUser } from '@/lib/auth';

export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

/** Largo mínimo del secreto. Por debajo de esto el HMAC no aporta nada serio. */
const MIN_SECRET_LENGTH = 32;

interface SessionPayload extends SessionUser {
  exp: number; // epoch en segundos
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Se reserva el ArrayBuffer explícitamente para que el tipo resultante sea
// Uint8Array<ArrayBuffer>, que es lo que crypto.subtle acepta como BufferSource.
function b64urlDecode(value: string) {
  const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Importar la clave tiene costo, así que se cachea mientras el secreto no cambie.
let keyCache: { secret: string; key: CryptoKey } | null = null;

async function getKey(): Promise<CryptoKey | null> {
  const secret = process.env.SESSION_SECRET ?? '';
  // Sin secreto se falla cerrado: nadie entra. Es preferible a firmar con un
  // valor por defecto, que en la práctica equivaldría a no firmar.
  if (secret.length < MIN_SECRET_LENGTH) return null;
  if (keyCache && keyCache.secret === secret) return keyCache.key;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  keyCache = { secret, key };
  return key;
}

/**
 * Firma una sesión. Devuelve null si falta SESSION_SECRET, en cuyo caso el
 * login debe fallar en vez de emitir una cookie que no protege nada.
 */
export async function signSession(
  user: SessionUser,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;

  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifica el token y devuelve la sesión, o null si la firma no valida, el
 * token está vencido o falta el secreto. Cualquier error de formato también
 * cae en null: no se confía en nada que no haya pasado por la firma.
 */
export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const key = await getKey();
  if (!key) return null;

  const sep = token.lastIndexOf('.');
  if (sep <= 0 || sep === token.length - 1) return null;

  const body = token.slice(0, sep);
  try {
    const signature = b64urlDecode(token.slice(sep + 1));
    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(body));
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(b64urlDecode(body))) as SessionPayload;
    if (!payload.username || !payload.role) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;

    return {
      username: payload.username,
      role: payload.role,
      email: payload.email,
      sucursal: payload.sucursal,
    };
  } catch {
    return null;
  }
}
