"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STAFF_ROLES, ROLE_LABELS, type StaffRole } from "@/lib/permissions";
import { Search, UserPlus, Trash2, Shield, Users } from "lucide-react";

interface StaffMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  createdAt: string;
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StaffMember[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["admin-staff"],
    queryFn: () => api("/api/store/admin/staff"),
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
              {staff.map((member) => (
                <tr key={member.id} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="p-3 font-medium">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="p-3 text-muted-foreground">{member.email}</td>
                  <td className="p-3">
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
