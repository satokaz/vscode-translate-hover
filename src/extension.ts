'use strict';

import * as vscode from 'vscode';
import * as WebRequest from 'web-request';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-translate-hover" is now active!');

	let preSelection = ' ';
	let preResult = ' ';
	let translate;

	// hover
	vscode.languages.registerHoverProvider('*', {
		async provideHover(document, position, token) {

		// 選択された文字列をゲット
			let selection = await document.getText(vscode.window.activeTextEditor.selection);

			// 選択が空じゃないか? スペースだけじゃないか？ 一つ前の内容と同一じゃないか？をチェック
			if (selection != "" && selection != " " && selection != preSelection) {
				preSelection = selection;

				if(selection === document.getText(vscode.window.activeTextEditor.selection)){
					translate = await Translate(selection)
				} else {
					console.log('格納されている値と選択されている値が異なります');
					return;

					// selection = await document.getText(vscode.window.activeTextEditor.selection);
					// translate = await Translate(selection);
				}
				preResult = translate;
				await console.log('translate =', translate);
					return await new vscode.Hover('* ' + resultFormat(translate) + `&nbsp; [⬇️](command:extension.translatePaste)`);
			} else {
				// マウスが移動した場合は、翻訳結果の hover 表示を辞める
				// console.log('マウスが移動しました');
				let cHover = document.getText(document.getWordRangeAtPosition(position));
				// console.log('同じ内容を何度も翻訳させません！');
				if (selection.indexOf(cHover) != -1) {
					return await new vscode.Hover('* ' + resultFormat(preResult) + ' `\[使い回し\]`' + `&nbsp; [⬇️](command:extension.translatePaste)`);
				}
			}
		}
	});

		// 翻訳結果の paste コマンド
		context.subscriptions.push(vscode.commands.registerCommand('extension.translatePaste', () => {
			// 翻訳結果が何もない場合(undefined) は、ペーストしない
			if(translate == undefined){
				return;
			}
			// カーソルがある行を取得
			let editor = vscode.window.activeTextEditor;
			let selection2 = editor.selection;
			let startLine = selection2.start.line;
			let lastCharIndex = vscode.window.activeTextEditor.document.lineAt(startLine).text.length;

			if (selection2.isReversed === true) {
					// 右から左へ選択した場合
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.anchor.line) + 1, 0), resultFormat(translate) + '\n')
					);
			} else if (selection2.isSingleLine === false && selection2.end.character == 0) {
					// ダブルクリックで選択した場合
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.end.line), 0), resultFormat(translate) + '\n')
					);
			} else {
					// 左から右へ選択した場合 (通常の選択)
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.end.line) + 1, 0), resultFormat(translate) + '\n')
					);
			}
			// ペースト後に選択解除
			vscode.window.activeTextEditor.selection = new vscode.Selection(selection2.active, selection2.active);
		}));
}

// this method is called when your extension is deactivated
export function deactivate() {

}

// 翻訳結果の整形
function resultFormat(translate) {
	return translate.replace(/[（]/g, ' (').replace(/[）]/g, ') ');
}

// 翻訳 (ひとまず 英語 -> 日本語に固定)
function Translate(selection) {

	let cfg = vscode.workspace.getConfiguration();
	let proxy = String(cfg.get("http.proxy"));
	let api = String('google');
	let targetLanguage = String('ja');
	let fromLanguage = String('');

	let translateStr = googleTranslate(selection, targetLanguage, fromLanguage);
	// console.log(proxy);
	// console.log(translateStr);

	return WebRequest.get(translateStr, { "proxy": proxy }).then((TResult) => {

					let translateResult;
					let res = JSON.parse(TResult.content.toString());
					let result = [];

					res.sentences.forEach(function (v) {
						result.push(v.trans)
					})

					translateResult = result.join('');
					// console.log('translateResult = ', translateResult.toString());
					return translateResult.toString();
				});
}

// 
// Google 翻訳に渡す URL を生成
// markdown header (###) で始まると、翻訳が行われない。選択を encodeURIComponent() で encode して渡すこと
//
function googleTranslate(selection, targetLanguage, fromLanguage) {
	console.log(selection);
	return 'https://translate.google.com/translate_a/single?client=gtx&sl=' + (fromLanguage || 'auto') + '&tl=' + (targetLanguage || 'auto') + '&dt=t&dt=bd&ie=UTF-8&oe=UTF-8&dj=1&source=icon&q=' + encodeURIComponent(selection);
}
