import { describe, expect, it } from "bun:test";
import { cn } from "@/lib/utils";

// Dummy test to check if test environment is running smoothly with progress / helper logic
describe("Design System Helpers", () => {
  it("concatenates classes correctly", () => {
    const result = cn("text-success", "bg-success/15");
    expect(result).toContain("text-success");
    expect(result).toContain("bg-success/15");
  });
});
