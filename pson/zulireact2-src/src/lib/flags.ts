// @ts-nocheck
/* Country / nationality strings from Companies House → flag-icons code. CH data is messy (see consultation 2 §13):
   'Uk', 'Gbr', 'Unietd Kingdom', 'English', 'British,American', 'Las Vegas, Usa'. Unknown values return null (text only). */
const CODES = 'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws xk ye yt za zm zw'.split(' ')
const ALIAS = {
  'united kingdom': 'gb', uk: 'gb', 'u.k.': 'gb', 'u k': 'gb', gbr: 'gb', gb: 'gb', 'great britain': 'gb', britain: 'gb', british: 'gb', 'unietd kingdom': 'gb', 'united kingdon': 'gb', 'united kindgom': 'gb',
  england: 'gb-eng', english: 'gb-eng', scotland: 'gb-sct', scottish: 'gb-sct', wales: 'gb-wls', welsh: 'gb-wls', 'northern ireland': 'gb', 'northern irish': 'gb',
  usa: 'us', 'u.s.a.': 'us', us: 'us', 'united states': 'us', 'united states of america': 'us', america: 'us', american: 'us',
  irish: 'ie', ireland: 'ie', 'republic of ireland': 'ie', french: 'fr', german: 'de', italian: 'it', spanish: 'es', portuguese: 'pt', dutch: 'nl', netherlands: 'nl', holland: 'nl', belgian: 'be', swiss: 'ch', austrian: 'at',
  swedish: 'se', norwegian: 'no', danish: 'dk', finnish: 'fi', icelandic: 'is', polish: 'pl', czech: 'cz', slovak: 'sk', hungarian: 'hu', romanian: 'ro', bulgarian: 'bg', greek: 'gr', cypriot: 'cy', maltese: 'mt', croatian: 'hr', slovenian: 'si', serbian: 'rs',
  lithuanian: 'lt', latvian: 'lv', estonian: 'ee', ukrainian: 'ua', russian: 'ru', belarusian: 'by', turkish: 'tr', israeli: 'il', lebanese: 'lb', jordanian: 'jo', emirati: 'ae', 'uae': 'ae', saudi: 'sa', 'saudi arabian': 'sa', qatari: 'qa', kuwaiti: 'kw', bahraini: 'bh', omani: 'om', iranian: 'ir', iraqi: 'iq', egyptian: 'eg',
  indian: 'in', pakistani: 'pk', bangladeshi: 'bd', 'sri lankan': 'lk', nepalese: 'np', chinese: 'cn', 'hong kong': 'hk', 'hong konger': 'hk', japanese: 'jp', korean: 'kr', 'south korean': 'kr', taiwanese: 'tw', singaporean: 'sg', malaysian: 'my', thai: 'th', vietnamese: 'vn', filipino: 'ph', philippine: 'ph', indonesian: 'id',
  australian: 'au', 'new zealander': 'nz', 'new zealand': 'nz', kiwi: 'nz', canadian: 'ca', mexican: 'mx', brazilian: 'br', argentine: 'ar', argentinian: 'ar', chilean: 'cl', colombian: 'co', peruvian: 'pe', venezuelan: 've', jamaican: 'jm', trinidadian: 'tt', barbadian: 'bb',
  'south african': 'za', nigerian: 'ng', ghanaian: 'gh', kenyan: 'ke', ugandan: 'ug', tanzanian: 'tz', zimbabwean: 'zw', zambian: 'zm', ethiopian: 'et', somali: 'so', sudanese: 'sd', moroccan: 'ma', algerian: 'dz', tunisian: 'tn', mauritian: 'mu',
  luxembourger: 'lu', luxembourgish: 'lu', monegasque: 'mc', manx: 'im', 'isle of man': 'im', jersey: 'je', guernsey: 'gg', gibraltarian: 'gi', 'cayman islands': 'ky', caymanian: 'ky', 'british virgin islands': 'vg', bermudian: 'bm', bahamian: 'bs', 'channel islands': 'je',
  afghan: 'af', albanian: 'al', armenian: 'am', azerbaijani: 'az', georgian: 'ge', kazakh: 'kz', uzbek: 'uz', bosnian: 'ba', macedonian: 'mk', montenegrin: 'me', kosovan: 'xk', moldovan: 'md', syrian: 'sy', yemeni: 'ye', libyan: 'ly', palestinian: 'ps',
  cameroonian: 'cm', senegalese: 'sn', ivorian: 'ci', rwandan: 'rw', malawian: 'mw', botswanan: 'bw', namibian: 'na', mozambican: 'mz', angolan: 'ao', congolese: 'cd', eritrean: 'er', gambian: 'gm', 'sierra leonean': 'sl', liberian: 'lr',
  cuban: 'cu', dominican: 'do', ecuadorian: 'ec', bolivian: 'bo', paraguayan: 'py', uruguayan: 'uy', guyanese: 'gy', burmese: 'mm', cambodian: 'kh', mongolian: 'mn', maldivian: 'mv', fijian: 'fj',
}
let NAMES = null
function names() {
  if (NAMES) return NAMES
  NAMES = {}
  try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); for (const c of CODES) { if (c === 'xk') continue; const n = dn.of(c.toUpperCase()); if (n) NAMES[n.toLowerCase()] = c } } catch { /* old browser */ }
  return NAMES
}
const clean = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z .'-]/g, ' ').replace(/\s+/g, ' ').trim()
/* One value → {code, label} or null. Dual values ('British,American') return the first match. */
export function flagFor(raw) {
  if (!raw) return null
  const parts = String(raw).split(/[,/;&]| and /i).map(clean).filter(Boolean)
  const n = names()
  for (const p of parts.length ? parts : [clean(raw)]) {
    const c = ALIAS[p] || n[p] || (p.length > 3 && Object.keys(n).find((k) => p.endsWith(' ' + k)) ? n[Object.keys(n).find((k) => p.endsWith(' ' + k))] : '')
    if (c) return { code: c }
  }
  return null
}
export const flagSrc = (code) => import.meta.env.BASE_URL + 'flags/' + code + '.svg'
