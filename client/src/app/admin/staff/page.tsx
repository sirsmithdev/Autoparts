"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { STAFF_ROLES, ROLE_LABELS, type StaffRole } from "@/lib/permissions";
import {
  Search, UserPlus, Trash2, Shield, Users, Mail, Eye, Activity,
} from "lucide-react";
import { format } from "date-fns";

interface StaffMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  createdAt: string;
}

interface StaffInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedAt: string;
  expiresAt: string;
}

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-red-100", text: "text-red-700" },
  manager: { bg: "bg-blue-100", text: "text-blue-700" },
  warehouse_staff: { bg: "bg-green-100", text: "text-green-700" },
  cashier: { bg: "bg-amber-100", text: "text-amber-700" },
};

const INVITE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-700" },
  accepted: { bg: "bg-green-100", text: "text-green-700" },
  expired: { bg: "bg-gray-100", text: "text-gray-500" },
};

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StaffMember[]>([]);
  const [searching, setSearching] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("");
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["admin-staff"],
    queryFn: () => api("/api/store/admin/staff"),
  });

  const { data: invites = [] } = useQuery<StaffInvite[]>({
    queryKey: ["admin-staff-invites"],
    queryFn: () => api("/api/store/admin/staff/invites"),
  });

  const setRoleMutation = useMutation({
    mutationFn: ({ customerId, role }: { customerId: string; role: string }) =>
      api(`/api/store/admin/staff/${customerId}/role`, {
        method: "POST",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      setSearchResults([]);
      setSearchQuery("");
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: (customerId: string) =>
      api(`/api/store/admin/staff/${customerId}/role`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-staff"] }),
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      api("/api/store/admin/staff/invite", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      setInviteEmail("");
      setInviteRole("");
      setInviteMessage({ type: "success", text: "Invite sent successfully." });
      queryClient.invalidateQueries({ queryKey: ["admin-staff-invites"] });
      setTimeout(() => setInviteMessage(null), 5000);
    },
    onError: (err: Error) => {
      setInviteMessage({ type: "error", text: err.message || "Failed to send invite." });
      setTimeout(() => setInviteMessage(null), 5000);
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await api<StaffMember[]>(
        `/api/store/admin/staff/search?email=${encodeURIComponent(searchQuery.trim())}`
      );
      setSearchResults(results.filter((r) => !r.role));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteRole) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff roles and permissions for the parts store.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {staff.length} staff member{staff.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/staff/permissions"
          className="inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted transition-colors"
        >
          <Eye className="h-4 w-4" />
          View Permissions
        </Link>
        <Link
          href="/admin/staff/activity"
          className="inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted transition-colors"
        >
          <Activity className="h-4 w-4" />
          Activity Log
        </Link>
      </div>

      {/* Add Staff */}
      <div className="border rounded-md bg-card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          Add Staff Member
        </h2>
        <p className="text-sm text-muted-foreground">
          Search for a registered customer by email to assign them a staff role.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || searchQuery.trim().length < 2}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Assign Role</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((customer) => (
                  <tr key={customer.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      {customer.firstName} {customer.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{customer.email}</td>
                    <td className="p-3 text-right">
                      <select
                        className="border rounded-md px-2 py-1.5 text-sm bg-background"
                        defaultValue=""
                        onChange={(e) => {
                          const role = e.target.value;
                          if (role) {
                            if (!window.confirm(`Assign "${ROLE_LABELS[role as StaffRole]}" role to ${customer.firstName}?`)) {
                              e.target.value = "";
                              return;
                            }
                            setRoleMutation.mutate({
                              customerId: customer.id,
                              role,
                            });
                          }
                        }}
                      >
                        <option value="" disabled>Select role...</option>
                        {STAFF_ROLES.map((role) => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite by Email */}
      <div className="border rounded-md bg-card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Invite by Email
        </h2>
        <p className="text-sm text-muted-foreground">
          Send an invitation to an email address. They will be assigned the selected role when they register or log in.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            placeholder="Email address..."
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            className="flex-1 min-w-[200px] max-w-sm px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="" disabled>Select role...</option>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>
          <button
            onClick={handleInvite}
            disabled={inviteMutation.isPending || !inviteEmail.trim() || !inviteRole}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {inviteMutation.isPending ? "Sending..." : "Send Invite"}
          </button>
        </div>
        {inviteMessage && (
          <p className={`text-sm ${inviteMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {inviteMessage.text}
          </p>
        )}

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div className="border rounded-md overflow-hidden mt-4">
            <div className="p-3 bg-muted/40 border-b">
              <h3 className="text-sm font-medium text-muted-foreground">Pending Invites</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Invited</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Expires</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => {
                  const statusColors = INVITE_STATUS_COLORS[invite.status] || INVITE_STATUS_COLORS.pending;
                  return (
                    <tr key={invite.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="p-3 text-muted-foreground">{invite.email}</td>
                      <td className="p-3">
                        {(() => {
                          const colors = ROLE_BADGE_COLORS[invite.role];
                          return colors ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                              {ROLE_LABELS[invite.role as StaffRole]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{invite.role}</span>
                          );
                        })()}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                          {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(invite.invitedAt), "MMM d, yyyy")}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Current Staff */}
      <div className="border rounded-md bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/40">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Current Staff
          </h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading staff...</div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No staff members yet. Search for a customer above to add them.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => {
                const roleBadge = member.role ? ROLE_BADGE_COLORS[member.role] : null;
                return (
                  <tr key={member.id} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="p-3 font-medium">
                      {member.firstName} {member.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{member.email}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {roleBadge && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.bg} ${roleBadge.text}`}>
                            {ROLE_LABELS[member.role as StaffRole]}
                          </span>
                        )}
                        <select
                          value={member.role || ""}
                          onChange={(e) => {
                            const role = e.target.value;
                            if (role) {
                              if (!window.confirm(`Change ${member.firstName}'s role to "${ROLE_LABELS[role as StaffRole]}"?`)) {
                                e.target.value = member.role || "";
                                return;
                              }
                              setRoleMutation.mutate({
                                customerId: member.id,
                                role,
                              });
                            }
                          }}
                          className="border rounded-md px-2 py-1 text-sm bg-background"
                        >
                          {STAFF_ROLES.map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${member.firstName}'s staff access?`)) {
                            removeRoleMutation.mutate(member.id);
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Remove staff role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
