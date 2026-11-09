<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg" />
    <img src="assets/logo.svg" width="112" height="112" alt="Ask Your Notes: a folded note with a conversation tail" />
  </picture>
</p>

<h1 align="center">Ask Your Notes</h1>

<p align="center">
  <strong>Read, question, and develop your notes without leaving Obsidian.</strong><br />
  Bring a note, a selected passage, or a few references into a sidebar conversation.
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="https://github.com/Howzits/obsidian-ask-your-notes/releases/latest">Download</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#privacy-and-data">Privacy</a> ·
  <a href="https://github.com/Howzits/obsidian-ask-your-notes/issues">Report an issue</a>
</p>

Summarize a note, explain a difficult passage, compare ideas across referenced notes, or turn rough thoughts into an outline. Choose what to attach, review the references above the input, and send your question.

The plugin connects Obsidian to an OpenAI-compatible chat API. You supply the model connection, using a provider preset or your own endpoint. It does not automatically search or index your entire vault.

> This README describes the current source. Check the [release notes](https://github.com/Howzits/obsidian-ask-your-notes/releases) for features available in your installed version.

## Features

- **Active note or selection.** Include unsaved editor changes; in automatic mode, send a selected passage instead of the whole note.
- **References with `@`.** Attach multiple Markdown notes, remove individual references, or chat without attaching notes.
- **Replies you can use.** Render Markdown, tables, code, and math. Copy a reply, insert it at the note editor's selection or cursor, or regenerate the latest answer.
- **Visible request status.** See when notes are being read or a reply is generating. Stop generation or retry after a failed request.
- **Fits your workspace.** Colors, fonts, icons, and main control radii follow Obsidian's theme. English and Chinese interfaces are included.
- **Optional local history.** Resume the last conversation after restarting Obsidian.

## Preview

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/screenshot-dark.png" />
  <img src="assets/screenshot.png" width="540" alt="Ask Your Notes sidebar showing a demo reading workflow, a Markdown table, reply actions, and the message input" />
</picture>

Captured in Obsidian using a demo conversation, with no private notes or API requests. The preview follows your light or dark mode; appearance varies by theme.

## Installation

Until the plugin is available in the community directory, use BRAT or install a release manually.

### BRAT

1. Install and enable [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. Choose **Add a beta plugin** and enter `Howzits/obsidian-ask-your-notes`.
3. Enable **Ask Your Notes** under **Settings → Community plugins** if needed.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Howzits/obsidian-ask-your-notes/releases/latest).
2. Create `<vault>/.obsidian/plugins/ask-your-notes/` and place all three files there.
3. Reload Obsidian and enable **Ask Your Notes** under **Settings → Community plugins**.

Use the release attachments, rather than GitHub's source-code ZIP. To build from source, see [Development](#development).

## Quick start

1. Open **Settings → Ask Your Notes** and choose a provider.
2. Enter its API key if required, confirm the endpoint and model, and select **Test connection**. The test sends a small request and may consume API quota.
3. Open a Markdown note, then open **Ask Your Notes** from the ribbon icon or command palette.
4. Check the references above the input. Ask “Summarize this note in five points,” then press `Enter`.

For Ollama, start the local service and install a model first. Use a model name available on that service. `localhost` refers to the device running Obsidian.

### Connection presets

These are the defaults in the code, rather than model recommendations. Endpoints and model IDs are editable; availability depends on your provider and account.

| Preset | Chat completions endpoint | Default model |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/chat/completions` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `openai/gpt-4o-mini` |
| Ollama | `http://localhost:11434/v1/chat/completions` | `llama3.1` |
| Custom | Your full OpenAI-compatible chat completions URL | Your model ID |

Use the full chat completions URL, not just the base URL. Switching provider presets clears the previous API key. Third-party services may charge for requests.

## Choose the context

| Mode | Attached to the next question |
| --- | --- |
| Follow the active note | The active Markdown note, including unsaved edits. Enabled by default. |
| Selected text | In automatic mode, with **Prefer selected text** enabled, a nonempty selection replaces the full note. |
| Explicit references | Notes chosen through `@` or the **@** button. The first reference replaces automatic following; more can be added. |
| No attached notes | Remove all references, or disable automatic context and leave explicit references empty. |

Select a reference name to open its note, use its remove button to detach it, or use the reset arrow to restore automatic mode. Turning off **Use the active note as context** stops automatic attachment; explicit references still apply.

Each request also includes previous chat messages. Switching notes or removing references does not erase those messages. Start a **New chat** when changing topics or when you need a fresh conversation.

**Max context characters** defaults to 30,000 characters **per note**. Truncation is marked in the context bar. Many references or a long conversation can still exceed a model's context window.

### Controls

| Action | Control |
| --- | --- |
| Send | `Enter` |
| New line | `Shift+Enter` |
| Add a note | Type `@` or select the **@** button, then choose a note |
| Stop a reply | Select the stop button while generating |
| Start fresh | Select **+** in the header; this clears the current conversation |
| Reuse a reply | Select copy or insert; regenerate is available for the latest reply |

Desktop supports streaming replies. Mobile uses non-streaming requests. Stopping a non-streaming request stops local waiting and discards the late reply; it cannot cancel the underlying request or guarantee that provider processing stops.

## Privacy and data

- **Sent to the configured endpoint:** your question, earlier chat messages, system instructions, and attached note content or selection. If supplied, the API key is sent there as an authorization header.
- **Stored locally:** settings and the API key are saved as plain text in `<vault>/.obsidian/plugins/ask-your-notes/data.json`. With history enabled, this file also stores the last conversation, capped at 200 saved messages.
- **History controls:** disabling persistence clears saved history while keeping the current conversation in memory. **New chat** clears the conversation; there is no conversation archive.
- **Sync and Git:** exclude `data.json` from shared backups, sync, and version control if you do not want credentials and chat history copied. The plugin does not encrypt this file.
- **Provider handling:** your chosen service determines how requests are processed and retained. A local Ollama endpoint can keep model requests on your machine.

Answers and generated note links can be inaccurate. Check the source before relying on an answer or inserting it into your notes.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Connection test fails | Check the full endpoint, API key, model availability, and network. Re-enter the key after switching providers. |
| Wrong note is attached | Review the references above the input. Remove them or reset automatic following. |
| Only part of a note is used | Clear the editor selection or disable selection preference. Check the per-note character limit. |
| Request fails or times out | Check the provider and retry. Generation times out after two minutes. Reduce references or start a new chat for context-limit errors. |
| An old topic affects a new question | Start a new chat; earlier messages remain when you switch notes. |

For [bug reports](https://github.com/Howzits/obsidian-ask-your-notes/issues), include the Obsidian and plugin versions, platform, provider/model, reproduction steps, and error message. Remove API keys and private note content.

## Development

Built with TypeScript and esbuild, without a UI framework. The current dependencies have been tested with **Node.js 22.23.4** and npm.

```bash
git clone https://github.com/Howzits/obsidian-ask-your-notes.git
cd obsidian-ask-your-notes
npm ci
npm run build
npm test
```

Copy `main.js`, `manifest.json`, and `styles.css` into a development vault's plugin folder. No separate logo files are needed at runtime. Run `npm run dev` to watch changes, then reload the plugin in Obsidian after rebuilding.

Run `npm run build:brand` after editing the vector logo master. See [asset documentation](assets/README.md) for exports and [CHANGELOG.md](CHANGELOG.md) for release history.

Contributions are welcome. Keep changes focused, run `npm run build` and `npm test`, and explain the behavior changed and how it was verified in your pull request.

## License

[MIT](LICENSE).
