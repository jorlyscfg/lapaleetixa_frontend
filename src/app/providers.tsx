"use client";

import React from "react";
import { FrappeProvider } from "frappe-react-sdk";

export function Providers({ children }: { children: React.ReactNode }) {
  // Usamos ruta relativa por defecto para pasar a través del proxy de Next.js
  const url = process.env.NEXT_PUBLIC_FRAPPE_URL || "";
  
  return (
    <FrappeProvider
      url={url}
      enableSocket={false}
    >
      {children}
    </FrappeProvider>
  );
}
