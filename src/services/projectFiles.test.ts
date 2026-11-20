// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	buildProjectZip,
	buildStandaloneHtml,
	readProjectFile,
} from "./projectFiles";

const sample = {
	html: "<!doctype html><html><head></head><body><h1>Hi</h1></body></html>",
	css: "h1 { color: blue; }",
	javascript: "console.log('ready')",
};

describe("project files", () => {
	it("embeds CSS and JavaScript in the standalone HTML export", () => {
		const html = buildStandaloneHtml(sample);
		expect(html).toContain("<style>\nh1 { color: blue; }\n</style>");
		expect(html).toContain("<script>\nconsole.log('ready')\n</script>");
	});

	it("round-trips the three editor files through ZIP", async () => {
		const zipBlob = await buildProjectZip(sample);
		const zipFile = new File([zipBlob], "project.zip", {
			type: "application/zip",
		});
		expect(await readProjectFile(zipFile)).toEqual(sample);
	});
});
