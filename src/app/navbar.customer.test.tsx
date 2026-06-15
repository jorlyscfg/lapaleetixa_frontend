import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Navbar } from "./navbar";

const mockPush = vi.fn();
const mockLogout = vi.fn();

let mockCurrentUser: string | null | undefined = "customer@example.com";
let mockPathname = "/c/acme/mayoristas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

vi.mock("frappe-react-sdk", () => ({
  useFrappeAuth: () => ({
    currentUser: mockCurrentUser,
    logout: mockLogout,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("./providers", () => ({
  useSaaSConfig: () => ({
    saasConfig: {
      client_name: "La Paletixa Test",
      colors: { primary: "#3498db" },
      features: { pos: true, production: true },
    },
  }),
}));

global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
  const url = String(input);

  if (url.includes("get_customer_wholesale_profile")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: { success: true } }),
    } as Response);
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ message: {} }),
  } as Response);
});

describe("Navbar customer view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = "customer@example.com";
    mockPathname = "/c/acme/mayoristas";
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("keeps the navbar visible but hides admin-only controls", async () => {
    render(<Navbar />);

    expect(screen.getByText("customer@example.com")).toBeInTheDocument();
    expect(screen.getByTitle("Cerrar Sesión")).toBeInTheDocument();
    expect(screen.getByTitle(/Cambiar a Modo/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTitle("Abrir Menú")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Notificaciones")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Asistente de IA")).not.toBeInTheDocument();
      expect(screen.queryByText("Cliente Mayorista")).not.toBeInTheDocument();
    });
  });

  it("restores the persisted theme after refresh and toggles it in one click", async () => {
    localStorage.setItem("theme", "light");
    document.documentElement.classList.add("dark");

    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByTitle("Cambiar a Modo Oscuro")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Cambiar a Modo Oscuro"));

    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByTitle("Cambiar a Modo Claro")).toBeInTheDocument();
  });

  it("does not crash when there is no authenticated user", () => {
    mockCurrentUser = null;

    const { container } = render(<Navbar />);

    expect(container).toBeEmptyDOMElement();
  });
});
