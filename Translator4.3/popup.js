/* Translate API request is repeated here because content scripts have limitations(on some sites they are blocked),
but with popup you can use live translation on top of any page */
const API_KEY = "",
	XHR_TRANSLATE = new XMLHttpRequest(),
	XHR_DEFINITION = new XMLHttpRequest();
XHR_TRANSLATE.withCredentials = true;
XHR_DEFINITION.withCredentials = true;

const sourceLanguage = document.getElementById('source-langs'),
	targetLanguage = document.getElementById('target-langs'),
	liveTranslationInput = document.getElementById("live-translation-input"),
	liveTranslation = document.getElementById("live-translation"),
	powerState = document.getElementById('power-state'),
	detectedLanguageLabel = document.getElementById('detected-language');
var theme,
	isDictionaryModeEnabled,
	previousOptionIndex,
	previous,
	reqFinished,
	lastSent,
	[translatedBlocks, detectedBlocks, coords] = [[], [], []];

const container = document.getElementsByClassName('dictionary-container')[0],
	voiceOptions = [
		{ name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
		{ name: 'Microsoft Hazel - English (United Kingdom)', lang: 'en-GB' },
		{ name: 'Microsoft Susan - English (United Kingdom)', lang: 'en-GB' },
		{ name: 'Google Deutsch', lang: 'de-DE' },
		{ name: 'Google US English', lang: 'en-US' },
		{ name: 'Google UK English Female', lang: 'en-GB' },
		{ name: 'Google UK English Male', lang: 'en-GB' },
		{ name: 'Google español', lang: 'es-ES' },
		{ name: 'Google español de Estados Unidos', lang: 'es-US' },
		{ name: 'Google français', lang: 'fr-FR' },
		{ name: 'Google हिन्दी', lang: 'hi-IN' },
		{ name: 'Google Bahasa Indonesia', lang: 'id-ID' },
		{ name: 'Google italiano', lang: 'it-IT' },
		{ name: 'Google 日本語', lang: 'ja-JP' },
		{ name: 'Google 한국의', lang: 'ko-KR' },
		{ name: 'Google Nederlands', lang: 'nl-NL' },
		{ name: 'Google polski', lang: 'pl-PL' },
		{ name: 'Google português do Brasil', lang: 'pt-BR' },
		{ name: 'Google русский', lang: 'ru-RU' },
		{ name: 'Google 普通话（中国大陆）', lang: 'zh-CN' },
		{ name: 'Google 粤語（香港）', lang: 'zh-HK' },
		{ name: 'Google 國語（臺灣）', lang: 'zh-TW' }
	]
const speaker_one = document.getElementById('speaker1');
const speaker_two = document.getElementById('speaker2');
speaker_one.onclick = () => { dictate(liveTranslationInput.value, sourceLanguage.value) };
speaker_two.onclick = () => { dictate(liveTranslation.innerText, targetLanguage.value) };


loadAttributes()

window.onload = function () {
	liveTranslationInput.select();
}
liveTranslation.onclick = () => { copyToClipboard(liveTranslation.innerText) };
document.querySelector('#live-translation-input').addEventListener('keypress', function (e) {
	if (e.key === 'Enter') {
		chrome.tabs.create({ url: 'https://www.google.com/search?q=' + liveTranslationInput.value, active: true });
	}
});
document.getElementById('google-link').onclick = () => { chrome.tabs.create({ url: 'https://www.google.com/search?q=' + liveTranslationInput.value, active: true }); };
document.getElementById('github-link').onclick = () => { chrome.tabs.create({ url: 'https://github.com/search?q=' + liveTranslationInput.value, active: true }); };
document.getElementById('google-translate-link').onclick = () => { chrome.tabs.create({ url: 'https://translate.google.com/?text=' + liveTranslationInput.value, active: true }); };
document.getElementById('shortcuts-link').onclick = () => { chrome.tabs.create({ url: 'chrome://extensions/shortcuts', active: true }); };
document.getElementById('youtube-link').onclick = () => {
	let l = (liveTranslationInput.value === '') ? 'https://www.youtube.com' : 'https://www.youtube.com//results?search_query=' + liveTranslationInput.value;
	chrome.tabs.create({ url: l, active: true });
};
document.getElementById('additional-info').onclick = () => {
	document.documentElement.style.setProperty("--transition", "0.5s");
	rightSideVisibility();
};
document.getElementById('reverse').onclick = swap;
document.getElementById('theme-changer').onclick = () => {
	document.documentElement.style.setProperty("--transition", "1s");
	// If theme currently is light
	if (theme === 'light') {
		darkness();
		theme = 'dark';
	}
	else {
		light();
		theme = 'light';
	}
	sendBackground('set', theme, 'theme');
};
powerState.onclick = () => {
	let state = (chrome.extension.getBackgroundPage().window.stateObject['extensionState'] === "ON") ? "OFF" : "ON";
	powerState.innerText = state
	// sendContent('extension state', powerState.innerText.toString())
	sendBackground('set', state, 'extensionState');
};
optionChange();
sourceLanguage.onchange = optionChange;
targetLanguage.onchange = optionChange;
let timeout = null;
liveTranslationInput.addEventListener('keyup', () => {
	clearTimeout(timeout);
	timeout = setTimeout(function () {
		if (document.contains(document.getElementsByClassName('dictionary-container-row')[0])) {
			document.querySelectorAll('.dictionary-container-row').forEach(e => e.remove());
		}
		liveTranslationInput.value = liveTranslationInput.value.trim();
		translatorApiRequest(liveTranslationInput.value);
		dictionaryApiRequest(liveTranslationInput.value);
	}, 1200);
});
liveTranslationInput.addEventListener('wheel', (event) => {
	event.preventDefault(); // prevent the default action (scroll / move caret)
	let fontSize = parseInt(window.getComputedStyle(liveTranslation).fontSize),
		scale = 0;
	event.deltaY > 0 ? scale += 2 : scale -= 2;
	if (fontSize <= 14 && scale < 0 || fontSize >= 100 && scale > 0)
		return;
	liveTranslation.style.fontSize = fontSize + scale + 'px'
});
function createRow(firstColumn, secondColumn) {
	let row = document.createElement('div'),
		rowItem = document.createElement('div');
	row.classList.add('dictionary-container-row');
	rowItem.innerText = firstColumn;
	rowItem.classList.add('dictionary-container-row-title');
	row.appendChild(rowItem.cloneNode(true));
	rowItem.classList.remove('dictionary-container-row-title');
	rowItem.classList.add('dictionary-container-row-item');
	rowItem.title = 'Click to Copy';
	row.onclick = () => { copyToClipboard(secondColumn); }
	rowItem.innerText = secondColumn;

	row.appendChild(rowItem.cloneNode(true));
	container.appendChild(row);
}
function saveAttributes() {
	let obj = {
		'extensionState': chrome.extension.getBackgroundPage().window.stateObject['extensionState'],
		'langFrom': sourceLanguage.value,
		'langTo': targetLanguage.value,
		'theme': theme,
		'isDictionaryModeEnabled': chrome.extension.getBackgroundPage().window.stateObject['isDictionaryModeEnabled']
	}
	sendBackground('serialize data', obj)
	sendContent('change language', obj)
}
function loadAttributes() {
	// Apply saved languages
	console.log(chrome.extension.getBackgroundPage().window.stateObject);
	targetLanguage.value = chrome.extension.getBackgroundPage().window.stateObject['langTo'];
	sourceLanguage.value = chrome.extension.getBackgroundPage().window.stateObject['langFrom'];
	powerState.innerText = chrome.extension.getBackgroundPage().window.stateObject['extensionState'];
	theme = chrome.extension.getBackgroundPage().window.stateObject['theme'];
	isDictionaryModeEnabled = chrome.extension.getBackgroundPage().window.stateObject['isDictionaryModeEnabled'];
	// rightSideVisibility(isDictionaryModeEnabled);
	(isDictionaryModeEnabled === true) ? showDictionary() : hideDictionary();
	(theme === 'light') ? light() : darkness();
}



function optionChange() {
	liveTranslationInput.spellcheck = (sourceLanguage.value === 'en') ? true : false;
	if (sourceLanguage.selectedIndex - 1 === targetLanguage.selectedIndex) {
		/*
		source and target language options mustn't be the same
		if the same , return back to previous state(swapped)
		F.e.
		Deustch -> English - current state
		try change it to
		English -> English
		this function will immediately change it to
		English -> Deustch 
		*/
		[sourceLanguage.selectedIndex, targetLanguage.selectedIndex] = [previousOptionIndex[0], previousOptionIndex[1]]
		// swap()
	}
	previousOptionIndex = [sourceLanguage.selectedIndex, targetLanguage.selectedIndex];
	// document.getElementById('selected-option').innerText = sourceLanguage.value + ' -> ' + targetLanguage.value;
	saveAttributes();
	translatorApiRequest(liveTranslationInput.value);
	dictionaryApiRequest(liveTranslationInput.value);
}


// Swap languages in places
function swap() {
	/* 
	Gets current source and target language selection and swaps it in places,
	F.e.
	English -> Deustch
	swap()
	Deustch -> English
	*/
	// source option set to Autodetection?
	// source contains Autodetection option therefore -1 from length
	// target contains 1 option less therefore +1 to length
	let [s, t] = [sourceLanguage.selectedIndex, targetLanguage.selectedIndex];
	if (sourceLanguage.selectedIndex === 0) {
		if (detectedLanguageLabel.innerText.length <= 0)
			return
		sourceLanguage.value = detectedLanguageLabel.innerText;
		s = sourceLanguage.selectedIndex;
	}
	liveTranslationInput.value = (liveTranslation.innerText === '...') ? '' : liveTranslation.innerText;
	sourceLanguage.selectedIndex = t + 1;
	targetLanguage.selectedIndex = s - 1;
	optionChange();
	translatorApiRequest(liveTranslationInput.value);
	dictionaryApiRequest(liveTranslationInput.value);
	return;
}

// translator API request
function translationApiRequest(text) {
	console.log('here ', text);
	let src = (sourceLanguage.value === 'auto') ? '' : '&from=' + sourceLanguage.value;
	XHR_TRANSLATE.open("POST", `https://microsoft-translator-text.p.rapidapi.com/translate?
	to=${targetLanguage.value}&api-version=3.0${src}&profanityAction=NoAction&textType=plain`);
	XHR_TRANSLATE.setRequestHeader("content-type", "application/json");
	XHR_TRANSLATE.setRequestHeader("x-rapidapi-key", API_KEY);
	XHR_TRANSLATE.setRequestHeader("x-rapidapi-host", "microsoft-translator-text.p.rapidapi.com");
	XHR_TRANSLATE.send(JSON.stringify([{ "text": text }]));
}

// dictionary API request
function dictionaryApiRequest(w) {
	if (w === undefined || w === '') {
		return
	}
	XHR_DEFINITION.open("GET", "https://api.dictionaryapi.dev/api/v2/entries/en/" + w);
	XHR_DEFINITION.send();
}
// dictionary response
XHR_DEFINITION.addEventListener("readystatechange", function () {
	if (this.readyState === this.DONE) {
		console.log(this.responseText);
		if (this.status === 404) {
			createRow("Sorry", "no definitions found. We recommend you to stay calm.")
			return
		}
		const responseData = JSON.parse(this.responseText);
		console.log(responseData);
		// console.log(responseData.toString());
		if (responseData[0]) {
			const { meanings } = responseData[0];
			let synonyms = [],
				definition = []
			for (i in meanings) {
				for (key in meanings[i].definitions) {
					if (meanings[i].definitions[key].definition) {
						definition.push(meanings[i].definitions[key].definition);
					}
					if (meanings[i].definitions[key].synonyms.length > 0) {
						// spread operator to merge into one array
						synonyms.push(...meanings[i].definitions[key].synonyms);
					}
				}
			}
			console.log(synonyms);
			console.log(definition);
			let syn = '', def = '';
			(synonyms.length > 0) ? synonyms.forEach(el => syn += el + ';\n') : syn = '_ _ _';
			(definition.length > 0) ? definition.forEach(el => def += el + '\n\n') : def = '_ _ _';
			createRow('synonyms', syn);
			createRow('definition', def)
			return
		}
	}
});

function hideDictionary() {
	cssProperties({
		"--left-side": "100%",
		"--right-side": "0%",
		"--width": "300px",
		"--right-side-visibility": "none"
	});
}
function showDictionary() {
	cssProperties({
		"--left-side": "50%",
		"--right-side": "50%",
		"--width": "500px",
		"--right-side-visibility": "visible"
	});
}
function rightSideVisibility() {
	// if (document.getElementsByClassName('glass-ui')[0].clientWidth === 500) {
	if (document.getElementsByClassName('glass-ui')[0].clientWidth === 500) {
		hideDictionary()
		isDictionaryModeEnabled = false;
	} else {
		showDictionary()
		isDictionaryModeEnabled = true;
	}
	sendBackground('set', isDictionaryModeEnabled, 'isDictionaryModeEnabled');
}

function sendContent(arg1, arg2) {
	chrome.tabs.query({}, function (tabs) {
		let message = { target: 'content', action: arg1, content: arg2 };
		for (let i = 0; i < tabs.length; ++i) {
			chrome.tabs.sendMessage(tabs[i].id, message)
		}
	});
}
function sendBackground(arg1, arg2, arg3 = '') {
	chrome.runtime.sendMessage({
		target: 'background',
		action: arg1,
		content: arg2,
		stateKey: arg3
	});
}
function cssProperties(attrs) {
	for (let key in attrs) {
		document.documentElement.style.setProperty(key, attrs[key]);
	}
}
function darkness() {
	cssProperties({
		"--bg-color": "hsla(233,12%,13%,1)",
		"--bg-color": "hsla(233,12%,13%,1)",
		"--font-family": "'Lato','Lucida Grande','Lucida Sans Unicode',Tahoma,Sans-Serif",
		"--font-color": "#ffffff",
		"--inner-bg-color": "hsla(223,14%,20%,1)",
		"--inner-border-color": "aqua",
		"--inner-font-color": "hsla(226,13%,75%,1)",
		"--input-bg-color": "hsla(233,12%,13%,1)",
		"--input-font-color": "hsla(62,76%,90%,1)",
		"--power-bg-color": "rgb(255,221,64)",
		"--power-font-weight": "bold",
		"--power-font-color": "#000",
		"--scrollbar-bg": "#FFFFFF",
		"--reverse": " invert(100%) sepia(0%) saturate(0%) hue-rotate(93deg) brightness(103%) contrast(103%)",
		"--dictionary-row-bg": "hsla(223,14%,20%,1)",
		"--dictionary-item-font-color": "hsla(62,34%,76%,1)",
		"--dictionary-title-bg": "rgba(222, 190, 73, 0.1)",
		"--dictionary-title-font-color": "rgba(222, 190, 73, 1)",
	});
}
function light() {
	cssProperties({
		"--bg-color": "#ffffff",
		"--font-family": "'Lato','Lucida Grande','Lucida Sans Unicode',Tahoma,Sans-Serif",
		"--font-color": "#000",
		"--inner-bg-color": "#fff",
		"--inner-border-color": "#007bff",
		"--inner-font-color": "#007bff",
		"--input-bg-color": "#fff",
		"--input-font-color": "hsla(225, 10%, 8%, 1)",
		"--power-bg-color": "rgb(255, 221, 64)",
		"--power-font-color": "#000",
		"--power-font-weight": "bold",
		"--scrollbar-bg": "#007bff",
		"--reverse": "invert(0%) sepia(8%) saturate(2228%) hue-rotate(248deg) brightness(107%) contrast(100%)",
		// "--reverse": "invert(37%) sepia(3%) saturate(903%) hue-rotate(173deg) brightness(96%) contrast(80%)",
		"--dictionary-row-bg": "rgb(0 0 0 / 10%)",
		"--dictionary-item-font-color": "hsla(0,0%,0%,1)",
		"--dictionary-title-bg": "rgb(0 0 0 / 10%)",
		"--dictionary-title-font-color": "hsla(0,0%,0%,.86)",

	});
}



async function translatorApiRequest(t) {
	document.querySelectorAll('.dictionary-container-row').forEach(e => e.remove());
	if (t === '') {
		liveTranslation.innerText = '...';
		detectedLanguageLabel.innerText = '';
		createRow('---', '_ _ _')
		return
	}

	[reqFinished, translatedBlocks] = [[], []];
	if (t.length > 220) {
		let v = t.match(/.*?\D[.!?]+|.*/gs)
		if (v[v.length - 1] === '') {
			v.pop()
		}
		// fill new boolean array to keep track of successful requests 
		reqFinished = new Array(v.length).fill(false);
		loop1: for (var i = 0; i < v.length; i++) {
			translationApiRequest(v[i].toString());
			while (reqFinished === [] || reqFinished[i] === false) {
				if (t !== liveTranslationInput.value) {
					[reqFinished, translatedBlocks, detectedBlocks] = [[], [], []];
					lastSent = true;
				}
				if (lastSent === true) {
					break loop1;
				}
				await new Promise(r => setTimeout(r, 500)); // wait half a second

				// setTimeout(function () {
				// }, 900); // wait half a second
			}

		}
	} else {
		translationApiRequest(t)
	}
}
XHR_TRANSLATE.addEventListener("readystatechange", async function () {
	if (this.readyState === this.DONE) {
		const responseData = JSON.parse(this.responseText)[0];
		let language = responseData.detectedLanguage && responseData.detectedLanguage.language || [],
			translation = responseData.translations[0].text;

		if (reqFinished && reqFinished.length > 0) {
			translatedBlocks += translation
			if (!detectedBlocks.includes(language) && language !== []) {
				detectedBlocks.push(language)
			}
			liveTranslation.innerText = translatedBlocks
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
			if (lastSent === true) {
				lastSent = false;
				return;
			}
			detectedBlocks.push(language)
			liveTranslation.innerText = translation;
			detectedLanguageLabel.innerText = detectedBlocks
			detectedBlocks = [];
		}
	}
});

function copyToClipboard(text) {
	var copyFrom = document.createElement("textarea");
	copyFrom.textContent = text;
	document.body.appendChild(copyFrom);
	copyFrom.select();
	document.execCommand('copy');
	copyFrom.blur();
	document.body.removeChild(copyFrom);
}

// Text to speech
function dictate(t, l) {
	if (t.length <= 0 || t === '...') {
		let msg = new SpeechSynthesisUtterance();
		msg.text = 'Please fill "Ready to translate" input box'
		msg.lang = 'en-US';
		window.speechSynthesis.speak(msg);
		return;
	}
	// Detected language speaker
	if (l === 'auto' && detectedLanguageLabel.innerText.length > 0) {
		l = detectedLanguageLabel.innerText
	}
	let languageFound = -1;
	voiceOptions.forEach((el, i) => {
		if (el.lang.indexOf(l) >= 0) {
			console.log(i + ' ' + voiceOptions[i].lang + ' ' + el.lang.indexOf(l))
			languageFound = voiceOptions[i].lang;
		}
	});
	let msg = new SpeechSynthesisUtterance();
	msg.text = t.toString();
	msg.lang = (languageFound === -1 || languageFound === 'en-GB') ? 'en-US' : languageFound;
	window.speechSynthesis.speak(msg);
}


// chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });