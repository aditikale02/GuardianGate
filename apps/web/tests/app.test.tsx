import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Web App", () => {
  it("renders role portal", () => {
    render(<App />);
    expect(screen.getAllByText("GuardianGate").length).toBeGreaterThan(0);
    expect(screen.getByText("Student Login")).toBeTruthy();
    expect(screen.getByText("Admin Login")).toBeTruthy();
    expect(screen.getByText("Warden Login")).toBeTruthy();
  });

  it("stays on auth view when one-time session restore fails", async () => {
    localStorage.setItem("guardian_portal_access_token", "stale-token");

    let resolveMe: (value: Response) => void = () => {};
    const mePromise = new Promise<Response>((resolve) => {
      resolveMe = resolve;
    });

    vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/auth/me")) {
        return mePromise;
      }

      if (url.includes("/api/v1/auth/refresh")) {
        return Promise.resolve(new Response("", { status: 401 }));
      }

      return Promise.resolve(new Response("", { status: 404 }));
    });

    render(<App />);

    fireEvent.click(screen.getAllByText("Admin Login")[0]);
    expect(screen.getByText("ADMIN Authentication")).toBeTruthy();

    resolveMe(new Response("", { status: 401 }));

    await waitFor(() => {
      expect(screen.getByText("ADMIN Authentication")).toBeTruthy();
    });
  });

  it("redirects to dashboard when one-time session restore succeeds", async () => {
    localStorage.setItem("guardian_portal_access_token", "valid-token");

    vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/auth/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: "u-admin-1",
                name: "Admin User",
                email: "admin@guardian.com",
                role: "ADMIN",
                first_login: false,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(new Response("", { status: 404 }));
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("ADMIN workspace")).toBeTruthy();
      expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    });
  });
});
