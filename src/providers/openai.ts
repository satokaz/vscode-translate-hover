/**
 * OpenAI翻訳プロバイダー
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { TranslationConfig, SystemRoleSupportCache, OpenAIClientConfig, SystemRoleCheckResult } from '../types';
import { DEFAULTS, LANGUAGE_NAMES } from '../constants';
import * as logger from '../utils/logger';

// ================================================================================
// systemロールサポートキャッシュ
// ================================================================================

/**
 * モデル×baseURLごとにsystemロールサポート状況をキャッシュ
 */
const systemRoleSupportCache = new Map<string, SystemRoleSupportCache>();

/**
 * キャッシュキーを生成
 */
function getCacheKey(modelName: string, baseUrl: string): string {
	const normalizedBaseUrl = baseUrl.trim() || 'default';
	const key = `${modelName}::${normalizedBaseUrl}`;
	logger.debug('Generated cache key:', key);
	return key;
}

/**
 * systemロール関連のエラーかどうかを判定
 */
function isSystemRoleError(error: any): boolean {
	const apiError = error?.error || error;
	const message = apiError?.message?.toLowerCase() || '';
	
	return (
		apiError?.code === 'invalid_request_error' ||
		message.includes('system') ||
		message.includes('unsupported parameter')
	);
}

/**
 * systemロールのサポート状況をチェック
 * @param openai OpenAIクライアント
 * @param modelName チェック対象のモデル名
 * @param timeoutMs タイムアウト（ミリ秒）
 * @returns チェック結果（成功時はsupportsSystemRole: boolean、失敗時はthrow）
 */
async function checkSystemRoleSupport(
	openai: OpenAI,
	modelName: string,
	timeoutMs: number = 5000
): Promise<SystemRoleCheckResult> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		await openai.chat.completions.create({
			model: modelName,
			messages: [
				{ role: 'system', content: 'Test' },
				{ role: 'user', content: 'Hi' }
			],
			max_tokens: 1,
			temperature: 0
		}, {
			signal: controller.signal as any
		});

		clearTimeout(timeoutId);
		logger.debug('System role check passed for model:', modelName);
		
		return {
			supportsSystemRole: true,
			checkedAt: Date.now()
		};
	} catch (error: unknown) {
		clearTimeout(timeoutId);

		if (isSystemRoleError(error)) {
			logger.debug('System role not supported for model:', modelName);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				supportsSystemRole: false,
				checkedAt: Date.now(),
				errorMessage
			};
		}

		// その他のエラー（ネットワークエラー等）は再スロー
		logger.error('System role check failed:', error);
		throw error;
	}
}

// ================================================================================
// LLMベース言語検出
// ================================================================================

/**
 * LLMを使用してテキストの言語を検出
 * @param text 検出するテキスト
 * @param openai OpenAIクライアント
 * @returns 言語コード（ja, en, zh, ko など）
 */
export async function detectLanguageWithLLM(text: string, openai: OpenAI, model: string): Promise<string> {
	try {
		logger.debug('Detecting language with LLM for text:', text.substring(0, 50) + '...');
		
		const response = await openai.chat.completions.create({
			model: model,
			messages: [
				{
					role: 'user',
					content: `Detect the language of the following text and respond with ONLY the ISO 639-1 language code (e.g., "ja" for Japanese, "en" for English, "zh" for Chinese, "ko" for Korean). Do not include any explanation.\n\nText: ${text}`
				}
			],
			max_tokens: 10,
			temperature: 0
		});

		const detectedLang = response.choices[0]?.message?.content?.trim().toLowerCase() || 'en';
		logger.debug('LLM detected language:', detectedLang);
		
		return detectedLang;
	} catch (error: unknown) {
		logger.error('LLM language detection failed:', error);
		// フォールバック: 英語と仮定
		return 'en';
	}
}

// ================================================================================
// OpenAI翻訳関数
// ================================================================================

/**
 * OpenAI APIを使った翻訳
 * @param selection 翻訳するテキスト
 * @param config 設定
 * @param targetLanguage ターゲット言語（auto-detect時に解決済みの言語コード）
 */
export async function translateWithOpenAI(selection: string, config: TranslationConfig, targetLanguage: string): Promise<string> {
	const { openaiApiKey, openaiBaseUrl, openaiModel } = config;

	if (!openaiApiKey || openaiApiKey.trim() === '') {
		return 'OpenAI API key is not set. Please set it in settings.';
	}

	try {
		const openaiConfig: OpenAIClientConfig = { apiKey: openaiApiKey };

		// カスタムベースURL
		if (openaiBaseUrl && openaiBaseUrl.trim() !== '') {
			openaiConfig.baseURL = openaiBaseUrl;
			logger.debug('Using custom OpenAI base URL:', openaiBaseUrl);
		}

		const openai = new OpenAI(openaiConfig);
		const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

		// systemロールサポートチェック
		const cacheKey = getCacheKey(openaiModel, openaiBaseUrl || '');
		let cached = systemRoleSupportCache.get(cacheKey);

		if (cached && cached.supportsSystemRole !== null) {
			logger.debug('Cache hit for model:', openaiModel, '| Support:', cached.supportsSystemRole, '| CheckedAt:', new Date(cached.checkedAt).toISOString());
		}

		// キャッシュがない、または未確定(null)の場合はチェック実行
		const needsCheck = !cached || cached.supportsSystemRole === null;
		
		if (needsCheck) {
			logger.info('Checking system role support for model:', openaiModel);
			try {
				const checkResult = await checkSystemRoleSupport(openai, openaiModel);
				cached = {
					modelName: openaiModel,
					baseUrl: openaiBaseUrl || '',
					supportsSystemRole: checkResult.supportsSystemRole,
					checkedAt: checkResult.checkedAt
				};
				systemRoleSupportCache.set(cacheKey, cached);
				logger.debug('Cached system role support:', JSON.stringify({
					key: cacheKey,
					supportsSystemRole: cached.supportsSystemRole,
					checkedAt: new Date(cached.checkedAt).toISOString()
				}));
			} catch (error: unknown) {
				// チェック失敗時はキャッシュに「未確定」として記録（次回再チェック）
			logger.error('System role check failed, will retry next time:', error);
				cached = {
					modelName: openaiModel,
					baseUrl: openaiBaseUrl || '',
					supportsSystemRole: null, // 未確定
					checkedAt: Date.now()
				};
				// 未確定の場合はキャッシュしない（次回再チェックのため）
				logger.debug('System role support check failed, not caching');
			}
		}

		// メッセージ配列を動的に構築（型安全）
		const messages: ChatCompletionMessageParam[] = [];
		
		// supportsSystemRole が true の場合のみsystemロールを使用
		// null（未確定）や false の場合はuserロールのみ
		// cached は上記のロジックで必ず設定される
		const useSystemRole = cached?.supportsSystemRole === true;

		if (useSystemRole) {
			// systemロールをサポートする場合
			messages.push({
				role: 'system',
				content: `あなたは優秀な翻訳者です。与えられたテキストを${targetLangName}に翻訳してください。翻訳結果のみを出力し、説明は不要です。`
			});
			messages.push({
				role: 'user',
				content: selection,
			});
			logger.debug('Using system role for translation');
		} else {
			// systemロールをサポートしない場合（o1シリーズ等）または未確定の場合
			messages.push({
				role: 'user',
				content: `次のテキストを${targetLangName}に翻訳してください。翻訳結果のみを出力し、説明は不要です。\n\n${selection}`
			});
			logger.debug('Not using system role (model limitation or unknown)');
		}

		// 完了パラメータの構築（型安全）
		const completionParams: ChatCompletionCreateParamsNonStreaming = {
			model: openaiModel,
			messages: messages,
		};

		// systemロールサポートモデルのみtemperature/max_tokensを追加
		if (useSystemRole) {
			completionParams.temperature = DEFAULTS.TEMPERATURE;
			completionParams.max_tokens = DEFAULTS.MAX_TOKENS;
		}

		// reasoning_effort パラメータ (o1シリーズのモデル用)
		if (config.reasoningEffort && config.reasoningEffort.trim() !== '') {
			(completionParams as any).reasoning_effort = config.reasoningEffort;
			logger.debug('Using reasoning_effort:', config.reasoningEffort);
		}

		const completion = await openai.chat.completions.create(completionParams);

		const translatedText = completion.choices[0]?.message?.content || 'Translation failed';
		logger.debug('OpenAI translation completed');
		
		return translatedText;
	} catch (error: unknown) {
		logger.error('OpenAI translation failed:', error);
		
		const errorMessage = error instanceof Error ? error.message : String(error);
		
		// systemロール関連エラーの場合は親切なメッセージを返す
		if (isSystemRoleError(error)) {
			return `OpenAI API Error: このモデルはsystemロールをサポートしていません。次回の翻訳から自動的に対応します。\n\nエラー詳細: ${errorMessage}`;
		}
		
		if (errorMessage) {
			return `OpenAI API Error: ${errorMessage}`;
		}
		
		return 'OpenAI translation failed';
	}
}

// ================================================================================
// 事前チェック用エクスポート関数
// ================================================================================

/**
 * 指定されたモデルのsystemロールサポートを事前チェック
 * extension.tsのactivate()から呼び出される
 */
export async function preloadSystemRoleSupportForModel(
	apiKey: string,
	baseUrl: string,
	modelName: string
): Promise<void> {
	if (!apiKey || !modelName) {
		return;
	}

	const cacheKey = getCacheKey(modelName, baseUrl);
	const existingCache = systemRoleSupportCache.get(cacheKey);
	
	// 既にキャッシュがあり、確定済み（nullでない）の場合はスキップ
	if (existingCache && existingCache.supportsSystemRole !== null) {
		logger.debug('Model already checked:', modelName);
		return;
	}

	try {
		const openaiConfig: OpenAIClientConfig = { apiKey };
		if (baseUrl && baseUrl.trim() !== '') {
			openaiConfig.baseURL = baseUrl;
		}
		
		const openai = new OpenAI(openaiConfig);
		const checkResult = await checkSystemRoleSupport(openai, modelName);
		
		systemRoleSupportCache.set(cacheKey, {
			modelName,
			baseUrl: baseUrl || '',
			supportsSystemRole: checkResult.supportsSystemRole,
			checkedAt: checkResult.checkedAt
		});
		
		logger.info('Preloaded system role support for', modelName, ':', checkResult.supportsSystemRole);
		logger.debug('Preload cache entry:', JSON.stringify({
			key: cacheKey,
			modelName,
			baseUrl: baseUrl || 'default',
			supportsSystemRole: checkResult.supportsSystemRole,
			checkedAt: new Date(checkResult.checkedAt).toISOString()
		}));
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('Preload check failed for', modelName, ':', errorMessage);
	}
}
