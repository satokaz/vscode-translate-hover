/**
 * 言語検出ユーティリティ
 */

/**
 * テキストが主に日本語かどうかを判定
 */
export function isJapanese(text: string): boolean {
	// ひらがな、カタカナ、漢字の範囲
	const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
	const japaneseChars = text.match(new RegExp(japaneseRegex, 'g'));
	
	if (!japaneseChars) {
		return false;
	}
	
	// 日本語文字の割合が30%以上なら日本語と判定
	const ratio = japaneseChars.length / text.length;
	return ratio > 0.3;
}

/**
 * テキストが主に中国語かどうかを判定
 */
export function isChinese(text: string): boolean {
	// 漢字のみ（日本語特有の文字を除外）
	const chineseRegex = /[\u4E00-\u9FAF]/;
	const japaneseOnlyRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
	
	// 日本語特有の文字があれば中国語ではない
	if (japaneseOnlyRegex.test(text)) {
		return false;
	}
	
	const chineseChars = text.match(new RegExp(chineseRegex, 'g'));
	if (!chineseChars) {
		return false;
	}
	
	// 漢字の割合が30%以上なら中国語と判定
	const ratio = chineseChars.length / text.length;
	return ratio > 0.3;
}

/**
 * テキストが主に韓国語かどうかを判定
 */
export function isKorean(text: string): boolean {
	// ハングルの範囲
	const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
	const koreanChars = text.match(new RegExp(koreanRegex, 'g'));
	
	if (!koreanChars) {
		return false;
	}
	
	// 韓国語文字の割合が30%以上なら韓国語と判定
	const ratio = koreanChars.length / text.length;
	return ratio > 0.3;
}

/**
 * テキストの言語を検出
 * @returns 検出された言語コード (ja, zh, ko, en など)
 */
export function detectLanguage(text: string): string {
	if (isJapanese(text)) {
		return 'ja';
	}
	
	if (isChinese(text)) {
		return 'zh';
	}
	
	if (isKorean(text)) {
		return 'ko';
	}
	
	// デフォルトは英語と仮定
	return 'en';
}

/**
 * 自動検出設定に基づいて適切なターゲット言語を決定
 * @param text 翻訳するテキスト
 * @param autoConfig auto-ja などの設定
 * @param pairs 言語ペア設定
 * @returns 決定されたターゲット言語
 */
export function resolveTargetLanguage(
	text: string,
	autoConfig: string,
	pairs: { [key: string]: { primary: string, secondary: string } }
): string {
	const config = pairs[autoConfig];
	if (!config) {
		return autoConfig; // auto設定でない場合はそのまま返す
	}
	
	const detectedLang = detectLanguage(text);
	
	// 検出された言語がプライマリ言語の場合、セカンダリ言語に翻訳
	if (detectedLang === config.primary) {
		return config.secondary;
	}
	
	// それ以外の場合はプライマリ言語に翻訳
	return config.primary;
}
