# vscode-translate-hover README

## Features

選択されたテキストを google translate で翻訳し、結果をホバー表示する拡張機能です。
翻訳結果を選択されたテキストの下にペーストすることも可能。

* Windows/Linux: `ctrl + shift + T`, macOS: `cmd + shift + T`: 翻訳結果を選択されたテキスト直下に貼り付ける

下記の拡張機能を参考にしました。

* [vscode-translate](https://marketplace.visualstudio.com/items?itemName=chun.vscode-translate)
* [TranslationToolbox](https://marketplace.visualstudio.com/items?itemName=WLY.translationtoolbox)

## Requirements

* Google 翻訳に頼っているため、ネットワーク接続必須
* http.proxy をサポート。

## Extension Settings

* なし

## 使い方

適当に文字列をマウスで選択し、選択された文字列のにマウスカーソルを重ねれば翻訳結果がホバー表示されます。
必要なら `cmd + shift + T` か、hover に表示される ⬇️ をクリックで選択されたテキストの下にペーストされます


## Known Issues

* 一発で翻訳ができない場合がある。マウスを移動させて何度かホバーを表示させて翻訳結果を確認してください

### 0.0.1

Initial release

---


**Enjoy!**