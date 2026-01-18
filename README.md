# vscode-translate-hover README

![alt](https://raw.githubusercontent.com/satokaz/vscode-translate-hover/master/vscode_hover.gif)

## Features

選択されたテキストをGoogle翻訳またはOpenAI APIで翻訳し、結果をホバー表示する拡張機能です。
翻訳結果を選択されたテキストの下にペーストすることも可能。

### 主な機能

* **Google翻訳**: インターネット接続のみで利用可能な無料翻訳
* **OpenAI API翻訳**: GPT-4o, GPT-4o-mini, o1シリーズなど、OpenAIの最新モデルを使用した高品質な翻訳
  * o1-preview, o1-miniなどのReasoningモデルに自動対応
  * カスタムベースURL対応（LiteLLM Proxy, Azure OpenAI等）
  * 使用モデル名をホバー表示に表示
* **翻訳結果のペースト**: Windows/Linux: `ctrl + shift + T`, macOS: `cmd + shift + T`
* **自動キャッシュ**: 同じテキストの再翻訳を防止

下記の拡張機能を参考にしました。

* [vscode-translate](https://marketplace.visualstudio.com/items?itemName=chun.vscode-translate)
* [TranslationToolbox](https://marketplace.visualstudio.com/items?itemName=WLY.translationtoolbox)

## Requirements

* Google 翻訳に頼っているため、ネットワーク接続必須
* http.proxy をサポート。

## Extension Settings

拡張機能の設定は VS Code の設定画面から変更できます。

### 基本設定

* `translateHover.translationMethod`: 翻訳方法の選択
  * `google` (デフォルト): Google翻訳を使用
  * `openai`: OpenAI APIを使用
* `translateHover.targetLanguage`: 翻訳先の言語 (デフォルト: `ja`)
  * サポート言語: `ja`, `en`, `zh`, `ko`, `fr`, `de`, `es`, `it`, `pt`, `ru`, `ar`, `hi`

### OpenAI設定 (translationMethodが`openai`の場合)

* `translateHover.openaiApiKey`: OpenAI APIキー (必須)
  * [OpenAI Platform](https://platform.openai.com/api-keys)で取得
* `translateHover.openaiModel`: 使用するモデル (デフォルト: `gpt-4o-mini`)
  * 推奨モデル: `gpt-4o-mini`, `gpt-4o`, `o1-mini`, `o1-preview`
  * o1シリーズは自動的に対応（systemロールなし、reasoning_effort対応）
* `translateHover.openaiBaseUrl`: カスタムベースURL (オプション)
  * LiteLLM Proxy, Azure OpenAI等のカスタムエンドポイントに対応
  * 空文字列の場合はOpenAI公式API (`https://api.openai.com/v1`) を使用
* `translateHover.openaiReasoningEffort`: o1シリーズの推論努力レベル (オプション)
  * 選択肢: `""` (デフォルト), `low`, `medium`, `high`
  * o1-preview, o1-mini使用時のみ有効

## 使い方

適当に文字列をマウスで選択し、選択された文字列のにマウスカーソルを重ねれば翻訳結果がホバー表示されます。
必要なら `cmd + shift + T` か、hover に表示される ⬇️ をクリックで選択されたテキストの下にペーストされます


## 技術仕様

### System Role自動検出機能

OpenAI APIを使用する際、各モデルのsystem roleサポート状況を自動的に検出します：

1. **初回チェック**: 拡張機能起動時にユーザー設定モデルを事前チェック（API呼び出しコストを最適化）
2. **軽量プロンプト**: 1トークンのみを使用する最小限のチェック（コスト: 約$0.000001以下）
3. **キャッシュ**: モデル名×ベースURLごとに結果をキャッシュし、再チェック不要
4. **自動フォールバック**: o1シリーズなどsystem roleをサポートしないモデルでは、自動的にuser roleのみで翻訳を実行
5. **堅牢なリトライ**: チェック失敗時は「未確定」状態としてキャッシュせず、次回使用時に再チェック

### 型安全性

* OpenAI SDK の型定義（`ChatCompletionMessageParam`, `ChatCompletionCreateParamsNonStreaming`）を活用
* `error: unknown` + `instanceof Error` による型安全なエラーハンドリング
* XSS対策: モデル名表示時にHTMLエスケープ処理

### キャッシュ機構

* **翻訳結果**: 最後の1件をメモリに保持（同一テキストの再翻訳を防止）
* **System Roleサポート**: モデルごとのサポート状況を拡張機能実行中は永続的にキャッシュ

## Known Issues

* 一発で翻訳ができない場合がある。マウスを移動させて何度かホバーを表示させて翻訳結果を確認してください
* OpenAI APIを使用する場合、初回のみモデルチェックのため若干の遅延が発生する場合があります（通常1秒未満）

## Release Notes

### 0.1.0 (2026-01-16)

Major update with OpenAI API support and modern tooling

---


**Enjoy!**