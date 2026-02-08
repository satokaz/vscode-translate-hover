/**
 * ホバーUI関連
 */

import * as vscode from 'vscode';
import { formatTranslationResult } from '../utils/format';
import * as logger from '../utils/logger';

/**
 * HTML特殊文字をエスケープ（XSS対策）
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * ホバー表示を作成
 */
export function createHover(translationResult: string, isCached: boolean, method: string = 'google', modelName?: string): vscode.Hover {
	// In unit tests we stub the `vscode` module; defensive fallback keeps tests stable
	// even if the stub doesn't provide a constructor-compatible MarkdownString.
	const MarkdownStringCtor: (new () => vscode.MarkdownString) | undefined =
		typeof (vscode as unknown as { MarkdownString?: unknown }).MarkdownString === 'function'
			? (vscode as unknown as { MarkdownString: new () => vscode.MarkdownString }).MarkdownString
			: undefined;

	const markdown = MarkdownStringCtor ? new MarkdownStringCtor() : ({
		isTrusted: true,
		supportHtml: true,
		content: '',
		appendMarkdown: function (this: { content: string }, s: string) {
			this.content += s;
		}
	} as unknown as vscode.MarkdownString);
	markdown.isTrusted = true;
	markdown.supportHtml = true;

	const icon = method === 'openai' ? '🤖' : '🌸';
	const methodName = method === 'openai' ? 'AI 翻訳' : 'Google 翻訳';
	
	markdown.appendMarkdown(`### ${icon} ${methodName}結果\n\n`);
	
	// OpenAI使用時はモデル名を表示（エスケープ済み）
	if (method === 'openai' && modelName) {
		logger.debug('Displaying model name in hover:', modelName);
		markdown.appendMarkdown(`<sub>モデル: ${escapeHtml(modelName)}</sub>\n\n`);
	} else if (method === 'openai') {
		logger.debug('OpenAI method but no modelName provided');
	}
	
	markdown.appendMarkdown('---\n\n');
	markdown.appendMarkdown(`💬\n\n ${formatTranslationResult(translationResult)}\n\n`);
	markdown.appendMarkdown('---\n\n');

	if (isCached) {
		markdown.appendMarkdown('✨ *キャッシュから取得*  ');
	}

	markdown.appendMarkdown('⬇️ [**翻訳をペースト**](command:extension.translatePaste "翻訳結果をカーソル位置にペースト")');

	const HoverCtor: (new (contents: vscode.MarkdownString) => vscode.Hover) | undefined =
		typeof (vscode as unknown as { Hover?: unknown }).Hover === 'function'
			? (vscode as unknown as { Hover: new (contents: vscode.MarkdownString) => vscode.Hover }).Hover
			: undefined;

	return HoverCtor ? new HoverCtor(markdown) : ({ markdown } as unknown as vscode.Hover);
}
