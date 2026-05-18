"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { api, type ApiResponse } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Product {
  id: string;
  name: string;
  slug: string;
  basePrice: string;
  images: { url: string; alt: string | null }[];
  category: { name: string; slug: string };
  inventory: { quantity: number } | null;
}

interface ProductsResponse {
  data: Product[];
  meta: { page: number; total: number; totalPages: number };
}

async function fetchProducts(): Promise<ProductsResponse> {
  const res = await api.get<ApiResponse<Product[]> & { meta: ProductsResponse["meta"] }>("/products");
  return { data: res.data.data, meta: (res.data as unknown as ProductsResponse).meta };
}

export default function ProductsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-zinc-500">
        Loading products...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-red-500">
        Failed to load products. Is the backend running on port 4000?
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold">Products</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {data?.meta.total ?? 0} products available
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data?.data.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link href={`/products/${product.slug}`}>
              <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                <div className="aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {product.images[0] && (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].alt ?? product.name}
                      className="h-full w-full object-cover transition-transform hover:scale-105"
                    />
                  )}
                </div>
                <CardHeader className="pb-2">
                  <p className="text-xs text-violet-600">{product.category.name}</p>
                  <CardTitle className="text-base line-clamp-2">{product.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold">{formatCurrency(Number(product.basePrice))}</p>
                  <p className="text-xs text-zinc-500">
                    {product.inventory?.quantity ?? 0} in stock
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
