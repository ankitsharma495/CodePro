import JSZip from "jszip";
import type { EditorCode } from "../types/editor";

function injectBefore(source: string, closingTag: RegExp, insertion: string) {
	if (closingTag.test(source))
		return source.replace(closingTag, `${insertion}$&`);
	return `${source}${insertion}`;
}

export function buildStandaloneHtml(code: EditorCode) {
	const css = code.css.replace(/<\/style/gi, "<\\/style");
	const javascript = code.javascript.replace(/<\/script/gi, "<\\/script");
	let html = injectBefore(
		code.html,
		/<\/head>/i,
		`<style>\n${css}\n</style>\n`,
	);
	html = injectBefore(
		html,
		/<\/body>/i,
		`<script>\n${javascript}\n</script>\n`,
	);
	return html;
}

export async function buildProjectZip(code: EditorCode) {
	const zip = new JSZip();
	zip.file("index.html", code.html);
	zip.file("styles.css", code.css);
	zip.file("script.js", code.javascript);
	return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function readProjectFile(file: File): Promise<EditorCode> {
	if (/\.zip$/i.test(file.name)) {
		const zip = await JSZip.loadAsync(file);
		const htmlFile = zip.file("index.html") ?? zip.file("index.htm");
		if (!htmlFile) throw new Error("The ZIP file must contain index.html.");
		const [html, css, javascript] = await Promise.all([
			htmlFile.async("string"),
			(zip.file("styles.css") ?? zip.file("style.css"))?.async("string") ?? "",
			(zip.file("script.js") ?? zip.file("app.js"))?.async("string") ?? "",
		]);
		return { html, css, javascript };
	}

	if (!/\.html?$/i.test(file.name)) {
		throw new Error("Choose an .html or .zip project file.");
	}
	return { html: await file.text(), css: "", javascript: "" };
}

export function downloadFile(name: string, content: BlobPart, type: string) {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
