"use client";

import dynamic from "next/dynamic";

const LogisticsPage = dynamic(() => import("./logistica_page"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500"></div>
        <p className="text-sm font-medium tracking-wide animate-pulse">Cargando Módulo de Logística...</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <LogisticsPage />;
}
