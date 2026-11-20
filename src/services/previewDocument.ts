import type { EditorCode } from "../types/editor";

const CONSOLE_BRIDGE = `
(function () {
  var marker = "__codeproPreview";
  function printable(value) {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }
  function send(level, args) {
    var message = Array.prototype.map.call(args, printable).join(" ");
    parent.postMessage({ marker: marker, level: level, message: message, timestamp: Date.now() }, "*");
  }
  ["log", "info", "warn", "error"].forEach(function (level) {
    var original = console[level].bind(console);
    console[level] = function () {
      send(level, arguments);
      original.apply(console, arguments);
    };
  });
  window.addEventListener("error", function (event) {
    send("error", [event.message || "Uncaught preview error"]);
  });
  window.addEventListener("unhandledrejection", function (event) {
    send("error", ["Unhandled promise rejection:", event.reason]);
  });
})();
`;

export default function buildPreviewDocument(code: EditorCode): string {
	const safeCss = code.css.replace(/<\/style/gi, "<\\/style");
	const safeJavascript = code.javascript.replace(/<\/script/gi, "<\\/script");
	return `<!doctype html><html><head><meta charset="utf-8"><style>${safeCss}</style><script>${CONSOLE_BRIDGE}</script></head><body>${code.html}<script>${safeJavascript}</script></body></html>`;
}
