/**
 * 定数定義
 */

export const CONFIG_SECTION = 'translateHover';

export const DEFAULTS = {
	TRANSLATION_METHOD: 'google',
	TARGET_LANGUAGE: 'ja',
	OPENAI_MODEL: 'gpt-4o-mini',
	LANGUAGE_DETECTION_METHOD: 'regex',
	TIMEOUT: 10000,
	MAX_TOKENS: 1000,
	TEMPERATURE: 0.3,
	DEBOUNCE_DELAY: 300 // 連続選択時の待機時間（ミリ秒）
} as const;

/**
 * 自動言語検出のプレフィックス
 */
export const AUTO_DETECT_PREFIX = 'auto-';

/**
 * 自動検出設定の言語ペア
 */
export const AUTO_DETECT_PAIRS: { [key: string]: { primary: string, secondary: string } } = {
	'auto-ja': { primary: 'ja', secondary: 'en' },  // 日本語以外→日本語、日本語→英語
	'auto-en': { primary: 'en', secondary: 'ja' },  // 英語以外→英語、英語→日本語
	'auto-zh': { primary: 'zh', secondary: 'en' },  // 中国語以外→中国語、中国語→英語
};

export const LANGUAGE_NAMES: { [key: string]: string } = {
	'ja': '日本語',
	'en': '英語',
	'zh': '中国語',
	'zh-CN': '中国語(簡体)',
	'zh-TW': '中国語(繁体)',
	'ko': '韓国語',
	'es': 'スペイン語',
	'fr': 'フランス語',
	'de': 'ドイツ語',
	'it': 'イタリア語',
	'pt': 'ポルトガル語',
	'ru': 'ロシア語',
	'ar': 'アラビア語',
	'hi': 'ヒンディー語',
	'th': 'タイ語',
	'vi': 'ベトナム語',
	'id': 'インドネシア語',
	'nl': 'オランダ語',
	'pl': 'ポーランド語',
	'tr': 'トルコ語',
	'sv': 'スウェーデン語',
	'da': 'デンマーク語',
	'no': 'ノルウェー語',
	'fi': 'フィンランド語'
};
