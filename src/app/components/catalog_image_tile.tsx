"use client";

import React from "react";

type CatalogImageTileMode = "cover" | "contain";

export const CATALOG_IMAGE_TILE_DEFAULT_FALLBACK = (
  <svg className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

export interface CatalogImageTileProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt: string;
  mode?: CatalogImageTileMode;
  fallback?: React.ReactNode;
  fallbackClassName?: string;
  imageClassName?: string;
}

const ROOT_CLASS_NAME =
  "relative flex items-center justify-center overflow-hidden rounded-2xl border border-slate-850 bg-slate-900 text-slate-700";

const MODE_CLASS_NAME: Record<CatalogImageTileMode, string> = {
  cover: "bg-cover bg-center",
  contain: "bg-contain bg-center bg-no-repeat",
};

function joinClasses(...values: Array<string | undefined | false | null>) {
  return values.filter(Boolean).join(" ");
}

export function normalizeFrappeImageSrc(src?: string | null) {
  const value = src?.trim();

  if (!value) {
    return null;
  }

  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(value)) {
    return value;
  }

  const baseUrl = process.env.NEXT_PUBLIC_FRAPPE_URL || "";

  if (!baseUrl) {
    return value;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  return `${normalizedBase}${normalizedPath}`;
}

export function CatalogImageTile({
  src,
  alt,
  mode = "cover",
  fallback,
  fallbackClassName = "text-2xl",
  imageClassName = "",
  className = "",
  children,
  ...divProps
}: CatalogImageTileProps) {
  const normalizedSrc = normalizeFrappeImageSrc(src);

  return (
    <div className={joinClasses(ROOT_CLASS_NAME, className)} {...divProps}>
      {normalizedSrc ? (
        <div
          role="img"
          aria-label={alt}
          className={joinClasses("h-full w-full", MODE_CLASS_NAME[mode], imageClassName)}
          style={{ backgroundImage: `url(${JSON.stringify(normalizedSrc)})` }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          {typeof fallback === "string" || typeof fallback === "number" ? (
            <span className={fallbackClassName}>{fallback}</span>
          ) : (
            fallback ?? CATALOG_IMAGE_TILE_DEFAULT_FALLBACK
          )}
        </div>
      )}

      {children ? <div className="absolute inset-0 z-10">{children}</div> : null}
    </div>
  );
}
