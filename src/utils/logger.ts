/**
 * ログ出力ユーティリティ
 */

import * as vscode from 'vscode';

/**
 * 出力チャネル（シングルトン）
 */
let outputChannel: vscode.OutputChannel | null = null;

/**
 * デバッグログの有効/無効
 */
let debugEnabled = true;

/**
 * 出力チャネルを初期化
 */
export function initializeLogger(channelName: string = 'Translate Hover'): void {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel(channelName);
	}
}

/**
 * 出力チャネルを破棄
 */
export function disposeLogger(): void {
	if (outputChannel) {
		outputChannel.dispose();
		outputChannel = null;
	}
}

/**
 * デバッグログの有効/無効を設定
 */
export function setDebugEnabled(enabled: boolean): void {
	debugEnabled = enabled;
}

/**
 * デバッグログを出力
 */
export function debug(...args: unknown[]): void {
	if (!debugEnabled || !outputChannel) {
		return;
	}
	
	const timestamp = new Date().toISOString();
	const message = args.map(arg => 
		typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
	).join(' ');
	
	outputChannel.appendLine(`[${timestamp}] [DEBUG] ${message}`);
}

/**
 * 情報ログを出力
 */
export function info(...args: unknown[]): void {
	if (!outputChannel) {
		return;
	}
	
	const timestamp = new Date().toISOString();
	const message = args.map(arg => 
		typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
	).join(' ');
	
	outputChannel.appendLine(`[${timestamp}] [INFO] ${message}`);
}

/**
 * エラーログを出力
 */
export function error(...args: unknown[]): void {
	if (!outputChannel) {
		return;
	}
	
	const timestamp = new Date().toISOString();
	const message = args.map(arg => 
		typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
	).join(' ');
	
	outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
}

/**
 * 出力チャネルを表示
 */
export function show(): void {
	if (outputChannel) {
		outputChannel.show();
	}
}

/**
 * 出力チャネルをクリア
 */
export function clear(): void {
	if (outputChannel) {
		outputChannel.clear();
	}
}
