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

/** Non-streaming request via requestUrl (works on desktop and mobile). */
export async function chatCompletion(options: ChatOptions): Promise<string> {
	const response = await requestUrl({
		url: options.endpoint,
		method: "POST",
		headers: buildHeaders(options.apiKey),
		body: buildBody(options, false),
		throw: false,
	});

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

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;

			const data = trimmed.slice(5).trim();
			if (data === "[DONE]") return full;

			let json: unknown;
			try {
				json = JSON.parse(data);
			} catch {
				continue;
			}

			const parsed = json as {
				error?: { message?: string };
				choices?: Array<{ delta?: { content?: string } }>;
			};
			if (parsed.error) {
				throw new Error(parsed.error.message ?? "Stream error");
			}

			const delta = parsed.choices?.[0]?.delta?.content;
			if (typeof delta === "string" && delta.length > 0) {
				full += delta;
				options.onDelta?.(delta, full);
			}
		}
	}

	return full;
}
