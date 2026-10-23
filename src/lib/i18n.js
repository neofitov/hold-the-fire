// The few words the game shows, short and loud (Oleg: cool text on nightfall and on a night survived), in the languages Poki
// suggests first (English, French, Italian, German, Spanish, Turkish) and Portuguese. The language comes from Poki's SDK when it
// is there, else the browser; {n} is a number.
const WORDS = {
  en: { dusk: 'NIGHT FALLS', brute: 'A GIANT IS COMING!', night: 'NIGHT {n}', held: 'NIGHT {n} SURVIVED!', perfect: 'PERFECT NIGHT!', victory: 'VICTORY!', nights: '{n} NIGHTS HELD', out: 'THE FIRE WENT OUT', relit: 'THE FIRE LIVES!', dying: 'THE FIRE IS DYING!', best: 'BEST', hint: 'FEED THE FIRE WITH COAL', feed: 'FEED THE FIRE!', attack: 'SAVE THE FIRE!' },
  fr: { dusk: 'LA NUIT TOMBE', brute: 'UN GÉANT ARRIVE !', night: 'NUIT {n}', held: 'NUIT {n} SURVÉCUE !', perfect: 'NUIT PARFAITE !', victory: 'VICTOIRE !', nights: '{n} NUITS TENUES', out: "LE FEU S'EST ÉTEINT", relit: 'LE FEU REVIT !', dying: 'LE FEU FAIBLIT !', best: 'RECORD', hint: 'NOURRIS LE FEU DE CHARBON', feed: 'NOURRIS LE FEU !', attack: 'SAUVE LE FEU !' },
  it: { dusk: 'CALA LA NOTTE', brute: 'ARRIVA UN GIGANTE!', night: 'NOTTE {n}', held: 'NOTTE {n} SUPERATA!', perfect: 'NOTTE PERFETTA!', victory: 'VITTORIA!', nights: '{n} NOTTI RESISTITE', out: 'IL FUOCO SI È SPENTO', relit: 'IL FUOCO RIVIVE!', dying: 'IL FUOCO SI SPEGNE!', best: 'RECORD', hint: 'NUTRI IL FUOCO CON IL CARBONE', feed: 'NUTRI IL FUOCO!', attack: 'SALVA IL FUOCO!' },
  de: { dusk: 'DIE NACHT BRICHT AN', brute: 'EIN RIESE KOMMT!', night: 'NACHT {n}', held: 'NACHT {n} ÜBERLEBT!', perfect: 'PERFEKTE NACHT!', victory: 'SIEG!', nights: '{n} NÄCHTE GEHALTEN', out: 'DAS FEUER IST AUS', relit: 'DAS FEUER LEBT!', dying: 'DAS FEUER ERLISCHT!', best: 'REKORD', hint: 'FÜTTERE DAS FEUER MIT KOHLE', feed: 'FÜTTERE DAS FEUER!', attack: 'RETTE DAS FEUER!' },
  es: { dusk: 'CAE LA NOCHE', brute: '¡VIENE UN GIGANTE!', night: 'NOCHE {n}', held: '¡NOCHE {n} SUPERADA!', perfect: '¡NOCHE PERFECTA!', victory: '¡VICTORIA!', nights: '{n} NOCHES RESISTIDAS', out: 'EL FUEGO SE APAGÓ', relit: '¡EL FUEGO VIVE!', dying: '¡EL FUEGO SE APAGA!', best: 'RÉCORD', hint: 'ALIMENTA EL FUEGO CON CARBÓN', feed: '¡ALIMENTA EL FUEGO!', attack: '¡SALVA EL FUEGO!' },
  tr: { dusk: 'GECE ÇÖKÜYOR', brute: 'BİR DEV GELİYOR!', night: 'GECE {n}', held: 'GECE {n} ATLATILDI!', perfect: 'KUSURSUZ GECE!', victory: 'ZAFER!', nights: '{n} GECE DAYANILDI', out: 'ATEŞ SÖNDÜ', relit: 'ATEŞ YENİDEN YANDI!', dying: 'ATEŞ SÖNÜYOR!', best: 'REKOR', hint: 'ATEŞİ KÖMÜRLE BESLE', feed: 'ATEŞİ BESLE!', attack: 'ATEŞİ KURTAR!' },
  pt: { dusk: 'CAI A NOITE', brute: 'VEM AÍ UM GIGANTE!', night: 'NOITE {n}', held: 'NOITE {n} SOBREVIVIDA!', perfect: 'NOITE PERFEITA!', victory: 'VITÓRIA!', nights: '{n} NOITES RESISTIDAS', out: 'O FOGO SE APAGOU', relit: 'O FOGO VIVE!', dying: 'O FOGO ESTÁ MORRENDO!', best: 'RECORDE', hint: 'ALIMENTE O FOGO COM CARVÃO', feed: 'ALIMENTE O FOGO!', attack: 'SALVE O FOGO!' },
};

// the dawn cards' word each (Dana's playtest: a picture and a number alone left her guessing)
const CARDS = {
  en: { arrows: 'TOWERS', fire: 'BIGGER FIRE', speed: 'FASTER', axe: 'STRONGER', haggle: 'COAL PRICE', pockets: 'BIGGER BAG', loot: 'MORE LOOT', hands: 'QUICK HANDS', walls: 'STRONG WALLS' },
  fr: { arrows: 'TOURS', fire: 'GRAND FEU', speed: 'PLUS VITE', axe: 'PLUS FORT', haggle: 'PRIX DU CHARBON', pockets: 'GRAND SAC', loot: 'PLUS DE BUTIN', hands: 'MAINS AGILES', walls: 'MURS SOLIDES' },
  it: { arrows: 'TORRI', fire: 'FUOCO GRANDE', speed: 'PIÙ VELOCE', axe: 'PIÙ FORTE', haggle: 'PREZZO CARBONE', pockets: 'ZAINO GRANDE', loot: 'PIÙ BOTTINO', hands: 'MANI SVELTE', walls: 'MURA FORTI' },
  de: { arrows: 'TÜRME', fire: 'GROSSES FEUER', speed: 'SCHNELLER', axe: 'STÄRKER', haggle: 'KOHLEPREIS', pockets: 'GROSSER RUCKSACK', loot: 'MEHR BEUTE', hands: 'FLINKE HÄNDE', walls: 'STARKE MAUERN' },
  es: { arrows: 'TORRES', fire: 'FUEGO MAYOR', speed: 'MÁS RÁPIDO', axe: 'MÁS FUERTE', haggle: 'PRECIO CARBÓN', pockets: 'MOCHILA GRANDE', loot: 'MÁS BOTÍN', hands: 'MANOS RÁPIDAS', walls: 'MUROS FUERTES' },
  tr: { arrows: 'KULELER', fire: 'BÜYÜK ATEŞ', speed: 'DAHA HIZLI', axe: 'DAHA GÜÇLÜ', haggle: 'KÖMÜR FİYATI', pockets: 'BÜYÜK ÇANTA', loot: 'DAHA ÇOK GANİMET', hands: 'HIZLI ELLER', walls: 'SAĞLAM DUVARLAR' },
  pt: { arrows: 'TORRES', fire: 'FOGO MAIOR', speed: 'MAIS RÁPIDO', axe: 'MAIS FORTE', haggle: 'PREÇO DO CARVÃO', pockets: 'MOCHILA MAIOR', loot: 'MAIS SAQUE', hands: 'MÃOS RÁPIDAS', walls: 'MUROS FORTES' },
};
const MORE = {   // the night's cards and the fall (Leo's and Mia's round 4)
  en: { frost: 'SLOWING ARROWS', sparks: 'BURNING FIRE', warmth: 'WARM FIRE', fell: 'YOU FELL!', pickaxe: 'PICKAXE', hammer: 'HAMMER', build: 'CHOP TREES, BUILD TOWERS', goal: 'HOLD 10 NIGHTS', pick: 'PICK A POWER-UP' },
  fr: { frost: 'FLÈCHES GLACÉES', sparks: 'FEU BRÛLANT', warmth: 'FEU CHAUD', fell: 'TU ES TOMBÉ !', pickaxe: 'PIOCHE', hammer: 'MARTEAU', build: 'COUPE DU BOIS, BÂTIS DES TOURS', goal: 'TIENS 10 NUITS', pick: 'CHOISIS UN BONUS' },
  it: { frost: 'FRECCE GELIDE', sparks: 'FUOCO ARDENTE', warmth: 'FUOCO CALDO', fell: 'SEI CADUTO!', pickaxe: 'PICCONE', hammer: 'MARTELLO', build: 'TAGLIA LEGNA, COSTRUISCI TORRI', goal: 'RESISTI 10 NOTTI', pick: 'SCEGLI UN BONUS' },
  de: { frost: 'BREMSPFEILE', sparks: 'BRENNENDES FEUER', warmth: 'WARMES FEUER', fell: 'DU BIST GEFALLEN!', pickaxe: 'SPITZHACKE', hammer: 'HAMMER', build: 'HOLZ HACKEN, TÜRME BAUEN', goal: 'HALTE 10 NÄCHTE DURCH', pick: 'WÄHLE EINEN BONUS' },
  es: { frost: 'FLECHAS HELADAS', sparks: 'FUEGO ARDIENTE', warmth: 'FUEGO CÁLIDO', fell: '¡HAS CAÍDO!', pickaxe: 'PICO', hammer: 'MARTILLO', build: 'TALA ÁRBOLES, CONSTRUYE TORRES', goal: 'RESISTE 10 NOCHES', pick: 'ELIGE UNA MEJORA' },
  tr: { frost: 'YAVAŞLATAN OKLAR', sparks: 'YAKAN ATEŞ', warmth: 'SICAK ATEŞ', fell: 'DÜŞTÜN!', pickaxe: 'KAZMA', hammer: 'ÇEKİÇ', build: 'AĞAÇ KES, KULE YAP', goal: '10 GECE DAYAN', pick: 'BİR GÜÇ SEÇ' },
  pt: { frost: 'FLECHAS GELADAS', sparks: 'FOGO ARDENTE', warmth: 'FOGO QUENTE', fell: 'VOCÊ CAIU!', pickaxe: 'PICARETA', hammer: 'MARTELO', build: 'CORTE ÁRVORES, CONSTRUA TORRES', goal: 'RESISTA 10 NOITES', pick: 'ESCOLHA UM BÔNUS' },
};
for (const [k, v] of Object.entries(MORE)) {
  for (const id of ['frost', 'sparks', 'warmth', 'pickaxe', 'hammer']) CARDS[k][id] = v[id];
  for (const id of ['fell', 'build', 'goal', 'pick']) WORDS[k][id] = v[id];   // the fall; day 1's popup (Oleg, 2026-10-23)
}
// the modes (Oleg, 2026-10-23: Hard)
const MODES = {
  en: ['EASY', 'NORMAL', 'HARD', 'SPIN', 'PISTOL'], fr: ['FACILE', 'NORMAL', 'DIFFICILE', 'TOURNOIEMENT', 'PISTOLET'],
  it: ['FACILE', 'NORMALE', 'DIFFICILE', 'ROTEAZIONE', 'PISTOLA'], de: ['LEICHT', 'NORMAL', 'SCHWER', 'WIRBEL', 'PISTOLE'],
  es: ['FÁCIL', 'NORMAL', 'DIFÍCIL', 'GIRO', 'PISTOLA'], tr: ['KOLAY', 'NORMAL', 'ZOR', 'DÖNÜŞ', 'TABANCA'],
  pt: ['FÁCIL', 'NORMAL', 'DIFÍCIL', 'GIRO', 'PISTOLA'],
};
for (const [k, [e, n, h, sp, pi]] of Object.entries(MODES)) {   // the modes (Oleg: easy, normal, hard); the dawn shop's two
  Object.assign(WORDS[k], { easy: e, normal: n, hard: h, card_spin: sp, card_pistol: pi });
}
// fullscreen where the browser has none (Oleg's phone test: no button): an iPhone goes fullscreen from the home screen, and an
// app's built-in browser (a link opened from a chat app) from the real browser
const FULL = {
  en: ['SHARE, THEN ADD TO HOME SCREEN', 'OPEN IN THE BROWSER FOR FULLSCREEN'],
  fr: ["PARTAGER, PUIS SUR L'ÉCRAN D'ACCUEIL", 'OUVRE DANS LE NAVIGATEUR POUR LE PLEIN ÉCRAN'],
  it: ['CONDIVIDI, POI AGGIUNGI ALLA HOME', 'APRI NEL BROWSER PER LO SCHERMO INTERO'],
  de: ['TEILEN, DANN ZUM HOME-BILDSCHIRM', 'IM BROWSER ÖFFNEN FÜR VOLLBILD'],
  es: ['COMPARTIR Y AÑADIR A INICIO', 'ABRE EN EL NAVEGADOR PARA PANTALLA COMPLETA'],
  tr: ['PAYLAŞ, SONRA ANA EKRANA EKLE', 'TAM EKRAN İÇİN TARAYICIDA AÇ'],
  pt: ['PARTILHAR E ADICIONAR AO ECRÃ INICIAL', 'ABRE NO NAVEGADOR PARA ECRÃ INTEIRO'],
};
for (const [k, [ios, app]] of Object.entries(FULL)) Object.assign(WORDS[k], { full_ios: ios, full_app: app });
for (const [k, v] of Object.entries(CARDS)) for (const [id, word] of Object.entries(v)) WORDS[k][`card_${id}`] = word;

let lang = 'en';
export function pickLanguage() {
  let code = '';
  try {
    code = (window.PokiSDK && window.PokiSDK.getLanguage && window.PokiSDK.getLanguage()) || navigator.language || '';
  } catch {}
  const base = String(code).toLowerCase().slice(0, 2);
  const forced = new URLSearchParams(location.search).get('lang');
  lang = WORDS[forced] ? forced : WORDS[base] ? base : 'en';
  return lang;
}

export const t = (key, n) => (WORDS[lang][key] || WORDS.en[key]).replace('{n}', n ?? '');
