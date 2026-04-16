// ── Usuarios hardcodeados ─────────────────────────────────────────────────────
// Para agregar usuarios: añadir un objeto al array.
// Para cambiar permisos: modificar el objeto de roles más abajo.

export interface User {
  username: string;
  password: string;
  role: Role;
  email?: string;
  sucursal?: string; // solo para rol 'local' — el local que puede ver
}

const USERS: User[] = [
  { username: 'matias',       password: '3455',    role: 'admin',   email: 'matiasvladiloc@gmail.com'     },
  { username: 'maria',        password: '3455',    role: 'usuario', email: 'nacha.lobos.l@gmail.com'      },
  { username: 'nikolas',      password: '3455',    role: 'admin',   email: 'nvladiloc@gmail.com'          },
  { username: 'fernando',     password: '3455',    role: 'admin',   email: 'fernando.vladilo@gmail.com'   },
  { username: 'marcela',      password: 'elorria', role: 'usuario', email: ''                             },
  { username: 'matiaslagos',  password: 'elorria', role: 'usuario', email: ''                             },
  { username: 'jose',         password: '3455',    role: 'usuario', email: ''                             },
  { username: 'lareina',     password: 'elorria3455', role: 'local', sucursal: 'La Reina' },
  { username: 'pv',          password: 'elorria3455', role: 'local', sucursal: 'PV'       },
  { username: 'pt',          password: 'elorria3455', role: 'local', sucursal: 'PT'       },
  { username: 'bilbao',      password: 'elorria3455', role: 'local',      sucursal: 'Bilbao'   },
  { username: 'produccion',  password: 'elorria3455', role: 'produccion'                    },
];

// ── Roles y permisos ──────────────────────────────────────────────────────────
// Para agregar un rol nuevo: agregar una clave al objeto ROLES con sus permisos.

export type Role = 'admin' | 'usuario' | 'local' | 'produccion';

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
  local: {
    canViewAll: false,           // solo ve su propio local
    allowedLocations: [],        // se determina por user.sucursal
    canAccessGastoFijo: false,
  },
  produccion: {
    canViewAll: false,
    allowedLocations: [],
    canAccessGastoFijo: false,
  },
};

// ── Sesión ────────────────────────────────────────────────────────────────────

export interface SessionUser {
  username: string;
  role: Role;
  email?: string;
  sucursal?: string; // presente solo cuando role === 'local'
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
