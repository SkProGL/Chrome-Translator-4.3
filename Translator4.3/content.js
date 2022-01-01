console.log("[content.js] - Translator4.3");

const API_KEY = "",
	XHR = new XMLHttpRequest();
XHR.withCredentials = true;

var canTranslate,
	reqFinished,
	targetLanguage = 'en',
	sourceLanguage = '',
	isAutodetectionEnabled = true,
	isLastSent,
	[translatedBlocks, detectedBlocks, coords] = [[], [], []];

// const bubbleDOM = document.createElement('div').appendChild(document.createElement('div'));
const [mainBubble, textBubble, detectionBubble] = [
	document.createElement('div'),
	document.createElement('div'),
	document.createElement('div')
];
mainBubble.appendChild(textBubble);
mainBubble.appendChild(detectionBubble);

textBubble.setAttribute('class', 'tooltip_bubble');

// No need for css file if you want to prevent cases
// when website has the same class name or id and css file being applied automatically(on every website)
// It is useful only for extensions that change website appearance
cssProperties(detectionBubble, {
	'color': 'rgb(172, 172, 172)',
	'border-top': '1px solid rgb(172, 172, 172)',
	'font-size': '12px'
});
cssProperties(mainBubble, {
	"font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
	"font-family": "monospace",
	"visibility": "hidden",
	"font-style": "normal",
	"position": "fixed",
	"padding": "12px",
	"margin": "1em 0 3em",
	"color": "rgb(205, 205, 205)",
	"background": "#3f3e3e",
	"z-index": "1000",
	"-webkit-border-radius": "10px",
	"-moz-border-radius": "10px",
	"border-radius": "-50%"
});
document.body.appendChild(mainBubble);

// on tooltip hover
var delay = function (elem, callback) {
	var timeout = null;
	elem.onmouseover = function () {
		// Set timeout to be a timer which will invoke callback
		timeout = setTimeout(callback, 2500);
	};

	elem.onmouseout = function () {
		// Clear any timers set to timeout
		clearTimeout(timeout);
	}
};
delay(mainBubble, function () {
	let h = textBubble.innerText,
		timeout = null;
	sendBackground('clipboard', h);
	detectionBubble.style.display = 'none';
	textBubble.innerText = '[COPIED TO CLIPBOARD]';
	clearTimeout(timeout);
	timeout = setTimeout(function () {
		textBubble.innerText = h;
		detectionBubble.style.display = 'block';
	}, 600);
});
sendBackground('deserialize data');

// chrome Message passing is used to communicate with background and popup .js
// listener
chrome.extension.onMessage.addListener((request) => {
	// extension state (either on or off)
	if (request.action === 'remember everything') {
		canTranslate = (request.content['extensionState'] === "OFF") ? false : true;
		// console.log(canTranslate);
		targetLanguage = request.content['langTo']
		if (request.content['langFrom'] === 'auto') {
			sourceLanguage = '';
			isAutodetectionEnabled = true;
		} else {
			sourceLanguage = 'from=' + request.content['langFrom'] + '&';
			isAutodetectionEnabled = false;
		}
	}
	if (request.action === 'clipboard shortcut') {
		sendBackground('clipboard', textBubble.innerText);
	}
});

// chrome Message passing is used to communicate with background and popup .js
// sender
function sendBackground(a = '', b = '') {
	chrome.runtime.sendMessage({
		target: 'background',
		action: a,
		content: b
	})
}

function showTranslation(mouseX, mouseY, input) {
	textBubble.innerText = input;
	if (isAutodetectionEnabled) {
		let a = '';
		// If text contains different languages at once [English, German], then display them all
		if (detectedBlocks.length > 1) {
			for (i in detectedBlocks) {
				if (parseInt(i) === detectedBlocks.length - 1) {
					a += availableLanguages[detectedBlocks[parseInt(i)]];
					break;
				}
				a += availableLanguages[detectedBlocks[parseInt(i)]] + ', ';
			}
		}
		else { a = availableLanguages[detectedBlocks[0]]; }
		detectionBubble.innerText = '[' + detectedBlocks + ']' + a;
		detectionBubble.style.display = 'block';
	} else { detectionBubble.style.display = 'none'; }
	mainBubble.style.visibility = 'visible';
	mainBubble.style.left = mouseX + 'px';
	mainBubble.style.top = mouseY + 'px';

}
// API request
function apiRequest(text) {
	XHR.open("POST", "https://microsoft-translator-text.p.rapidapi.com/translate?to=" + targetLanguage + "&api-version=3.0&" + sourceLanguage + "profanityAction=NoAction&textType=plain");
	XHR.setRequestHeader("content-type", "application/json");
	XHR.setRequestHeader("x-rapidapi-key", API_KEY);
	XHR.setRequestHeader("x-rapidapi-host", "microsoft-translator-text.p.rapidapi.com");
	XHR.send(JSON.stringify([{
		"text": text
	}]));
}
// API response
XHR.addEventListener("readystatechange", async function () {
	if (this.readyState === this.DONE) {
		const responseData = JSON.parse(this.responseText)[0];
		let detectedLanguage = responseData.detectedLanguage && responseData.detectedLanguage.language || [],
			// accuracy = responseData.detectedLanguage && responseData.detectedLanguage.score || [],
			translation = responseData.translations[0].text;

		if (reqFinished && reqFinished.length > 0) {
			translatedBlocks += translation
			if (!detectedBlocks.includes(detectedLanguage) && detectedLanguage !== []) {
				detectedBlocks.push(detectedLanguage);
			}
			showTranslation(coords[0], coords[1], translatedBlocks);
			// Last response received
			if (reqFinished.indexOf(false) === reqFinished.length - 1) {
				[translatedBlocks, detectedBlocks] = [[], []];
			}

			// Requests aborted
			if (reqFinished.indexOf(false) === -1) {
				// console.log('Aborted');
				[reqFinished, translatedBlocks, detectedBlocks] = [[], [], []];
				return;
			}
			reqFinished[reqFinished.indexOf(false)] = true

		} else {
			if (isLastSent === true) {
				isLastSent = false;
				return;
			}
			detectedBlocks.push(detectedLanguage)
			showTranslation(coords[0], coords[1], translation);
			detectedBlocks = [];
		}
	}
});

window.addEventListener('wheel', function () {
	mainBubble.style.visibility = 'hidden';
	detectionBubble.style.display = 'none';
})

window.addEventListener('mouseup', async function (e) {
	if (canTranslate === false) return;
	let selection = (window.getSelection()).toString();
	if (selection.length < 1 || selection === '\n' || selection === '\r' || selection === ' ') {
		mainBubble.style.visibility = 'hidden';
	}
	else {
		let rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
		coords = [e.x, e.y, rect.width, rect.height];
		// doesn't let you append last translation
		[reqFinished, translatedBlocks] = [[], []];
		/* request has text amount limit (approx 400-500 chars) so the workaround is to
		 split text to sentences then send it by separate requests */
		if (selection.length > 220) {
			let v = selection.match(/.*?\D[.!?]+|.*/gs)// split every sentence with . or ! or ? also it won't split dot after number
			if (v[v.length - 1] === '') { // removes empty string
				v.pop()
			}
			// fill new boolean array to keep track of successful requests 
			reqFinished = new Array(v.length).fill(false);
			loop1: for (let i = 0; i < v.length; i++) {
				apiRequest(v[i].toString());
				// wait until response is received
				while (reqFinished === [] || reqFinished[i] === false) {
					// console.log('Initializing ', requestsFinished);
					if (window.getSelection().isCollapsed.toString() === 'true') {
						// if user close selection then set value to []
						[reqFinished, translatedBlocks, detectedBlocks] = [[], [], []];
						isLastSent = true;
						break loop1;
					}
					await new Promise(r => setTimeout(r, 500)); // wait half a second
				}

			}
		} else {
			apiRequest(selection)
		}
	}
});


function cssProperties(elem, attrs) {
	for (let key in attrs) {
		elem.style.setProperty(key, attrs[key]);
	}
}

let availableLanguages = {
	'af': 'Afrikaans',
	'ar': 'Arabic',
	'as': 'Assamese',
	'bn': 'Bangla',
	'bs': 'Bosnian (Latin)',
	'bg': 'Bulgarian',
	'yue': 'Cantonese (Traditional)',
	'ca': 'Catalan',
	'zh-Hans': 'Chinese Simplified',
	'zh-Hant': 'Chinese Traditional',
	'hr': 'Croatian',
	'cs': 'Czech',
	'prs': 'Dari',
	'da': 'Danish',
	'nl': 'Dutch',
	'en': 'English',
	'et': 'Estonian',
	'fj': 'Fijian',
	'fil': 'Filipino',
	'fi': 'Finnish',
	'fr': 'French',
	'fr-ca': 'French (Canada)',
	'de': 'German',
	'el': 'Greek',
	'gu': 'Gujarati',
	'ht': 'Haitian Creole',
	'he': 'Hebrew',
	'hi': 'Hindi',
	'mww': 'Hmong Daw',
	'hu': 'Hungarian',
	'is': 'Icelandic',
	'id': 'Indonesian',
	'ga': 'Irish',
	'it': 'Italian',
	'ja': 'Japanese',
	'kn': 'Kannada',
	'kk': 'Kazakh',
	'tlh-Latn': 'Klingon',
	'tlh-Piqd': 'Klingon (plqaD)',
	'ko': 'Korean',
	'ku': 'Kurdish (Central)',
	'kmr': 'Kurdish (Northern)',
	'lv': 'Latvian',
	'lt': 'Lithuanian',
	'mg': 'Malagasy',
	'ms': 'Malay',
	'ml': 'Malayalam',
	'mt': 'Maltese',
	'mi': 'Maori',
	'mr': 'Marathi',
	'nb': 'Norwegian',
	'or': 'Odia',
	'ps': 'Pashto',
	'fa': 'Persian',
	'pl': 'Polish',
	'pt-br': 'Portuguese (Brazil)',
	'pt-pt': 'Portuguese (Portugal)',
	'pa': 'Punjabi',
	'otq': 'Queretaro Otomi',
	'ro': 'Romanian',
	'ru': 'Russian',
	'sm': 'Samoan',
	'sr-Cyrl': 'Serbian (Cyrillic)',
	'sr-Latn': 'Serbian (Latin)',
	'sk': 'Slovak',
	'sl': 'Slovenian',
	'es': 'Spanish',
	'sw': 'Swahili',
	'sv': 'Swedish',
	'ty': 'Tahitian',
	'ta': 'Tamil',
	'te': 'Telugu',
	'th': 'Thai',
	'to': 'Tongan',
	'tr': 'Turkish',
	'uk': 'Ukrainian',
	'ur': 'Urdu',
	'vi': 'Vietnamese',
	'cy': 'Welsh',
	'yua': 'Yucatec Maya'
}
