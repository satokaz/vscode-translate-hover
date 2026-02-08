/**
 * Google翻訳プロバイダー
 */

import * as vscode from 'vscode';
import axios, { AxiosProxyConfig, AxiosRequestConfig } from 'axios';
import { DEFAULTS } from '../constants';
import * as logger from '../utils/logger';

/**
 * Google翻訳を使った翻訳
 */
export async function translateWithGoogle(selection: string, targetLanguage: string, signal?: AbortSignal): Promise<string> {
	const translateUrl = buildGoogleTranslateUrl(selection, targetLanguage);
	const cfg = vscode.workspace.getConfiguration();
	const proxyStr = cfg.get<string>("http.proxy");

	interface GoogleTranslateSentence {
		trans?: string;
	}

	interface GoogleTranslateDictEntry {
		terms?: string[];
	}

	interface GoogleTranslateResponse {
		sentences?: GoogleTranslateSentence[];
		dict?: GoogleTranslateDictEntry[];
	}

	try {
		const axiosConfig: AxiosRequestConfig = {
			url: translateUrl,
			method: 'GET',
			timeout: DEFAULTS.TIMEOUT,
			signal
		};

		// プロキシ設定
		if (proxyStr && proxyStr.trim() !== '') {
			const proxyUrl = new URL(proxyStr);
			axiosConfig.proxy = {
				protocol: proxyUrl.protocol.replace(':', ''),
				host: proxyUrl.hostname,
				port: parseInt(proxyUrl.port)
			} as AxiosProxyConfig;
		}

		const response = await axios<GoogleTranslateResponse>(axiosConfig);
		const data = response.data;

		// 翻訳結果の抽出
		const translations: string[] = [];
		if (data.sentences) {
			data.sentences.forEach((sentence) => {
				if (sentence.trans) {
					translations.push(sentence.trans);
				}
			});
		}

		let result = translations.join('');

		// 辞書データの追加
		if (data.dict) {
			const dictTerms: string[] = [];
			data.dict.forEach((dict) => {
				if (dict.terms) {
					dictTerms.push(...dict.terms);
				}
			});
			
			if (dictTerms.length > 0) {
				result += '\n  * ' + dictTerms.join('');
			}
		}

		return result;
	} catch (error) {
		if (signal?.aborted) {
			logger.debug('Google translation aborted');
			return 'Translation cancelled';
		}
		logger.error('Google translation failed:', error);
		return 'Translation failed';
	}
}

/**
 * Google翻訳APIのURLを生成
 */
function buildGoogleTranslateUrl(text: string, targetLanguage: string, fromLanguage: string = 'auto'): string {
	const params = new URLSearchParams({
		client: 'gtx',
		sl: fromLanguage,
		tl: targetLanguage,
		dt: 't',
		ie: 'UTF-8',
		oe: 'UTF-8',
		dj: '1',
		source: 'icon',
		q: text
	});

	// dt=bd パラメータを追加（辞書データ取得用）
	return `https://translate.google.com/translate_a/single?${params.toString()}&dt=bd`;
}
