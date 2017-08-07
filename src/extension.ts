'use strict';

import * as vscode from 'vscode';
import * as WebRequest from 'web-request';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-translate-hover2" is now active!');

		let preSelection = ' ';
		let preResult = ' ';
		// hover
		vscode.languages.registerHoverProvider('*', {
			async provideHover(document, position, token) {
				let translate;
				let selection = await document.getText(vscode.window.activeTextEditor.selection);
				
				if (selection != "" && selection != " " && selection != preSelection) {
					preSelection = selection;
					translate = await google(selection)
					preResult = translate;
					await console.log('translate =', translate);
					return await new vscode.Hover(translate.replace(/[（]/g, '(').replace(/[）]/g, ')'));
				} else {
					console.log('マウスが移動しました');
					let cHover = document.getText(document.getWordRangeAtPosition(position));
					console.log('同じ内容を何度も翻訳させません！');
					if (selection.indexOf(cHover) != -1) {
						return await new vscode.Hover(preResult);
					}
				}
				// console.log('selection = ', selection);
				// console.log('preSelection = ', preSelection);
					// return await new vscode.Hover(translate);
			}
		});
}

// this method is called when your extension is deactivated
export function deactivate() {
}


// 
function google(selection) {
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

					// translateResult = result.join('');
					console.log('translateResult = ', result.toString());
					return result.toString();
				});
}

function googleTranslate(selection, targetLanguage, fromLanguage) {
	console.log(selection);
	return 'https://translate.google.com/translate_a/single?client=gtx&sl=' + (fromLanguage || 'auto') + '&tl=' + (targetLanguage || 'auto') + '&dt=t&dt=bd&ie=UTF-8&oe=UTF-8&dj=1&source=icon&q=' + selection;
}

