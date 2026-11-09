import { requestUrl } from "obsidian";
import type { ChatMessage } from "./types";

export interface ChatOptions {
	endpoint: string;
	apiKey: string;
	model: string;
	messages: ChatMessage[];
	temperature: number;
	maxTokens: number;
	signal?: AbortSignal;
	onDelta?: (delta: string, full: string) => void;
}

function buildHeaders(apiKey: string): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
	return headers;
}

function buildBody(options: ChatOptions, stream: boolean): string {
	const payload: Record<string, unknown> = {
		model: options.model,
		messages: options.messages,
		temperature: options.temperature,
		stream,
	};
	if (options.maxTokens > 0) payload.max_tokens = options.maxTokens;
	return JSON.stringify(payload);
}

function parseError(status: number, text: string): string {
	try {
		const json = JSON.parse(text) as { error?: { message?: string } };
		if (json.error?.message) return `HTTP ${status}: ${json.error.message}`;
	} catch {
		// not JSON — fall through
	}
	return `HTTP ${status}: ${text.slice(0, 300)}`;
}

/** requestUrl cannot cancel its transport; stop waiting and ignore late results. */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) return promise;
	return new Promise<T>((resolve, reject) => {
		const abort = () => reject(new DOMException("Aborted", "AbortError"));
		if (signal.aborted) { abort(); return; }
		signal.addEventListener("abort", abort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
	});
}

/** Non-streaming request via requestUrl (works on desktop and mobile). */
export async function chatCompletion(options: ChatOptions): Promise<string> {
	if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
	const response = await withAbort(requestUrl({
		url: options.endpoint,
		method: "POST",
		headers: buildHeaders(options.apiKey),
		body: buildBody(options, false),
		throw: false,
	}), options.signal);

	if (response.status < 200 || response.status >= 300) {
		throw new Error(parseError(response.status, response.text));
	}

	const content = response.json?.choices?.[0]?.message?.content;
	if (typeof content !== "string" || content.length === 0) {
		throw new Error("Empty response from the API");
	}
	return content;
}

/** Streaming request via fetch + SSE (desktop). */
export async function chatCompletionStream(
	options: ChatOptions
): Promise<string> {
	const response = await fetch(options.endpoint, {
		method: "POST",
		headers: buildHeaders(options.apiKey),
		body: buildBody(options, true),
		signal: options.signal,
	});

	if (!response.ok) {
		throw new Error(parseError(response.status, await response.text()));
	}
	if (!response.body) {
		throw new Error("Streaming is not supported in this environment");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let buffer = "";
	let full = "";
	const consume = (line: string): boolean => {
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) return false;
		const data = trimmed.slice(5).trim();
		if (data === "[DONE]") return true;
		let parsed: { error?: { message?: string }; choices?: Array<{ delta?: { content?: string } }> };
		try { parsed = JSON.parse(data); } catch { return false; }
		if (parsed.error) throw new Error(parsed.error.message ?? "Stream error");
		const delta = parsed.choices?.[0]?.delta?.content;
		if (typeof delta === "string" && delta.length > 0) {
			full += delta;
			options.onDelta?.(delta, full);
		}
		return false;
	};

	try {
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			buffer += decoder.decode();
			if (buffer.trim()) consume(buffer);
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			if (consume(line)) return full;
		}
	}
	return full;
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
