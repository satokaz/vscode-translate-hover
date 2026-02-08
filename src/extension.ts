import * as vscode from 'vscode';
import { TranslationCache } from './types';
import { getTranslationConfig } from './config';
import { createHover } from './ui/hover';
import { translateWithGoogle } from './providers/google';
import { translateWithOpenAI, preloadSystemRoleSupportForModel, detectLanguageWithLLM } from './providers/openai';
import { formatTranslationResult } from './utils/format';
import { resolveTargetLanguage, detectLanguage } from './utils/languageDetector';
import { AUTO_DETECT_PREFIX, AUTO_DETECT_PAIRS, DEFAULTS } from './constants';
import OpenAI from 'openai';
import * as logger from './utils/logger';
import { HoverOrchestrator } from './hover/orchestrator';



export let __testHoverProvider: any | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
	// ログ出力チャネルを初期化
	logger.initializeLogger('Translate Hover');
	
	// 設定からデバッグログの有効/無効を取得
	const config = getTranslationConfig();
	logger.setDebugEnabled(config.enableDebugLogging);
	
	logger.info('Extension "vscode-translate-hover" is now active!');
	
	// 設定変更を監視してデバッグログを動的に切り替え
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('translateHover.enableDebugLogging')) {
				const newConfig = getTranslationConfig();
				logger.setDebugEnabled(newConfig.enableDebugLogging);
				logger.info('Debug logging', newConfig.enableDebugLogging ? 'enabled' : 'disabled');
			}
		})
	);

	// systemロールサポートの事前チェック（バックグラウンド実行）
	preloadSystemRoleSupport().catch(error => {
		logger.error('Preload system role check failed:', error);
	});

	let orchestration: HoverOrchestrator | undefined; // HoverOrchestrator instance (typed)

	// hover orchestration (instantiate now using the typed class)
	orchestration = new HoverOrchestrator({
		getConfig: getTranslationConfig,
		translateText,
		createHover,
		logger
	});
	// expose orchestrator for tests
	__testHoverProvider = orchestration;

	const hoverDisposable = vscode.languages.registerHoverProvider('*', {
		provideHover: orchestration.provideHover.bind(orchestration)
	});
	context.subscriptions.push(hoverDisposable);

		// 翻訳結果の paste コマンド
	context.subscriptions.push(vscode.commands.registerCommand('extension.translatePaste', () => {
		// 翻訳結果が何もない場合(undefined) は、ペーストしない
		const last = orchestration?.getLastTranslation();
		if(last === undefined){
			return;
		}
		// カーソルがある行を取得
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		
		const selection2 = editor.selection;

		if (selection2.isReversed === true) {
				// 右から左へ選択した場合
				editor.edit(edit =>
						edit.insert(new vscode.Position(Number(selection2.anchor.line) + 1, 0), formatTranslationResult(last) + '\n')
				);
		} else if (selection2.isSingleLine === false && selection2.end.character === 0) {
				// ダブルクリックで選択した場合
				editor.edit(edit =>
						edit.insert(new vscode.Position(Number(selection2.end.line), 0), formatTranslationResult(last) + '\n')
				);
		} else {
				// 左から右へ選択した場合 (通常の選択)
				editor.edit(edit =>
						edit.insert(new vscode.Position(Number(selection2.end.line) + 1, 0), formatTranslationResult(last) + '\n')
				);
		}
		// ペースト後に選択解除
		editor.selection = new vscode.Selection(selection2.active, selection2.active);
	}));

	// ログ出力チャネルを表示するコマンド
	context.subscriptions.push(vscode.commands.registerCommand('extension.showLogs', () => {
		logger.show();
	}));

	// 翻訳結果をクリップボードにコピーするコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.copyTranslation', async () => {
			try {
				const last = orchestration?.getLastTranslation();
				if (last === undefined) {
					return;
				}

				await vscode.env.clipboard.writeText(formatTranslationResult(last));
				vscode.window.showInformationMessage('Translation copied to clipboard');
			} catch (error: unknown) {
				logger.error('Copy translation failed:', error);
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Copy translation failed: ${message}`);
			}
		})
	);

	// クリップボードを翻訳して QuickPick に表示するコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.translateClipboardQuickPick', async () => {
			try {
				const clipboardText = (await vscode.env.clipboard.readText()).trim();
				if (!clipboardText) {
					vscode.window.showInformationMessage('Clipboard is empty');
					return;
				}

				const config = getTranslationConfig();
				logger.debug('Translating clipboard text:', JSON.stringify(clipboardText));
				const translated = await translateText(clipboardText, config);

				const picked = await vscode.window.showQuickPick(
					[
						{
							label: truncateForQuickPickLabel(translated),
							description: truncateForQuickPickDescription(clipboardText),
							detail: translated
						}
					],
					{
						title: 'Translation (Clipboard)',
						placeHolder: 'Press Enter to copy translation to clipboard'
					}
				);

				if (!picked) {
					return;
				}

				await vscode.env.clipboard.writeText(picked.detail ?? picked.label);
				vscode.window.showInformationMessage('Translation copied to clipboard');
			} catch (error: unknown) {
				logger.error('Clipboard translation failed:', error);
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Clipboard translation failed: ${message}`);
			}
		})
	);
}



function truncateForQuickPickLabel(text: string, max = 80): string {
	const singleLine = text.replace(/\s+/g, ' ').trim();
	return singleLine.length > max ? singleLine.slice(0, max - 1) + '…' : singleLine;
}

function truncateForQuickPickDescription(text: string, max = 80): string {
	const singleLine = text.replace(/\s+/g, ' ').trim();
	return singleLine.length > max ? singleLine.slice(0, max - 1) + '…' : singleLine;
}

// this method is called when your extension is deactivated
export function deactivate() {
	// ロガーをクリーンアップ
	logger.disposeLogger();
}

async function translateText(
	selection: string,
	config: ReturnType<typeof getTranslationConfig>,
	signal?: AbortSignal
): Promise<string> {
	// 自動言語検出が有効な場合、適切なターゲット言語を決定
	let targetLanguage = config.targetLanguage;
	if (config.targetLanguage && config.targetLanguage.startsWith(AUTO_DETECT_PREFIX)) {
		let detectedLang: string | undefined;
		
		// LLMベース言語検出（OpenAI使用時のみ）
		if (config.languageDetectionMethod === 'llm' && config.translationMethod === 'openai' && config.openaiApiKey) {
			try {
				const openai = new OpenAI({
					apiKey: config.openaiApiKey,
					...(config.openaiBaseUrl ? { baseURL: config.openaiBaseUrl } : {})
				});
				detectedLang = await detectLanguageWithLLM(selection, openai, config.openaiModel, signal);
					logger.debug('LLM detected language:', detectedLang);
				} catch (error) {
					logger.error('LLM language detection failed, falling back to regex:', error);
					detectedLang = detectLanguage(selection);
				}
		} else {
			// 正規表現ベース検出（デフォルト、またはGoogle翻訳時）
			detectedLang = detectLanguage(selection);
			logger.debug('Regex detected language:', detectedLang);
		}
		
		targetLanguage = resolveTargetLanguage(selection, config.targetLanguage, AUTO_DETECT_PAIRS, detectedLang);
		logger.debug('Auto-detect mode: target language:', targetLanguage);
	}
	
	if (config.translationMethod === 'openai') {
		return await translateWithOpenAI(selection, config, targetLanguage, signal);
	} else {
		return await translateWithGoogle(selection, targetLanguage, signal);
	}
}

// ================================================================================
// systemロールサポート事前チェック
// ================================================================================

/**
 * ユーザー設定モデルのsystemロールサポートを事前チェック
 * activate()時にバックグラウンドで実行される
 */
async function preloadSystemRoleSupport(): Promise<void> {
	const config = getTranslationConfig();
	
	if (config.translationMethod !== 'openai' || !config.openaiApiKey) {
		logger.debug('Skipping preload: OpenAI not configured');
		return;
	}

	// ユーザー設定のモデルのみをチェック（不要なAPI呼び出しを削減）
	const modelToCheck = config.openaiModel;

	logger.info('Preloading system role support for model:', modelToCheck);

	try {
		await preloadSystemRoleSupportForModel(
			config.openaiApiKey,
			config.openaiBaseUrl,
			modelToCheck
		);
		logger.info('System role support preload completed for:', modelToCheck);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error('System role support preload failed:', errorMessage);
	}
}
