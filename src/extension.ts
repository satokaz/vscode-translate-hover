'use strict';

import * as vscode from 'vscode';
import * as request from 'request-promise';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-translate-hover" is now active!');

	let preSelection = ' ';
	let preResult = [];
	let translate = [];
    let disposables: vscode.Disposable[] = [];
    
    // hover
	vscode.languages.registerHoverProvider('*', {
		async provideHover(document, position, token) {
			
		// 選択された文字列をゲット
        let selection = document.getText(vscode.window.activeTextEditor.selection);
        let wordRange = document.getWordRangeAtPosition(position);
        let text = [];

		// 選択が空じゃないか? スペースだけじゃないか？ 一つ前の内容と同一じゃないか？をチェック
		if (selection != "" && selection != " " && selection != preSelection) {
            preSelection = selection;
            
    		if(selection === document.getText(vscode.window.activeTextEditor.selection)){
				translate = await Translate(selection);
				await console.log('translate =', translate);
			} else {
                console.log('格納されている値と選択されている値が異なります');
				// selection = await document.getText(vscode.window.activeTextEditor.selection);
				// translate = await Translate(selection);
				return;
			}

            preResult = translate;
            console.log('preResult =', preResult);
            await text.push('![test](https://www.google.co.jp/images/branding/googleg/1x/googleg_standard_color_128dp.png|height=12)' + ' **翻訳結果**');
            await preResult.forEach(async function(a, i){
                // if(i != 0){
                    await text.push(await resultFormat(preResult[i].toString()));
                // }
            });
            // text.push('* ' + await resultFormat(preResult));
            await text.push(`[⬇️](command:extension.translatePaste) 翻訳結果をペースト`);
			return await new vscode.Hover(text, wordRange);
		} else {
				// マウスが移動した場合は、翻訳結果の hover 表示を辞める
				// console.log('マウスが移動しました');
				let cHover = document.getText(document.getWordRangeAtPosition(position));
				// console.log('同じ内容を何度も翻訳させません！');
				if (selection.indexOf(cHover) != -1) {
                    await text.push('![test](https://www.google.co.jp/images/branding/googleg/1x/googleg_standard_color_128dp.png|height=12)' + ' **翻訳結果** (直前の翻訳結果と同一です)');
                    // text.push('* ' + await resultFormat(preResult));
                    await preResult.forEach(async function(a, i){
                        // if(i != 0){
                            await text.push(await resultFormat(preResult[i].toString()));
                        // }
                    });
                    text.push(`[](command:extension.translatePaste) 翻訳結果をペースト`);
                    return await new vscode.Hover(text, wordRange);
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
							edit.insert(new vscode.Position(Number(selection2.anchor.line) + 1, 0), resultFormat(translate[0].toString()) + '\n')
					);
			} else if (selection2.isSingleLine === false && selection2.end.character == 0) {
					// ダブルクリックで選択した場合
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.end.line), 0), resultFormat(translate[0].toString()) + '\n')
					);
			} else {
					// 左から右へ選択した場合 (通常の選択)
					editor.edit(edit =>
							edit.insert(new vscode.Position(Number(selection2.end.line) + 1, 0), resultFormat(translate[0].toString()) + '\n')
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
    return translate.replace(/[（]/g, ' (')
    .replace(/[）]/g, ') ')
    .replace(/：/g, ':')
    .replace(/＃/g, '#');
}

// 翻訳 (ひとまず 英語 -> 日本語に固定)
async function Translate(selection) {
	let targetLanguage = String('ja');
	let fromLanguage = String('');
	let translateStr = googleTranslate(selection, targetLanguage, fromLanguage);
	let cfg = vscode.workspace.getConfiguration();
	let proxy = String(cfg.get("http.proxy"));

	const options = {
		uri: translateStr,
		proxy: proxy,
		json: true
	};

	// console.log(request(translateStr));
	return request(options).then(async res => {
		console.log(res);
		let result = [];
        let dict = [];

        let translateResult: String = '';
		let dictResult: String = '';
		// let obj = JSON.parse(res);

		res.sentences.forEach(function (v) {
				result.push(v.trans);
		})

		translateResult = result.join('');
		
		// 返ってきた JSON の中に dict があった場合
		if(res.dict){
			res.dict.forEach(function (d) {
				dict.push(d.terms);
			});
			translateResult = dict.join('');
        }

		console.log(result);
		console.log(dict);
        console.log('translateResult = ', translateResult);
        
		return [translateResult];
	});
}

// 
// Google 翻訳に渡す URL を生成
// markdown header (###) で始まると、翻訳が行われない。選択を encodeURIComponent() で encode して渡すこと
//
function googleTranslate(selection, targetLanguage, fromLanguage) {
	console.log(selection);
    return 'https://translate.google.com/translate_a/single?client=gtx&sl=' + (fromLanguage || 'auto') + '&tl=' + (targetLanguage || 'auto') + '&dt=at' + '&dt=t&dt=bd&ie=UTF-8&oe=UTF-8&dj=1&source=icon&q=' + encodeURIComponent(selection);
}
