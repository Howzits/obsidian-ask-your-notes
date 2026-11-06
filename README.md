# Ask Your Notes

Chat with any OpenAI-compatible LLM inside Obsidian — **the note you are working on is sent as context automatically**.

> 在 Obsidian 里与任意 OpenAI 兼容的 LLM 对话，自动把当前笔记作为上下文。

## Features

- 💬 **Sidebar chat** with Markdown-rendered replies (code blocks, tables, lists, math)
- 📄 **Active note as context** — reads the editor buffer, so unsaved edits are included
- ✂️ **Selection-aware** — select a passage and only that selection is sent
- 🌊 **Streaming** responses on desktop with a stop button; graceful fallback to non-streaming on mobile
- 🔁 **Regenerate**, **copy** or **insert into note** from any reply
- 🧠 **Persistent history** across restarts (configurable)
- 🔌 **Provider presets** — DeepSeek, OpenAI, OpenRouter, Ollama (local), or any custom endpoint
- 🌍 **English / 中文 UI**, auto-detected from your system language
- 🔒 API key stays in your vault's plugin data — never leaves your machine except to your chosen API

## Installation

### From source

```bash
git clone <your-repo-url>
cd <repo>
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into:

```
<your-vault>/.obsidian/plugins/ask-your-notes/
```

Then reload Obsidian and enable **Ask Your Notes** under *Settings → Community plugins*.

### BRAT (alternative)

Add this repository to [BRAT](https://github.com/TfTHacker/obsidian42-brat) and let it install releases for you.

## Configuration

Open *Settings → Ask Your Notes* and pick a provider:

| Provider | Endpoint | Example model |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/chat/completions` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `openai/gpt-4o-mini` |
| Ollama (local) | `http://localhost:11434/v1/chat/completions` | `llama3.1` |
| Custom | any OpenAI-compatible endpoint | any |

Use **Test connection** to verify before chatting.

## Usage

- Open the chat from the ribbon icon, or run **Open LLM chat** from the command palette
- **Enter** sends, **Shift+Enter** adds a newline (IME composition never sends by accident)
- The context line above the input shows which note is being sent
- Hover a reply to **copy** it, **insert** it at the cursor, or **regenerate**
- **New chat** clears the conversation

### Tips

- Select text in the editor and ask "explain this" — only the selection is sent
- Turn off *Use the active note as context* for general questions
- Long notes are truncated at *Max context characters* (default 30,000)

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # type-check + production bundle
```

Reload Obsidian (`Cmd/Ctrl+R`) after each rebuild. The plugin is plain TypeScript bundled by esbuild; no framework.

## Releasing

Bump `version` in `manifest.json`, `package.json`, and `versions.json`, then push a matching tag:

```bash
git tag 1.1.0 && git push origin 1.1.0
```

The GitHub Actions workflow builds and attaches `main.js`, `manifest.json`, and `styles.css` to the release.

## License

[MIT](LICENSE)

---

## 中文说明

### 功能

- 侧边栏聊天，AI 回复以 Markdown 渲染
- 默认以**当前激活的笔记**为上下文（包含未保存的修改）
- 选中文本时只发送选中部分
- 桌面端流式输出、可随时停止；移动端自动降级
- 回复支持复制、插入到笔记光标处、重新生成
- 对话历史可持久化
- 内置 DeepSeek / OpenAI / OpenRouter / Ollama 预设，也支持任意自定义端点
- 界面支持中文 / English，默认跟随系统

### 安装

把 `main.js`、`manifest.json`、`styles.css` 放入 `<你的库>/.obsidian/plugins/ask-your-notes/`，重启 Obsidian 并在第三方插件中启用。

### 配置

设置 → Ask Your Notes，选择服务商并填入 API Key，点「测试连接」确认可用。

### 使用

- 功能入口：左侧边栏消息图标，或命令面板搜索「打开 LLM 聊天」
- Enter 发送，Shift+Enter 换行
- 输入框上方显示当前上下文笔记
- 悬停 AI 回复可复制、插入笔记、重新生成

### 许可证

[MIT](LICENSE)
