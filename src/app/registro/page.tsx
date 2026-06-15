import { Suspense } from "react";
import { RegistroPageClient } from "./registro_client";

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <RegistroPageClient />
    </Suspense>
  );
}
