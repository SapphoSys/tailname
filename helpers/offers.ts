import { log } from '$helpers/logging';
import { getTailnetNames, validateTailnetNames } from '$helpers/tailnet';
import { extractMatchingTokens, storeTokens } from '$helpers/tokens';
import type { Offer } from '$types/tokens';

export const getTailcontrolCookie = async (): Promise<{
	value: string;
} | null> => {
	return await browser.cookies.get({
		url: 'https://login.tailscale.com',
		name: 'tailcontrol',
	});
};

export const fetchTailscaleOffers = async (cookieValue: string) => {
	return await fetch(
		'https://login.tailscale.com/admin/api/public/admin/tcd/offers',
		{
			headers: {
				accept: 'application/json, text/plain, */*',
				'accept-language': 'en-US,en;q=0.9',
				'cache-control': 'no-cache',
				pragma: 'no-cache',
				cookie: `tailcontrol=${cookieValue}; tailwww-ui=true`,
			},
			referrer: 'https://login.tailscale.com/admin/dns',
			referrerPolicy: 'strict-origin-when-cross-origin',
			method: 'GET',
			mode: 'cors',
		},
	);
};

const handleCheckOffersError = (errMsg: string) => {
	log(errMsg, 'ERROR', 'Offers');
	log(
		'Checking offers process finished due to an error. See line above.',
		'ERROR',
		'Offers',
	);

	browser.alarms.clear('checkOffersAlarm');
};

export const checkTailscaleOffers = async () => {
	log(
		'Checking offers process started. Searching Tailscale for tailnet name offers...',
		'INFO',
		'Offers',
	);
	let tailnetNames: string[] = [];

	try {
		tailnetNames = await getTailnetNames();
	} catch {
		log(
			'Failed to get tailnetNames from storage. Defaulting to empty array.',
			'WARNING',
			'Offers',
		);
	}

	if (!validateTailnetNames(tailnetNames)) {
		handleCheckOffersError(
			'No tailnet keywords set. User needs to add at least one tailnet keyword.',
		);
		return;
	}

	try {
		const cookie = await getTailcontrolCookie();
		if (!cookie) {
			handleCheckOffersError(
				'Tailcontrol cookie not found. User needs to log in to Tailscale.',
			);
			return;
		}

		const cookieValue = cookie.value;
		const response = await fetchTailscaleOffers(cookieValue);
		const body: { data?: Offer } = await response.json();

		if (body.data?.tcds) {
			const tokens = extractMatchingTokens(body.data.tcds, tailnetNames);

			if (tokens.length > 0) {
				log(
					`Found matching tokens: ${JSON.stringify(tokens)}`,
					'INFO',
					'Offers',
				);

				storeTokens(tokens);
			} else {
				log(
					"No matching tailnet name offers found that match the user's defined keywords.",
					'INFO',
					'Offers',
				);
			}
		}
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : 'Unknown error';
		handleCheckOffersError(errorMsg || 'Unknown error');
	}
};
