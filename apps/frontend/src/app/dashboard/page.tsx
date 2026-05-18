"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BarChart3, Package, Users, DollarSign } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

async function fetchMe(): Promise<UserProfile> {
  const res = await api.get<ApiResponse<UserProfile>>("/auth/me");
  return res.data.data;
}

const stats = [
  { label: "Revenue", value: "₹0", icon: DollarSign, note: "Connect orders API" },
  { label: "Orders", value: "0", icon: Package, note: "Phase 2" },
  { label: "Users", value: "—", icon: Users, note: "Admin analytics" },
  { label: "Products", value: "—", icon: BarChart3, note: "Inventory module" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
  });

  if (!isLoading && error) {
    router.replace("/login");
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        {user && (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Welcome, {user.firstName} {user.lastName} ({user.role})
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">{stat.label}</CardTitle>
              <stat.icon className="h-5 w-5 text-violet-600" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-zinc-500">{stat.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Dashboard Roadmap</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
          <p>✅ Authentication &amp; RBAC foundation</p>
          <p>⏳ Sales analytics &amp; revenue graphs</p>
          <p>⏳ Order &amp; inventory management UI</p>
          <p>⏳ Coupon admin panel</p>
          <p>⏳ Shipment tracking</p>
        </CardContent>
      </Card>
    </div>
  );
}
