export default defineContentScript({
	matches: ['https://login.tailscale.com/admin/dns*'],
	main() {
		browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
			if (message.action === 'claimToken') {
				const { tcd, token } = message;
				fetch('https://login.tailscale.com/admin/api/public/admin/tcd', {
					credentials: 'include',
					headers: {
						Accept: 'application/json, text/plain, */*',
						'Accept-Language': 'en-US,en;q=0.5',
						'Content-Type': 'application/json',
						'Sec-Fetch-Site': 'same-origin',
					},
					referrer: 'https://login.tailscale.com/admin/dns',
					body: JSON.stringify({ tcd, token }),
					method: 'POST',
					mode: 'cors',
				})
					.then((res) => res.json())
					.then((result) => {
						if (result.error === 'invalid tailnet name offer token') {
							sendResponse({
								success: false,
								error: 'This tailnet token offer has expired.',
							});
							return;
						} else {
							sendResponse({ success: true, result });
						}
					})
					.catch((err) => {
						sendResponse({ success: false, error: err.toString() });
					});
				return true;
			}
		});
	},
});
