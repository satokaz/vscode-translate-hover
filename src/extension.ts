'use strict';

import * as vscode from 'vscode';
import axios, { AxiosProxyConfig } from 'axios';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-translate-hover" is now active!');

	let preSelection = ' ';
	let preResult = ' ';
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
			if (selection !== "" && selection !== " " && selection !== preSelection) {
				console.log('[DEBUG] New selection detected, starting translation...');
				preSelection = selection;

				if(selection === document.getText(editor.selection)){
					translate = await Translate(selection);
					console.log('[DEBUG] Translation result:', translate);
				} else {
					console.log('格納されている値と選択されている値が異なります');
					// selection = await document.getText(editor.selection);
					// translate = await Translate(selection);
					return;
				}

				preResult = translate;
				return new vscode.Hover('* ' + resultFormat(translate) + `&nbsp; [⬇️](command:extension.translatePaste)`);
			} else {
				// マウスが移動した場合は、翻訳結果の hover 表示を辞める
				console.log('[DEBUG] Using cached translation for selection');
				const cHover = document.getText(document.getWordRangeAtPosition(position));
				// console.log('同じ内容を何度も翻訳させません!');
				if (selection.indexOf(cHover) !== -1) {
					return new vscode.Hover('* ' + resultFormat(preResult) + '`\[使い回し\]`' + `&nbsp; [⬇️](command:extension.translatePaste)`);
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
							edit.insert(new vscode.Position(Number(selection2.anchor.line) + 1, 0), resultFormat(translate!) + '\n')
					);
			} else if (selection2.isSingleLine === false && selection2.end.character === 0) {
					// ダブルクリックで選択した場合
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.end.line), 0), resultFormat(translate!) + '\n')
					);
			} else {
					// 左から右へ選択した場合 (通常の選択)
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.end.line) + 1, 0), resultFormat(translate!) + '\n')
					);
			}
			// ペースト後に選択解除
			editor.selection = new vscode.Selection(selection2.active, selection2.active);
		}));
}

// this method is called when your extension is deactivated
export function deactivate() {

}

// 翻訳結果の整形
function resultFormat(translate: string): string {
	return translate.replace(/[（]/g, ' (').replace(/[）]/g, ') ');
}

// 翻訳 (ひとまず 英語 -> 日本語に固定)
async function Translate(selection: string): Promise<string> {
	const targetLanguage = 'ja';
	const fromLanguage = '';
	const translateUrl = googleTranslate(selection, targetLanguage, fromLanguage);
	const cfg = vscode.workspace.getConfiguration();
	const proxyStr = cfg.get<string>("http.proxy");

	try {
		let axiosConfig: any = {
			url: translateUrl,
			method: 'GET',
			timeout: 10000
		};

		// プロキシ設定がある場合は追加
		if (proxyStr && proxyStr.trim() !== '') {
			const proxyUrl = new URL(proxyStr);
			axiosConfig.proxy = {
				protocol: proxyUrl.protocol.replace(':', ''),
				host: proxyUrl.hostname,
				port: parseInt(proxyUrl.port)
			} as AxiosProxyConfig;
		}

		const response = await axios(axiosConfig);
		const res = response.data;

		let result: string[] = [];
		let dict: string[] = [];

		if (res.sentences) {
			res.sentences.forEach((v: any) => {
				if (v.trans) {
					result.push(v.trans);
				}
			});
		}

		let translateResult = result.join('');
		
		// 返ってきた JSON の中に dict があった場合
		if(res.dict){
			res.dict.forEach((d: any) => {
				if (d.terms) {
					dict.push(d.terms);
				}
			});
			translateResult += '\n' + '  * ' + dict.join('');
		}

		return translateResult.toString();
	} catch (error) {
		console.error('Translation error:', error);
		return 'Translation failed';
	}
}


// 
// Google 翻訳に渡す URL を生成
// markdown header (###) で始まると、翻訳が行われない。選択を encodeURIComponent() で encode して渡すこと
//
function googleTranslate(selection: string, targetLanguage: string, fromLanguage: string): string {
	console.log(selection);
	return 'https://translate.google.com/translate_a/single?client=gtx&sl=' + (fromLanguage || 'auto') + '&tl=' + (targetLanguage || 'auto') + '&dt=t&dt=bd&ie=UTF-8&oe=UTF-8&dj=1&source=icon&q=' + encodeURIComponent(selection);
}
