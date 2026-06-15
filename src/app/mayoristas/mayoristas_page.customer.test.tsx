import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import MayoristasPage from "./mayoristas_page";

const mockPush = vi.fn();

let mockCurrentUser: string | null = "customer@example.com";
const originalFrappeUrl = process.env.NEXT_PUBLIC_FRAPPE_URL;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("frappe-react-sdk", () => ({
  useFrappeAuth: () => ({
    currentUser: mockCurrentUser,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../components/custom_select", () => ({
  CustomSelect: ({ value }: { value: string }) => <div data-testid="custom-select">{value}</div>,
}));

vi.mock("../components/custom_date_picker", () => ({
  CustomDatePicker: ({ value }: { value: string }) => <div data-testid="custom-date-picker">{value}</div>,
}));

vi.mock("./admin_orders_panel", () => ({
  default: () => <div data-testid="admin-orders-panel" />,
}));

global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
  const url = String(input);

  if (url.includes("get_features")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: { client_name: "La Paletixa Test", colors: { primary: "#3498db" }, features: { wholesale: true } } }),
    } as Response);
  }

  if (url.includes("get_customer_wholesale_profile")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: { success: true, customer: "CUST-0001", customer_name: "Acme SA", email: "acme@example.com" } }),
    } as Response);
  }

  if (url.includes("get_active_items_with_prices")) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          message: [
            { name: "ITEM-0001", item_name: "Chocolate", item_group: "Helados", retail_price: 12.5, wholesale_price: 10, image: "/files/chocolate.png", actual_qty: 25 },
            { name: "ITEM-0002", item_name: "Vanilla", item_group: "Helados", retail_price: 11.0, wholesale_price: 9.5, image: null, actual_qty: 12 },
          ],
        }),
    } as Response);
  }

  if (url.includes("get_active_warehouses_with_stock")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: [{ name: "WH-0001", warehouse_name: "Distribucion Central" }] }),
    } as Response);
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ message: {} }),
  } as Response);
});

describe("MayoristasPage customer layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = "customer@example.com";
    process.env.NEXT_PUBLIC_FRAPPE_URL = "https://frappe.test";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FRAPPE_URL = originalFrappeUrl;
  });

  it("keeps the customer product card edge-to-edge", async () => {
    const { container } = render(<MayoristasPage />);

    await screen.findByText("Opciones del Pedido");
    const productImage = await screen.findByRole("img", { name: "Chocolate" });
    const imageWrapper = productImage.parentElement;
    const detailsWrapper = imageWrapper?.nextElementSibling as HTMLElement | null;
    const actionsWrapper = detailsWrapper?.nextElementSibling as HTMLElement | null;

    expect(screen.queryByText("Tus Datos de Cliente")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cerrar sesión/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Catálogo de Productos Mayorista/)).toBeInTheDocument();
    const productCard = productImage.parentElement?.parentElement;
    expect(productCard).toHaveClass("rounded-3xl");
    expect(productCard).toHaveClass("p-4");
    expect(productCard).toHaveClass("sm:p-5");
    expect(productCard).toHaveClass("flex");
    expect(productCard).toHaveClass("flex-col");
    expect(productCard).toHaveClass("overflow-hidden");
    expect(productCard).not.toHaveClass("aspect-square");
    expect(productCard).not.toHaveClass("h-[260px]");
    expect(imageWrapper).toHaveClass("aspect-square");
    expect(imageWrapper).toHaveClass("rounded-2xl");
    expect(imageWrapper).toHaveClass("mb-4");
    expect(imageWrapper).toHaveClass("overflow-hidden");
    expect(imageWrapper).toHaveClass("relative");
    expect(detailsWrapper).toHaveClass("min-w-0");
    expect(actionsWrapper).toHaveClass("mt-4");
    expect(productImage).toHaveClass("bg-cover");
    expect(productImage).toHaveClass("bg-center");
    expect(productImage).not.toHaveClass("bg-contain");
    expect(productImage).toHaveStyle({ backgroundImage: 'url("https://frappe.test/files/chocolate.png")' });

    const vanillaCard = screen.getByText("Vanilla").closest("div")?.parentElement as HTMLElement | null;
    expect(vanillaCard?.querySelector("svg")).toHaveClass("h-10", "w-10", "text-slate-600");
    expect(screen.queryByText("🍦")).not.toBeInTheDocument();

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form?.className).toContain("grid-cols-1");
    expect(form?.className).not.toContain("lg:grid-cols-12");
    expect(form?.className).toContain("pb-[calc(11rem+env(safe-area-inset-bottom))]");
  });

  it("uses the shared production-style product card for admin users", async () => {
    mockCurrentUser = "admin@example.com";

    const { container } = render(<MayoristasPage />);

    await screen.findByText("Almacén de Salida y Fecha");
    const productImage = await screen.findByRole("img", { name: "Chocolate" });
    const imageWrapper = productImage.parentElement;
    const detailsWrapper = imageWrapper?.nextElementSibling as HTMLElement | null;
    const actionsWrapper = detailsWrapper?.nextElementSibling as HTMLElement | null;

    expect(screen.queryByText("Opciones del Pedido")).not.toBeInTheDocument();
    expect(screen.getByText("Almacén de Salida y Fecha")).toBeInTheDocument();
    const productCard = productImage.parentElement?.parentElement;
    expect(productCard).toHaveClass("rounded-3xl");
    expect(productCard).toHaveClass("p-4");
    expect(productCard).toHaveClass("sm:p-5");
    expect(productCard).toHaveClass("flex");
    expect(productCard).toHaveClass("flex-col");
    expect(productCard).toHaveClass("overflow-hidden");
    expect(productCard).not.toHaveClass("h-[260px]");
    expect(imageWrapper).toHaveClass("aspect-square");
    expect(imageWrapper).toHaveClass("rounded-2xl");
    expect(imageWrapper).toHaveClass("mb-4");
    expect(imageWrapper).toHaveClass("overflow-hidden");
    expect(imageWrapper).toHaveClass("relative");
    expect(detailsWrapper).toHaveClass("min-w-0");
    expect(actionsWrapper).toHaveClass("mt-4");
    expect(actionsWrapper).toHaveClass("shrink-0");
    expect(productImage).toHaveClass("bg-cover");
    expect(productImage).toHaveClass("bg-center");
    expect(productImage).not.toHaveClass("bg-contain");
    expect(productImage).toHaveStyle({ backgroundImage: 'url("https://frappe.test/files/chocolate.png")' });

    expect(container.querySelector("input[type='number']")).toBeInTheDocument();
    expect(within(productCard as HTMLElement).getByText("Stock:")).toBeInTheDocument();
    expect(screen.getByText("25 pz")).toBeInTheDocument();
  });
});
