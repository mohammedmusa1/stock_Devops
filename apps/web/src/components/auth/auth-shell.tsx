"use client";

import { motion } from "framer-motion";
import { PublicHeader } from "@/components/layout/public-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid-bg flex min-h-screen flex-col"
    >
      <PublicHeader />

      <div className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="neon-text text-2xl">{title}</CardTitle>
              {subtitle && <CardDescription>{subtitle}</CardDescription>}
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
