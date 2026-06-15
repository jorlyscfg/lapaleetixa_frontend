import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatalogImageTile, normalizeFrappeImageSrc } from "./catalog_image_tile";

describe("CatalogImageTile", () => {
  const originalFrappeUrl = process.env.NEXT_PUBLIC_FRAPPE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_FRAPPE_URL = "https://frappe.test";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FRAPPE_URL = originalFrappeUrl;
  });

  it("normalizes relative Frappe paths and renders overlay children", () => {
    render(
      <CatalogImageTile
        className="aspect-square w-full"
        src="/files/chocolate.png"
        alt="Chocolate"
        imageClassName="group-hover:scale-105 transition-transform duration-300"
      >
        <span data-testid="overlay">New</span>
      </CatalogImageTile>
    );

    const tile = screen.getByRole("img", { name: "Chocolate" });

    expect(tile).toHaveClass("bg-cover");
    expect(tile).toHaveClass("bg-center");
    expect(tile).toHaveStyle({ backgroundImage: 'url("https://frappe.test/files/chocolate.png")' });
    expect(screen.getByTestId("overlay")).toBeInTheDocument();
  });

  it("renders the shared production-style fallback by default", () => {
    const { container } = render(
      <CatalogImageTile
        className="h-12 w-12"
        alt="Company logo"
        mode="contain"
      />
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveClass("h-10", "w-10", "text-slate-600");
    expect(screen.queryByText("🍦")).not.toBeInTheDocument();
  });

  it("still allows a custom fallback override", () => {
    render(
      <CatalogImageTile
        className="h-12 w-12"
        alt="Company logo"
        fallback="🍦"
        fallbackClassName="text-3xl"
      />
    );

    expect(screen.getByText("🍦")).toHaveClass("text-3xl");
  });

  it("keeps absolute URLs untouched", () => {
    expect(normalizeFrappeImageSrc("https://example.com/image.png")).toBe("https://example.com/image.png");
  });
});
