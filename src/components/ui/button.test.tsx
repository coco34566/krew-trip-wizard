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
    const label = button.querySelector("[data-krew-button-label]");

    expect(button).toHaveClass("min-h-10");
    expect(button).not.toHaveClass("h-10");
    expect(label).toHaveClass("whitespace-normal", "break-words", "text-center");
  });

  it("keeps a leading icon in symmetric side columns so the label stays optically centered", () => {
    render(
      <Button>
        <svg aria-hidden="true" data-testid="button-icon" />
        Continuer
      </Button>,
    );

    const button = screen.getByRole("button");
    const icon = screen.getByTestId("button-icon");
    const content = button.querySelector("[data-krew-button-content]");
    const label = button.querySelector("[data-krew-button-label]");

    expect(content).toContainElement(icon);
    expect(content).toHaveClass("grid-cols-[1rem_minmax(0,auto)_1rem]");
    expect(label).toHaveTextContent("Continuer");
    expect(button.querySelector(":scope > svg")).not.toBeInTheDocument();
  });

  it("keeps a trailing icon symmetric as well", () => {
    render(
      <Button>
        Continuer
        <svg aria-hidden="true" data-testid="trailing-icon" />
      </Button>,
    );

    const button = screen.getByRole("button");
    const content = button.querySelector("[data-krew-button-content]");
    const label = button.querySelector("[data-krew-button-label]");

    expect(content).toHaveClass("grid-cols-[1rem_minmax(0,auto)_1rem]");
    expect(label).toHaveTextContent("Continuer");
    expect(content?.lastElementChild).toContainElement(screen.getByTestId("trailing-icon"));
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
    expect(link.querySelector("[data-krew-button-label]")).toHaveTextContent(
      "Voir d’autres propositions",
    );
  });
});
