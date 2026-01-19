/**
 * 設定管理
 */

import * as vscode from 'vscode';
import { TranslationConfig } from './types';
import { CONFIG_SECTION, DEFAULTS } from './constants';
import * as logger from './utils/logger';

/**
 * 翻訳設定を取得
 */
export function getTranslationConfig(): TranslationConfig {
	const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
	
	const config = {
		translationMethod: cfg.get<string>('translationMethod', DEFAULTS.TRANSLATION_METHOD),
		targetLanguage: cfg.get<string>('targetLanguage', DEFAULTS.TARGET_LANGUAGE),
		openaiApiKey: cfg.get<string>('openaiApiKey', ''),
		openaiBaseUrl: cfg.get<string>('openaiBaseUrl', ''),
		openaiModel: cfg.get<string>('openaiModel', DEFAULTS.OPENAI_MODEL),
		reasoningEffort: cfg.get<string>('openaiReasoningEffort', ''),
		languageDetectionMethod: cfg.get<string>('languageDetectionMethod', DEFAULTS.LANGUAGE_DETECTION_METHOD),
		enableDebugLogging: cfg.get<boolean>('enableDebugLogging', false)
	};
	
	logger.debug('Config loaded:', JSON.stringify({
		translationMethod: config.translationMethod,
		openaiModel: config.openaiModel,
		hasApiKey: !!config.openaiApiKey,
		enableDebugLogging: config.enableDebugLogging
	}));
	
	return config;
}
