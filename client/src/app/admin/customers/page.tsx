"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, ChevronLeft, ChevronRight, CircleUser, ShieldBan, ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { ROLE_LABELS, type StaffRole } from "@/lib/permissions";

interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string | null;
  isBlocked: boolean;
  createdAt: string;
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
}

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-red-100", text: "text-red-700" },
  manager: { bg: "bg-blue-100", text: "text-blue-700" },
  warehouse_staff: { bg: "bg-green-100", text: "text-green-700" },
  cashier: { bg: "bg-amber-100", text: "text-amber-700" },
};

export default function AdminCustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["admin-customers", search, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(limit));
      return api<CustomersResponse>(`/api/store/admin/customers?${params}`);
    },
  });

  const customers = data?.customers || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const blockMutation = useMutation({
    mutationFn: (customerId: string) =>
      api(`/api/store/admin/customers/${customerId}/block`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-customers"] }),
  });

  const unblockMutation = useMutation({
    mutationFn: (customerId: string) =>
      api(`/api/store/admin/customers/${customerId}/unblock`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-customers"] }),
  });

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View and manage customer accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleUser className="h-4 w-4" />
          {total} customer{total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
            className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Customers Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {search ? "No customers found matching your search." : "No customers yet."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Registered</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const roleBadge = customer.role ? ROLE_BADGE_COLORS[customer.role] : null;
                    return (
                      <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="p-3 font-medium">
                          {customer.firstName || customer.lastName
                            ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                            : "--"}
                        </td>
                        <td className="p-3 text-muted-foreground">{customer.email}</td>
                        <td className="p-3 text-muted-foreground">{customer.phone || "--"}</td>
                        <td className="p-3">
                          {customer.role && roleBadge ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.bg} ${roleBadge.text}`}
                            >
                              {ROLE_LABELS[customer.role as StaffRole]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Customer</span>
                          )}
                        </td>
                        <td className="p-3">
                          {customer.isBlocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <ShieldBan className="h-3 w-3" />
                              Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <ShieldCheck className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {format(new Date(customer.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="p-3 text-right">
                          {customer.isBlocked ? (
                            <button
                              onClick={() => {
                                if (window.confirm(`Unblock ${customer.email}?`)) {
                                  unblockMutation.mutate(customer.id);
                                }
                              }}
                              disabled={unblockMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium border border-green-300 text-green-700 rounded-md hover:bg-green-50 disabled:opacity-50 transition-colors"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (window.confirm(`Block ${customer.email}? They will not be able to log in or place orders.`)) {
                                  blockMutation.mutate(customer.id);
                                }
                              }}
                              disabled={blockMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
                            >
                              Block
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
