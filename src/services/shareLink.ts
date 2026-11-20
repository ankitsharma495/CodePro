import type { EditorCode } from "../types/editor";

const HASH_PREFIX = "#code=";
const MAX_COMPRESSED_BYTES = 1_500_000;
const MAX_DECOMPRESSED_BYTES = 4_000_000;

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(
			...bytes.subarray(offset, offset + chunkSize),
		);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function base64UrlToBytes(encoded: string): Uint8Array {
	if (!/^[A-Za-z0-9_-]*$/.test(encoded))
		throw new Error("The share link is not valid.");
	const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isEditorCode(value: unknown): value is EditorCode {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return ["html", "css", "javascript"].every(
		(language) => typeof record[language] === "string",
	);
}

async function readDecompressedText(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let text = "";
	let byteLength = 0;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			byteLength += value.byteLength;
			if (byteLength > MAX_DECOMPRESSED_BYTES) {
				await reader.cancel();
				throw new Error("This share link expands to too much data.");
			}
			text += decoder.decode(value, { stream: true });
		}
		return text + decoder.decode();
	} finally {
		reader.releaseLock();
	}
}

export async function encodeShareLink(
	code: EditorCode,
	currentUrl = window.location.href,
) {
	if (!("CompressionStream" in window)) {
		throw new Error(
			"Compressed share links are not supported by this browser.",
		);
	}
	const json = JSON.stringify(code);
	const compressed = new Uint8Array(
		await new Response(
			new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
		).arrayBuffer(),
	);
	if (compressed.byteLength > MAX_COMPRESSED_BYTES) {
		throw new Error("This project is too large to fit in a share link.");
	}
	const url = new URL(currentUrl);
	url.hash = `${HASH_PREFIX.slice(1)}${bytesToBase64Url(compressed)}`;
	return url.toString();
}

export async function decodeShareHash(hash: string): Promise<EditorCode> {
	if (!hash.startsWith(HASH_PREFIX))
		throw new Error("The share link is not valid.");
	if (!("DecompressionStream" in window)) {
		throw new Error(
			"Compressed share links are not supported by this browser.",
		);
	}
	const compressed = base64UrlToBytes(hash.slice(HASH_PREFIX.length));
	if (compressed.byteLength > MAX_COMPRESSED_BYTES) {
		throw new Error("This share link is too large.");
	}
	try {
		const decompressed = new Blob([
			compressed.buffer.slice(
				compressed.byteOffset,
				compressed.byteOffset + compressed.byteLength,
			) as ArrayBuffer,
		])
			.stream()
			.pipeThrough(new DecompressionStream("gzip"));
		const json = await readDecompressedText(decompressed);
		const parsed: unknown = JSON.parse(json);
		if (!isEditorCode(parsed))
			throw new Error("The share link does not contain editor code.");
		return parsed;
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message.startsWith("The share link") ||
				error.message.startsWith("This share link"))
		) {
			throw error;
		}
		throw new Error("This share link is corrupt or incomplete.", {
			cause: error,
		});
	}
}
