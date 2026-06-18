"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFrappeAuth } from "frappe-react-sdk";

export default function NotFound() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useFrappeAuth();

  useEffect(() => {
    if (authLoading) return;

    // Root already resolves to the correct dashboard/login entry point.
    router.replace("/");
  }, [authLoading, currentUser, router]);

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-900 px-4 text-slate-100 font-sans">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-sky-500" />
        <p className="text-sm font-medium tracking-wide">Redirecting...</p>
      </div>
    </div>
  );
}
