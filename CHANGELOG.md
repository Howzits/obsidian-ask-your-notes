# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.1] - 2026-11-09

### Fixed

- Community-review blockers: manual settings headings and direct element style assignments.
- Deprecated settings APIs, clipboard fallback, unsafe API response access, and CSS important declarations.

### Changed

- All settings use searchable declarative definitions and native group headings.
- Release CI checks the blocking Obsidian ESLint rules and generates artifact provenance attestations.
- Build uses Node's built-in module list instead of the deprecated builtin-modules dependency.

## [1.3.0] - 2026-11-09

### Added

- First-run connection guidance, request status, an explicit note-reference button, and regression tests.
- Theme-aware identity and controls, light/dark logo assets and screenshots, and a complete Chinese README.
- Context truncation feedback, request timeouts, and persistent connection-test results.

### Fixed

- Duplicate sends during context reading, stale replies across sessions, and non-streaming cancellation handling.
- Empty unsaved editors falling back to old disk content and inconsistent automatic-context references.
- Context-read error recovery, reference changes, suggestion cursor handling, and draft preservation.
- Streaming final-line parsing, serialized persistence, history disabling, and provider key isolation.
- Markdown rendering, source paths, keyboard access, and narrow-sidebar layouts.

### Changed

- Minimum Obsidian version is 1.15.0, matching the version verified for this release.
- Release workflow uses Node.js 22.23.4 and runs regression tests before publishing.

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

[Unreleased]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.3.1...HEAD
[1.3.1]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.2.1...1.3.0
[1.2.1]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/Howzits/obsidian-ask-your-notes/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/Howzits/obsidian-ask-your-notes/releases/tag/1.0.0
