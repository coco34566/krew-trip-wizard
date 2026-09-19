// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeExternalLink } from "@/components/krew/SafeExternalLink";

describe("SafeExternalLink",()=>{
 it("ne rend pas de lien pour javascript:",()=>{ const { container }=render(<SafeExternalLink href="javascript:alert(1)">Réserver</SafeExternalLink>); expect(container.querySelector("a")).toBeNull(); expect(screen.queryByText("Réserver")).toBeNull(); });
 it("rend une URL https sûre",()=>{ render(<SafeExternalLink href="https://example.com/path">Réserver</SafeExternalLink>); expect(screen.getByRole("link",{name:"Réserver"})).toHaveAttribute("href","https://example.com/path"); });
});
