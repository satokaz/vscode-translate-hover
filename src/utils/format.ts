/**
 * フォーマット関連のユーティリティ
 */

/**
 * 翻訳結果の整形（括弧の前後にスペースを追加）
 */
export function formatTranslationResult(text: string): string {
	return text.replace(/[（]/g, ' (').replace(/[）]/g, ') ');
}
