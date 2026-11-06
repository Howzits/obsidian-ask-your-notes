import { AbstractInputSuggest, App, TFile } from "obsidian";

/**
 * @-mention note suggester. Opens when the input ends with an @ trigger,
 * filters vault markdown files by path/basename, and hands the picked
 * file back through onSelectFile.
 */
export class NoteSuggest extends AbstractInputSuggest<TFile> {
	private input: HTMLTextAreaElement;
	private onSelectFile: (file: TFile) => void;

	constructor(
		app: App,
		input: HTMLTextAreaElement,
		onSelectFile: (file: TFile) => void
	) {
		super(app, input as unknown as HTMLInputElement);
		this.input = input;
		this.onSelectFile = onSelectFile;
		this.limit = 8;
	}

	/** Whether the suggestion popover is currently open. */
	get popoverOpen(): boolean {
		// PopoverSuggest tracks its own isOpen state at runtime, but it is
		// not part of the public typings, so read it via a cast.
		return (this as unknown as { isOpen: boolean }).isOpen;
	}

	// Obsidian reads non-<input> elements via innerText, which is always
	// empty for a <textarea>. Override both accessors to use .value.
	override getValue(): string {
		return this.input.value;
	}

	override setValue(value: string): void {
		this.input.value = value;
	}

	getSuggestions(query: string): TFile[] {
		const match = /(?:^|\s)@([^\s]*)$/.exec(query);
		if (!match) return [];
		const term = match[1].toLowerCase();
		const files = this.app.vault.getMarkdownFiles();
		const filtered = term
			? files.filter(
					(file) =>
						file.path.toLowerCase().includes(term) ||
						file.basename.toLowerCase().includes(term)
				)
			: files;
		// Short paths first: root-level notes are usually the most wanted.
		return filtered
			.sort((a, b) => a.path.length - b.path.length)
			.slice(0, this.limit);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.addClass("llm-chat-suggest");
		el.createDiv({ cls: "llm-chat-suggest-name", text: file.basename });
		el.createDiv({ cls: "llm-chat-suggest-path", text: file.path });
	}

	selectSuggestion(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
		// Strip the trailing "@query" token from the input, keep the rest.
		const value = this.input.value;
		const idx = value.lastIndexOf("@");
		this.input.value = idx >= 0 ? value.slice(0, idx) : "";
		this.input.dispatchEvent(new Event("input"));
		this.onSelectFile(file);
	}
}
