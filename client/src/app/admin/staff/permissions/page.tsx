"use client";

import Link from "next/link";
import { ChevronLeft, Shield, Check, Minus } from "lucide-react";
import {
  STAFF_ROLES,
  PERMISSIONS,
  ROLE_LABELS,
  hasPermission,
  type StaffRole,
  type Permission,
} from "@/lib/permissions";

const PERMISSION_GROUPS: { category: string; permissions: Permission[] }[] = [
  { category: "Orders", permissions: ["orders:read", "orders:manage"] },
  { category: "Returns", permissions: ["returns:read", "returns:manage"] },
  { category: "Warehouse", permissions: ["warehouse:read", "warehouse:manage"] },
  { category: "Pick Lists", permissions: ["picklists:read", "picklists:manage"] },
  { category: "POS", permissions: ["pos:operate", "pos:reports"] },
  { category: "Settings", permissions: ["settings:read", "settings:manage"] },
  { category: "Products", permissions: ["products:manage"] },
  { category: "Staff", permissions: ["staff:manage"] },
  { category: "Sync", permissions: ["sync:manage"] },
];

const ROLE_BADGE_COLORS: Record<StaffRole, { bg: string; text: string }> = {
  admin: { bg: "bg-red-100", text: "text-red-700" },
  manager: { bg: "bg-blue-100", text: "text-blue-700" },
  warehouse_staff: { bg: "bg-green-100", text: "text-green-700" },
  cashier: { bg: "bg-amber-100", text: "text-amber-700" },
};

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  admin: "Full access to all features. Can manage staff, settings, and sync configuration.",
  manager: "Can manage orders, returns, warehouse, pick lists, POS, and products. Read-only settings access.",
  warehouse_staff: "Can view orders and manage warehouse operations and pick lists.",
  cashier: "Can view orders and operate the point-of-sale system.",
};

function formatPermissionLabel(permission: string): string {
  const parts = permission.split(":");
  return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
}

export default function PermissionsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/admin/staff"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold">Permissions Matrix</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Overview of which roles have access to which features.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          {STAFF_ROLES.length} roles, {PERMISSIONS.length} permissions
        </div>
      </div>

      {/* Permissions Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground min-w-[200px]">
                  Permission
                </th>
                {STAFF_ROLES.map((role) => {
                  const colors = ROLE_BADGE_COLORS[role];
                  return (
                    <th key={role} className="p-3 text-center min-w-[120px]">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <>
                  {/* Category header row */}
                  <tr key={`cat-${group.category}`} className="bg-muted/20">
                    <td
                      colSpan={STAFF_ROLES.length + 1}
                      className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground"
                    >
                      {group.category}
                    </td>
                  </tr>
                  {/* Permission rows */}
                  {group.permissions.map((permission) => (
                    <tr
                      key={permission}
                      className="border-b last:border-0 hover:bg-muted/10"
                    >
                      <td className="p-3 text-muted-foreground">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {permission}
                        </code>
                        <span className="ml-2 text-foreground">
                          {formatPermissionLabel(permission)}
                        </span>
                      </td>
                      {STAFF_ROLES.map((role) => {
                        const allowed = hasPermission(role, permission);
                        return (
                          <td key={role} className="p-3 text-center">
                            {allowed ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                                <Minus className="h-3.5 w-3.5 text-gray-400" />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="border rounded-md bg-card p-5 space-y-4">
        <h2 className="font-semibold">Role Descriptions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STAFF_ROLES.map((role) => {
            const colors = ROLE_BADGE_COLORS[role];
            return (
              <div key={role} className="border rounded-md p-4 space-y-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
                >
                  {ROLE_LABELS[role]}
                </span>
                <p className="text-sm text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
