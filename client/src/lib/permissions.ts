/**
 * Client-side role and permission helpers.
 * Mirrors server/permissions.ts — keep in sync.
 */

export const STAFF_ROLES = ["admin", "manager", "warehouse_staff", "cashier"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "orders:read",
  "orders:manage",
  "returns:read",
  "returns:manage",
  "warehouse:read",
  "warehouse:manage",
  "picklists:read",
  "picklists:manage",
  "pos:operate",
  "pos:reports",
  "settings:read",
  "settings:manage",
  "staff:manage",
  "sync:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  admin: new Set(PERMISSIONS),
  manager: new Set<Permission>([
    "orders:read", "orders:manage",
    "returns:read", "returns:manage",
    "warehouse:read", "warehouse:manage",
    "picklists:read", "picklists:manage",
    "pos:operate", "pos:reports",
    "settings:read",
  ]),
  warehouse_staff: new Set<Permission>([
    "orders:read",
    "warehouse:read", "warehouse:manage",
    "picklists:read", "picklists:manage",
  ]),
  cashier: new Set<Permission>([
    "orders:read",
    "pos:operate",
  ]),
};

export function isValidRole(role: string): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole);
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !isValidRole(role)) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export function getPermissions(role: string | null | undefined): Permission[] {
  if (!role || !isValidRole(role)) return [];
  return [...ROLE_PERMISSIONS[role]];
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  manager: "Manager",
  warehouse_staff: "Warehouse Staff",
  cashier: "Cashier",
};
