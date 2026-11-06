export type ProviderId = "deepseek" | "openai" | "openrouter" | "ollama" | "custom";

export type UILanguage = "auto" | "en" | "zh";

export interface PluginSettings {
	provider: ProviderId;
	apiEndpoint: string;
	apiKey: string;
	model: string;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
	stream: boolean;
	includeActiveNote: boolean;
	preferSelection: boolean;
	maxContextChars: number;
	persistHistory: boolean;
	language: UILanguage;
}

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface PluginData {
	settings: PluginSettings;
	history: ChatMessage[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
	provider: "deepseek",
	apiEndpoint: "https://api.deepseek.com/chat/completions",
	apiKey: "",
	model: "deepseek-chat",
	systemPrompt:
		"You are a helpful assistant. Prefer using the provided note context when answering; reply in the same language as the user.",
	temperature: 0.7,
	maxTokens: 0,
	stream: true,
	includeActiveNote: true,
	preferSelection: true,
	maxContextChars: 30000,
	persistHistory: true,
	language: "auto",
};
