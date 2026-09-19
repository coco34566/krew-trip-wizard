import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, safeExternalUrl } from "../safe-url";
describe("safeExternalUrl",()=>{
 it.each(["javascript:alert(1)","data:text/html,x","http://example.com","vbscript:msgbox(1)","java\nscript:alert(1)","JAVASCRIPT:alert(1)","/relative","","https://user:pass@example.com"])("rejects %s",v=>expect(safeExternalUrl(v)).toBeNull());
 it("rejects non strings and too long",()=>{expect(safeExternalUrl(42)).toBeNull();expect(safeExternalUrl("https://example.com/"+"a".repeat(2050))).toBeNull();});
 it("accepts https",()=>{expect(safeExternalUrl(" https://example.com/path?q=1 ")).toBe("https://example.com/path?q=1");expect(isSafeExternalUrl("https://example.com")).toBe(true);});
});
