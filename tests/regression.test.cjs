const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function load(entry, obsidian = {}, extra = {}) {
  const code = buildSync({ entryPoints: [path.join(__dirname, '..', entry)], bundle: true,
    platform: 'node', format: 'cjs', external: ['obsidian'], loader: { '.svg': 'text' }, write: false }).outputFiles[0].text;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports,
    require: name => name === 'obsidian' ? obsidian : require(name),
    AbortController, DOMException, TextDecoder, fetch, console, ...extra });
  return module.exports;
}

const options = { endpoint: 'http://localhost/test', apiKey: '', model: 'test',
  messages: [{ role: 'user', content: 'test' }], temperature: 0, maxTokens: 0 };

test('non-streaming stop resolves promptly and ignores a late response', async () => {
  const response = deferred();
  const api = load('src/api.ts', { requestUrl: () => response.promise });
  const controller = new AbortController();
  const pending = api.chatCompletion({ ...options, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  response.resolve({ status: 200, json: { choices: [{ message: { content: 'late' } }] } });
});

test('pre-cancelled requests never contact the provider', async () => {
  let calls = 0;
  const api = load('src/api.ts', { requestUrl: () => { calls++; } });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(api.chatCompletion({ ...options, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('SSE preserves split Chinese bytes and final data without newline', async () => {
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"！"}}]}');
  const stream = new ReadableStream({ start(c) {
    for (let i = 0; i < bytes.length; i++) c.enqueue(bytes.slice(i, i + 1));
    c.close();
  } });
  const api = load('src/api.ts', {}, { fetch: async () => new Response(stream) });
  let result = '';
  assert.equal(await api.chatCompletionStream({ ...options, onDelta: (_, full) => { result = full; } }), '你好！');
  assert.equal(result, '你好！');
});

test('SSE surfaces provider errors and cancels its reader', async () => {
  let cancelled = false;
  const api = load('src/api.ts', {}, { fetch: async () => new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode('data: {"error":{"message":"quota exceeded"}}\n')); },
    cancel() { cancelled = true; }
  })) });
  await assert.rejects(api.chatCompletionStream(options), /quota exceeded/);
  assert.equal(cancelled, true);
});

function fixture() {
  const dom = new JSDOM('<body></body>');
  const { document, HTMLElement, Event } = dom.window;
  Object.assign(HTMLElement.prototype, {
    empty() { this.replaceChildren(); }, setText(text) { this.textContent = text; },
    addClass(cls) { this.classList.add(cls); }, removeClass(cls) { this.classList.remove(cls); },
    toggleClass(cls, on) { this.classList.toggle(cls, on); },
    createEl(tag, options = {}) {
      const el = document.createElement(tag);
      if (options.cls) el.className = options.cls;
      if (options.text) el.textContent = options.text;
      for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, value);
      this.append(el); return el;
    },
    createDiv(options) { return this.createEl('div', options); },
    createSpan(options) { return this.createEl('span', options); }
  });
  class MarkdownView {}
  class TFile { constructor(path) { this.path = path; this.basename = path.split('/').pop().replace(/\.md$/, ''); } }
  class AbstractInputSuggest {
    constructor(app) { this.app = app; } open() {} close() {}
  }
  class ItemView {
    constructor(leaf) { this.app = leaf.app; this.containerEl = document.createElement('div');
      this.containerEl.append(document.createElement('div'), document.createElement('div')); }
    registerEvent() {}
  }
  const response = deferred();
  let requests = 0;
  const obsidian = { ItemView, MarkdownView, TFile, AbstractInputSuggest, Notice: class {},
    Platform: { isMobileApp: false }, setIcon() {},
    MarkdownRenderer: { render: async (_app, text, el) => el.setText(text) },
    requestUrl: () => { requests++; return response.promise; } };
  const globals = { document, HTMLElement, Event, window: dom.window, navigator: dom.window.navigator };
  const { ChatView } = load('src/view.ts', obsidian, globals);
  const { DEFAULT_SETTINGS } = load('src/types.ts');
  const plugin = { settings: { ...DEFAULT_SETTINGS, provider: 'custom', apiEndpoint: options.endpoint, stream: false },
    history: [], saveAll: async () => {}, manifest: { id: 'ask-your-notes' } };
  const file = new TFile('folder/note.md');
  const editor = new MarkdownView();
  editor.file = file; editor.editor = { getValue: () => 'unsaved text', getSelection: () => '' };
  const leaf = { view: editor }; editor.leaf = leaf;
  const app = { workspace: { getActiveViewOfType: () => editor, getLeavesOfType: () => [leaf] },
    vault: { getAbstractFileByPath: () => file, cachedRead: async () => 'old disk text', getMarkdownFiles: () => [file] } };
  const view = new ChatView({ app }, plugin);
  view.buildUI(); view.renderConversation();
  return { view, plugin, app, editor, file, response, dom, requests: () => requests, obsidian, globals, load };
}

test('blank unsaved editor never falls back to old disk content', async () => {
  const f = fixture(); f.editor.editor.getValue = () => '';
  assert.equal(await f.view.collectContext(), null);
  f.dom.window.close();
});

test('disabled automatic context hides its chip but allows explicit references', async () => {
  const f = fixture(); f.plugin.settings.includeActiveNote = false;
  f.view.renderChips();
  assert.equal(f.view.chipsRow.querySelectorAll('.llm-chat-chip-ref').length, 0);
  assert.equal(await f.view.collectContext(), null);
  f.view.addRef(f.file);
  assert.equal((await f.view.collectContext())[0].content, 'unsaved text');
  assert.equal(f.view.chipsRow.querySelectorAll('button').length, 3);
  f.dom.window.close();
});

test('double send during context reading creates exactly one user message/request', async () => {
  const f = fixture(), context = deferred();
  f.view.collectContext = () => context.promise;
  f.view.inputEl.value = 'question'; const first = f.view.send();
  f.view.inputEl.value = 'second'; await f.view.send();
  assert.equal(f.view.messages.length, 1);
  context.resolve(null); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests(), 1);
  f.response.resolve({ status: 200, json: { choices: [{ message: { content: 'answer' } }] } });
  await first; assert.equal(f.view.messages.length, 2);
  assert.equal(f.view.inputEl.value, 'second'); f.dom.window.close();
});

test('new chat during context reading prevents an old request from starting', async () => {
  const f = fixture(), context = deferred();
  f.view.collectContext = () => context.promise;
  f.view.inputEl.value = 'question'; const pending = f.view.send();
  f.view.startNewChat(); context.resolve(null); await pending;
  assert.equal(f.requests(), 0); assert.equal(f.view.messages.length, 0);
  assert.equal(f.view.busy, false); f.dom.window.close();
});

test('new chat while requesting discards late responses', async () => {
  const f = fixture(); f.view.inputEl.value = 'question'; const pending = f.view.send();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests(), 1); f.view.startNewChat();
  f.response.resolve({ status: 200, json: { choices: [{ message: { content: 'late reply' } }] } });
  await pending;
  assert.equal(f.view.messages.length, 0); assert.equal(f.plugin.history.length, 0);
  assert.equal(f.view.busy, false); f.dom.window.close();
});

test('Chinese IME Enter does not submit a message', () => {
  const f = fixture(); let calls = 0; f.view.send = async () => { calls++; };
  f.view.inputEl.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
  assert.equal(calls, 0);
  f.view.inputEl.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Enter' }));
  assert.equal(calls, 1); f.dom.window.close();
});

test('reference selection in the middle preserves text after the cursor', () => {
  const f = fixture();
  const { NoteSuggest } = load('src/suggest.ts', f.obsidian, f.globals);
  const input = f.view.inputEl; input.value = 'explain @no please'; input.setSelectionRange(11, 11);
  let selected;
  const suggest = new NoteSuggest(f.app, input, file => { selected = file; });
  assert.equal(suggest.getSuggestions(input.value).length, 1);
  suggest.selectSuggestion(f.file, {});
  assert.equal(input.value, 'explain  please'); assert.equal(selected, f.file);
  assert.equal(suggest.popoverOpen, false); f.dom.window.close();
});

test('draft survives language rebuild and truncation is visible', async () => {
  const f = fixture(); f.view.inputEl.value = 'unfinished question';
  f.view.rebuildUI(); assert.equal(f.view.inputEl.value, 'unfinished question');
  f.plugin.settings.maxContextChars = 3;
  await f.view.updateContextBar(); assert.match(f.view.contextEl.textContent, /truncated to 3/);
  f.dom.window.close();
});

test('failed context read unlocks input and offers recovery', async () => {
  const f = fixture(); f.view.collectContext = async () => { throw new Error('missing'); };
  f.view.inputEl.value = 'question'; await f.view.send();
  assert.equal(f.view.busy, false); assert.equal(f.requests(), 0);
  assert.equal(f.view.regenerateButtons.length, 1); f.dom.window.close();
});

test('history saves are ordered snapshots and obey persistence setting', async () => {
  const { default: Plugin } = load('main.ts', { Plugin: class {}, PluginSettingTab: class {},
    ItemView: class {}, AbstractInputSuggest: class {} });
  const plugin = new Plugin(), gate = deferred(), saved = [];
  plugin.saveData = async data => { if (saved.length === 0) { saved.push(data); await gate.promise; } else saved.push(data); };
  plugin.history = [{ role: 'user', content: 'first' }]; const first = plugin.saveAll();
  plugin.history[0].content = 'second'; const second = plugin.saveAll();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(saved.length, 1);
  assert.equal(saved[0].history[0].content, 'first'); gate.resolve(); await Promise.all([first, second]);
  assert.equal(saved[1].history[0].content, 'second');
  plugin.settings.persistHistory = false; await plugin.saveAll(); assert.equal(saved[2].history.length, 0);
});
