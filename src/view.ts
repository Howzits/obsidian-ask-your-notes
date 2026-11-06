import {
	App,
	ItemView,
	MarkdownRenderer,
	MarkdownView,
	Notice,
	Platform,
	setIcon,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import type LlmChatPlugin from "../main";
import { chatCompletion, chatCompletionStream } from "./api";
import { t } from "./i18n";
import { NoteSuggest } from "./suggest";
import type { ChatMessage } from "./types";

export const VIEW_TYPE_CHAT = "llm-note-chat-view";

interface SettingsApp extends App {
	setting: { open(): void; openTabById(id: string): void };
}

interface ContextInfo {
	path: string;
	content: string;
	isSelection: boolean;
	chars: number;
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n\n… (truncated)`;
}

function noteName(path: string): string {
	return path.split("/").pop() ?? path;
}

export class ChatView extends ItemView {
	private plugin: LlmChatPlugin;
	private messages: ChatMessage[] = [];
	private busy = false;
	private abortController: AbortController | null = null;
	private lastMarkdownView: MarkdownView | null = null;
	private autoScroll = true;
	private sessionId = 0;
	private copyText = new WeakMap<HTMLElement, string>();
	private regenerateButtons: HTMLButtonElement[] = [];

	/** @-mentions: referenced note paths. */
	private refs: string[] = [];
	/** When true, the auto "follow active note" chip has been removed/overridden. */
	private manualMode = false;
	private noteSuggest: NoteSuggest | null = null;

	private messagesEl!: HTMLElement;
	private contextEl!: HTMLElement;
	private chipsRow!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private stopBtn!: HTMLButtonElement;
	private subtitleEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: LlmChatPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CHAT;
	}

	getDisplayText(): string {
		return t("viewTitle");
	}

	getIcon(): string {
		return "message-square";
	}

	async onOpen(): Promise<void> {
		this.messages = this.plugin.settings.persistHistory
			? [...this.plugin.history]
			: [];
		this.initContextView();
		this.buildUI();
		this.renderConversation();
		await this.updateContextBar();
		this.inputEl.focus();

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof MarkdownView) {
					this.lastMarkdownView = leaf.view;
				}
				if (!this.manualMode) {
					this.renderChips();
				}
				void this.updateContextBar();
			})
		);
	}

	async onClose(): Promise<void> {
		this.noteSuggest?.close();
		this.abortController?.abort();
	}

	/** Rebuild the whole UI (used after a language change). */
	rebuildUI(): void {
		if (this.busy) return;
		this.buildUI();
		this.renderConversation();
		void this.updateContextBar();
	}

	refreshHeader(): void {
		if (this.subtitleEl) {
			this.subtitleEl.setText(
				this.plugin.settings.model || t("modelUnset")
			);
		}
	}

	startNewChat(): void {
		this.sessionId++;
		this.abortController?.abort();
		this.messages = [];
		this.plugin.history = [];
		void this.plugin.saveAll();
		this.renderConversation();
		void this.updateContextBar();
		this.inputEl?.focus();
	}

	// ---------- UI construction ----------

	private buildUI(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("llm-chat-container");

		const header = container.createDiv({ cls: "llm-chat-header" });
		const titleWrap = header.createDiv({ cls: "llm-chat-title-wrap" });
		titleWrap.createDiv({ cls: "llm-chat-title", text: t("viewTitle") });
		this.subtitleEl = titleWrap.createDiv({
			cls: "llm-chat-subtitle",
			text: this.plugin.settings.model || t("modelUnset"),
		});

		const actions = header.createDiv({ cls: "llm-chat-actions" });
		this.iconButton(actions, "plus", t("newChat"), () =>
			this.startNewChat()
		);
		this.iconButton(actions, "settings", t("settings"), () => {
			const app = this.app as SettingsApp;
			app.setting.open();
			app.setting.openTabById(this.plugin.manifest.id);
		});

		this.messagesEl = container.createDiv({ cls: "llm-chat-messages" });
		this.messagesEl.addEventListener("scroll", () => {
			this.autoScroll = this.isNearBottom();
		});

		const footer = container.createDiv({ cls: "llm-chat-footer" });
		this.contextEl = footer.createDiv({ cls: "llm-chat-context" });

		const inputRow = footer.createDiv({ cls: "llm-chat-input-row" });
		this.chipsRow = inputRow.createDiv({ cls: "llm-chat-chips-row" });
		const inner = inputRow.createDiv({ cls: "llm-chat-input-inner" });
		this.inputEl = inner.createEl("textarea", {
			cls: "llm-chat-input",
			attr: { placeholder: t("placeholder"), rows: "1" },
		});
		this.inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
			// isComposing: don't send while an IME candidate window is open
			if (evt.key === "Enter" && !evt.shiftKey && !evt.isComposing) {
				// Let the suggestion popover handle Enter when it is open.
				if (this.noteSuggest?.popoverOpen) return;
				evt.preventDefault();
				void this.send();
			}
		});
		this.inputEl.addEventListener("input", () => this.autoResize());

		this.noteSuggest = new NoteSuggest(this.app, this.inputEl, (file) =>
			this.addRef(file)
		);

		const btnCol = inner.createDiv({ cls: "llm-chat-btn-col" });
		this.sendBtn = btnCol.createEl("button", {
			cls: "llm-chat-send",
			attr: { "aria-label": t("send"), title: t("send") },
		});
		setIcon(this.sendBtn, "send");
		this.sendBtn.addEventListener("click", () => void this.send());

		this.stopBtn = btnCol.createEl("button", {
			cls: "llm-chat-stop",
			attr: { "aria-label": t("stop"), title: t("stop") },
		});
		setIcon(this.stopBtn, "square");
		this.stopBtn.toggleClass("is-hidden", true);
		this.stopBtn.addEventListener("click", () =>
			this.abortController?.abort()
		);

		this.renderChips();
	}

	private iconButton(
		parent: HTMLElement,
		icon: string,
		label: string,
		onClick: () => void
	): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: "llm-chat-icon-btn",
			attr: { "aria-label": label, title: label },
		});
		setIcon(button, icon);
		button.addEventListener("click", onClick);
		return button;
	}

	// ---------- Context chips (@-mentions) ----------

	/** Render the chips row above the input. */
	private renderChips(): void {
		if (!this.chipsRow) return;
		this.chipsRow.empty();

		let paths: string[] = [];
		if (this.manualMode) {
			paths = [...this.refs];
		} else {
			const view = this.getContextView();
			if (view?.file) paths = [view.file.path];
		}

		for (const path of paths) {
			const chip = this.chipsRow.createDiv({
				cls: "llm-chat-chip-ref",
				attr: { title: path },
			});
			chip.createSpan({
				cls: "llm-chat-chip-ref-name",
				text: `@${noteName(path)}`,
			});
			const remove = chip.createSpan({
				cls: "llm-chat-chip-ref-remove",
				attr: { "aria-label": t("removeRef") },
			});
			setIcon(remove, "x");
			remove.addEventListener("click", (evt) => {
				evt.stopPropagation();
				this.removeRef(path);
			});
			chip.addEventListener("click", () => this.openRefNote(path));
		}

		if (this.manualMode) {
			const reset = this.chipsRow.createEl("button", {
				cls: "llm-chat-icon-btn llm-chat-chip-reset",
				attr: { title: t("resetContext"), "aria-label": t("resetContext") },
			});
			setIcon(reset, "rotate-ccw");
			reset.addEventListener("click", () => this.resetRefs());
		}

		this.chipsRow.toggleClass(
			"is-hidden",
			paths.length === 0 && !this.manualMode
		);
	}

	private addRef(file: TFile): void {
		if (!this.manualMode) {
			this.manualMode = true;
			this.refs = [];
		}
		if (!this.refs.includes(file.path)) this.refs.push(file.path);
		this.renderChips();
		void this.updateContextBar();
		this.inputEl.focus();
	}

	private removeRef(path: string): void {
		if (this.manualMode) {
			this.refs = this.refs.filter((p) => p !== path);
		} else {
			// Removing the default chip: switch to manual mode, no refs.
			this.manualMode = true;
			this.refs = [];
		}
		this.renderChips();
		void this.updateContextBar();
	}

	private resetRefs(): void {
		this.manualMode = false;
		this.refs = [];
		this.renderChips();
		void this.updateContextBar();
	}

	private openRefNote(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === path) {
				void this.app.workspace.revealLeaf(leaf);
				return;
			}
		}
		void this.app.workspace.getLeaf(false).openFile(file);
	}

	// ---------- Rendering ----------

	private renderConversation(): void {
		this.messagesEl.empty();
		this.regenerateButtons = [];
		if (this.messages.length === 0) {
			this.renderEmptyState();
			return;
		}
		this.messages.forEach((message, index) =>
			this.renderMessage(message, index)
		);
		this.scrollToBottom(true);
	}

	private renderEmptyState(): void {
		const wrap = this.messagesEl.createDiv({ cls: "llm-chat-empty" });
		const icon = wrap.createDiv({ cls: "llm-chat-empty-icon" });
		setIcon(icon, "sparkles");
		wrap.createDiv({ cls: "llm-chat-empty-title", text: t("emptyTitle") });
		wrap.createDiv({ cls: "llm-chat-empty-body", text: t("emptyBody") });

		const chips = wrap.createDiv({ cls: "llm-chat-chips" });
		(
			["suggestion1", "suggestion2", "suggestion3"] as const
		).forEach((key) => {
			const chip = chips.createEl("button", {
				cls: "llm-chat-chip",
				text: t(key),
			});
			chip.addEventListener("click", () => {
				this.inputEl.value = t(key);
				this.inputEl.focus();
				this.autoResize();
			});
		});
	}

	private renderMessage(message: ChatMessage, index: number): void {
		if (message.role === "user") {
			const row = this.messagesEl.createDiv({ cls: "llm-chat-msg user" });
			row.createDiv({ cls: "llm-chat-bubble" }).setText(message.content);
			return;
		}
		if (message.role === "assistant") {
			const { bubble, content } = this.createAssistantBubble();
			this.copyText.set(bubble, message.content);
			void this.renderMarkdown(content, message.content);
			if (index === this.messages.length - 1) {
				this.addRegenerateButton(bubble);
			}
		}
	}

	private async renderMarkdown(
		element: HTMLElement,
		markdown: string
	): Promise<void> {
		element.empty();
		const sourcePath = this.getContextView()?.file?.path ?? "";
		await MarkdownRenderer.render(
			this.app,
			markdown,
			element,
			sourcePath,
			this
		);
	}

	private createAssistantBubble(): {
		bubble: HTMLElement;
		content: HTMLElement;
	} {
		const row = this.messagesEl.createDiv({ cls: "llm-chat-msg assistant" });
		const bubble = row.createDiv({ cls: "llm-chat-bubble" });
		const content = bubble.createDiv({ cls: "llm-chat-content" });
		const actions = bubble.createDiv({ cls: "llm-chat-bubble-actions" });
		this.iconButton(actions, "copy", t("copy"), () =>
			void this.copyBubble(bubble)
		);
		this.iconButton(actions, "arrow-down-to-line", t("insert"), () =>
			this.insertBubble(bubble)
		);
		return { bubble, content };
	}

	private addRegenerateButton(bubble: HTMLElement): void {
		const actions = bubble.querySelector(".llm-chat-bubble-actions");
		if (!(actions instanceof HTMLElement)) return;
		const button = this.iconButton(actions, "refresh-cw", t("regenerate"), () =>
			void this.regenerate()
		);
		this.regenerateButtons.push(button);
	}

	private clearRegenerateButtons(): void {
		this.regenerateButtons.forEach((button) => button.remove());
		this.regenerateButtons = [];
	}

	private setBusy(busy: boolean): void {
		this.sendBtn.disabled = busy;
		this.stopBtn.toggleClass("is-hidden", !busy);
	}

	// ---------- Messaging ----------

	private async send(): Promise<void> {
		if (this.busy) return;
		const text = this.inputEl.value.trim();
		if (!text) return;

		const settings = this.plugin.settings;
		if (
			settings.provider !== "ollama" &&
			settings.provider !== "custom" &&
			!settings.apiKey
		) {
			new Notice(t("needApiKey"));
			return;
		}
		if (!settings.apiEndpoint || !settings.model) {
			new Notice(t("needEndpoint"));
			return;
		}

		this.clearRegenerateButtons();
		if (this.messages.length === 0) this.messagesEl.empty();

		const userMessage: ChatMessage = { role: "user", content: text };
		this.messages.push(userMessage);
		this.renderMessage(userMessage, this.messages.length - 1);
		this.inputEl.value = "";
		this.autoResize();
		this.autoScroll = true;
		this.scrollToBottom(true);
		this.persist();

		await this.runCompletion();
	}

	private async runCompletion(): Promise<void> {
		const last = this.messages[this.messages.length - 1];
		if (this.busy || !last || last.role !== "user") return;

		const settings = this.plugin.settings;
		const context = await this.collectContext();
		await this.updateContextBar(context);

		const apiMessages: ChatMessage[] = [];
		if (settings.systemPrompt.trim()) {
			apiMessages.push({
				role: "system",
				content: settings.systemPrompt.trim(),
			});
		}
		if (context) {
			apiMessages.push({
				role: "system",
				content: this.buildContextPrompt(context),
			});
		}
		apiMessages.push(...this.messages);

		const session = this.sessionId;
		const { bubble, content } = this.createAssistantBubble();
		bubble.addClass("llm-chat-streaming");
		content.setText("");

		this.busy = true;
		this.setBusy(true);
		this.autoScroll = true;
		this.scrollToBottom(true);

		const controller = new AbortController();
		this.abortController = controller;

		let full = "";
		let streamed = "";
		let failed: string | null = null;

		try {
			if (settings.stream && !Platform.isMobileApp) {
				full = await chatCompletionStream({
					endpoint: settings.apiEndpoint,
					apiKey: settings.apiKey,
					model: settings.model,
					messages: apiMessages,
					temperature: settings.temperature,
					maxTokens: settings.maxTokens,
					signal: controller.signal,
					onDelta: (_delta, fullText) => {
						streamed = fullText;
						content.setText(fullText);
						this.scrollToBottom();
					},
				});
			} else {
				full = await chatCompletion({
					endpoint: settings.apiEndpoint,
					apiKey: settings.apiKey,
					model: settings.model,
					messages: apiMessages,
					temperature: settings.temperature,
					maxTokens: settings.maxTokens,
				});
				content.setText(full);
			}
		} catch (error) {
			if (!controller.signal.aborted) {
				failed =
					error instanceof Error ? error.message : String(error);
			}
		} finally {
			this.abortController = null;
			this.busy = false;
			this.setBusy(false);
			bubble.removeClass("llm-chat-streaming");
		}

		if (!full && streamed) full = streamed;

		const row = bubble.parentElement;
		if (session !== this.sessionId) {
			row?.remove();
			return;
		}

		if (full) {
			await this.renderMarkdown(content, full);
			this.copyText.set(bubble, full);
			if (failed) {
				content.createDiv({
					cls: "llm-chat-error",
					text: `${t("errorPrefix")}${failed}`,
				});
			}
			this.addRegenerateButton(bubble);
			this.messages.push({ role: "assistant", content: full });
			this.persist();
		} else if (failed) {
			content.empty();
			content.createDiv({
				cls: "llm-chat-error",
				text: `${t("errorPrefix")}${failed}`,
			});
			this.addRegenerateButton(bubble);
		} else if (controller.signal.aborted) {
			row?.remove();
		} else {
			content.setText(t("noContent"));
			this.addRegenerateButton(bubble);
		}

		this.scrollToBottom();
	}

	private async regenerate(): Promise<void> {
		if (this.busy) return;
		const last = this.messages[this.messages.length - 1];
		if (!last) return;
		if (last.role === "assistant") this.messages.pop();
		const tail = this.messages[this.messages.length - 1];
		if (!tail || tail.role !== "user") return;

		this.renderConversation();
		this.persist();
		await this.runCompletion();
	}

	private persist(): void {
		if (!this.plugin.settings.persistHistory) {
			if (this.plugin.history.length > 0) {
				this.plugin.history = [];
				void this.plugin.saveAll();
			}
			return;
		}
		let messages = this.messages;
		if (messages.length > 200) messages = messages.slice(-200);
		while (messages.length > 0 && messages[0].role !== "user") {
			messages = messages.slice(1);
		}
		this.plugin.history = messages;
		void this.plugin.saveAll();
	}

	// ---------- Bubble actions ----------

	private async copyBubble(bubble: HTMLElement): Promise<void> {
		const text = this.copyText.get(bubble);
		if (!text) {
			new Notice(t("nothingToCopy"));
			return;
		}
		try {
			await navigator.clipboard.writeText(text);
			new Notice(t("copied"));
		} catch {
			try {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.appendChild(textarea);
				textarea.select();
				const ok = document.execCommand("copy");
				textarea.remove();
				new Notice(ok ? t("copied") : t("copyFailed"));
			} catch {
				new Notice(t("copyFailed"));
			}
		}
	}

	private insertBubble(bubble: HTMLElement): void {
		const text = this.copyText.get(bubble);
		if (!text) {
			new Notice(t("nothingToCopy"));
			return;
		}
		const view = this.getContextView();
		if (!view) {
			new Notice(t("insertFailed"));
			return;
		}
		view.editor.replaceSelection(text);
		new Notice(t("inserted"));
	}

	// ---------- Context ----------

	private initContextView(): void {
		const recent = this.app.workspace.getMostRecentLeaf();
		if (recent && recent.view instanceof MarkdownView) {
			this.lastMarkdownView = recent.view;
			return;
		}
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView && leaf.view.file) {
				this.lastMarkdownView = leaf.view;
				return;
			}
		}
	}

	private getContextView(): MarkdownView | null {
		const active = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (active) {
			this.lastMarkdownView = active;
			return active;
		}
		const last = this.lastMarkdownView;
		if (
			last &&
			last.file &&
			this.app.workspace.getLeavesOfType("markdown").includes(last.leaf)
		) {
			return last;
		}
		return null;
	}

	/**
	 * Resolve the current context. Returns null when there is nothing to
	 * send. In auto mode the active note (or its selection) is used; in
	 * manual mode exactly the @-referenced notes are used.
	 */
	private async collectContext(): Promise<ContextInfo[] | null> {
		const settings = this.plugin.settings;

		let paths: string[];
		let autoSingle = false;
		if (this.manualMode) {
			paths = [...this.refs];
		} else {
			if (!settings.includeActiveNote) return null;
			const view = this.getContextView();
			if (!view?.file) return null;
			paths = [view.file.path];
			autoSingle = true;
		}
		if (paths.length === 0) return null;

		const infos: ContextInfo[] = [];
		for (const path of paths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) continue;

			// Prefer the open editor buffer so unsaved edits are included.
			let raw = "";
			for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
				const view = leaf.view;
				if (view instanceof MarkdownView && view.file?.path === path) {
					raw = view.editor.getValue();
					break;
				}
			}
			if (raw === "") {
				raw = await this.app.vault.cachedRead(file);
			}

			let isSelection = false;
			if (autoSingle && settings.preferSelection) {
				const selection = this.getContextView()?.editor.getSelection() ?? "";
				if (selection.trim().length > 0) {
					raw = selection;
					isSelection = true;
				}
			}

			if (!raw.trim()) continue;
			infos.push({
				path,
				content: truncate(raw, settings.maxContextChars),
				isSelection,
				chars: raw.length,
			});
		}
		return infos.length > 0 ? infos : null;
	}

	private buildContextPrompt(infos: ContextInfo[]): string {
		if (infos.length === 1 && infos[0].isSelection) {
			return `The user is currently working on the note "${infos[0].path}". Here is the text they selected in it:\n\n<note>\n${infos[0].content}\n</note>\n\nUse it as context when answering the user. If their question is unrelated to the note, answer normally.`;
		}
		const blocks = infos
			.map(
				(info) =>
					`<note path="${info.path}">\n${info.content}\n</note>`
			)
			.join("\n\n");
		const intro =
			infos.length === 1
				? `The user is currently working on the note "${infos[0].path}". Here is its Markdown content:`
				: `The user referenced the following notes as context:`;
		return `${intro}\n\n${blocks}\n\nUse the note content above as context when answering the user. If their question is unrelated to these notes, answer normally.`;
	}

	private async updateContextBar(
		context?: ContextInfo[] | null
	): Promise<void> {
		if (!this.contextEl) return;
		const settings = this.plugin.settings;
		let text: string;

		const infos =
			context === undefined ? await this.collectContext() : context;
		if (!infos) {
			if (this.manualMode) {
				text = t("contextManualEmpty");
			} else if (!settings.includeActiveNote) {
				text = t("contextOff");
			} else {
				text = t("contextNone");
			}
		} else {
			const paths = infos.map((info) => info.path).join("、");
			const chars = infos.reduce((sum, info) => sum + info.chars, 0);
			const hasSelection = infos.length === 1 && infos[0].isSelection;
			const template = hasSelection
				? t("contextSelection")
				: t("contextNote");
			text = template
				.replace("{path}", paths)
				.replace("{chars}", String(chars));
		}
		this.contextEl.setText(text);
	}

	// ---------- Scrolling & input ----------

	private isNearBottom(): boolean {
		const element = this.messagesEl;
		return (
			element.scrollHeight - element.scrollTop - element.clientHeight < 60
		);
	}

	private scrollToBottom(force = false): void {
		if (!force && !this.autoScroll) return;
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}

	private autoResize(): void {
		if (!this.inputEl) return;
		this.inputEl.style.height = "auto";
		this.inputEl.style.height = `${Math.min(
			this.inputEl.scrollHeight,
			160
		)}px`;
	}
}
