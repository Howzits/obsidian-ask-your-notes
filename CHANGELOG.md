# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.1] - 2026-11-06

### Fixed

- `@`-mention suggester not opening when triggered from the textarea input (Obsidian reads non-`<input>` elements via `innerText`, which is always empty for a `<textarea>`)

## [1.2.0] - 2026-11-06

### Added

- `@`-mention context references: type `@` in the chat input to pick any vault note
- Context chips above the input with remove (`×`) and reset-to-auto (`↺`) actions
- Multi-note context: referenced notes are sent as separate `<note>` blocks

## [1.1.0] - 2026-11-05

### Added

- Open-source release: modular source layout (`src/`), English/中文 UI, provider presets (DeepSeek, OpenAI, OpenRouter, Ollama, custom), persistent chat history, regenerate/copy/insert reply actions, GitHub Actions release workflow
- Redesigned chat UI

## [1.0.0] - 2026-11-04

### Added

- Initial release: sidebar chat view with LLM API integration, active note as default context, streaming replies with stop support

[Unreleased]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.2.1...HEAD
[1.2.1]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/Howzits/obsidian-ask-your-notes/releases/tag/1.0.0
