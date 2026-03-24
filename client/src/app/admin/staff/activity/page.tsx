"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Activity, Filter } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { api } from "@/lib/api";

interface ActivityEntry {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

interface ActivityResponse {
  activities: ActivityEntry[];
  total: number;
  page: number;
  limit: number;
}

const ACTION_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  order: { bg: "bg-blue-100", text: "text-blue-700" },
  return: { bg: "bg-orange-100", text: "text-orange-700" },
  product: { bg: "bg-green-100", text: "text-green-700" },
  staff: { bg: "bg-purple-100", text: "text-purple-700" },
  settings: { bg: "bg-gray-100", text: "text-gray-700" },
};

function getActionColor(action: string) {
  const prefix = action.split("_")[0];
  return ACTION_TYPE_COLORS[prefix] || { bg: "bg-gray-100", text: "text-gray-700" };
}

function getEntityLink(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "order":
      return `/admin/orders/${entityId}`;
    case "return":
      return `/admin/returns`;
    case "product":
      return `/admin/products/${entityId}`;
    default:
      return null;
  }
}

function formatActionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function StaffActivityPage() {
  const [page, setPage] = useState(1);
  const [staffFilter, setStaffFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const limit = 50;

  const { data, isLoading } = useQuery<ActivityResponse>({
    queryKey: ["admin-staff-activity", page, staffFilter, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (staffFilter) params.set("staffId", staffFilter);
      if (actionFilter) params.set("action", actionFilter);
      return api<ActivityResponse>(`/api/store/admin/staff/activity?${params}`);
    },
  });

  const activities = data?.activities || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Collect unique staff members and action types for filter dropdowns
  const uniqueStaff = activities.reduce<Record<string, string>>((acc, a) => {
    if (a.staffId && a.staffName) acc[a.staffId] = a.staffName;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
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
            <h1 className="text-2xl font-bold">Staff Activity Log</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Track all staff actions across the admin panel.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          {total} event{total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filters */}
      <div className="border rounded-md bg-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters:
          </div>
          <select
            value={staffFilter}
            onChange={(e) => { setStaffFilter(e.target.value); setPage(1); }}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value="">All Staff</option>
            {Object.entries(uniqueStaff).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value="">All Actions</option>
            <option value="order">Order Actions</option>
            <option value="return">Return Actions</option>
            <option value="product">Product Actions</option>
            <option value="staff">Staff Actions</option>
            <option value="settings">Settings Actions</option>
          </select>
          {(staffFilter || actionFilter) && (
            <button
              onClick={() => { setStaffFilter(""); setActionFilter(""); setPage(1); }}
              className="text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Activity Table */}
      <div className="border rounded-md bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading activity...</div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No activity found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Staff Member</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Action</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Entity</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((entry) => {
                    const colors = getActionColor(entry.action);
                    const link = getEntityLink(entry.entityType, entry.entityId);
                    return (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-medium">
                            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(entry.createdAt), "MMM d, yyyy h:mm a")}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{entry.staffName}</div>
                          <div className="text-xs text-muted-foreground">{entry.staffEmail}</div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                          >
                            {formatActionLabel(entry.action)}
                          </span>
                        </td>
                        <td className="p-3">
                          {entry.entityType && entry.entityId ? (
                            link ? (
                              <Link
                                href={link}
                                className="text-primary hover:underline text-sm"
                              >
                                {entry.entityType} #{entry.entityId.slice(0, 8)}
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {entry.entityType} #{entry.entityId.slice(0, 8)}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[300px] truncate">
                          {entry.details || "--"}
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
