import * as vscode from 'vscode';
import { TranslationCache } from '../types';
import { DEFAULTS } from '../constants';
import * as logger from '../utils/logger';
import { buildCacheKey, updateCache, CACHE_MAX_ENTRIES } from './cache';

export type TranslateFn = (selection: string, config: ReturnType<typeof import('../config').getTranslationConfig>, signal?: AbortSignal) => Promise<string>;
export type GetConfigFn = () => ReturnType<typeof import('../config').getTranslationConfig>;

export interface HoverOrchestratorOptions {
	getConfig: GetConfigFn;
	translateText: TranslateFn;
	createHover: (text: string, isCached: boolean, method: string, modelName?: string) => vscode.Hover;
	logger?: typeof logger;
}

export class HoverOrchestrator {
	private debounceTimer: NodeJS.Timeout | null = null;
	private pendingSelection: string | null = null;
	private lastSelectionTime = 0;
	private hoverRequestSeq = 0;
	private translationCache = new Map<string, TranslationCache>();
	private lastTranslation: string | undefined;

	constructor(private opts: HoverOrchestratorOptions) {}

	public getLastTranslation(): string | undefined {
		return this.lastTranslation;
	}

	public async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return undefined;
		}

		const selection = document.getText(editor.selection);
		const requestId = ++this.hoverRequestSeq;
		const abortController = new AbortController();
		const cancelSubscription = token.onCancellationRequested(() => abortController.abort());

		if (selection && selection !== '' && selection !== ' ') {
			this.opts.logger?.debug('Selected text:', JSON.stringify(selection));
			this.opts.logger?.debug('Selection length:', selection.length);
		}

		try {
			const configForCache = this.opts.getConfig();
			const cacheKey = buildCacheKey(
				selection,
				configForCache.translationMethod,
				configForCache.targetLanguage,
				configForCache.translationMethod === 'openai' ? configForCache.openaiModel : undefined
			);

			const cached = this.translationCache.get(cacheKey);
			if (cached) {
				this.opts.logger?.debug('Using cached translation for selection');
				const cHover = document.getText(document.getWordRangeAtPosition(position));
				if (selection.indexOf(cHover) !== -1) {
					this.translationCache.delete(cacheKey);
					this.translationCache.set(cacheKey, cached);
					this.lastTranslation = cached.result;
					return this.opts.createHover(cached.result, true, cached.method, cached.modelName);
				}
			}

			if (selection !== '' && selection !== ' ') {
				this.opts.logger?.debug('New selection detected');

				if (this.debounceTimer) {
					this.opts.logger?.debug('Cancelling previous debounce timer');
					clearTimeout(this.debounceTimer);
					this.debounceTimer = null;
				}

				this.pendingSelection = selection;
				const currentSelectionTime = Date.now();
				this.lastSelectionTime = currentSelectionTime;

				const debouncePromise = new Promise<void>((resolve) => {
					this.debounceTimer = setTimeout(() => {
						this.debounceTimer = null;
						resolve();
					}, DEFAULTS.DEBOUNCE_DELAY);
				});

				this.opts.logger?.debug(`Debounce in progress, waiting ${DEFAULTS.DEBOUNCE_DELAY}ms...`);

				await debouncePromise;
				if (token.isCancellationRequested || requestId !== this.hoverRequestSeq) {
					this.opts.logger?.debug('Hover request cancelled after debounce');
					return undefined;
				}

				if (currentSelectionTime !== this.lastSelectionTime) {
					this.opts.logger?.debug('Selection changed during debounce, cancelling');
					return undefined;
				}

				const selectionToTranslate = this.pendingSelection;

				if (!selectionToTranslate || selectionToTranslate !== document.getText(editor.selection)) {
					this.opts.logger?.debug('Selection mismatch after debounce');
					this.pendingSelection = null;
					return undefined;
				}

				this.opts.logger?.debug('Debounce timeout reached, starting translation...');

				const config = this.opts.getConfig();
				const translated = await this.opts.translateText(selectionToTranslate, config, abortController.signal);
				if (token.isCancellationRequested || requestId !== this.hoverRequestSeq) {
					this.opts.logger?.debug('Hover request cancelled after translation');
					return undefined;
				}
				this.opts.logger?.debug('Translation result:', translated);
				this.lastTranslation = translated;

				const currentConfig = this.opts.getConfig();
				const entry: TranslationCache = {
					selection: selectionToTranslate,
					result: translated,
					method: currentConfig.translationMethod,
					targetLanguage: currentConfig.targetLanguage,
					modelName: currentConfig.translationMethod === 'openai' ? currentConfig.openaiModel : undefined
				};
				const entryKey = buildCacheKey(
					selectionToTranslate,
					currentConfig.translationMethod,
					currentConfig.targetLanguage,
					entry.modelName
				);
				updateCache(this.translationCache, entryKey, entry);

				this.opts.logger?.debug('Cache updated:', JSON.stringify({ method: entry.method, modelName: entry.modelName, hasResult: !!entry.result }));

				this.pendingSelection = null;
				return this.opts.createHover(translated, false, entry.method, entry.modelName);
			}
		} finally {
			cancelSubscription.dispose();
		}

		return undefined;
	}
}
