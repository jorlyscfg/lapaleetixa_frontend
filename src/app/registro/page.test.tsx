import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const suspended = new Promise(() => {});

vi.mock("./registro_client", () => ({
  RegistroPageClient: () => {
    throw suspended;
  },
}));

import RegistroPage from "./page";

describe("RegistroPage", () => {
  it("renders the Suspense fallback while the client subtree is suspended", async () => {
    const { container } = render(<RegistroPage />);

    await waitFor(() => {
      expect(container.querySelector(".min-h-screen.bg-slate-950")).not.toBeNull();
    });
  });
});
