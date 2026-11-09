import { App, Notice, PluginSettingTab, SettingDefinitionItem } from "obsidian";
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

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "group",
				heading: t("sectionApi"),
				items: [
					{
						name: t("provider"),
						desc: t("providerDesc"),
						render: (setting) => {
							setting.addDropdown((dropdown) => {
								for (const id of PROVIDER_ORDER) {
									dropdown.addOption(id, PROVIDERS[id].label);
								}
								dropdown.setValue(this.plugin.settings.provider);
								dropdown.onChange(async (value) => {
									const id = value as ProviderId;
									if (id !== this.plugin.settings.provider)
										this.plugin.settings.apiKey = "";
									this.plugin.settings.provider = id;
									const preset = PROVIDERS[id];
									if (id !== "custom") {
										this.plugin.settings.apiEndpoint = preset.endpoint;
										this.plugin.settings.model = preset.model;
									}
									await this.plugin.saveAll();
									this.update();
									this.plugin.getView()?.refreshHeader();
								});
							});
						},
					},
					{
						name: t("apiEndpoint"),
						desc: t("apiEndpointDesc"),
						render: (setting) => {
							setting.addText((text) =>
								text
									.setPlaceholder("https://api.openai.com/v1/chat/completions")
									.setValue(this.plugin.settings.apiEndpoint)
									.onChange(async (value) => {
										this.plugin.settings.apiEndpoint = value.trim();
										await this.plugin.saveAll();
									}),
							);
						},
					},
					{
						name: t("apiKey"),
						desc: t("apiKeyDesc"),
						render: (setting) => {
							setting.addText((text) => {
								text.inputEl.type = "password";
								text
									.setPlaceholder("sk-…")
									.setValue(this.plugin.settings.apiKey)
									.onChange(async (value) => {
										this.plugin.settings.apiKey = value.trim();
										await this.plugin.saveAll();
									});
							});
						},
					},
					{
						name: t("model"),
						desc: t("modelDesc"),
						render: (setting) => {
							setting.addText((text) =>
								text
									.setPlaceholder("deepseek-chat")
									.setValue(this.plugin.settings.model)
									.onChange(async (value) => {
										this.plugin.settings.model = value.trim();
										await this.plugin.saveAll();
										this.plugin.getView()?.refreshHeader();
									}),
							);
						},
					},
					{
						name: t("testConnection"),
						desc: t("testConnectionDesc"),
						render: (setting) => {
							const connectionResult = setting.descEl.createDiv({
								attr: { role: "status", "aria-live": "polite" },
							});
							setting.addButton((button) =>
								button.setButtonText(t("test")).onClick(async () => {
									const settings = { ...this.plugin.settings };
									if (!settings.apiEndpoint || !settings.model) {
										new Notice(t("testNeedConfig"));
										return;
									}
									if (
										PROVIDERS[settings.provider].keyRequired &&
										!settings.apiKey
									) {
										connectionResult.setText(t("needApiKey"));
										return;
									}
									button.setButtonText(t("testing"));
									button.setDisabled(true);
									connectionResult.setText(t("testing"));
									const controller = new AbortController();
									const timeout = window.setTimeout(
										() => controller.abort(),
										20000,
									);
									try {
										await chatCompletion({
											endpoint: settings.apiEndpoint,
											apiKey: settings.apiKey,
											model: settings.model,
											messages: [{ role: "user", content: "ping" }],
											temperature: 0,
											maxTokens: 16,
											signal: controller.signal,
										});
										new Notice(`✅ ${t("testOk")}`);
										connectionResult.setText(t("testOk"));
									} catch (error) {
										const message = controller.signal.aborted
											? t("requestTimeout")
											: error instanceof Error
												? error.message
												: String(error);
										new Notice(`❌ ${t("testFail")}: ${message}`);
										connectionResult.setText(`${t("testFail")}: ${message}`);
									} finally {
										window.clearTimeout(timeout);
										button.setButtonText(t("test"));
										button.setDisabled(false);
									}
								}),
							);
						},
					},
				],
			},
			{
				type: "group",
				heading: t("sectionGeneration"),
				items: [
					{
						name: t("systemPrompt"),
						desc: t("systemPromptDesc"),
						render: (setting) => {
							setting.addTextArea((area) => {
								area.inputEl.rows = 4;
								area.inputEl.addClass("llm-chat-settings-textarea");
								area
									.setValue(this.plugin.settings.systemPrompt)
									.onChange(async (value) => {
										this.plugin.settings.systemPrompt = value;
										await this.plugin.saveAll();
									});
							});
						},
					},
					{
						name: t("temperature"),
						desc: t("temperatureDesc"),
						render: (setting) => {
							setting.addSlider((slider) =>
								slider
									.setLimits(0, 2, 0.1)

									.setValue(this.plugin.settings.temperature)
									.onChange(async (value) => {
										this.plugin.settings.temperature = value;
										await this.plugin.saveAll();
									}),
							);
						},
					},
					{
						name: t("maxTokens"),
						desc: t("maxTokensDesc"),
						render: (setting) => {
							setting.addText((text) =>
								text
									.setPlaceholder("0")
									.setValue(
										this.plugin.settings.maxTokens > 0
											? String(this.plugin.settings.maxTokens)
											: "",
									)
									.onChange(async (value) => {
										const parsed = parseInt(value, 10);
										this.plugin.settings.maxTokens =
											Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
										await this.plugin.saveAll();
									}),
							);
						},
					},
				],
			},
			{
				type: "group",
				heading: t("sectionContext"),
				items: [
					{
						name: t("includeActiveNote"),
						desc: t("includeActiveNoteDesc"),
						render: (setting) => {
							setting.addToggle((toggle) =>
								toggle
									.setValue(this.plugin.settings.includeActiveNote)
									.onChange(async (value) => {
										this.plugin.settings.includeActiveNote = value;
										await this.plugin.saveAll();
										this.plugin.getView()?.refreshHeader();
									}),
							);
						},
					},
					{
						name: t("preferSelection"),
						desc: t("preferSelectionDesc"),
						render: (setting) => {
							setting.addToggle((toggle) =>
								toggle
									.setValue(this.plugin.settings.preferSelection)
									.onChange(async (value) => {
										this.plugin.settings.preferSelection = value;
										await this.plugin.saveAll();
										this.plugin.getView()?.refreshHeader();
									}),
							);
						},
					},
					{
						name: t("maxContextChars"),
						desc: t("maxContextCharsDesc"),
						render: (setting) => {
							setting.addText((text) =>
								text
									.setValue(String(this.plugin.settings.maxContextChars))
									.onChange(async (value) => {
										const parsed = parseInt(value, 10);
										if (Number.isFinite(parsed) && parsed > 0) {
											this.plugin.settings.maxContextChars = parsed;
											await this.plugin.saveAll();
											this.plugin.getView()?.refreshHeader();
										}
									}),
							);
						},
					},
				],
			},
			{
				type: "group",
				heading: t("sectionBehavior"),
				items: [
					{
						name: t("stream"),
						desc: t("streamDesc"),
						render: (setting) => {
							setting.addToggle((toggle) =>
								toggle
									.setValue(this.plugin.settings.stream)
									.onChange(async (value) => {
										this.plugin.settings.stream = value;
										await this.plugin.saveAll();
									}),
							);
						},
					},
					{
						name: t("persistHistory"),
						desc: t("persistHistoryDesc"),
						render: (setting) => {
							setting.addToggle((toggle) =>
								toggle
									.setValue(this.plugin.settings.persistHistory)
									.onChange(async (value) => {
										this.plugin.settings.persistHistory = value;
										if (!value) this.plugin.history = [];
										await this.plugin.saveAll();
									}),
							);
						},
					},
					{
						name: t("language"),
						render: (setting) => {
							setting.addDropdown((dropdown) =>
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
										this.update();
										this.plugin.getView()?.rebuildUI();
									}),
							);
						},
					},
					{
						name: t("resetDefaults"),
						desc: t("resetDefaultsDesc"),
						render: (setting) => {
							setting.addButton((button) =>
								button
									.setButtonText(t("reset"))
									.setDestructive()
									.onClick(async () => {
										this.plugin.settings = { ...DEFAULT_SETTINGS };
										this.plugin.applyLanguage();
										await this.plugin.saveAll();
										this.update();
										this.plugin.getView()?.rebuildUI();
										new Notice(t("resetDone"));
									}),
							);
						},
					},
				],
			},
		];
	}
}
