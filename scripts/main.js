
async function translate(sourceText, sourceLang, targetLang) {
	const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(sourceText)}`;
	const res = await fetch(url);
	const data = await res.json();

	return data[0].map(item => item[0]).join("");
}

const localeMap = {
	en_US: "en",
	en_GB: "en",
	de_DE: "de",
	es_ES: "es",
	es_MX: "es",
	fr_FR: "fr",
	fr_CA: "fr",
	it_IT: "it",
	ja_JP: "ja",
	ko_KR: "ko",
	pt_BR: "pt",
	pt_PT: "pt",
	ru_RU: "ru",
	zh_CN: "zh-CN",
	zh_TW: "zh-TW",
	nl_NL: "nl",
	bg_BG: "bg",
	cs_CZ: "cs",
	da_DK: "da",
	el_GR: "el",
	fi_FI: "fi",
	hu_HU: "hu",
	id_ID: "id",
	nb_NO: "no",
	pl_PL: "pl",
	sk_SK: "sk",
	sv_SE: "sv",
	tr_TR: "tr",
	uk_UA: "uk"
};

const languageNames = {
	en_US: "English (US)",
	en_GB: "English (UK)",
	de_DE: "Deutsch (Deutschland)",
	es_ES: "Español (España)",
	es_MX: "Español (México)",
	fr_FR: "Français (France)",
	fr_CA: "Français (Canada)",
	it_IT: "Italiano (Italia)",
	ja_JP: "日本語 (日本)",
	ko_KR: "한국어 (대한민국)",
	pt_BR: "Português (Brasil)",
	pt_PT: "Português (Portugal)",
	ru_RU: "Русский (Россия)",
	zh_CN: "简体中文 (中国)",
	zh_TW: "繁體中文 (台灣)",
	nl_NL: "Nederlands (Nederland)",
	bg_BG: "Български (BG)",
	cs_CZ: "Čeština (Česká republika)",
	da_DK: "Dansk (DA)",
	el_GR: "Ελληνικά (Ελλάδα)",
	fi_FI: "Suomi (Suomi)",
	hu_HU: "Magyar (HU)",
	id_ID: "Bahasa Indonesia (Indonesia)",
	nb_NO: "Norsk bokmål (Norge)",
	pl_PL: "Polski (PL)",
	sk_SK: "Slovensky (SK)",
	sv_SE: "Svenska (Sverige)",
	tr_TR: "Türkçe (Türkiye)",
	uk_UA: "Українська (Україна)"
};

const parseLangFile = input => {
	const lines = input.split(/\r?\n/);
	const result = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
			result.push({ type: "raw", text: line });
			continue;
		}
		const separatorIndex = line.indexOf("=");
		if (separatorIndex === -1) {
			result.push({ type: "raw", text: line });
			continue;
		}
		const keyPart = line.slice(0, separatorIndex);
		const valuePart = line.slice(separatorIndex + 1);
		const match = valuePart.match(/^(\s*)(.*?)(\s*)$/);
		const leading = match ? match[1] : "";
		const core = match ? match[2] : valuePart;
		const trailing = match ? match[3] : "";
		const key = keyPart.trim();
		if (!key) {
			result.push({ type: "raw", text: line });
			continue;
		}
		result.push({
			type: "entry",
			keyPart,
			leading,
			core,
			trailing
		});
	}

	return result;
};

const formatLangOutput = lines =>
	lines
		.map(line => {
			if (line.type === "raw") {
				return line.text;
			}
			return `${line.keyPart}=${line.leading}${line.core}${line.trailing}`;
		})
		.join("\n");

const translateEntries = async (lines, targetLocale) => {
	const targetLang = localeMap[targetLocale] || "en";
	const translated = [];

	for (const line of lines) {
		if (line.type !== "entry") {
			translated.push(line);
			continue;
		}
		if (!line.core.trim()) {
			translated.push(line);
			continue;
		}
		try {
			const translatedValue = await translate(line.core, "auto", targetLang);
			translated.push({ ...line, core: translatedValue });
		} catch (error) {
			translated.push(line);
		}
	}

	return translated;
};

const getSelectedLocales = () => {
	const container = document.getElementById("target-locales");
	if (!container) {
		return [];
	}
	return Array.from(container.querySelectorAll("input[type='checkbox']:checked")).map(
		input => input.value
	);
};

let lastTranslatedText = "";
let lastSourceText = "";

const updatePreview = async rawText => {
	const output = document.getElementById("output-preview");
	if (!output) {
		return;
	}
	output.value = "Parsing...";
	const entries = parseLangFile(rawText);
	const selectedLocales = getSelectedLocales();
	lastSourceText = rawText;

	if (!entries.some(line => line.type === "entry")) {
		output.value = "No valid .lang entries found.";
		lastTranslatedText = "";
		lastSourceText = "";
		return;
	}

	if (!selectedLocales.length) {
		output.value = "Select at least one target locale.";
		lastTranslatedText = "";
		lastSourceText = rawText;
		return;
	}

	output.value = `Translating 0/${selectedLocales.length} locales (0%)...`;
	const outputs = [];
	for (let index = 0; index < selectedLocales.length; index += 1) {
		const locale = selectedLocales[index];
		const percent = Math.round((index / selectedLocales.length) * 100);
		output.value = `Translating ${index}/${selectedLocales.length} locales (${percent}%)...`;
		const translatedEntries = await translateEntries(entries, locale);
		const formatted = formatLangOutput(translatedEntries);
		outputs.push({ locale, text: formatted });
	}
	output.value = `Translating ${selectedLocales.length}/${selectedLocales.length} locales (100%)...`;

	lastTranslatedText = outputs.map(item => `# ${item.locale}\n${item.text}`).join("\n\n");
	output.value = lastTranslatedText;
};

const handleFile = async file => {
	if (!file) {
		return;
	}
	const text = await file.text();
	const pasteInput = document.getElementById("paste-input");
	if (pasteInput) {
		pasteInput.value = text;
	}
	await updatePreview(text);
};

document.addEventListener("DOMContentLoaded", () => {
	const dropZone = document.getElementById("drop-zone");
	const fileInput = document.getElementById("file-input");
	const chooseButton = document.getElementById("choose-file");
	const pasteInput = document.getElementById("paste-input");
	const targetLocales = document.getElementById("target-locales");
	const downloadButton = document.getElementById("download-zip");
	const selectAllButton = document.getElementById("select-all");
	const deselectAllButton = document.getElementById("deselect-all");

	if (!dropZone || !fileInput || !chooseButton || !pasteInput || !targetLocales || !downloadButton || !selectAllButton || !deselectAllButton) {
		return;
	}

	chooseButton.addEventListener("click", () => fileInput.click());
	fileInput.addEventListener("change", event => handleFile(event.target.files[0]));

	dropZone.addEventListener("dragover", event => {
		event.preventDefault();
		dropZone.classList.add("border-primary");
	});

	dropZone.addEventListener("dragleave", () => dropZone.classList.remove("border-primary"));

	dropZone.addEventListener("drop", event => {
		event.preventDefault();
		dropZone.classList.remove("border-primary");
		const [file] = event.dataTransfer.files;
		handleFile(file);
	});

	pasteInput.addEventListener("input", () => updatePreview(pasteInput.value));
	targetLocales.addEventListener("change", () => {
		if (pasteInput.value.trim()) {
			updatePreview(pasteInput.value);
		}
	});

	selectAllButton.addEventListener("click", () => {
		const checkboxes = targetLocales.querySelectorAll("input[type='checkbox']");
		checkboxes.forEach(checkbox => (checkbox.checked = true));
		if (pasteInput.value.trim()) {
			updatePreview(pasteInput.value);
		}
	});

	deselectAllButton.addEventListener("click", () => {
		const checkboxes = targetLocales.querySelectorAll("input[type='checkbox']");
		checkboxes.forEach(checkbox => (checkbox.checked = false));
		const output = document.getElementById("output-preview");
		if (output) {
			output.value = "Select at least one target locale.";
		}
	});

	downloadButton.addEventListener("click", async () => {
		if (!lastTranslatedText.trim()) {
			const output = document.getElementById("output-preview");
			output.value = "Translate something first to download.";
			return;
		}
		if (typeof JSZip === "undefined") {
			const output = document.getElementById("output-preview");
			output.value = "Zip library not loaded. Refresh the page.";
			return;
		}

		const selectedLocales = getSelectedLocales();
		if (!selectedLocales.length) {
			const output = document.getElementById("output-preview");
			output.value = "Select at least one target locale.";
			return;
		}
		if (!lastSourceText.trim()) {
			const output = document.getElementById("output-preview");
			output.value = "Translate something first to download.";
			return;
		}

		const originalLabel = downloadButton.textContent;
		downloadButton.disabled = true;
		downloadButton.textContent = "Zipping 0%";

		const zip = new JSZip();
		for (const locale of selectedLocales) {
			const translatedEntries = await translateEntries(
				parseLangFile(lastSourceText),
				locale
			);
			const text = formatLangOutput(translatedEntries);
			zip.file(`${locale}.lang`, text);
		}
		const languagesJson = JSON.stringify(selectedLocales, null, 4);
		const languageNamesJson = JSON.stringify(
			selectedLocales.map(locale => [locale, languageNames[locale] || locale]),
			null,
			4
		);
		zip.file("languages.json", languagesJson);
		zip.file("language_names.json", languageNamesJson);
		const blob = await zip.generateAsync({ type: "blob" }, metadata => {
			const percent = Math.round(metadata.percent);
			downloadButton.textContent = `Zipping ${percent}%`;
		});
		saveAs(blob, "translation.zip");
		downloadButton.disabled = false;
		downloadButton.textContent = originalLabel;
	});
});
