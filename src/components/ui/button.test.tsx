// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("lets long labels wrap without turning the minimum height into a clipping ceiling", () => {
    render(
      <Button className="w-36">
        Un libellé volontairement long qui doit pouvoir passer sur deux lignes
      </Button>,
    );

    const button = screen.getByRole("button");
    const content = button.querySelector("[data-krew-button-content]");

    expect(button).toHaveClass("min-h-10");
    expect(button).not.toHaveClass("h-10");
    expect(content).toHaveClass("whitespace-normal", "break-words", "text-center");
  });

  it("keeps icons inside the centered content flow instead of as direct button children", () => {
    render(
      <Button>
        <svg aria-hidden="true" data-testid="button-icon" />
        Continuer
      </Button>,
    );

    const button = screen.getByRole("button");
    const icon = screen.getByTestId("button-icon");
    const content = button.querySelector("[data-krew-button-content]");

    expect(content).toContainElement(icon);
    expect(button.querySelector(":scope > svg")).not.toBeInTheDocument();
  });

  it("preserves the child element when using asChild", () => {
    render(
      <Button asChild>
        <a href="/destination">Voir d’autres propositions</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Voir d’autres propositions" });
    expect(link).toHaveAttribute("href", "/destination");
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link.querySelector("[data-krew-button-content]")).toHaveTextContent(
      "Voir d’autres propositions",
    );
  });
});
