import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type LlmChatPlugin from "../main";
import { chatCompletion } from "./api";
import { t } from "./i18n";
import { PROVIDER_ORDER, PROVIDERS } from "./providers";
import { DEFAULT_SETTINGS, ProviderId } from "./types";

export class LlmChatSettingsTab extends PluginSettingTab {
	private plugin: LlmChatPlugin;

	constructor(app: App, plugin: LlmChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("llm-chat-settings");

		containerEl.createEl("h2", { text: t("settingsTitle") });

		// ---------- API ----------

		containerEl.createEl("h3", { text: t("sectionApi") });

		new Setting(containerEl)
			.setName(t("provider"))
			.setDesc(t("providerDesc"))
			.addDropdown((dropdown) => {
				for (const id of PROVIDER_ORDER) {
					dropdown.addOption(id, PROVIDERS[id].label);
				}
				dropdown.setValue(this.plugin.settings.provider);
				dropdown.onChange(async (value) => {
					const id = value as ProviderId;
					this.plugin.settings.provider = id;
					const preset = PROVIDERS[id];
					if (id !== "custom") {
						this.plugin.settings.apiEndpoint = preset.endpoint;
						this.plugin.settings.model = preset.model;
					}
					await this.plugin.saveAll();
					this.display();
					this.plugin.getView()?.refreshHeader();
				});
			});

		new Setting(containerEl)
			.setName(t("apiEndpoint"))
			.setDesc(t("apiEndpointDesc"))
			.addText((text) =>
				text
					.setPlaceholder(
						"https://api.openai.com/v1/chat/completions"
					)
					.setValue(this.plugin.settings.apiEndpoint)
					.onChange(async (value) => {
						this.plugin.settings.apiEndpoint = value.trim();
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName(t("apiKey"))
			.setDesc(t("apiKeyDesc"))
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("sk-…")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveAll();
					});
			});

		new Setting(containerEl)
			.setName(t("model"))
			.setDesc(t("modelDesc"))
			.addText((text) =>
				text
					.setPlaceholder("deepseek-chat")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value.trim();
						await this.plugin.saveAll();
						this.plugin.getView()?.refreshHeader();
					})
			);

		new Setting(containerEl)
			.setName(t("testConnection"))
			.setDesc(t("testConnectionDesc"))
			.addButton((button) =>
				button.setButtonText(t("test")).onClick(async () => {
					const settings = this.plugin.settings;
					if (!settings.apiEndpoint || !settings.model) {
						new Notice(t("testNeedConfig"));
						return;
					}
					button.setButtonText(t("testing"));
					button.setDisabled(true);
					try {
						await chatCompletion({
							endpoint: settings.apiEndpoint,
							apiKey: settings.apiKey,
							model: settings.model,
							messages: [{ role: "user", content: "ping" }],
							temperature: 0,
							maxTokens: 16,
						});
						new Notice(`✅ ${t("testOk")}`);
					} catch (error) {
						const message =
							error instanceof Error
								? error.message
								: String(error);
						new Notice(`❌ ${t("testFail")}: ${message}`);
					} finally {
						button.setButtonText(t("test"));
						button.setDisabled(false);
					}
				})
			);

		// ---------- Generation ----------

		containerEl.createEl("h3", { text: t("sectionGeneration") });

		new Setting(containerEl)
			.setName(t("systemPrompt"))
			.setDesc(t("systemPromptDesc"))
			.addTextArea((area) => {
				area.inputEl.rows = 4;
				area.inputEl.addClass("llm-chat-settings-textarea");
				area.setValue(this.plugin.settings.systemPrompt).onChange(
					async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveAll();
					}
				);
			});

		new Setting(containerEl)
			.setName(t("temperature"))
			.setDesc(t("temperatureDesc"))
			.addSlider((slider) =>
				slider
					.setLimits(0, 2, 0.1)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.temperature)
					.onChange(async (value) => {
						this.plugin.settings.temperature = value;
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName(t("maxTokens"))
			.setDesc(t("maxTokensDesc"))
			.addText((text) =>
				text
					.setPlaceholder("0")
					.setValue(
						this.plugin.settings.maxTokens > 0
							? String(this.plugin.settings.maxTokens)
							: ""
					)
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						this.plugin.settings.maxTokens =
							Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
						await this.plugin.saveAll();
					})
			);

		// ---------- Context ----------

		containerEl.createEl("h3", { text: t("sectionContext") });

		new Setting(containerEl)
			.setName(t("includeActiveNote"))
			.setDesc(t("includeActiveNoteDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeActiveNote)
					.onChange(async (value) => {
						this.plugin.settings.includeActiveNote = value;
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName(t("preferSelection"))
			.setDesc(t("preferSelectionDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.preferSelection)
					.onChange(async (value) => {
						this.plugin.settings.preferSelection = value;
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName(t("maxContextChars"))
			.setDesc(t("maxContextCharsDesc"))
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.maxContextChars))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (Number.isFinite(parsed) && parsed > 0) {
							this.plugin.settings.maxContextChars = parsed;
							await this.plugin.saveAll();
						}
					})
			);

		// ---------- Behavior ----------

		containerEl.createEl("h3", { text: t("sectionBehavior") });

		new Setting(containerEl)
			.setName(t("stream"))
			.setDesc(t("streamDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stream)
					.onChange(async (value) => {
						this.plugin.settings.stream = value;
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName(t("persistHistory"))
			.setDesc(t("persistHistoryDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.persistHistory)
					.onChange(async (value) => {
						this.plugin.settings.persistHistory = value;
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName(t("language"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("auto", t("languageAuto"))
					.addOption("en", t("languageEn"))
					.addOption("zh", t("languageZh"))
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language =
							value as typeof this.plugin.settings.language;
						this.plugin.applyLanguage();
						await this.plugin.saveAll();
						this.display();
						this.plugin.getView()?.rebuildUI();
					})
			);

		new Setting(containerEl)
			.setName(t("resetDefaults"))
			.setDesc(t("resetDefaultsDesc"))
			.addButton((button) =>
				button
					.setButtonText(t("reset"))
					.setWarning()
					.onClick(async () => {
						this.plugin.settings = { ...DEFAULT_SETTINGS };
						this.plugin.applyLanguage();
						await this.plugin.saveAll();
						this.display();
						this.plugin.getView()?.rebuildUI();
						new Notice(t("resetDone"));
					})
			);
	}
}
