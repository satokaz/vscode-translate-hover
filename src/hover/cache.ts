import { TranslationCache } from '../types';

export const CACHE_MAX_ENTRIES = 30;

export function buildCacheKey(
	selection: string,
	method: string,
	targetLanguage: string,
	modelName?: string
): string {
	const modelToken = modelName ?? '';
	return `${method}::${targetLanguage}::${modelToken}::${selection}`;
}

export function updateCache(cache: Map<string, TranslationCache>, key: string, entry: TranslationCache): void {
	if (cache.has(key)) {
		cache.delete(key);
	}
	cache.set(key, entry);
	if (cache.size > CACHE_MAX_ENTRIES) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) {
			cache.delete(oldestKey);
		}
	}
}
