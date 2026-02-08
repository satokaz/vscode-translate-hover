# AGENTS.md

This document helps contributors and AI agents understand the repository and work effectively.

# Project Guidelines

## Code Style
- TypeScript strict mode; keep naming conventions from [src/types.ts](src/types.ts) and [src/extension.ts](src/extension.ts).
- Use the logger wrapper (no console logging) in [src/utils/logger.ts](src/utils/logger.ts).
- Keep import order: Node.js -> third-party -> local (see [src/extension.ts](src/extension.ts)).

## Architecture
- Entry point is [src/extension.ts](src/extension.ts): hover provider, commands, debounce, cancellation, LRU cache.
- Providers live in [src/providers/google.ts](src/providers/google.ts) and [src/providers/openai.ts](src/providers/openai.ts).
- UI is rendered by [src/ui/hover.ts](src/ui/hover.ts); config is centralized in [src/config.ts](src/config.ts).

## Build and Test
- Install: `npm install`
- Build: `npm run compile`
- Watch: `npm run watch`
- Lint: `npm run lint`
- Test: `npm test` (Mocha on `out/test/**/*.test.js` with setup stub)
- Package: `npm run package`

## Project Conventions
- Hover flow uses debounce + cancellation checks + AbortController; keep these in sync when editing [src/extension.ts](src/extension.ts).
- Translation cache is an LRU with max 30 entries keyed by selection/method/targetLanguage/modelName (see [src/extension.ts](src/extension.ts) and [src/types.ts](src/types.ts)).
- Auto language routing uses `auto-xx` pairs in [src/constants.ts](src/constants.ts) and helpers in [src/utils/languageDetector.ts](src/utils/languageDetector.ts).

## Integration Points
- VS Code APIs for hover/commands/quick pick/clipboard are used in [src/extension.ts](src/extension.ts).
- Google Translate scrape uses axios and optional `http.proxy` in [src/providers/google.ts](src/providers/google.ts).
- OpenAI Chat Completions with system-role detection and optional base URL in [src/providers/openai.ts](src/providers/openai.ts).

## Security
- Selected text is sent to Google/OpenAI for translation (see [README.md](README.md)).
- API keys live in VS Code settings and must not be logged; only use the logger wrapper.

## Project Overview

**vscode-translate-hover** is a VS Code extension that translates selected text and shows the result in a hover.

### Key features

- Automatic translation hover when text is selected
- Debounce: reduce API calls for rapid selections (default 300ms)
- Automatic language detection and routing (auto-xx modes)
  - `auto-ja`: Japanese → English, others → Japanese
  - `auto-en`: English → Japanese, others → English
  - `auto-zh`: Chinese → English, others → Chinese
  - Two detection methods: fast regex-based (default) and optional LLM-based (OpenAI only)
- Switchable translation providers: Google or OpenAI
- In-memory translation cache (LRU)
- Paste-translation command to insert the translated text
- Proxy support for Google provider
- Custom base URL support for OpenAI (e.g., LiteLLM proxy)
- Dynamic system-role support detection per OpenAI model (cached per model+baseURL)
- Configurable `reasoning_effort` for o1-series models
- Model name display shown in the hover when using OpenAI

## Tech stack

- **Language**: TypeScript (strict)
- **Runtime**: Node.js (ES2020 target)
- **Platform**: VS Code Extension API (compatible with recent VS Code versions)
- **HTTP client**: axios
- **AI SDK**: openai (v4)
- **Build**: TypeScript compiler (`tsc`)
- **Package manager**: npm

## Project structure

```
vscode-translate-hover/
├── src/
│   ├── extension.ts           # main entry point (hover provider & orchestration)
│   ├── types.ts               # TypeScript type definitions
│   ├── constants.ts           # constants
│   ├── config.ts              # settings reading
│   ├── utils/
│   │   ├── format.ts          # small formatting helpers
│   │   └── languageDetector.ts # language detection helpers
│   ├── providers/
│   │   ├── google.ts          # Google translate provider
│   │   └── openai.ts          # OpenAI provider
│   └── ui/
│       └── hover.ts           # hover UI generation
├── out/                       # compiled JS
├── package.json               # npm scripts & contributes
├── tsconfig.json              # TypeScript config
├── CHANGELOG.md               # changelog
└── README.md                  # user documentation
```

## Architecture

### Layered design

1. **Presentation layer** (`ui/`)
   - Builds and formats the hover display
   - Uses Markdown for rich rendering

2. **Business logic layer** (`extension.ts`)
   - Integrates with the VS Code API
   - Handles events, debouncing, cache, and sequencing

3. **Data access layer** (`providers/`)
   - Communicates with external translation services
   - Handles network errors and parsing

4. **Utility layer** (`utils/`, `config.ts`, `constants.ts`)
   - Shared helpers, settings management, constants

### Design principles

- **Single responsibility**: each module has one primary responsibility
- **Dependency injection**: settings and external clients are passed in or read from config
- **Separation of concerns**: UI, business logic, and provider code are isolated
- **Type safety**: prefer explicit types under TypeScript strict mode

## ファイル別詳細

### `src/extension.ts`

Role: main extension entry point and orchestration

Key functions:
- `activate(context)`: initialize the extension
  - register hover provider
  - register commands
  - initialize caches
  - manage debounce timers (module-scoped)
  - preload system-role support for configured models in background (optimization)
- `deactivate()`: cleanup (clear timers, dispose logger)
- `translateText(selection, config)`: route translation to the configured provider
- `preloadSystemRoleSupport()`: background pre-check for the configured OpenAI model(s)

Debounce & hover flow:
- Module-level variables: `debounceTimer`, `pendingSelection`, `lastSelectionTime`
- New selection resets the timer and triggers a translation after 300ms (`DEFAULTS.DEBOUNCE_DELAY`)
- Uses an async debounce promise inside `provideHover` to wait for translation completion
- Ensure `CancellationToken` checks and `AbortController` wiring (token → controller.abort())
- If cache hit, show cached result immediately and skip debounce
- Cancel pending work when selection changes or the token requests cancellation

Dependencies (example):
```typescript
import { TranslationCache } from './types';
import { getTranslationConfig } from './config';
import { createHover } from './ui/hover';
import { translateWithGoogle } from './providers/google';
import { translateWithOpenAI } from './providers/openai';
import { formatTranslationResult } from './utils/format';
```

### `src/types.ts`

Role: central TypeScript type definitions

Key types:
- `TranslationCache`: structure for cached translation entries (selection, result, method, modelName)
- `TranslationConfig`: structured config values used across the extension
- `SystemRoleSupportCache`: cache structure for system-role support checks
  - `supportsSystemRole: boolean | null` — `null` means "undetermined" (check failed)
- `OpenAIClientConfig`: OpenAI client configuration type (apiKey, baseURL?)
- `SystemRoleCheckResult`: result of system-role check (supportsSystemRole, checkedAt, errorMessage?)

### `src/constants.ts`

Role: constants used across the project

Defined constants:
- `CONFIG_SECTION`: the VS Code configuration section name
- `DEFAULTS`: default values (timeouts, model name, **debounce delay**, etc.)
- `LANGUAGE_NAMES`: mapping of language codes to human-friendly names

### `src/config.ts`

Role: reading values from VS Code settings

Functions:
- `getTranslationConfig()`: return all configuration values in a structured object

### `src/utils/format.ts`

Role: text formatting helpers

Functions:
- `formatTranslationResult(text)`: normalize punctuation and format translated text (e.g., convert full-width brackets to half-width)

### `src/utils/logger.ts`

Role: manage a dedicated OutputChannel for logs

Functions:
- `initializeLogger(channelName)`: create (singleton) OutputChannel
- `disposeLogger()`: resource cleanup
- `setDebugEnabled(enabled)`: toggle debug logging
- `debug(...args)`: debug-level logging (controlled by config)
- `info(...args)`: info-level logging
- `error(...args)`: error-level logging
- `show()`: show the output panel
- `clear()`: clear logs

Features:
- ISO timestamps on log entries
- Automatic JSON serialization for objects
- Singleton OutputChannel management
- Debug logs gated by user setting

Note: Do not log secrets or full prompts/responses.

### `src/utils/languageDetector.ts`

Role: text language detection and translation-direction resolution

Functions:
- `isJapanese(text)`: detect Japanese (hiragana/katakana/kanji ratio ≥ 30%)
- `isChinese(text)`: detect Chinese (exclude Japanese-only characters; kanji ratio ≥ 30%)
- `isKorean(text)`: detect Korean (Hangul ratio ≥ 30%)
- `detectLanguage(text)`: return language code (ja, zh, ko, en)
- `resolveTargetLanguage(text, autoConfig, pairs)`: determine the appropriate target language for auto-xx settings

Features:
- Character-class based detection
- Uses ≥30% character ratio heuristic
- Supports `auto-ja`, `auto-en`, `auto-zh` routing

### `src/providers/google.ts`

Role: Google Translate request/parse integration

Functions:
- `translateWithGoogle(selection, targetLanguage)`: perform translation
- `buildGoogleTranslateUrl(text, targetLanguage, fromLanguage)`: build the request URL

Features:
- Proxy setting support
- Optional dictionary data retrieval
- 10s network timeout
- Accepts `AbortSignal` for cancellation

### `src/providers/openai.ts`

Role: OpenAI integration

Module-level variables:
- `DEBUG_LOG_ENABLED`: debug logging flag
- `systemRoleSupportCache`: `Map<string, SystemRoleSupportCache>` — cache per model+baseURL

Helpers:
- `debugLog(...args)`: debug logging (gated by `DEBUG_LOG_ENABLED`)
- `getCacheKey(modelName, baseUrl)`: cache key helper (`modelName::baseUrl`)
- `isSystemRoleError(error)`: detect system-role-related errors
- `checkSystemRoleSupport(openai, modelName, timeoutMs)`: perform system role support check (5s timeout)

Exports:
- `translateWithOpenAI(selection, config)`: perform translation
- `preloadSystemRoleSupportForModel(apiKey, baseUrl, modelName)`: pre-check helper

Type safety:
- `ChatCompletionMessageParam` and other precise types used
- `error: unknown` + `instanceof Error` safe error handling

Features:
- Custom base URL support (LiteLLM proxy etc.)
- `reasoning_effort` handling for o1 models
- Dynamic system-role detection per model (5s timeout)
- Fallback strategy: cache `supportsSystemRole: null` when undetermined; retry later
- Automatic fallback to user-role-only messages for models that don't support system role

### `src/ui/hover.ts`

Role: hover UI rendering

Functions:
- `escapeHtml(text)`: escape HTML-special characters (XSS prevention)
- `createHover(translationResult, isCached, method, modelName?)`: build a VS Code Hover object

Display elements:
- Engine identification (🌸 Google / 🤖 OpenAI)
- Model name display: when using OpenAI, show the model name in a `<sub>` (escaped)
- Translation text
- Cache state indicator
- Paste command link

## Settings (package.json)

```json
{
  "translateHover.translationMethod": "google" | "openai",
  "translateHover.targetLanguage": "auto-ja" | "auto-en" | "auto-zh" | "ja" | "en" | "zh" | etc.,
  "translateHover.languageDetectionMethod": "regex" | "llm",
  "translateHover.openaiApiKey": "sk-...",
  "translateHover.openaiBaseUrl": "https://custom-endpoint.com/v1",
  "translateHover.openaiModel": "gpt-4o-mini" | "o1-preview" | etc.,
  "translateHover.openaiReasoningEffort": "" | "low" | "medium" | "high"
}
```

**自動言語検出モード**:
- `auto-ja`: Japanese → English, others → Japanese
- `auto-en`: English → Japanese, others → English
- `auto-zh`: Chinese → English, others → Chinese

**言語検出方式**:
- `regex`: 正規表現ベース（高速、無料、Google/OpenAI両方で使用可）
- `llm`: LLMベース（高精度、OpenAI使用時のみ、追加コストあり）

## Development workflow

### Compile

```bash
npm run compile
```

### Watch mode

```bash
npm run watch
```

### Packaging

```bash
vsce package
```

### Debug

Press F5 to start the extension in debug mode (configured in `.vscode/launch.json`)

## Coding conventions

### TypeScript

- **strictモード**: 有効
- **命名規則**:
  - 関数: camelCase（例: `translateText`）
  - 定数: UPPER_SNAKE_CASE（例: `CONFIG_SECTION`）
  - 型: PascalCase（例: `TranslationConfig`）
  - プライベート関数: camelCase（exportしない）

### コメント

- JSDocスタイルの関数コメント推奨
- セクション区切りコメント（80文字の等号線）
- デバッグログには `[DEBUG]` プレフィックス
- エラーログには `[ERROR]` プレフィックス

### インポート順序

1. Node.js標準モジュール
2. サードパーティライブラリ（vscode, axios, openai）
3. ローカルモジュール（相対パス）

## Error handling

### Google translation

- タイムアウト: 10秒
- エラー時の戻り値: `'Translation failed'`
- エラーログ出力: `logger.error('Google translation failed:', error)`

### OpenAI translation

- APIキー未設定時: 設定促進メッセージを返す
- On error: return a string containing the error message
- **System Role errors**: automatically retry with user role only (record in cache)
- エラーログ出力: `logger.error('OpenAI translation failed:', error)`

### System Role support check

- タイムアウト: 5秒（AbortControllerで制御）
- On error: cache as `supportsSystemRole: false`
- リトライなし（チェック失敗 = サポートなしと判断）
- デバッグログで詳細を記録

## Debugging & logging

### ログ出力システム

**専用出力チャネル**（`src/utils/logger.ts`）:
- VS Codeの出力パネルに専用チャネル "Translate Hover" を作成
- タイムスタンプ付きログ出力
- ログレベル: DEBUG（オプション）、INFO、ERROR
- デバッグログは設定で有効/無効を切り替え可能

**ログ表示コマンド**:
- コマンド: `extension.showLogs`
- UI: "ログ出力チャネルを表示"
- ログパネルを開いて出力を確認

**設定項目**:
- `translateHover.enableDebugLogging`: デバッグログの有効/無効（デフォルト: false）
- 設定変更は即座に反映（再起動不要）

### ログ出力内容

#### 拡張機能ライフサイクル（extension.ts）
- `[INFO] Extension "vscode-translate-hover" is now active!` - 拡張機能起動
- `[INFO] Debug logging enabled/disabled` - デバッグログ切り替え

#### 設定ロード（config.ts）
- `[DEBUG] Config loaded: {translationMethod, openaiModel, hasApiKey, enableDebugLogging}` - 設定読み込み時のログ

#### キャッシュ操作（extension.ts）
- `[DEBUG] Selected text: "<text>"` - 選択されたテキスト
- `[DEBUG] Selection length: <number>` - 選択文字数
- `[DEBUG] New selection detected, starting translation...` - 新規選択検出
- `[DEBUG] Translation result: <result>` - translation result
- `[DEBUG] Cache updated: {method, modelName, hasResult}` - cache updated
- `[DEBUG] Using cached translation for selection` - cache used

#### モデル名表示（hover.ts）
- `[DEBUG] Displaying model name in hover: <modelName>` - モデル名表示

#### System Roleサポート（openai.ts）
- `[DEBUG] Checking cache for key: <modelName>::<baseUrl>` - cache lookup
- `[DEBUG] Cache hit for <modelName> at <baseUrl>: <result>` - cache hit
- `[DEBUG] Cache miss for <modelName> at <baseUrl>` - cache miss
- `[DEBUG] Check result for <modelName>: <result>` - チェック結果
- `[DEBUG] Stored in cache: <key> => <result>` - cache stored
- `[INFO] Preloading system role support for model: <modelName>` - 事前チェック開始
- `[INFO] System role support preload completed for: <modelName>` - 事前チェック完了

#### 言語検出（extension.ts, openai.ts）
- `[DEBUG] LLM detected language: <lang>` - LLMベース検出結果
- `[DEBUG] Regex detected language: <lang>` - 正規表現ベース検出結果
- `[DEBUG] Auto-detect mode: target language: <lang>` - 自動検出による翻訳方向

### Error logs

- `[ERROR] Google translation failed:` - Google translation error
- `[ERROR] OpenAI translation failed:` - OpenAI translation error
- `[ERROR] System role support check failed:` - サポートチェックエラー
- `[ERROR] LLM language detection failed:` - LLM言語検出エラー



Automated tests: currently not implemented. Suggested future additions:

1. **Unit tests**:
   - `formatTranslationResult()`
   - `buildGoogleTranslateUrl()`
   - provider response parsing and error paths (mocked)

2. **Integration tests**:
   - VS Code API integration for hover provider
   - hover race-condition and cancellation scenarios

3. **E2E tests**:
   - Full translation flow end-to-end


## Performance considerations

### Cache strategy

**翻訳結果キャッシュ**:
- 現在: 1件のみ保持（最後の翻訳結果）
- モデル名も保存してトラッキングを強化
- 将来: LRUキャッシュの実装を検討

**System Roleサポートキャッシュ**:
- モデル名×ベースURLごとにキャッシュ
- 拡張機能実行中は永続（再起動で自動クリア）
- 初回チェックコスト: 約$0.000001未満（1トークン）
- 2回目以降はAPI呼び出し不要
- **フォールバック戦略**: チェック失敗時は`supportsSystemRole: null`（未確定）としてキャッシュせず、次回再チェック

### API call optimizations

- 同一選択の重複翻訳を防止
- タイムアウト設定（Google: 10秒、System Roleチェック: 5秒）
- **事前チェック**: activate時にユーザー設定モデルのみをチェック（最適化: 全モデルではなく設定モデルのみ）
- **キャッシュヒット率**: 同一モデル使用時は100%（再チェック不要）

### Memory management

- 翻訳結果キャッシュ: 1件のみ（メモリ影響最小）
- System Roleキャッシュ: 通常5-10エントリ程度（軽量）
- 大きなテキストの翻訳には注意

## セキュリティ

### API key handling

- VS Code設定に保存（ユーザースコープ）
- コードには含めない
- ログに出力しない

### HTTPS usage

- Google翻訳: HTTPS
- OpenAI API: HTTPS
- カスタムベースURLは検証なし（ユーザー責任）

## Extension addition guidelines

### Adding a new translation provider

1. `src/providers/` に新しいファイルを作成（例: `deepl.ts`）
2. `translateWith[Provider]()` 関数を実装
3. `package.json` の `translationMethod` enum に追加
4. `extension.ts` の `translateText()` にルーティング追加
5. `ui/hover.ts` のアイコン追加（オプション）

### Adding a new configuration setting

1. `package.json` の `contributes.configuration.properties` に追加
2. `src/types.ts` の `TranslationConfig` に型を追加
3. `src/config.ts` の `getTranslationConfig()` で値を取得
4. 該当する関数で設定値を使用
5. 設定変更監視が必要な場合は `extension.ts` で `onDidChangeConfiguration` を使用

### Adding a command

1. `package.json` の `contributes.commands` に追加
2. `extension.ts` で `vscode.commands.registerCommand()` を使用して実装
3. `context.subscriptions.push()` でコマンドを登録

### Adding logging

1. `import * as logger from './utils/logger'` でロガーをインポート
2. デバッグ情報: `logger.debug(...)`（設定で制御可能）
3. 情報ログ: `logger.info(...)`
4. エラーログ: `logger.error(...)`
5. **console.logやconsole.errorは使用しない**（ユーザーから見えない）

### UI changes

1. `src/ui/hover.ts` の `createHover()` を編集
2. MarkdownString の仕様に従う
3. コマンドリンクは `command:extension.commandName` 形式
2. MarkdownString の仕様に従う
3. コマンドリンクは `command:extension.commandName` 形式

## Troubleshooting

### Hover not showing

- `activationEvents: ["onStartupFinished"]` が設定されているか確認
- ログ出力チャネルでデバッグ情報を確認（コマンド: "ログ出力チャネルを表示"）

### Translation fails

- APIキーが正しく設定されているか確認
- ネットワーク接続を確認
- プロキシ設定を確認（Google翻訳）
- ログ出力チャネルでエラー詳細を確認

### Compile errors

- `npm install` で依存関係を再インストール
- `tsconfig.json` の設定を確認
- 型定義の import を確認

## Future improvements

### Priority: High

1. ~~**デバウンス処理**: 連続選択時のAPI呼び出し削減~~ ✅ 実装済み（v0.2.0）
2. **LRUキャッシュ**: 複数の翻訳結果を保持
3. ~~**出力チャネル**: 専用のログ出力チャネル~~ ✅ 実装済み（v0.2.0）
4. **エラーハンドリング強化**: リトライロジック、カスタムエラークラス

### Priority: Medium

1. **テストの追加**: ユニットテスト、統合テスト
2. ~~**設定変更の監視**: 再起動不要で設定反映~~ ✅ 実装済み（enableDebugLogging）
3. **翻訳履歴機能**: サイドバーパネルで履歴表示
4. **バッチ翻訳**: 複数選択箇所の一括翻訳

### Priority: Low

1. **DeepL API対応**: より高精度な翻訳
2. **Claude API対応**: Anthropic APIのサポート
3. **カスタム辞書**: 用語集機能
4. **比較モード**: 複数エンジンの並列表示

## Release process

1. `CHANGELOG.md` を更新
2. `package.json` のバージョンを更新
3. `npm run compile` でコンパイル
4. テスト実行（手動）
5. `vsce package` でVSIXファイル生成
6. VS Code Marketplaceに公開

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Google Translate API](https://translate.google.com/)

## Contact

- Repository: https://github.com/satokaz/vscode-translate-hover
- Issues: https://github.com/satokaz/vscode-translate-hover/issues

---

# Project Guidelines

This short guide is for AI agents and contributors working on `vscode-translate-hover`.

## Summary
- Purpose: Translate selected text and show translation in a VS Code Hover.
- Providers: Google (HTTP scrape via axios) and OpenAI (Chat Completions via `openai` SDK).
- Focus: Responsiveness (debounce + cancellation), predictable UX, safe logging, and small in-memory LRU cache.

## Code Style
- TypeScript in `strict` mode. Keep types explicit and avoid `any` where practical.
- Use `src/utils/logger.ts` for logging—do not use `console.*`.
- Import order: Node.js built-ins → third-party → local modules.

## Architecture (where to change what)
- Entry/orchestration: `src/extension.ts` (hover provider, debounce, CancellationToken checks, AbortController propagation, request sequencing, LRU cache).
- Providers: `src/providers/google.ts` (axios + proxy + AbortSignal), `src/providers/openai.ts` (openai SDK, system-role detection, AbortSignal).
- UI: `src/ui/hover.ts` (Markdown hover, model name display, XSS-escaping).
- Config + constants: `src/config.ts`, `src/constants.ts`.

## Runtime Contracts / Conventions
- Hover flow MUST maintain: debounce, CancellationToken checks, request sequencing (latest-wins), and AbortController propagation into provider calls.
- Cache: in-memory LRU with max 30 entries. Key = `selection + method + targetLanguage + modelName`. Avoid storing large objects.
- Auto language detection: `regex` is default; `llm` (OpenAI) only when API key is set.
- OpenAI: perform system-role support check per model+baseURL and cache results; fallback to user-only messages for unsupported models.

## Build / Test / Lint
- Install: `npm install`
- Build: `npm run compile`
- Watch: `npm run watch`
- Lint: `npm run lint`
- Test: `npm test` (Mocha runs compiled tests under `out/test/**/*.test.js` with a `vscode` stub)
- Package: `npm run package`

Mandatory test rules for contributors/agents:
- Always run the test suite locally before opening a PR: `npm test`.
- If your change affects behavior and there are no tests covering it, add tests under `test/` and ensure they pass after `npm run compile`.

## Security & Privacy
- Selected text is sent to external services (Google/OpenAI) for translation. Document this in user-facing content as appropriate.
- Never log API keys or unredacted prompts/responses. Use debug logging only when scrubbed and gated.
- HTTPS is required; custom base URLs are user-responsibility.

## Testing Priorities (recommended next steps)
- Add unit tests for provider parsing and error paths, hover debounce/cancellation logic, and cache behavior.
- Add integration tests (if feasible) for hover provider behavior using a VS Code test harness.

If you'd like, I can add a short contributor PR checklist block to the top of this file (e.g., "Tests run: ✅", "New tests added: ✅").
