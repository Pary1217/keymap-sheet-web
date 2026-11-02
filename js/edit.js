// キーマップを変える: キーを選び、新しいキーコードを選んで、キーボードに書き込む。
//
// 書き込みの前に、読んだキーマップを「変更前」として必ず保存する(app.js が行う)。
// 1 キー書くたびに、そのキーを読み直して、書いたとおりになったか確かめる。
// QK_BOOT(書き込みモード)は選べないようにする(Vial では鍵を開けないと置けず、押し間違えると困るため)。

import * as keycodes from "./keycodes.js";

// 新しい並び(QMK 0.19 以降)と古い並びで、番号の作り方が違うもの
const ENC = {
  new: {
    mods: (m, k) => (m << 8) | k,
    mt: (m, k) => 0x2000 | (m << 8) | k,
    lt: (n, k) => 0x4000 | (n << 8) | k,
    to: (n) => 0x5200 | n, mo: (n) => 0x5220 | n, df: (n) => 0x5240 | n,
    tg: (n) => 0x5260 | n, osl: (n) => 0x5280 | n, tt: (n) => 0x52C0 | n,
    osm: (m) => 0x52A0 | m,
    mouse: [0xCD, 0xCE, 0xCF, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD9, 0xDA, 0xDB, 0xDC],
    kb: (i) => 0x7E00 + i,
    maxLayer: 31, ltMaxLayer: 15,
  },
  old: {
    mods: (m, k) => (m << 8) | k,
    mt: (m, k) => 0x6000 | (m << 8) | k,
    lt: (n, k) => 0x4000 | (n << 8) | k,
    // 古い TO は QMK の版で番号が違う(0.17 は 0x5010|n、0.18 は 0x5000|n)。見分けられないので作らない
    to: null, mo: (n) => 0x5100 | n, df: (n) => 0x5200 | n,
    tg: (n) => 0x5300 | n, osl: (n) => 0x5400 | n, tt: (n) => 0x5800 | n,
    osm: (m) => 0x5500 | m,
    mouse: [0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFB, 0xFC],
    kb: (i) => 0x5F80 + i,
    maxLayer: 15, ltMaxLayer: 15,
  },
};

export const MOD_BITS = [["Ctrl", 0x01], ["Shift", 0x02], ["Alt", 0x04], ["Win", 0x08]];
// 置かせないキー: 書き込みモード(QK_BOOT)と、設定を消すキー(QK_CLEAR_EEPROM)。新・旧の番号
const FORBIDDEN = new Map([
  [0x7C00, "書き込みモードのキー(QK_BOOT)"], [0x5C00, "書き込みモードのキー(QK_BOOT)"],
  [0x7C03, "設定を消すキー(QK_CLEAR_EEPROM)"], [0x5CDF, "設定を消すキー(QK_CLEAR_EEPROM)"],
]);

// 置く前に確かめる。だめなら理由、よければ null
export function problem(code, layerCount, isNew) {
  if (FORBIDDEN.has(code)) return `${FORBIDDEN.get(code)}は、ここでは置けないようにしています。`;
  if (!isNew && code >= 0x5000 && code <= 0x50FF) {
    return "古いキーボードの「レイヤーへ移る(TO)」は、ファームウェアの版で番号が違うため、ここでは置けないようにしています。";
  }
  const lb = keycodes.label(code, true, isNew);
  if (lb.kind === "layer" && lb.layer !== null && lb.layer >= layerCount) {
    return `このキーボードにはレイヤーが ${layerCount} 個(L0〜L${layerCount - 1})しかありません。L${lb.layer} は使えません。`;
  }
  return null;
}

// 押すと設定が変わり、キーマップを戻しても戻らないキー(Keyball の設定リセット・保存)
export function warnOf(name, code, isNew) {
  if (!name.toLowerCase().includes("keyball")) return null;
  const kb0 = isNew ? 0x7E00 : 0x5F80; // QK_KB_0(新)/ USER00(旧)
  if (code === kb0) return "Keyball の設定(CPI など)を初期値に戻すキー";
  if (code === kb0 + 1) return "Keyball の今の設定(CPI など)をキーボードに保存するキー";
  return null;
}

// 選べるキーの一覧(グループごと)。value はキーコード
export function catalog(jis, isNew, custom, kbWide) {
  const e = isNew ? ENC.new : ENC.old;
  const lab = (c) => keycodes.label(c, jis, isNew, custom, kbWide);
  const item = (c) => ({ code: c, label: lab(c) });
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const groups = [
    ["文字", range(0x04, 0x1D)],
    ["数字", range(0x1E, 0x27)],
    ["記号", [0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x87, 0x89, 0x64]],
    ["Shift 付きの記号", [...range(0x1E, 0x27), 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x87, 0x89]
      .map((k) => e.mods(0x02, k)).filter((c) => lab(c).tap.length <= 2)],
    ["編集・移動", [0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x4C, 0x49, 0x4A, 0x4D, 0x4B, 0x4E, 0x52, 0x51, 0x50, 0x4F,
      0x39, 0x46, 0x47, 0x48, 0x65]],
    ["日本語", [0x90, 0x91, 0x8A, 0x8B, 0x88, 0x35]],
    ["修飾キー", range(0xE0, 0xE7)],
    ["F キー", [...range(0x3A, 0x45), ...range(0x68, 0x73)]],
    ["テンキー", range(0x53, 0x63)],
    ["マウス", e.mouse],
    ["音・画面", [0x7F, 0x80, 0x81, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAE, 0xBD, 0xBE]],
    ["そのほか", [0x01, 0x00]],
  ];
  if (custom && custom.length) groups.push(["このキーボードの独自キー", custom.map((_, i) => e.kb(i))]);
  return groups.map(([name, codes]) => ({ name, items: codes.map(item) }));
}

// レイヤーキーなど、組み立てて作るキー
export function compose(kind, { layer = 0, tap = 0x2C, mods = 0 } = {}, isNew = true) {
  const e = isNew ? ENC.new : ENC.old;
  switch (kind) {
    case "mo": return e.mo(layer);
    case "tg": return e.tg(layer);
    case "to":
      if (!e.to) throw new Error("古いキーボードの「レイヤーへ移る(TO)」は作れません");
      return e.to(layer);
    case "tt": return e.tt(layer);
    case "osl": return e.osl(layer);
    case "df": return e.df(layer);
    case "lt": return e.lt(layer, tap);
    case "mt": return e.mt(mods, tap);
    case "mods": return e.mods(mods, tap);
    case "osm": return e.osm(mods);
    default: throw new Error(`知らない種類: ${kind}`);
  }
}

export function maxLayer(isNew, kind) {
  const e = isNew ? ENC.new : ENC.old;
  return kind === "lt" ? e.ltMaxLayer : e.maxLayer;
}
