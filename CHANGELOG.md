# Change Log
All notable changes to the "vscode-translate-hover" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- **Hover cancellation hardening**: Stable hover updates under rapid cursor/selection changes
  - CancellationToken checks after debounce/translation
  - In-flight request sequencing to discard stale results
  - AbortController wiring for Google/OpenAI requests
- **Lint tooling**: Added ESLint configuration and npm script support
- **Unit tests expanded**: Added coverage for URL generation, formatting, language detection, and OpenAI utilities
- **Mocha-based test runner**: `npm test` now runs compiled unit tests with a VS Code stub
- **Repository:** Move mocha artifacts into `test/mocha-artifacts/` and update `scripts/*` to use the new path (added `scripts/move_mocha_artifacts.js`)
- **Translate Clipboard (QuickPick)**: Translate clipboard text and show the result in QuickPick
  - Command: `extension.translateClipboardQuickPick`
  - Press Enter to copy the translation to clipboard
- **Debounce Processing**: Reduces consecutive API calls during rapid text selection changes
  - 300ms delay before triggering translation (configurable via `DEFAULTS.DEBOUNCE_DELAY`)
  - Cancels pending translation if selection changes during delay
  - Shows VS Code's built-in "Loading..." message during translation
  - Cache hits bypass debounce for instant display
- **Dedicated Logging System**: Professional output channel for debugging and diagnostics
  - New `translateHover.enableDebugLogging` setting to control debug output
  - Timestamped logs with ISO format
  - Three log levels: DEBUG (optional), INFO, ERROR
  - "Show Logs" command to view output panel
  - Dynamic configuration monitoring (no restart required)
  - Comprehensive logging across all components:
    - Extension lifecycle events
    - Configuration loading
    - Translation operations and results
    - Cache operations
    - System role support detection
    - Language detection (regex and LLM-based)
- **Automatic Language Detection**: Automatically detects source text language and switches translation direction
  - New `auto-ja` mode: Japanese → English, other languages → Japanese
  - New `auto-en` mode: English → Japanese, other languages → English
  - New `auto-zh` mode: Chinese → English, other languages → Chinese
  - **Dual detection methods**:
    - **Regex-based** (default): Fast, free, character composition analysis
    - **LLM-based**: High accuracy using OpenAI API (OpenAI mode only, additional cost)
  - Configurable via `translateHover.targetLanguage` and `translateHover.languageDetectionMethod` settings
  - Works with both Google Translate and OpenAI API
- **Dynamic System Role Support Detection**: Automatically detects whether an OpenAI model supports the `system` role
  - Performs lightweight check (1 token) on first use of each model
  - Caches results per model and base URL combination
  - Preloads user-configured model on activation (optimized from checking all models)
  - Automatically adapts message structure for o1-series models (no system role, temperature, or max_tokens)
  - Works seamlessly with custom base URLs (LiteLLM Proxy, Azure OpenAI, etc.)
  - **Improved fallback strategy**: Check failures result in `null` (undetermined) state, triggering recheck on next use
- **Model Name Display in Hover**: Shows the OpenAI model name in hover tooltip for AI translations
  - Displayed as decorative text below the translation method header
  - Only shown for OpenAI translations (not Google Translate)
  - **XSS protection**: Model name is properly escaped
- **Enhanced Diagnostics Logging**: Added comprehensive debug logging across all components
  - **Configuration loading**: Logs translation method, model, and API key status
  - **Cache operations**: Logs cache updates with method, model name, and result status
  - **Model display**: Logs model name display in hover, including cases where model name is missing
  - **System role support**: Controllable via `DEBUG_LOG_ENABLED` flag in openai.ts
    - Cache key generation
    - Cache hit/miss status
    - System role support check results
    - Preload summary statistics
- **New Type Definitions**: Added `OpenAIClientConfig` and `SystemRoleCheckResult` interfaces for better type safety

### Changed
- OpenAI translation now automatically handles models without system role support (e.g., o1-series)
- Translation cache now stores model name for better tracking
- **Improved type safety**: Replaced `any` types with proper OpenAI SDK types (`ChatCompletionMessageParam`, `ChatCompletionCreateParamsNonStreaming`)
- **Optimized preload**: Now only checks user-configured model instead of all common models (reduces API calls)
- `SystemRoleSupportCache.supportsSystemRole` now accepts `boolean | null` to represent undetermined state
- Error handling now uses `unknown` type with proper `instanceof Error` checks
- **Type safety improvements**: Removed remaining `any` usage in Google/OpenAI providers and added typed response handling
- **Commands cleanup**: Consolidated commands under `contributes.commands`

## [0.1.0] - 2026-01-16

### Changed
- **Major Update**: Migrated from deprecated `request` package to `axios` for HTTP requests
- Updated VS Code engine requirement to `^1.85.0` (from `^1.14.0`)
- Updated TypeScript to version `5.3.3` (from `2.0.3`)
- Updated to modern VS Code extension development tooling:
  - Replaced `vscode` package with `@types/vscode` and `@vscode/test-electron`
  - Added `@vscode/test-cli` for testing
- Updated Node.js types to `^20.x` (from `^6.0.40`)
- Modernized TypeScript configuration:
  - Target ES2020 (from ES6)
  - Enabled strict mode and additional type checking
  - Added esModuleInterop and resolveJsonModule
- Improved code quality with strict TypeScript checks
- Added proper null/undefined checks for editor instances
- Added `activationEvents: onStartupFinished` to enable hover functionality on startup
- Updated build scripts to use modern npm commands
- Added comprehensive debug logging for text selection and translation process

### Fixed
- Fixed potential null pointer exceptions with editor access
- Improved error handling in translation requests
- Added timeout configuration for HTTP requests (10 seconds)

### Security
- Removed dependency on deprecated and unmaintained `request` and `request-promise` packages
- Updated all dependencies to latest secure versions

## [0.0.2]
- Previous release

## [Unreleased]
- Initial release