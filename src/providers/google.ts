/**
 * Google翻訳プロバイダー
 */

import * as vscode from 'vscode';
import axios, { AxiosProxyConfig } from 'axios';
import { DEFAULTS } from '../constants';
import * as logger from '../utils/logger';

/**
 * Google翻訳を使った翻訳
 */
export async function translateWithGoogle(selection: string, targetLanguage: string): Promise<string> {
	const translateUrl = buildGoogleTranslateUrl(selection, targetLanguage);
	const cfg = vscode.workspace.getConfiguration();
	const proxyStr = cfg.get<string>("http.proxy");

	try {
		const axiosConfig: any = {
			url: translateUrl,
			method: 'GET',
			timeout: DEFAULTS.TIMEOUT
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

		const response = await axios(axiosConfig);
		const data = response.data;

		// 翻訳結果の抽出
		const translations: string[] = [];
		if (data.sentences) {
			data.sentences.forEach((sentence: any) => {
				if (sentence.trans) {
					translations.push(sentence.trans);
				}
			});
		}

		let result = translations.join('');

		// 辞書データの追加
		if (data.dict) {
			const dictTerms: string[] = [];
			data.dict.forEach((dict: any) => {
				if (dict.terms) {
					dictTerms.push(dict.terms);
				}
			});
			
			if (dictTerms.length > 0) {
				result += '\n  * ' + dictTerms.join('');
			}
		}

		return result;
	} catch (error) {
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
