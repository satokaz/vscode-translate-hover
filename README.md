# vscode-translate-hover

VS Code で **選択したテキストを翻訳し、ホバーに表示**する拡張機能です。翻訳エンジンは **Google 翻訳** または **OpenAI API** を選べます。

![Hover demo](./vscode_hover.gif)

---

## 評価（Repository Review）

### 良い点

- **責務分離が明確**: UI（`src/ui`）、プロバイダー（`src/providers`）、ユーティリティ（`src/utils`）、設定（`src/config.ts`）が整理されています。
- **パフォーマンス配慮**: 300ms デバウンスと「最後の1件」キャッシュにより、不要な API 呼び出しが抑制されています。
- **OpenAI 互換性への配慮**: system role サポートの有無をモデルごとに自動検出します。system-role 関連の明確なエラー（例: `invalid_request_error`）が検出された場合はそのモデルを `supportsSystemRole: false` としてキャッシュして自動的に user-role のプロンプトへフォールバックします。チェックがタイムアウトやネットワークエラーで失敗した場合は未確定 (`supportsSystemRole: null`) としてキャッシュせず、次回再試行します。
- **デバッグ容易性**: OutputChannel ベースのロガーがあり、設定で DEBUG ログを切り替えできます。

### 改善余地（将来の拡張候補）

- **自動テストの拡充**: `test/` はあるものの、ユニットテスト（言語判定、URL 生成、フォーマット等）の整備余地があります。
- **キャッシュの強化**: 現状は「最後の1件」のみ。LRU など複数件保持に拡張可能です。
- **セキュリティ/プライバシー記載の明確化**: OpenAI 利用時の送信データ、ログ出力の方針（API キーを出さない等）を README 上で明確にすると安心です。

---

## 機能

- 選択テキストの翻訳結果をホバー表示
- 翻訳結果のペースト（`cmd/ctrl + shift + T`）
- クリップボードのテキストを翻訳して QuickPick に表示（Enterで翻訳結果をクリップボードにコピー）
- **デバウンス**（既定 300ms）と **キャッシュ**（最後の1件）
- **自動言語検出**（`auto-ja` / `auto-en` / `auto-zh`）
  - `regex`（高速・無料）/ `llm`（高精度・OpenAI のみ）の 2方式
- Google 翻訳（プロキシ設定 `http.proxy` を考慮）
- OpenAI 翻訳（カスタム Base URL、reasoning_effort、モデル名表示）
- 専用ログ出力チャネル（「ログ出力チャネルを表示」コマンド）

---

## 要件

- VS Code: `^1.85.0`
- Google 翻訳利用時はネットワーク接続が必要です
- OpenAI 利用時は API キーが必要です

---

## プライバシー/送信データ

- **選択したテキストのみ**が翻訳のために外部サービス（Google/OpenAI）へ送信されます。ファイル名、ファイルパス、周辺テキストや編集履歴などの追加メタデータは送信されません。
- 送信が発生するタイミング:
  - エディタでテキストを選択してホバーした際（デフォルトで約300ms のデバウンス後に自動で翻訳リクエストが送信されます）
  - 「クリップボードを翻訳」コマンド実行時（クリップボードの内容が送信されます）
  - LLM ベースの言語検出を有効にしている場合（OpenAI を使用）、検出のために選択テキストが送信されます
- 起動時の事前チェック: OpenAI の system-role サポート判定のため、短いテストリクエスト（固定文字列）を構成されたモデルへ送信することがあります（ユーザー選択テキストは含まれません）。
- ログについて: `translateHover.enableDebugLogging` を有効にするとデバッグログに選択テキストが出力される場合があります。機密データを扱う環境ではデバッグログを無効にしてください（既定は無効）。
- 企業利用上の注意: データの保持・利用ポリシーは翻訳サービス提供者（Google/OpenAI またはカスタム Base URL のサービス）に従います。社内ポリシーで外部送信を制限している場合は、プライベートな翻訳エンドポイント（`translateHover.openaiBaseUrl`）の利用や、本拡張機能を無効化することを検討してください。
- API キーは VS Code の設定に保存され、ログに出力しない方針です.

---

## 使い方

1. エディタ上で任意の文字列を選択
2. 選択範囲にマウスカーソルを乗せると翻訳結果がホバー表示されます
3. 必要に応じて以下でペーストできます
   - キーバインド: Windows/Linux `ctrl+shift+t` / macOS `cmd+shift+t`
   - またはホバー内の「翻訳をペースト」リンク

---

## 設定（Extension Settings）

### 基本

- `translateHover.translationMethod`: `google`（既定） / `openai`
- `translateHover.targetLanguage`: 翻訳先言語（既定 `ja`）
  - 自動検出: `auto-ja` / `auto-en` / `auto-zh`
- `translateHover.languageDetectionMethod`: `regex`（既定） / `llm`
  - `llm` は OpenAI 利用時のみ有効
- `translateHover.enableDebugLogging`: `false`（既定）/ `true`

### OpenAI（`translateHover.translationMethod = openai` の場合）

- `translateHover.openaiApiKey`: OpenAI API キー（必須）
- `translateHover.openaiModel`: 使用モデル（既定 `gpt-4o-mini`）
- `translateHover.openaiBaseUrl`: カスタム Base URL（任意、空なら公式）
- `translateHover.openaiReasoningEffort`: `"" | low | medium | high`（o1 系列向け）

---

## 技術仕様

実装の詳細（アーキテクチャ、データフロー、エラーハンドリング、OpenAI system role 検出、設定仕様など）は **[TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md)** にまとめています。

---

## 参考

- [vscode-translate](https://marketplace.visualstudio.com/items?itemName=chun.vscode-translate)
- [TranslationToolbox](https://marketplace.visualstudio.com/items?itemName=WLY.translationtoolbox)

---

## 開発

- 依存関係のインストール: `npm install`
- ビルド: `npm run compile`
- ウォッチ: `npm run watch`
- テスト: `npm test`
- リント: `npm run lint`
- パッケージング: `npm run package`
