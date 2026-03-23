// ── Usuarios hardcodeados ─────────────────────────────────────────────────────
// Para agregar usuarios: añadir un objeto al array.
// Para cambiar permisos: modificar el objeto de roles más abajo.

export interface User {
  username: string;
  password: string;
  role: Role;
  email?: string;
}

const USERS: User[] = [
  { username: 'matias', password: '3455', role: 'admin',   email: 'matiasvladiloc@gmail.com' },
  { username: 'maria',  password: '3455', role: 'usuario', email: 'nacha.lobos.l@gmail.com'  },
];

// ── Roles y permisos ──────────────────────────────────────────────────────────
// Para agregar un rol nuevo: agregar una clave al objeto ROLES con sus permisos.

export type Role = 'admin' | 'usuario';

export interface RolePermissions {
  canViewAll: boolean;
  allowedLocations: string[];
  canAccessGastoFijo: boolean;
}

export const ROLES: Record<Role, RolePermissions> = {
  admin: {
    canViewAll: true,
    allowedLocations: ['pv', 'lareina', 'pt', 'bilbao'],
    canAccessGastoFijo: true,
  },
  usuario: {
    canViewAll: true,
    allowedLocations: ['pv', 'lareina', 'pt', 'bilbao'],
    canAccessGastoFijo: false,
  },
};

// ── Sesión ────────────────────────────────────────────────────────────────────

export interface SessionUser {
  username: string;
  role: Role;
  email?: string;
}

export const SESSION_COOKIE = 'session';

// ── Funciones de autenticación ────────────────────────────────────────────────

export function validateCredentials(username: string, password: string): User | null {
  return USERS.find(u => u.username === username && u.password === password) ?? null;
}

export function findUser(username: string): User | null {
  return USERS.find(u => u.username === username) ?? null;
}

export function getPermissions(role: Role): RolePermissions {
  return ROLES[role];
}
