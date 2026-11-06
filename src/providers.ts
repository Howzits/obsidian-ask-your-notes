import type { ProviderId } from "./types";

export interface ProviderPreset {
	label: string;
	endpoint: string;
	model: string;
	keyRequired: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderPreset> = {
	deepseek: {
		label: "DeepSeek",
		endpoint: "https://api.deepseek.com/chat/completions",
		model: "deepseek-chat",
		keyRequired: true,
	},
	openai: {
		label: "OpenAI",
		endpoint: "https://api.openai.com/v1/chat/completions",
		model: "gpt-4o-mini",
		keyRequired: true,
	},
	openrouter: {
		label: "OpenRouter",
		endpoint: "https://openrouter.ai/api/v1/chat/completions",
		model: "openai/gpt-4o-mini",
		keyRequired: true,
	},
	ollama: {
		label: "Ollama (local)",
		endpoint: "http://localhost:11434/v1/chat/completions",
		model: "llama3.1",
		keyRequired: false,
	},
	custom: {
		label: "Custom",
		endpoint: "",
		model: "",
		keyRequired: false,
	},
};

export const PROVIDER_ORDER: ProviderId[] = [
	"deepseek",
	"openai",
	"openrouter",
	"ollama",
	"custom",
];
