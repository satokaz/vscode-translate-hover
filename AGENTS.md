# AGENTS.md

このドキュメントは、AIエージェントがこのプロジェクトを理解し、効果的に作業するためのガイドです。

## プロジェクト概要

**vscode-translate-hover** は、VS Code上で選択したテキストをホバー表示で翻訳する拡張機能です。

### 主な機能

- テキスト選択時の自動翻訳ホバー表示
- Google翻訳とOpenAI APIの切り替え可能な翻訳エンジン
- 翻訳結果のキャッシュ機能
- 翻訳結果のペーストコマンド
- プロキシ対応（Google翻訳）
- カスタムベースURL対応（OpenAI、LiteLLM Proxy等）
- **動的System Roleサポート検出**: モデルごとにsystem roleのサポート状況を自動検出
  - 初回のみ1トークンの軽量プロンプトでチェック
  - モデル名×ベースURLごとにキャッシュ
  - o1シリーズなどの自動フォールバック対応
- OpenAI o1シリーズの推論努力レベル設定
- **モデル名表示**: OpenAI使用時にホバー表示にモデル名を表示

## 技術スタック

- **言語**: TypeScript 5.3.3
- **ランタイム**: Node.js (ES2020ターゲット)
- **フレームワーク**: VS Code Extension API ^1.85.0
- **HTTPクライアント**: axios ^1.6.5
- **AI SDK**: openai ^4.77.3
- **ビルドツール**: TypeScript Compiler (tsc)
- **パッケージマネージャー**: npm

## プロジェクト構造

```
vscode-translate-hover/
├── src/
│   ├── extension.ts           # メインエントリーポイント
│   ├── types.ts               # TypeScript型定義
│   ├── constants.ts           # 定数定義
│   ├── config.ts              # 設定管理
│   ├── utils/
│   │   └── format.ts          # フォーマットユーティリティ
│   ├── providers/
│   │   ├── google.ts          # Google翻訳プロバイダー
│   │   └── openai.ts          # OpenAI翻訳プロバイダー
│   └── ui/
│       └── hover.ts           # ホバーUI生成
├── out/                       # コンパイル済みJavaScript
├── package.json               # 拡張機能マニフェスト
├── tsconfig.json              # TypeScript設定
├── CHANGELOG.md               # 変更履歴
└── README.md                  # ユーザー向けドキュメント
```

## アーキテクチャ設計

### レイヤー構成

1. **プレゼンテーション層** (`ui/`)
   - ホバー表示の生成とフォーマット
   - Markdown形式でのリッチな表示

2. **ビジネスロジック層** (`extension.ts`)
   - VS Code APIとの統合
   - イベントハンドリング
   - キャッシュ管理
   - 翻訳ルーティング

3. **データアクセス層** (`providers/`)
   - 外部翻訳APIとの通信
   - エラーハンドリング
   - レスポンスのパース

4. **ユーティリティ層** (`utils/`, `config.ts`, `constants.ts`)
   - 共通関数
   - 設定管理
   - 定数定義

### 設計原則

- **単一責任の原則**: 各モジュールは1つの責任のみを持つ
- **依存性の注入**: 設定は外部から注入
- **関心の分離**: UI、ロジック、データアクセスを分離
- **型安全性**: TypeScript strictモードで型チェック

## ファイル別詳細

### `src/extension.ts`

**役割**: VS Code拡張機能のメインエントリーポイント

**主要な関数**:
- `activate(context)`: 拡張機能の初期化
  - ホバープロバイダーの登録
  - コマンドの登録
  - キャッシュの初期化
  - **system roleサポートの事前チェック**: 主要モデルをバックグラウンドで事前チェック
- `deactivate()`: クリーンアップ処理
- `translateText(selection, config)`: 翻訳方法のルーティング
- `preloadSystemRoleSupport()`: ユーザー設定モデルの事前チェック（最適化: 全モデルではなく設定モデルのみ）

**依存関係**:
```typescript
import { TranslationCache } from './types';
import { getTranslationConfig } from './config';
import { createHover } from './ui/hover';
import { translateWithGoogle } from './providers/google';
import { translateWithOpenAI } from './providers/openai';
import { formatTranslationResult } from './utils/format';
```

### `src/types.ts`

**役割**: TypeScript型定義の集約

**定義される型**:
- `TranslationCache`: キャッシュデータの構造（selection, result, method, modelName）
- `TranslationConfig`: 設定データの構造
- `SystemRoleSupportCache`: system roleサポート状況のキャッシュ構造
  - `supportsSystemRole: boolean | null` - nullは「未確定」（チェック失敗）を意味する
- `OpenAIClientConfig`: OpenAIクライアント設定の型（apiKey, baseURL?）
- `SystemRoleCheckResult`: system roleチェック結果の型（supportsSystemRole, checkedAt, errorMessage?）

### `src/constants.ts`

**役割**: プロジェクト全体で使用される定数

**定義される定数**:
- `CONFIG_SECTION`: VS Code設定のセクション名
- `DEFAULTS`: デフォルト値（タイムアウト、モデル名等）
- `LANGUAGE_NAMES`: 言語コードと言語名のマッピング

### `src/config.ts`

**役割**: VS Code設定からの値取得

**関数**:
- `getTranslationConfig()`: 全設定値を構造化して返す

### `src/utils/format.ts`

**役割**: テキストフォーマット処理

**関数**:
- `formatTranslationResult(text)`: 全角括弧を半角に変換

### `src/providers/google.ts`

**役割**: Google翻訳APIとの統合

**関数**:
- `translateWithGoogle(selection, targetLanguage)`: 翻訳実行
- `buildGoogleTranslateUrl(text, targetLanguage, fromLanguage)`: API URL生成

**特徴**:
- プロキシ設定対応
- 辞書データの取得
- 10秒タイムアウト

### `src/providers/openai.ts`

**役割**: OpenAI APIとの統合

**モジュールレベル変数**:
- `DEBUG_LOG_ENABLED`: デバッグログの有効/無効フラグ
- `systemRoleSupportCache`: `Map<string, SystemRoleSupportCache>` - モデル×baseURLごとのキャッシュ

**ヘルパー関数**:
- `debugLog(...args)`: デバッグログ出力（`DEBUG_LOG_ENABLED`で制御）
- `getCacheKey(modelName, baseUrl)`: キャッシュキー生成（`modelName::baseUrl`）
- `isSystemRoleError(error)`: system role関連エラーの判定
- `checkSystemRoleSupport(openai, modelName, timeoutMs)`: system roleサポートチェック（5秒タイムアウト）

**主要なエクスポート関数**:
- `translateWithOpenAI(selection, config)`: 翻訳実行
- `preloadSystemRoleSupportForModel(apiKey, baseUrl, modelName)`: 事前チェック用

**型安全性**:
- `ChatCompletionMessageParam`: メッセージ配列の型
- `ChatCompletionCreateParamsNonStreaming`: APIパラメータの型
- `OpenAIClientConfig`: クライアント設定の型
- `error: unknown` + `instanceof Error`: 型安全なエラーハンドリング

**特徴**:
- カスタムベースURL対応（LiteLLM Proxy等）
- reasoning_effort パラメータ対応（o1シリーズ用）
- **動的system role検出**: モデルごとに自動チェック（5秒タイムアウト）
- **フォールバック戦略**: チェック失敗時は`supportsSystemRole: null`（未確定）で次回再チェック
- **自動フォールバック**: o1シリーズは自動的にuser roleのみで翻訳

### `src/ui/hover.ts`

**役割**: ホバー表示のレンダリング

**関数**:
- `escapeHtml(text)`: HTML特殊文字のエスケープ（XSS対策）
- `createHover(translationResult, isCached, method, modelName?)`: VS Code Hoverオブジェクト生成

**表示要素**:
- 翻訳方法の識別（🌸 Google / 🤖 OpenAI）
- **モデル名表示**: OpenAI使用時に`<sub>`タグでモデル名を表示（エスケープ済み）
- 翻訳結果
- キャッシュ状態表示
- ペーストコマンドリンク

## 設定項目（package.json）

```json
{
  "translateHover.translationMethod": "google" | "openai",
  "translateHover.targetLanguage": "ja" | "en" | "zh" | etc.,
  "translateHover.openaiApiKey": "sk-...",
  "translateHover.openaiBaseUrl": "https://custom-endpoint.com/v1",
  "translateHover.openaiModel": "gpt-4o-mini" | "o1-preview" | etc.,
  "translateHover.openaiReasoningEffort": "" | "low" | "medium" | "high"
}
```

## 開発ワークフロー

### コンパイル

```bash
npm run compile
```

### ウォッチモード

```bash
npm run watch
```

### パッケージング

```bash
vsce package
```

### デバッグ

F5キーでデバッグモードを起動（.vscode/launch.jsonに設定済み）

## コーディング規約

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

## エラーハンドリング

### Google翻訳

- タイムアウト: 10秒
- エラー時の戻り値: `'Translation failed'`
- エラーログ出力: `console.error('[ERROR] Google translation failed:', error)`

### OpenAI翻訳

- APIキー未設定時: 設定促進メッセージを返す
- エラー時: エラーメッセージを含む文字列を返す
- **System Roleエラー**: 自動的にuser roleのみでリトライ（キャッシュに記録）
- エラーログ出力: `console.error('[ERROR] OpenAI translation failed:', error)`

### System Roleサポートチェック

- タイムアウト: 5秒（AbortControllerで制御）
- エラー時: `supportsSystemRole: false` としてキャッシュ
- リトライなし（チェック失敗 = サポートなしと判断）
- デバッグログで詳細を記録

## デバッグとロギング

### デバッグログ

コンソールには以下のデバッグ情報が出力されます：

- `[DEBUG] Checking cache for key: <modelName>::<baseUrl>` - キャッシュ検索
- `[DEBUG] Cache hit for <modelName> at <baseUrl>: <result>` - キャッシュヒット
- `[DEBUG] Cache miss for <modelName> at <baseUrl>` - キャッシュミス
- `[DEBUG] Check result for <modelName>: <result>` - チェック結果
- `[DEBUG] Stored in cache: <key> => <result>` - キャッシュ保存
- `Preloading system role support for model: <modelName>` - 事前チェック開始
- `System role support preload completed for: <modelName>` - 事前チェック完了

### デバッグログ制御

`DEBUG_LOG_ENABLED` フラグ（openai.ts内）でデバッグログの出力を制御：
```typescript
const DEBUG_LOG_ENABLED = true;  // false にするとデバッグログ無効化
```

### エラーログ

- `[ERROR] Google translation failed:` - Google翻訳エラー
- `[ERROR] OpenAI translation failed:` - OpenAI翻訳エラー
- `[ERROR] System role support check failed:` - サポートチェックエラー

### ログレベル

- 通常動作: エラーログのみ（console.error）
- デバッグ情報: console.logで詳細を出力
- VS Code開発者ツール（Help > Toggle Developer Tools）で確認可能



現在、自動テストは未実装。将来の追加候補:

1. **ユニットテスト**:
   - `formatTranslationResult()` のテスト
   - `buildGoogleTranslateUrl()` のテスト
   - モックを使った翻訳プロバイダーのテスト

2. **統合テスト**:
   - VS Code APIとの統合テスト
   - ホバープロバイダーのテスト

3. **E2Eテスト**:
   - 実際の翻訳フローのテスト

## パフォーマンス考慮事項

### キャッシュ戦略

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

### API呼び出し最適化

- 同一選択の重複翻訳を防止
- タイムアウト設定（Google: 10秒、System Roleチェック: 5秒）
- **事前チェック**: activate時にユーザー設定モデルのみをチェック（最適化: 全モデルではなく設定モデルのみ）
- **キャッシュヒット率**: 同一モデル使用時は100%（再チェック不要）

### メモリ管理

- 翻訳結果キャッシュ: 1件のみ（メモリ影響最小）
- System Roleキャッシュ: 通常5-10エントリ程度（軽量）
- 大きなテキストの翻訳には注意

## セキュリティ

### APIキーの取り扱い

- VS Code設定に保存（ユーザースコープ）
- コードには含めない
- ログに出力しない

### HTTPSの使用

- Google翻訳: HTTPS
- OpenAI API: HTTPS
- カスタムベースURLは検証なし（ユーザー責任）

## 拡張機能の追加ガイドライン

### 新しい翻訳プロバイダーの追加

1. `src/providers/` に新しいファイルを作成（例: `deepl.ts`）
2. `translateWith[Provider]()` 関数を実装
3. `package.json` の `translationMethod` enum に追加
4. `extension.ts` の `translateText()` にルーティング追加
5. `ui/hover.ts` のアイコン追加（オプション）

### 新しい設定項目の追加

1. `package.json` の `contributes.configuration.properties` に追加
2. `src/types.ts` の `TranslationConfig` に型を追加
3. `src/config.ts` の `getTranslationConfig()` で値を取得
4. 該当する関数で設定値を使用

### UIの変更

1. `src/ui/hover.ts` の `createHover()` を編集
2. MarkdownString の仕様に従う
3. コマンドリンクは `command:extension.commandName` 形式

## トラブルシューティング

### ホバーが表示されない

- `activationEvents: ["onStartupFinished"]` が設定されているか確認
- コンソールログでデバッグ情報を確認

### 翻訳が失敗する

- APIキーが正しく設定されているか確認
- ネットワーク接続を確認
- プロキシ設定を確認（Google翻訳）
- コンソールログでエラー詳細を確認

### コンパイルエラー

- `npm install` で依存関係を再インストール
- `tsconfig.json` の設定を確認
- 型定義の import を確認

## 今後の改善案

### 優先度: 高

1. **デバウンス処理**: 連続選択時のAPI呼び出し削減
2. **LRUキャッシュ**: 複数の翻訳結果を保持
3. **出力チャネル**: 専用のログ出力チャネル
4. **エラーハンドリング強化**: リトライロジック、カスタムエラークラス

### 優先度: 中

1. **テストの追加**: ユニットテスト、統合テスト
2. **設定変更の監視**: 再起動不要で設定反映
3. **翻訳履歴機能**: サイドバーパネルで履歴表示
4. **バッチ翻訳**: 複数選択箇所の一括翻訳

### 優先度: 低

1. **DeepL API対応**: より高精度な翻訳
2. **Claude API対応**: Anthropic APIのサポート
3. **カスタム辞書**: 用語集機能
4. **比較モード**: 複数エンジンの並列表示

## リリースプロセス

1. `CHANGELOG.md` を更新
2. `package.json` のバージョンを更新
3. `npm run compile` でコンパイル
4. テスト実行（手動）
5. `vsce package` でVSIXファイル生成
6. VS Code Marketplaceに公開

## 参考リソース

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Google Translate API](https://translate.google.com/)

## 連絡先

- Repository: https://github.com/satokaz/vscode-translate-hover
- Issues: https://github.com/satokaz/vscode-translate-hover/issues

---

**最終更新**: 2026-01-16
**バージョン**: 0.1.0
