# GitHub Copilot repository instructions

This repository is a **VS Code extension** written in **TypeScript (strict)**.
Copilot should follow the existing architecture and conventions so changes stay consistent and safe.

## Goal of this extension

- Translate **selected text** and show the result in a VS Code **Hover**.
- Translation providers: **Google Translate** (`axios` scrape) or **OpenAI** (`openai` SDK Chat Completions).
- Emphasis: responsiveness (debounce + cancellation), predictable UX, and safe logging.

## Architectural map (where to change what)

- **Entry point / orchestration**: `src/extension.ts`
  - HoverProvider, commands, debounce, cancellation (`CancellationToken` + `AbortController`), request sequencing, and in-memory cache.
- **Configuration**: `src/config.ts`
  - Central place to read `translateHover.*` settings. Keep settings access here.
- **Providers**:
  - `src/providers/google.ts`: Google Translate request/parse; respects `http.proxy`; supports `AbortSignal`.
  - `src/providers/openai.ts`: OpenAI translation; optional base URL; dynamic **system role support** detection and caching; supports `AbortSignal`.
- **UI rendering**: `src/ui/hover.ts`
  - Builds Hover Markdown, paste command link, model name display (escape user-controlled strings).
- **Utilities**:
  - `src/utils/logger.ts`: OutputChannel-based logger. Use this instead of `console.*`.
  - `src/utils/languageDetector.ts`: regex language detection + `auto-xx` routing.

## Coding conventions (must follow)

- **TypeScript strict mode**: keep types explicit where helpful; avoid `any`.
- **No console logging**: use `src/utils/logger.ts` (`debug/info/error`) and never log secrets.
- **Import order**: Node.js built-ins → third-party → local modules (see `src/extension.ts`).
- Prefer small, pure helpers for testability; avoid side effects outside VS Code APIs.

## Hover/cancellation/cache rules (do not break)

- Hover flow must keep these aligned:
  - debounce (default `DEFAULTS.DEBOUNCE_DELAY`)
  - `CancellationToken` checks
  - request sequencing (latest request wins)
  - `AbortController` abort propagation into provider calls
- Cache is an in-memory **LRU** with **max 30 entries**.
  - Key: `selection + method + targetLanguage + modelName`.
  - Ensure new features do not accidentally explode cache keys or store large objects.

## Language auto-detection

- Auto target languages use `auto-xx` pairs in `src/constants.ts` and helpers in `src/utils/languageDetector.ts`.
- `languageDetectionMethod = llm` is only valid when using OpenAI and an API key is set; otherwise fall back to regex.

## OpenAI specifics

- Use the `openai` SDK (v4) Chat Completions.
- Support optional `translateHover.openaiBaseUrl` for compatible providers.
- Keep **system role support detection** behavior intact (some models reject `system`).
- Handle `reasoning_effort` only when configured; keep compatibility with non-o1 models.

## Security / privacy

- Selected text is sent to external services (Google/OpenAI) for translation.
- **Never log API keys** or other secrets. Avoid logging full prompts/responses unless behind debug and scrubbed.
- Escape any user-controlled strings in Hover Markdown/HTML (XSS prevention).

## Tests & commands

- **Mandatory:** Always run the test suite locally before opening a PR: `npm test` (Mocha; compiled tests under `out/test/**/*.test.js`).
- **Mandatory:** If your change affects behavior and there are no tests covering it, add tests (unit tests in `test/`, compile with `npm run compile` and then run `npm test`).
- Prefer adding/adjusting tests when modifying core logic.
- Useful scripts:
  - `npm run compile`, `npm run lint`, `npm test`.

## Output expectations for PRs/changes

- Keep changes minimal and consistent with existing patterns.
- Update docs (`README.md` / `TECHNICAL_SPEC.md`) only when behavior or settings change.
