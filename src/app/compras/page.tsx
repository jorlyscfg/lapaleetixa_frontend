"use client";

import dynamic from "next/dynamic";

const ComprasPage = dynamic(() => import("./compras_page"), { ssr: false });

export default function Page() {
  return <ComprasPage />;
}
