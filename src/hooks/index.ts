import type { Handle } from '@sveltejs/kit';
import * as cheerio from 'cheerio';
import {siteMode} from "$lib/config";


/**
 * Modifies the response in-place to fix the link rel="modulepreload" issue.
 *
 * Note that this fix causes significant server-side processing time increase -
 * do not use long term, only proper fix is to fix Vite.
 *
 * For the source of the issue of loading times please see https://github.com/vitejs/vite/issues/5120
 *
 */
function fixLinkModulePreloadIssue(response: ServerResponse) {

	if(!response.body) {
		throw new Error("text/html response was missing body");
	}
	const $ = cheerio.load(response.body);

	const body = $("body");

	// Replace <link rel="modulepreload"> with <script type="module">
	// https://api.jquery.com/replacewith/
	//$('link[rel="modulepreload"]').replaceWith(function() {
	//  const src = $(this).attr('href');
	//// The defer attribute has no effect on module scripts — they defer by default.
	//  return `<script type="module" src="${src}"></script>`;
	//});

	$('link[rel="modulepreload"]').each(function(idx, elem) {
		const $this = $(this);
		const src = $this.attr('href');
		$(`<script type="module" async src="${src}"></script>`).appendTo(body);
		$this.remove();
	});

	// TODO: Does not have effect if we put scripts at the end of the body
	// Move starter section to the <body> end
	// Assume we have only one <script type="module"> in our generated <head>
	// const starter = $("head script[type='module']");
	//starter.appendTo(body);
	//starter.remove();

	response.body = $.html();
}


export const handle: Handle = async ({ request, resolve }) => {

	// TODO https://github.com/sveltejs/kit/issues/1046
	if (request.query.has('_method')) {
		request.method = request.query.get('_method').toUpperCase();
	}

	const response = await resolve(request);

	// Fix modulepreload issue
	// https://stackoverflow.com/a/70472372/315168

	if (response.headers["content-type"] === "text/html") {
		// Only try to transform HTML pages,
		// do not touch binary etc. loads
		fixLinkModulePreloadIssue(response);
	}

	return response;
};


/**
 * Shortcut fetch() API requests on the server-side rendering.
 *
 * See https://github.com/tradingstrategy-ai/proxy-server/blob/master/Caddyfile
 *
 * @type {import('@sveltejs/kit').ExternalFetch}
 */
export async function externalFetch(request) {

	if(siteMode == "production") {

		// Write API URL to the internal network
		// TODO: Make these URLs part of config
		const publicHost = "https://tradingstrategy.ai/api";
		const internalHost = "http://127.0.0.1:3456"

		if (request.url.startsWith(publicHost)) {
			// clone the original request, but change the URL
			request = new Request(
				request.url.replace(publicHost, internalHost),
				request
			);}

	}
	return fetch(request);
}