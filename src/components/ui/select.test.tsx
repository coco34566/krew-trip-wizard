// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Select, SelectTrigger, SelectValue } from "./select";

describe("SelectTrigger", () => {
  it("uses a wrap-safe 44px minimum instead of a fixed one-line height", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Choisir une option">
          <SelectValue placeholder="Une option avec un libellé volontairement long" />
        </SelectTrigger>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Choisir une option" });
    expect(trigger).toHaveClass("min-h-11");
    expect(trigger).not.toHaveClass("h-9", "whitespace-nowrap");
    expect(trigger.className).toContain("[&>span]:whitespace-normal");
    expect(trigger.className).toContain("[&>span]:break-words");
  });
});
