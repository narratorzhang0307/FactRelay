import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("installable PWA shell", () => {
  it("declares standalone mobile icons and a product shortcut", async () => {
    const manifest = JSON.parse(await readFile(new URL("public/manifest.webmanifest", root), "utf8"));
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/?source=pwa");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]));
    expect(manifest.shortcuts[0].url).toBe("/#top");
  });

  it("keeps every verification and signal API request network-only", async () => {
    const worker = await readFile(new URL("public/sw.js", root), "utf8");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain("event.respondWith(fetch(request))");
    expect(worker).not.toMatch(/cache\.put\([^\n]*\/api\//);
  });
});
