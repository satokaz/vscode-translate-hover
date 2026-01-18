'use strict';

import * as vscode from 'vscode';
import { TranslationCache } from './types';
import { getTranslationConfig } from './config';
import { createHover } from './ui/hover';
import { translateWithGoogle } from './providers/google';
import { translateWithOpenAI, preloadSystemRoleSupportForModel } from './providers/openai';
import { formatTranslationResult } from './utils/format';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-translate-hover" is now active!');

	// systemロールサポートの事前チェック（バックグラウンド実行）
	preloadSystemRoleSupport().catch(error => {
		console.error('[ERROR] Preload system role check failed:', error);
	});

	let cache: TranslationCache = {
		selection: ' ',
		result: ' ',
		method: '',
		modelName: undefined
	};
	
	let translate: string | undefined;
	
	// hover
	vscode.languages.registerHoverProvider('*', {
		async provideHover(document, position, token) {
			
		// 選択された文字列をゲット
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}
			
			let selection = document.getText(editor.selection);
			
			// デバッグ: 選択されたテキストをログ出力
			if (selection && selection !== "" && selection !== " ") {
				console.log('[DEBUG] Selected text:', JSON.stringify(selection));
				console.log('[DEBUG] Selection length:', selection.length);
			}

			// 選択が空じゃないか? スペースだけじゃないか? 一つ前の内容と同一じゃないか?をチェック
			if (selection !== "" && selection !== " " && selection !== cache.selection) {
				console.log('[DEBUG] New selection detected, starting translation...');

				if(selection === document.getText(editor.selection)){
					const config = getTranslationConfig();
					translate = await translateText(selection, config);
					console.log('[DEBUG] Translation result:', translate);
				} else {
					console.log('[DEBUG] Selection mismatch');
					return;
				}

				const currentConfig = getTranslationConfig();
				cache = {
					selection: selection,
					result: translate,
					method: currentConfig.translationMethod,
					modelName: currentConfig.translationMethod === 'openai' ? currentConfig.openaiModel : undefined
				};
				
				console.log('[DEBUG] Cache updated:', JSON.stringify({
					method: cache.method,
					modelName: cache.modelName,
					hasResult: !!cache.result
				}));
				
				return createHover(translate, false, cache.method, cache.modelName);
			} else {
				// マウスが移動した場合は、翻訳結果の hover 表示を辞める
				console.log('[DEBUG] Using cached translation for selection');
				const cHover = document.getText(document.getWordRangeAtPosition(position));
				if (selection.indexOf(cHover) !== -1) {
				return createHover(cache.result, true, cache.method, cache.modelName);
				}
			}
		}
	});

		// 翻訳結果の paste コマンド
		context.subscriptions.push(vscode.commands.registerCommand('extension.translatePaste', () => {
			// 翻訳結果が何もない場合(undefined) は、ペーストしない
			if(translate === undefined){
				return;
			}
			// カーソルがある行を取得
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}
			
			const selection2 = editor.selection;
			const startLine = selection2.start.line;
			const lastCharIndex = editor.document.lineAt(startLine).text.length;

			if (selection2.isReversed === true) {
					// 右から左へ選択した場合
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.anchor.line) + 1, 0), formatTranslationResult(translate!) + '\n')
					);
			} else if (selection2.isSingleLine === false && selection2.end.character === 0) {
					// ダブルクリックで選択した場合
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.end.line), 0), formatTranslationResult(translate!) + '\n')
					);
			} else {
					// 左から右へ選択した場合 (通常の選択)
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.end.line) + 1, 0), formatTranslationResult(translate!) + '\n')
					);
			}
			// ペースト後に選択解除
			editor.selection = new vscode.Selection(selection2.active, selection2.active);
		}));
}

// this method is called when your extension is deactivated
export function deactivate() {

}

async function translateText(selection: string, config: ReturnType<typeof getTranslationConfig>): Promise<string> {
	if (config.translationMethod === 'openai') {
		return await translateWithOpenAI(selection, config);
	} else {
		return await translateWithGoogle(selection, config.targetLanguage);
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
		console.log('[DEBUG] Skipping preload: OpenAI not configured');
		return;
	}

	// ユーザー設定のモデルのみをチェック（不要なAPI呼び出しを削減）
	const modelToCheck = config.openaiModel;

	console.log('[INFO] Preloading system role support for model:', modelToCheck);

	try {
		await preloadSystemRoleSupportForModel(
			config.openaiApiKey,
			config.openaiBaseUrl,
			modelToCheck
		);
		console.log('[INFO] System role support preload completed for:', modelToCheck);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('[ERROR] System role support preload failed:', errorMessage);
	}
}
