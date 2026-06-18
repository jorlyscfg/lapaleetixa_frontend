import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import NotFound from "./not-found";

const mockReplace = vi.fn();

let mockCurrentUser: string | null = null;
let mockIsLoading = false;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock("frappe-react-sdk", () => ({
  useFrappeAuth: () => ({
    currentUser: mockCurrentUser,
    isLoading: mockIsLoading,
  }),
}));

describe("NotFound redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    mockIsLoading = false;
  });

  it.each([
    ["anonymous", null],
    ["authenticated", "user@example.com"],
  ])("redirects %s users to the app entry point", async (_label, user) => {
    mockCurrentUser = user;

    render(<NotFound />);

    expect(screen.getByText("Redirecting...")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("waits for auth resolution before redirecting", () => {
    mockIsLoading = true;

    render(<NotFound />);

    expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
