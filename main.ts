import { Plugin, WorkspaceLeaf } from "obsidian";
import { BRAND_ICON, registerBrandIcon } from "./src/brand";
import { detectLanguage, setLanguage, t } from "./src/i18n";
import { LlmChatSettingsTab } from "./src/settings";
import {
	ChatMessage,
	DEFAULT_SETTINGS,
	PluginData,
	PluginSettings,
} from "./src/types";
import { ChatView, VIEW_TYPE_CHAT } from "./src/view";

export default class LlmChatPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_SETTINGS };
	history: ChatMessage[] = [];
	private saveQueue: Promise<void> = Promise.resolve();

	async onload(): Promise<void> {
		await this.loadPluginData();
		registerBrandIcon();

		this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

		this.addRibbonIcon(BRAND_ICON, t("openChat"), () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-chat",
			name: t("openChat"),
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "new-chat",
			name: t("newChat"),
			callback: () => void this.newChat(),
		});

		this.addSettingTab(new LlmChatSettingsTab(this.app, this));
	}

	private async loadPluginData(): Promise<void> {
		const raw = (await this.loadData()) as Record<string, unknown> | null;
		this.settings = { ...DEFAULT_SETTINGS };
		this.history = [];

		if (!raw) {
			setLanguage(detectLanguage(this.settings.language));
			return;
		}

		if (raw.settings && typeof raw.settings === "object") {
			// Current format: { settings, history }
			Object.assign(
				this.settings,
				raw.settings as Partial<PluginSettings>
			);
			if (Array.isArray(raw.history)) {
				this.history = raw.history as ChatMessage[];
			}
		} else {
			// Legacy flat format from v1.0
			Object.assign(this.settings, raw as Partial<PluginSettings>);
		}

		setLanguage(detectLanguage(this.settings.language));
	}

	applyLanguage(): void {
		setLanguage(detectLanguage(this.settings.language));
	}

	async saveAll(): Promise<void> {
		const data: PluginData = {
			settings: this.settings,
			history: this.settings.persistHistory ? this.history : [],
		};
		// Snapshot and serialize writes so a slower old save cannot overwrite a new one.
		const snapshot = JSON.parse(JSON.stringify(data)) as PluginData;
		this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.saveData(snapshot));
		await this.saveQueue;
	}

	getView(): ChatView | null {
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];
		return leaf && leaf.view instanceof ChatView ? leaf.view : null;
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];
		if (existing) {
			await workspace.revealLeaf(existing);
			return;
		}
		const leaf: WorkspaceLeaf =
			workspace.getRightLeaf(false) ?? workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
		await workspace.revealLeaf(leaf);
	}

	async newChat(): Promise<void> {
		await this.activateView();
		this.getView()?.startNewChat();
	}
}
