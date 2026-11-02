// キーコード(16 ビットの数)を、チートシートに書く文字にする。
//
// QMK 0.19 でキーコードの番号の並びが変わった。isNew=true が新しい並び(VIA 11 以上、Vial 6 以上)。
// 基本のキー(0x00〜0xFF)は新旧で同じ。
// QK_KB / QK_USER の境目は 0.19〜0.21(VIA 11)と今(VIA 12)で違う。kbWide=true が VIA 11 の並び。
// PC 版(keymap-sheet の keycodes.py)と同じ結果になるようにしている。

// 基本のキー: [US の表示, JIS の表示]。JIS は Windows/Mac を日本語配列で使うときに出る文字
const BASIC = new Map([
  [0x00, ["", ""]], [0x01, ["▽", "▽"]],
  [0x28, ["Enter", "Enter"]], [0x29, ["Esc", "Esc"]], [0x2A, ["BS", "BS"]], [0x2B, ["Tab", "Tab"]],
  [0x2C, ["Space", "Space"]], [0x2D, ["-", "-"]], [0x2E, ["=", "^"]], [0x2F, ["[", "@"]],
  [0x30, ["]", "["]], [0x31, ["\\", "]"]], [0x32, ["#", "]"]], [0x33, [";", ";"]], [0x34, ["'", ":"]],
  [0x35, ["`", "半/全"]], [0x36, [",", ","]], [0x37, [".", "."]], [0x38, ["/", "/"]],
  [0x39, ["Caps", "英数"]], [0x46, ["PrtSc", "PrtSc"]], [0x47, ["ScrLk", "ScrLk"]],
  [0x48, ["Pause", "Pause"]], [0x49, ["Ins", "Ins"]], [0x4A, ["Home", "Home"]], [0x4B, ["PgUp", "PgUp"]],
  [0x4C, ["Del", "Del"]], [0x4D, ["End", "End"]], [0x4E, ["PgDn", "PgDn"]],
  [0x4F, ["→", "→"]], [0x50, ["←", "←"]], [0x51, ["↓", "↓"]], [0x52, ["↑", "↑"]],
  [0x53, ["NumLk", "NumLk"]], [0x54, ["P/", "P/"]], [0x55, ["P*", "P*"]], [0x56, ["P-", "P-"]],
  [0x57, ["P+", "P+"]], [0x58, ["PEnt", "PEnt"]], [0x62, ["P0", "P0"]], [0x63, ["P.", "P."]],
  [0x64, ["\\", "\\"]], [0x65, ["Menu", "Menu"]], [0x67, ["P=", "P="]],
  [0x7F, ["Mute", "Mute"]], [0x80, ["Vol+", "Vol+"]], [0x81, ["Vol-", "Vol-"]],
  [0x87, ["Int1", "＼"]], [0x88, ["Int2", "かな"]], [0x89, ["Int3", "¥"]], [0x8A, ["Int4", "変換"]],
  [0x8B, ["Int5", "無変換"]], [0x90, ["Lng1", "かな"]], [0x91, ["Lng2", "英数"]],
  [0xE0, ["Ctrl", "Ctrl"]], [0xE1, ["Shift", "Shift"]], [0xE2, ["Alt", "Alt"]], [0xE3, ["Win", "Win"]],
  [0xE4, ["RCtrl", "RCtrl"]], [0xE5, ["RShift", "RShift"]], [0xE6, ["RAlt", "RAlt"]], [0xE7, ["RWin", "RWin"]],
]);
for (let i = 0; i < 26; i++) {
  const ch = String.fromCharCode(65 + i);
  BASIC.set(0x04 + i, [ch, ch]);
}
"1234567890".split("").forEach((ch, i) => BASIC.set(0x1E + i, [ch, ch]));
for (let i = 0; i < 12; i++) {
  BASIC.set(0x3A + i, [`F${i + 1}`, `F${i + 1}`]);
  BASIC.set(0x68 + i, [`F${i + 13}`, `F${i + 13}`]);
}
for (let i = 0; i < 9; i++) BASIC.set(0x59 + i, [`P${i + 1}`, `P${i + 1}`]);

// 新しい並びのメディア・マウス(0xA5〜0xDF)
const MEDIA_COMMON = {
  0xA5: "Power", 0xA6: "Sleep", 0xA7: "Wake", 0xA8: "Mute", 0xA9: "Vol+", 0xAA: "Vol-",
  0xAB: "次の曲", 0xAC: "前の曲", 0xAD: "停止", 0xAE: "再生", 0xB2: "電卓",
  0xBD: "明るく", 0xBE: "暗く",
};
const MEDIA_NEW = new Map(Object.entries({
  ...MEDIA_COMMON,
  0xCD: "M↑", 0xCE: "M↓", 0xCF: "M←", 0xD0: "M→",
  0xD1: "左クリック", 0xD2: "右クリック", 0xD3: "中クリック", 0xD4: "Btn4", 0xD5: "Btn5",
  0xD6: "Btn6", 0xD7: "Btn7", 0xD8: "Btn8",
  0xD9: "ホイール↑", 0xDA: "ホイール↓", 0xDB: "ホイール←", 0xDC: "ホイール→",
  0xDD: "マウス加速0", 0xDE: "マウス加速1", 0xDF: "マウス加速2",
  0xB1: "メール", 0xB3: "PC", 0xB4: "Web検索", 0xB5: "ホーム", 0xB6: "戻る", 0xB7: "進む",
  0xB8: "読込中止", 0xB9: "再読込", 0xBA: "お気に入り", 0xBB: "早送り", 0xBC: "巻戻し",
}).map(([k, v]) => [Number(k), v]));
// 古い並びのメディア・マウス
const MEDIA_OLD = new Map(Object.entries({
  ...MEDIA_COMMON,
  0xF0: "M↑", 0xF1: "M↓", 0xF2: "M←", 0xF3: "M→",
  0xF4: "左クリック", 0xF5: "右クリック", 0xF6: "中クリック", 0xF7: "Btn4", 0xF8: "Btn5",
  0xF9: "ホイール↑", 0xFA: "ホイール↓", 0xFB: "ホイール←", 0xFC: "ホイール→",
  0xFD: "マウス加速0", 0xFE: "マウス加速1", 0xFF: "マウス加速2",
}).map(([k, v]) => [Number(k), v]));

// Shift を押したときに出る文字(JIS / US)
const SHIFT_JIS = new Map([[0x1E, "!"], [0x1F, "\""], [0x20, "#"], [0x21, "$"], [0x22, "%"], [0x23, "&"],
  [0x24, "'"], [0x25, "("], [0x26, ")"], [0x2D, "="], [0x2E, "~"], [0x2F, "`"], [0x30, "{"], [0x31, "}"],
  [0x32, "}"], [0x33, "+"], [0x34, "*"], [0x36, "<"], [0x37, ">"], [0x38, "?"], [0x87, "_"], [0x89, "|"]]);
const SHIFT_US = new Map([[0x1E, "!"], [0x1F, "@"], [0x20, "#"], [0x21, "$"], [0x22, "%"], [0x23, "^"],
  [0x24, "&"], [0x25, "*"], [0x26, "("], [0x27, ")"], [0x2D, "_"], [0x2E, "+"], [0x2F, "{"], [0x30, "}"],
  [0x31, "|"], [0x33, ":"], [0x34, "\""], [0x35, "~"], [0x36, "<"], [0x37, ">"], [0x38, "?"]]);

const RGB_NEW = new Map([[0x7820, "RGB 入切"], [0x7821, "RGB 次"], [0x7822, "RGB 前"], [0x7823, "色相+"],
  [0x7824, "色相-"], [0x7825, "彩度+"], [0x7826, "彩度-"], [0x7827, "明るさ+"], [0x7828, "明るさ-"],
  [0x7829, "速さ+"], [0x782A, "速さ-"]]);
const QUANTUM_NEW = new Map([[0x7C00, "書込モード"], [0x7C01, "再起動"], [0x7C03, "設定消去"],
  [0x7C16, "Esc/`"], [0x7C73, "CapsWord"], [0x7C79, "くり返し"]]);

// Keyball の独自キー(QK_KB_0 から)
export const KEYBALL_KB = ["設定リセット", "設定保存", "CPI+100", "CPI-100", "CPI+1000", "CPI-1000",
  "スクロール切替", "押す間スクロール", "スクロール速く", "スクロール遅く",
  "自動マウス切替", "自動マウス+50ms", "自動マウス-50ms",
  "縦スクロール固定", "横スクロール固定", "スクロール自由"];

const LAYER_NEW = [[0x5200, "L{n} へ移る", "move"], [0x5220, "押す間 L{n}", "hold"],
  [0x5240, "基本を L{n} に", "default"], [0x5260, "L{n} 切替", "toggle"],
  [0x5280, "次の1打 L{n}", "oneshot"], [0x52C0, "L{n} 押す/切替", "tt"]];
const LAYER_OLD = [[0x5000, "L{n} へ移る", "move"], [0x5100, "押す間 L{n}", "hold"],
  [0x5200, "基本を L{n} に", "default"], [0x5300, "L{n} 切替", "toggle"],
  [0x5400, "次の1打 L{n}", "oneshot"], [0x5800, "L{n} 押す/切替", "tt"]];

// レイヤーキーの働きと、行き先のレイヤーの図に書く言葉
export const ACTION_WORDS = {
  hold: "押したまま", tt: "押したまま/連打で切替", toggle: "押すと切替",
  move: "押すと移る", default: "押すと基本に", oneshot: "1回押す",
};
export const HOLD_ACTIONS = ["hold", "tt"];

// tap: 押したとき / hold: 長押しのとき / layer: 行くレイヤー / kind: key mod layer special trans none
function L(tap, hold = "", layer = null, kind = "key", action = "") {
  return { tap, hold, layer, kind, action };
}

const hex = (v, w) => "0x" + v.toString(16).toUpperCase().padStart(w, "0");

function mods(m) {
  const names = [];
  const right = m & 0x10;
  for (const [bit, n] of [[1, "Ctrl"], [2, "Shift"], [4, "Alt"], [8, "Win"]]) {
    if (m & bit) names.push((right ? "R" : "") + n);
  }
  return names.join("+");
}

export function basic(code, jis, isNew = true) {
  if (BASIC.has(code)) return BASIC.get(code)[jis ? 1 : 0];
  const media = isNew ? MEDIA_NEW : MEDIA_OLD;
  if (media.has(code)) return media.get(code);
  return hex(code, 2);
}

export function label(code, jis = true, isNew = true, custom = null, kbWide = false) {
  if (code === 0x00) return L("", "", null, "none");
  if (code === 0x01) return L("", "", null, "trans");
  if (code <= 0xFF) {
    return L(basic(code, jis, isNew), "", null, code >= 0xE0 && code <= 0xE7 ? "mod" : "key");
  }
  return isNew ? labelNew(code, jis, custom, kbWide) : labelOld(code, jis, custom);
}

function withMods(code, jis, isNew) {
  const m = (code >> 8) & 0x1F;
  const k = code & 0xFF;
  const shiftOnly = m === 0x02 || m === 0x12;
  const table = jis ? SHIFT_JIS : SHIFT_US;
  if (shiftOnly && table.has(k)) return L(table.get(k));
  if (shiftOnly && k >= 0x04 && k <= 0x1D) return L(basic(k, jis, isNew)); // 大文字
  return L(`${mods(m)}+${basic(k, jis, isNew)}`);
}

function customLabel(custom, i, fallback) {
  if (custom && i < custom.length) return L(custom[i], "", null, "special");
  return L(fallback, "", null, "special");
}

function labelNew(code, jis, custom, kbWide) {
  if (code <= 0x1FFF) return withMods(code, jis, true);
  if (code <= 0x3FFF) return L(basic(code & 0xFF, jis), mods((code >> 8) & 0x1F), null, "mod"); // MT
  if (code <= 0x4FFF) { // LT
    const n = (code >> 8) & 0xF;
    return L(basic(code & 0xFF, jis), `L${n}`, n, "layer", "hold");
  }
  if (code <= 0x51FF) { // LM
    const n = (code >> 5) & 0xF;
    return L(`L${n}+${mods(code & 0x1F)}`, "", n, "layer", "hold");
  }
  for (const [base, text, act] of LAYER_NEW) {
    if (code >= base && code < base + 0x20) {
      const n = code & 0x1F;
      return L(text.replace("{n}", n), "", n, "layer", act);
    }
  }
  if (code >= 0x52A0 && code < 0x52C0) return L("次の1打 " + mods(code & 0x1F), "", null, "mod");
  if (code >= 0x5700 && code <= 0x57FF) return L(`TD${code & 0xFF}`, "", null, "special");
  if (code >= 0x7700 && code <= 0x777F) return L(`マクロ${code & 0x7F}`, "", null, "special");
  if (RGB_NEW.has(code)) return L(RGB_NEW.get(code), "", null, "special");
  if (code >= 0x782B && code <= 0x7834) return L(`RGB 模様${code - 0x782B + 1}`, "", null, "special");
  if (QUANTUM_NEW.has(code)) return L(QUANTUM_NEW.get(code), "", null, "special");
  const [kbEnd, user0] = kbWide ? [0x7EFF, 0x7F00] : [0x7E3F, 0x7E40];
  if (code >= 0x7E00 && code <= kbEnd) return customLabel(custom, code - 0x7E00, `KB${code - 0x7E00}`);
  if (code >= user0 && code <= 0x7FFF) return L(`USER${code - user0}`, "", null, "special");
  return L(hex(code, 4), "", null, "special");
}

function labelOld(code, jis, custom) {
  if (code <= 0x1FFF) return withMods(code, jis, false);
  if (code >= 0x3000 && code <= 0x30FF) return L(`マクロ${code & 0xFF}`, "", null, "special");
  if (code >= 0x4000 && code <= 0x4FFF) {
    const n = (code >> 8) & 0xF;
    return L(basic(code & 0xFF, jis, false), `L${n}`, n, "layer", "hold");
  }
  for (const [base, text, act] of LAYER_OLD) {
    if (code >= base && code < base + 0x100) {
      const n = base !== 0x5000 ? code & 0x1F : code & 0xF;
      return L(text.replace("{n}", n), "", n, "layer", act);
    }
  }
  // 古い VIA / Vial の動的マクロ M0〜(QMK のマクロとは別)
  if (code >= 0x5F12 && code <= 0x5F31) return L(`マクロ${code - 0x5F12}`, "", null, "special");
  if (code >= 0x5500 && code < 0x5600) return L("次の1打 " + mods(code & 0x1F), "", null, "mod");
  if (code >= 0x5700 && code < 0x5800) return L(`TD${code & 0xFF}`, "", null, "special");
  if (code >= 0x5900 && code < 0x5A00) {
    const n = (code >> 4) & 0xF;
    return L(`L${n}+${mods(code & 0xF)}`, "", n, "layer", "hold");
  }
  if (code >= 0x5F80 && code <= 0x5FFF) return customLabel(custom, code - 0x5F80, `USER${code - 0x5F80}`);
  if (code >= 0x6000 && code <= 0x7FFF) {
    return L(basic(code & 0xFF, jis, false), mods((code >> 8) & 0x1F), null, "mod");
  }
  if (code === 0x5C00) return L("書込モード", "", null, "special");
  return L(hex(code, 4), "", null, "special");
}
