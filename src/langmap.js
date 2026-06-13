// Human-friendly names for the 2-letter language "family" codes, used both by
// the detector (tinyld returns these codes) and Piper voices (language.family).
// Purely for display in the UI / API; routing keys off the codes themselves.
export const FAMILY_NAMES = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ru: "Russian", uk: "Ukrainian",
  zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic", hi: "Hindi",
  tr: "Turkish", sv: "Swedish", no: "Norwegian", da: "Danish", fi: "Finnish",
  cs: "Czech", el: "Greek", hu: "Hungarian", ro: "Romanian", vi: "Vietnamese",
  fa: "Persian", ca: "Catalan", sk: "Slovak", sr: "Serbian", hr: "Croatian",
  bg: "Bulgarian", et: "Estonian", lv: "Latvian", lt: "Lithuanian",
  sl: "Slovenian", ka: "Georgian", is: "Icelandic", ga: "Irish", cy: "Welsh",
  ne: "Nepali", bn: "Bengali", ta: "Tamil", te: "Telugu", ml: "Malayalam",
  kn: "Kannada", mr: "Marathi", gu: "Gujarati", ur: "Urdu", th: "Thai",
  id: "Indonesian", ms: "Malay", he: "Hebrew", gl: "Galician",
};

export function familyName(family) {
  return FAMILY_NAMES[family] || family;
}
