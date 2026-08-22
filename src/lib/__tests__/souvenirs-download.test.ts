import { describe, expect, it } from "vitest";
import { uniqueZipFileNames } from "@/lib/souvenirs-download";

describe("uniqueZipFileNames", () => {
  it("keeps every photo when filenames collide", () => {
    const names = uniqueZipFileNames([
      { name: "IMG_1234.jpg", url: "https://example.test/1" },
      { name: "IMG_1234.jpg", url: "https://example.test/2" },
      { name: "IMG_1234.jpg", url: "https://example.test/3" },
    ]);

    expect(names).toEqual(["IMG_1234.jpg", "IMG_1234 (2).jpg", "IMG_1234 (3).jpg"]);
  });

  it("provides a safe fallback for empty filenames", () => {
    expect(uniqueZipFileNames([{ name: "", url: "https://example.test/1" }])).toEqual(["photo.jpg"]);
  });
});
