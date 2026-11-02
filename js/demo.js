// キーボードがなくても試せるように、Keyball44 の形で作った見本のキーマップ(4 層)。
// 公式のキーマップではなく、このアプリ用に作った例。

const A = (ch) => 0x04 + ch.charCodeAt(0) - 97;
const N = (d) => (d === 0 ? 0x27 : 0x1E + d - 1);
const [ESC, TAB, LCTL, LSFT, RSFT, DEL, BSPC, ENT, SPC] = [0x29, 0x2B, 0xE0, 0xE1, 0xE5, 0x4C, 0x2A, 0x28, 0x2C];
const [MINS, EQL, LBRC, RBRC, NUHS, SCLN, QUOT, COMM, DOT, SLSH, INT1, INT3] =
  [0x2D, 0x2E, 0x2F, 0x30, 0x32, 0x33, 0x34, 0x36, 0x37, 0x38, 0x87, 0x89];
const [LNG1, LNG2, LALT, LGUI, HOME, END, PGUP, PGDN] = [0x90, 0x91, 0xE2, 0xE3, 0x4A, 0x4D, 0x4B, 0x4E];
const [UP, DOWN, LEFT, RGHT, TR] = [0x52, 0x51, 0x50, 0x4F, 0x01];
const [BTN1, BTN2, BTN3, WH_U, WH_D] = [0xD1, 0xD2, 0xD3, 0xD9, 0xDA];
const S = (k) => 0x0200 | k;
const C = (k) => 0x0100 | k;
const LT = (n, k) => 0x4000 | (n << 8) | k;
const MO = (n) => 0x5220 | n;
const F = (i) => 0x3A + i - 1;
const KB = (i) => 0x7E00 + i;

// 左 6・右 6 ×3 段と、親指(左 5・右 5)を Keyball44 の 8×6 の行列に入れる
function layout(top, mid, bot, thumbs) {
  const m = Array.from({ length: 8 }, () => Array(6).fill(0));
  [top, mid, bot].forEach((keys, r) => {
    for (let i = 0; i < 6; i++) {
      m[r][i] = keys[i];
      m[4 + r][5 - i] = keys[6 + i];
    }
  });
  [1, 2, 3, 4, 5].forEach((c, i) => { m[3][c] = thumbs[i]; });
  [5, 4, 3, 2, 1].forEach((c, i) => { m[7][c] = thumbs[5 + i]; });
  return m;
}

const row = (s) => s.split("").map(A);

// L0: 文字。親指で Space / Enter とレイヤー、日本語の入切
const L0 = layout([TAB, ...row("qwert"), ...row("yuiop"), BSPC],
  [LCTL, ...row("asdfg"), ...row("hjkl"), SCLN, ENT],
  [LSFT, ...row("zxcvb"), ...row("nm"), COMM, DOT, SLSH, RSFT],
  [LGUI, LALT, LNG2, LT(1, SPC), ESC, DEL, LT(2, ENT), LNG1, MO(3), TR]);
// L1: 数字と記号(JIS 配列の PC で、キーに書いた字が出る並び)
const L1 = layout([TR, N(1), N(2), N(3), N(4), N(5), N(6), N(7), N(8), N(9), N(0), TR],
  [TR, S(N(1)), S(N(2)), S(N(3)), S(N(4)), S(N(5)), MINS, EQL, LBRC, RBRC, NUHS, QUOT],
  [TR, S(N(6)), S(N(7)), S(N(8)), S(N(9)), INT3, S(MINS), S(EQL), S(LBRC), S(RBRC), S(NUHS), INT1],
  Array(10).fill(TR));
// L2: 移動と F キー、よく使う Ctrl の組み合わせ
const L2 = layout([TR, F(1), F(2), F(3), F(4), F(5), HOME, PGDN, PGUP, END, TR, TR],
  [TR, F(6), F(7), F(8), F(9), F(10), LEFT, DOWN, UP, RGHT, TR, TR],
  [TR, C(A("z")), C(A("x")), C(A("c")), C(A("v")), F(11), F(12), TR, TR, TR, TR, TR],
  Array(10).fill(TR));
// L3: マウスと Keyball の設定
const L3 = layout([TR, TR, TR, TR, TR, TR, TR, BTN1, BTN3, BTN2, TR, TR],
  [TR, TR, TR, TR, TR, TR, WH_U, KB(2), KB(4), KB(8), TR, TR],
  [TR, TR, TR, TR, TR, TR, WH_D, KB(3), KB(5), KB(9), TR, TR],
  Array(10).fill(TR));

export const DEMO_LAYERS = [L0, L1, L2, L3];
