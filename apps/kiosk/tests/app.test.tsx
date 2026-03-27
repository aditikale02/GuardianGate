import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";

describe("Kiosk App", () => {
  it("renders login screen", () => {
    render(<App />);
    expect(screen.getByText("GuardianGate Kiosk Login")).toBeTruthy();
  });
});
