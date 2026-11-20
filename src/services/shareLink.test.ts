// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeShareHash, encodeShareLink } from "./shareLink";

const sample = {
	html: "<h1>Hello</h1>",
	css: "h1 { color: blue; }",
	javascript: "console.log('ready')",
};

describe("compressed share links", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("round-trips all editor panes through the URL hash", async () => {
		vi.stubGlobal("window", {
			CompressionStream: globalThis.CompressionStream,
			DecompressionStream: globalThis.DecompressionStream,
		});
		const url = await encodeShareLink(sample, "https://example.test/editor");
		expect(new URL(url).hash).toMatch(/^#code=[A-Za-z0-9_-]+$/);
		expect(await decodeShareHash(new URL(url).hash)).toEqual(sample);
	});

	it("rejects malformed hashes with a recoverable error", async () => {
		vi.stubGlobal("window", {
			DecompressionStream: globalThis.DecompressionStream,
		});
		await expect(decodeShareHash("#code=not-a-valid-gzip")).rejects.toThrow(
			/corrupt|valid/i,
		);
	});
});
