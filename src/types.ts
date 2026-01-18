/**
 * 型定義
 */

/**
 * 翻訳キャッシュの型
 */
export interface TranslationCache {
	selection: string;
	result: string;
	method: string;
	modelName?: string;
}

/**
 * 翻訳設定の型
 */
export interface TranslationConfig {
	translationMethod: string;
	targetLanguage: string;
	openaiApiKey: string;
	openaiBaseUrl: string;
	openaiModel: string;
	reasoningEffort?: string;
}

/**
 * systemロールサポートキャッシュの型
 * supportsSystemRole が null の場合は「未確定」（チェック失敗）を意味する
 */
export interface SystemRoleSupportCache {
	modelName: string;
	baseUrl: string;
	supportsSystemRole: boolean | null;
	checkedAt: number;
}

/**
 * OpenAI クライアント設定の型
 */
export interface OpenAIClientConfig {
	apiKey: string;
	baseURL?: string;
}

/**
 * System Role チェック結果の型
 */
export interface SystemRoleCheckResult {
	supportsSystemRole: boolean;
	checkedAt: number;
	errorMessage?: string;
}
