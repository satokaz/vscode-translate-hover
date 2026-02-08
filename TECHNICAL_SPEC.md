# 技術仕様: vscode-translate-hover

本ドキュメントは VS Code 拡張 **vscode-translate-hover** の技術仕様（設計・データフロー・設定・外部 API 連携・制約）を定義します。

対象リポジトリ: `satokaz/vscode-translate-hover`

---

## 1. 目的 / スコープ

### 目的

- エディタで選択したテキストを翻訳し、**Hover（ホバー）**として表示する。
- 必要に応じて翻訳結果をエディタへペーストできるようにする。

### スコープ内

- 翻訳エンジン
  - Google 翻訳（非公式エンドポイントへの GET）
  - OpenAI API（`openai` SDK で Chat Completions を利用）
- 自動言語検出（正規表現ベース / LLM ベース）
- パフォーマンス最適化（デバウンス、キャッシュ）
- ロギング（OutputChannel）

### スコープ外

- 多言語の高精度辞書・用語集
- バッチ翻訳、履歴 UI、LRU キャッシュ
- 永続ストレージ（翻訳結果の永続化）

---

## 2. 技術スタック

- Language: TypeScript
- Runtime/Target: Node.js / ES2020
- VS Code API: `^1.85.0`
- HTTP client: axios
- OpenAI client: `openai` (v4)

---

## 3. 主要コンポーネントと責務

### 3.1 エントリポイント

- `src/extension.ts`
  - HoverProvider 登録
  - コマンド登録（ペースト、ログ表示）
  - デバウンス管理
  - 翻訳結果キャッシュ（最後の1件）
  - 設定の読み取りと反映（デバッグログの動的切替）
  - OpenAI system role サポート事前チェック（バックグラウンド）

### 3.2 設定

- `src/config.ts`
  - VS Code 設定セクション（`translateHover`）を読み取り `TranslationConfig` を返す

### 3.3 翻訳プロバイダー

- `src/providers/google.ts`
  - Google 翻訳のエンドポイント URL 生成
  - axios による翻訳実行、レスポンスから翻訳文を抽出
  - `http.proxy` を考慮した proxy 設定
  - AbortSignal によるリクエスト中断に対応

- `src/providers/openai.ts`
  - Chat Completions を用いた翻訳
  - system role サポートの動的検出（モデル × baseURL）
  - o1 系など system role 非対応想定モデルの自動フォールバック
  - LLM ベース言語検出（任意）
  - AbortSignal によるリクエスト中断に対応

### 3.4 UI

- `src/ui/hover.ts`
  - Hover 表示用 Markdown を生成
  - OpenAI 利用時はモデル名を表示（HTML エスケープ）
  - ペーストコマンドへのリンク生成

### 3.5 ユーティリティ

- `src/utils/languageDetector.ts`
  - 文字種比率（30% 超）で ja/zh/ko を推定し、それ以外を en とする
  - `auto-xx` 設定から翻訳先言語を解決

- `src/utils/logger.ts`
  - OutputChannel の初期化/破棄
  - DEBUG 有効/無効切替
  - `debug/info/error` ログ API

---

## 4. データフロー（翻訳〜ホバー表示）

### 4.1 Hover トリガ

1. ユーザーがエディタでテキストを選択
2. マウスホバー時に HoverProvider（`provideHover`）が呼ばれる

#### 4.1.1 Hover の不安定さへの対策

- **CancellationToken のチェック**: デバウンス後/翻訳後に `token.isCancellationRequested` を確認し、不要な Hover を早期終了
- **in-flight の順序制御**: 単調増加のリクエスト ID を使い、最新リクエスト以外の結果を破棄
- **AbortController 連動**: Hover のキャンセルを翻訳リクエストに伝播し、HTTP/API 呼び出しを中断

### 4.2 キャッシュ

- キャッシュは **最大30件**の LRU（最終参照順）をメモリに保持
  - キー: `selection + method + targetLanguage + modelName`
  - 値: `{ result, method, targetLanguage, modelName? }`
- キャッシュヒット時はデバウンスをスキップし即時表示

### 4.3 デバウンス

- 新規 selection を検知すると 300ms（`DEFAULTS.DEBOUNCE_DELAY`）待機
- 待機中に selection が変わった場合はキャンセル
- 待機完了後、selection の整合性を確認して翻訳を開始
- デバウンス後に cancellation / 最新リクエスト判定を実施

### 4.4 翻訳ルーティング

- `translateText(selection, config)` が以下を行う
  1. `targetLanguage` が `auto-` の場合は言語検出を実行
  2. `translationMethod` によりプロバイダーへ委譲
    - `google` → `translateWithGoogle(selection, targetLanguage, signal)`
    - `openai` → `translateWithOpenAI(selection, config, targetLanguage, signal)`

### 4.5 Hover 描画

- `createHover(result, isCached, method, modelName?)`
  - method に応じたアイコン・タイトル
  - OpenAI のときはモデル名表示
  - ペーストコマンドリンク
  - 返却直前に cancellation / 最新リクエスト判定

---

## 5. 自動言語検出仕様

### 5.1 regex ベース（デフォルト）

- `detectLanguage(text)`
  - `ja`: ひらがな/カタカナ/漢字のいずれかが十分含まれる（30% 超）
  - `zh`: 漢字が 30% 超 かつ ひらがな/カタカナを含まない
  - `ko`: ハングルが 30% 超
  - それ以外は `en`

### 5.2 LLM ベース（OpenAI のみ、任意）

- `detectLanguageWithLLM(text, openai, model)`
  - user メッセージで「ISO 639-1 のみ返す」プロンプト
  - 失敗時は `en` を返す（フォールバック）

### 5.3 auto-XX の翻訳先解決

- `translateHover.targetLanguage` が `auto-ja` / `auto-en` / `auto-zh` の場合
  - `pairs[autoConfig].primary/secondary` に従い
    - source が primary → secondary
    - それ以外 → primary

---

## 6. OpenAI 翻訳仕様

### 6.1 クライアント設定

- API キー必須（未設定時はメッセージを返す）
- Base URL（任意）
  - 空文字列の場合は OpenAI 公式（SDK デフォルト）
  - LiteLLM Proxy / Azure OpenAI 等の互換 API を想定

### 6.2 system role サポートの動的検出

目的: モデルによっては `system` ロールが受け付けられないため、**事前に判定してプロンプト構造を切り替える**。

#### チェック方法

- `checkSystemRoleSupport(openai, modelName)`
  - `system` と `user` を含む messages で `max_tokens: 1` の軽量リクエスト
  - タイムアウト: 5 秒（AbortController）

#### 判定

- system role エラーとみなす条件（`isSystemRoleError`）
  - `invalid_request_error` など
  - メッセージに `system` / `unsupported parameter` を含む等

#### キャッシュ

- Map: `modelName::baseUrl`（baseUrl は空の場合 `default` として正規化）
- 値: `{ supportsSystemRole: boolean | null, checkedAt }`
  - `true/false`: 判定が確定した場合は Map に保存（キャッシュ）
  - `null`: 判定失敗 / 未確定の場合は Map に保存しない（次回再試行） — 未確定はグローバルキャッシュに保存されないことに注意

#### 事前チェック（プリロード）

- `activate()` でユーザー設定の `openaiModel` のみをバックグラウンドでチェック
  - 不要な API 呼び出しを抑制するため「全モデル」ではなく「設定モデルのみ」

### 6.3 翻訳プロンプト構造

- system role が使える場合
  - `system`: 翻訳者としての指示
  - `user`: 原文
  - `temperature` / `max_tokens` を付与

- system role が使えない / 未確定の場合
  - `user` 1発で指示 + 原文
  - system role 前提パラメータは付けない（モデル互換性を優先）

### 6.4 reasoning_effort

- `translateHover.openaiReasoningEffort` が `low`/`medium`/`high` のときのみ `reasoning_effort` を付与
- o1 系モデル向けの追加パラメータとして扱う

---

## 7. Google 翻訳仕様

### 7.1 エンドポイント

- `https://translate.google.com/translate_a/single`
- query:
  - `client=gtx`
  - `sl=auto`（既定）
  - `tl=<targetLanguage>`
  - `dj=1`
  - `dt=t`（翻訳文）
  - `dt=bd`（辞書候補）

### 7.2 レスポンス処理

- `sentences[].trans` を連結し翻訳文を構築
- `dict[].terms` があれば簡易的に追記（箇条書き風）

### 7.3 プロキシ

- VS Code の `http.proxy` が設定されている場合
  - axios の `proxy` 設定へ反映

---

## 8. コマンド / UI 仕様

### 8.1 コマンド

- `extension.translatePaste`
  - 直近の翻訳結果をエディタへペースト
  - 選択方向や選択形状に応じて挿入位置を調整

- `extension.showLogs`
  - OutputChannel を表示

### 8.2 Hover 表示

- タイトル: Google=🌸 / OpenAI=🤖
- OpenAI の場合はモデル名を `<sub>` で表示
- 「翻訳をペースト」リンクを常に表示
- XSS 対策
  - モデル名は HTML エスケープ

---

## 9. 設定仕様（package.json の contributes.configuration）

| Key | Type | Default | Note |
|---|---:|---:|---|
| `translateHover.translationMethod` | string | `google` | `google` / `openai` |
| `translateHover.targetLanguage` | string | `ja` | `auto-ja` / `auto-en` / `auto-zh` ほか |
| `translateHover.languageDetectionMethod` | string | `regex` | `llm` は OpenAI 時のみ |
| `translateHover.openaiApiKey` | string | `""` | OpenAI 利用時必須 |
| `translateHover.openaiBaseUrl` | string | `""` | 互換 API 用 |
| `translateHover.openaiModel` | string | `gpt-4o-mini` |  |
| `translateHover.openaiReasoningEffort` | string | `""` | `low`/`medium`/`high` |
| `translateHover.enableDebugLogging` | boolean | `false` | OutputChannel の DEBUG を制御 |

---

## 10. エラーハンドリング / 既知の制約

### 翻訳失敗時

- Google: `'Translation failed'` を返す（詳細はログに出る）
- OpenAI: エラーメッセージを整形して返す
  - system role 関連は「非対応」メッセージを含む

### Hover が一度で出ないことがある

- VS Code の Hover トリガ / selection 変化のタイミングに依存
- 対策として cancellation / in-flight 制御 / AbortController を実装

### プライバシー/送信データ

- 選択テキストは翻訳のために外部サービス（Google/OpenAI）へ送信される
- API キーはログに出力しない方針

---

## 11. ビルド / 開発

```bash
npm install
npm run compile
```

テスト（ユニットテスト）:

```bash
npm test
```

### テスト補足

- Mocha で `out/test/**/*.test.js` を実行
- `vscode` 依存をモックするセットアップを事前読み込み

### テスト対象一覧（現状）

- `formatTranslationResult()` の全角括弧変換
- `buildGoogleTranslateUrl()` のクエリ組み立て
- 言語判定（`isJapanese` / `isChinese` / `isKorean` / `detectLanguage`）
- `resolveTargetLanguage()` の auto-XX ルーティング
- OpenAI ユーティリティ（`isSystemRoleError` / `normalizeReasoningEffort`）

### 今後のテスト追加方針

- **プロバイダー層**: Google/OpenAI のレスポンスパースをモックして検証
- **キャッシュ/デバウンス**: Hover の連続呼び出しでの抑止ロジックをユニット化
- **設定境界値**: `auto-XX` / `languageDetectionMethod` / `reasoning_effort` の境界テスト
- **エラー経路**: タイムアウト/キャンセル時の戻り値とログ出力の検証
