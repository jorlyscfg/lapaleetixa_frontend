import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RegistroPageClient } from "./registro_client";

const push = vi.fn();
let mockSubdomain: string | null = null;
let mockToken: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "subdomain" ? mockSubdomain : key === "token" ? mockToken : null),
  }),
}));

describe("RegistroPageClient", () => {
  beforeEach(() => {
    mockSubdomain = null;
    mockToken = null;
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { status: "In Progress" } }),
      }),
    );
  });

  it("renders the default company-creation form when no subdomain query param is present", () => {
    render(<RegistroPageClient />);

    expect(screen.getByText("Creá tu Inquilino Corporativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear Compañía Dedicada" })).toBeInTheDocument();
    expect(screen.queryByText("Desplegando tu Empresa")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("mi-empresa")).toHaveValue("");
  });

  it("toggles password visibility in the registration form", () => {
    render(<RegistroPageClient />);

    const passwordInput = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    fireEvent.click(screen.getByTitle("Mostrar Contraseña"));

    expect(passwordInput.type).toBe("text");
    expect(screen.getByTitle("Ocultar Contraseña")).toBeInTheDocument();
  });

  it("keeps the provisioning flow when subdomain is present in the URL", async () => {
    mockSubdomain = "acme";
    mockToken = "token-123";

    render(<RegistroPageClient />);

    await waitFor(() => {
      expect(screen.getByText("Desplegando tu Empresa")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Crear Compañía Dedicada" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Creando base de datos MariaDB...").length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/method/paletixa_saas.paletixa_saas.api.get_tenant_status?subdomain=acme&token=token-123",
    );
  });

  it("keeps the provisioning flow and pushes the updated subdomain after a successful submit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { request_token: "request-token-123" } }),
      })
      .mockImplementationOnce(() => new Promise(() => {}));

    vi.stubGlobal("fetch", fetchMock);

    render(<RegistroPageClient />);

    fireEvent.change(screen.getByPlaceholderText("Mi Empresa S.A."), {
      target: { value: "Acme Corp" },
    });
    fireEvent.change(screen.getByPlaceholderText("mi-empresa"), {
      target: { value: "acme" },
    });
    fireEvent.change(screen.getByPlaceholderText("admin@miempresa.com"), {
      target: { value: "admin@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "secret123" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Crear Compañía Dedicada" }).closest("form") as HTMLFormElement);

    expect(await screen.findByText("Desplegando tu Empresa")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/method/paletixa_saas.paletixa_saas.api.request_tenant",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subdomain: "acme",
          company_name: "Acme Corp",
          admin_email: "admin@acme.com",
          admin_password: "secret123",
        }),
      },
    );
    expect(push).toHaveBeenCalledWith("/registro?subdomain=acme&token=request-token-123");
  });
});
