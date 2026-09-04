// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KrewMark } from "./KrewMark";

describe("KrewMark underline rendering", () => {
  it("stretches the group title wave across its requested SVG width", () => {
    const { container } = render(
      <KrewMark
        type="underline-wave"
        tone="sage"
        size="sm"
        className="krew-group-title-underline"
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    expect(svg).toHaveAttribute("viewBox", "0 28 100 20");
  });

  it("does not stretch unrelated marks", () => {
    const { container } = render(<KrewMark type="sparkle" size="sm" />);

    expect(container.querySelector("svg")).not.toHaveAttribute("preserveAspectRatio");
  });
});
