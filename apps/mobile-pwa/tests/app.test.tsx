import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";

describe("Mobile App", () => {
  it("renders login screen", () => {
    render(<App />);
    expect(screen.getByText("Guardian App Login")).toBeTruthy();
  });
});
