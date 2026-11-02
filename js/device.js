// VIA / Vial のキーボードと WebHID(raw HID)で話す。PC 版の device.py と同じ手順。
//
// VIA と Vial は同じ raw HID(usage page 0xFF60, usage 0x61)と 32 バイトの通信を使う。
// Vial はそれに 0xFE で始まる命令を足していて、配列の定義(KLE)をキーボードの中に持っている。
// VIA(Remap)のキーボードは定義を持っていないので、layouts/ の JSON を使う。

export const RAW_USAGE_PAGE = 0xFF60;
export const RAW_USAGE = 0x61;
const MSG_LEN = 32;

// VIA の命令
const ID_GET_PROTOCOL_VERSION = 0x01;
const ID_GET_KEYBOARD_VALUE = 0x02;
const ID_DYNAMIC_KEYMAP_GET_KEYCODE = 0x04;
const ID_DYNAMIC_KEYMAP_SET_KEYCODE = 0x05;
const ID_DYNAMIC_KEYMAP_GET_LAYER_COUNT = 0x11;
const ID_DYNAMIC_KEYMAP_GET_BUFFER = 0x12;
const ID_UNHANDLED = 0xFF;
const ID_LAYOUT_OPTIONS = 0x02;
// Vial の命令(0xFE の後ろ)
const ID_VIAL_PREFIX = 0xFE;
const VIAL_GET_KEYBOARD_ID = 0x00;
const VIAL_GET_SIZE = 0x01;
const VIAL_GET_DEFINITION = 0x02;

const MAX_DEFINITION = 64 * 1024;
const MAX_DEFINITION_JSON = 2 * 1024 * 1024;
const MAX_DICT = 64 * 1024 * 1024; // PC 版の memlimit と同じ

// Vial ではないキーボードの定義。このリポジトリには入れず、その都度、公式の GitHub から読む
// Keyball44: Yowkees/keyball の via.json(GPL-3.0)。版を決めて読む
export const BUILTIN = [
  { vid: 0x5957, pid: 0x0400, url: "https://raw.githubusercontent.com/Yowkees/keyball/5898f6f529e822ba9763dfccb43422decdfe7fc3/qmk_firmware/keyboards/keyball/keyball44/via.json" },
];

// キーボードを使っている作業(読み込み / 変更)。同時には 1 つだけ
let owner = null;
export function claim(name) {
  if (owner) throw new Error(`今は「${owner}」の途中です。終わってからにしてください。`);
  owner = name;
}
export function release(name) {
  if (owner === name) owner = null;
}

export function isSupported() {
  return "hid" in navigator;
}

export async function requestDevice() {
  const devices = await navigator.hid.requestDevice({
    filters: [{ usagePage: RAW_USAGE_PAGE, usage: RAW_USAGE }],
  });
  return devices[0] || null;
}

export async function grantedDevices() {
  const devs = await navigator.hid.getDevices();
  return devs.filter((d) => d.collections.some((c) => c.usagePage === RAW_USAGE_PAGE && c.usage === RAW_USAGE));
}

export class Connection {
  constructor(device) {
    this.device = device;
    this.waiting = null;
    this.chain = Promise.resolve(); // 命令を 1 つずつ送るための列
    this.onReport = (e) => {
      // raw HID の返事は report ID 0・32 バイトちょうど。それ以外は取らない
      if (!this.waiting || e.reportId !== 0 || e.data.byteLength !== MSG_LEN) return;
      const w = this.waiting;
      this.waiting = null;
      w(new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength).slice());
    };
  }

  async open() {
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener("inputreport", this.onReport);
  }

  async close() {
    this.device.removeEventListener("inputreport", this.onReport);
    if (this.device.opened) await this.device.close();
  }

  // 命令を 1 つずつ送り、32 バイトの返事を待つ
  send(...data) {
    if (this.broken) return Promise.reject(new Error("キーボードとのやりとりが途切れました。もう一度つなぎ直してください。"));
    const run = this.chain.then(() => this.sendOne(data));
    this.chain = run.catch(() => {});
    return run;
  }

  // 抜かれたときなど: 待っている命令をすぐ失敗させ、以後は送らない
  cancel(reason = "キーボードが外れました") {
    this.broken = true;
    if (this.failWaiting) this.failWaiting(new Error(reason));
  }

  sendOne(data) {
    // 列に並んでいる間に壊れた扱いになったら、送らない
    if (this.broken) return Promise.reject(new Error("キーボードとのやりとりが途切れました。もう一度つなぎ直してください。"));
    const msg = new Uint8Array(MSG_LEN);
    msg.set(data);
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn, v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.waiting = null;
        this.failWaiting = null;
        fn(v);
      };
      // 送るのに時間がかかっても、返事が来なくても、1 秒で打ち切る
      const timer = setTimeout(() => {
        // 遅れて来る返事を次の命令の返事と取り違えないよう、この接続はもう使わない
        this.broken = true;
        finish(reject, new Error("キーボードから返事がありません"));
      }, 1000);
      this.waiting = (r) => finish(resolve, r);
      this.failWaiting = (err) => finish(reject, err);
      // WebHID は report ID を別に渡す(raw HID は 0)
      this.device.sendReport(0, msg).catch((e) => finish(reject, new Error(`キーボードに送れませんでした: ${e.message}`)));
    });
  }

  // VIA の命令。VIA は命令の番号を返事の先頭にそのまま返す(知らない命令は 0xFF)
  async via(...data) {
    const r = await this.send(...data);
    if (r[0] !== data[0]) {
      throw new Error(`キーボードが命令 0x${data[0].toString(16).toUpperCase()} に対応していません`);
    }
    return r;
  }

  async viaProtocol() {
    const r = await this.via(ID_GET_PROTOCOL_VERSION);
    return (r[1] << 8) | r[2];
  }

  async vialProtocol() {
    const r = await this.send(ID_VIAL_PREFIX, VIAL_GET_KEYBOARD_ID);
    if (r[0] === ID_UNHANDLED && r[1] === VIAL_GET_KEYBOARD_ID) return null;
    return new DataView(r.buffer).getUint32(0, true);
  }

  async vialDefinition() {
    // Vial の返事は先頭から中身なので、命令の番号では確かめられない。大きさで確かめる
    const size = new DataView((await this.send(ID_VIAL_PREFIX, VIAL_GET_SIZE)).buffer).getUint32(0, true);
    if (!(size > 0 && size <= MAX_DEFINITION)) throw new Error(`Vial の定義の大きさがおかしい(${size} バイト)`);
    const buf = new Uint8Array(Math.ceil(size / MSG_LEN) * MSG_LEN);
    for (let page = 0; page * MSG_LEN < size; page++) {
      buf.set(await this.send(ID_VIAL_PREFIX, VIAL_GET_DEFINITION, page & 0xFF, page >> 8), page * MSG_LEN);
    }
    return JSON.parse(await unxz(buf.subarray(0, size)));
  }

  async layerCount() {
    const n = (await this.via(ID_DYNAMIC_KEYMAP_GET_LAYER_COUNT))[1];
    if (!(n >= 1 && n <= 32)) throw new Error(`レイヤーの数がおかしい(${n})`);
    return n;
  }

  async layoutOptions() {
    const r = await this.send(ID_GET_KEYBOARD_VALUE, ID_LAYOUT_OPTIONS);
    if (r[0] !== ID_GET_KEYBOARD_VALUE || r[1] !== ID_LAYOUT_OPTIONS) return 0;
    return new DataView(r.buffer).getUint32(2, false);
  }

  async keymapBuffer(size, progress) {
    const out = new Uint8Array(size);
    for (let off = 0; off < size; ) {
      const n = Math.min(28, size - off);
      const r = await this.via(ID_DYNAMIC_KEYMAP_GET_BUFFER, off >> 8, off & 0xFF, n);
      if (r[1] !== off >> 8 || r[2] !== (off & 0xFF) || r[3] !== n) {
        throw new Error("キーマップの読み込みで、返事の位置が合いません");
      }
      out.set(r.subarray(4, 4 + n), off);
      off += n;
      if (progress) progress(off / size);
    }
    return out;
  }

  async getKeycode(layer, row, col) {
    const r = await this.via(ID_DYNAMIC_KEYMAP_GET_KEYCODE, layer, row, col);
    if (r[1] !== layer || r[2] !== row || r[3] !== col) throw new Error("キーの読み直しで、返事の位置が合いません");
    return (r[4] << 8) | r[5];
  }

  // 1 キー書き込み、読み直して確かめる。書けた値を返す
  async setKeycode(layer, row, col, code) {
    const r = await this.via(ID_DYNAMIC_KEYMAP_SET_KEYCODE, layer, row, col, code >> 8, code & 0xFF);
    if (r[1] !== layer || r[2] !== row || r[3] !== col) throw new Error("書き込みの返事の位置が合いません");
    const now = await this.getKeycode(layer, row, col);
    if (now !== code) {
      const e = new Error(`書き込んだのに、キーボードの中が 0x${now.toString(16).toUpperCase().padStart(4, "0")} になりました` +
        "(このキーは置けないのかもしれません)");
      e.actual = now; // キーボードの中の本当の値
      throw e;
    }
    return now;
  }
}

// xz の最初のブロックの LZMA2 の辞書の大きさ(バイト)。分からなければ Infinity
export function xzDictSize(b) {
  const magic = [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00];
  if (b.length < 24 || magic.some((v, i) => b[i] !== v)) return Infinity;
  let p = 12; // ストリームのヘッダーの後ろが最初のブロック
  const end = p + (b[p] + 1) * 4;
  const flags = b[p + 1];
  p += 2;
  const vli = () => {
    let v = 0, shift = 0;
    for (let i = 0; i < 9 && p < end; i++) {
      const x = b[p++];
      v += (x & 0x7F) * 2 ** shift;
      if (!(x & 0x80)) return v;
      shift += 7;
    }
    throw new Error("xz のヘッダーが壊れています");
  };
  if (flags & 0x40) vli(); // 圧縮後の大きさ
  if (flags & 0x80) vli(); // 展開後の大きさ
  let dict = Infinity;
  for (let i = 0; i <= (flags & 0x03); i++) {
    const id = vli();
    const n = vli();
    if (id === 0x21 && n === 1) {
      const d = b[p] & 0x3F;
      dict = d > 40 ? Infinity : d === 40 ? 0xFFFFFFFF : (2 | (d & 1)) * 2 ** (Math.floor(d / 2) + 11);
    }
    p += n;
  }
  return dict;
}

// xz を広げる(vendor/xzwasm.min.js)。辞書と展開後の大きさに上限を付ける
async function unxz(bytes) {
  if (xzDictSize(bytes) > MAX_DICT) throw new Error("Vial の定義の圧縮のしかたが想定と違います(辞書が大きすぎます)");
  const input = new Response(bytes).body;
  const stream = new globalThis.xzwasm.XzReadableStream(input);
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DEFINITION_JSON) {
      await reader.cancel();
      throw new Error("Vial の定義が大きすぎます");
    }
    chunks.push(value.slice()); // xzwasm は出力の入れ物を使い回すので、写しておく
  }
  const all = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { all.set(c, p); p += c.byteLength; }
  return new TextDecoder().decode(all);
}

export async function builtinDefinition(vid, pid) {
  for (const b of BUILTIN) {
    if (b.vid !== vid || b.pid !== pid) continue;
    let d;
    try {
      const res = await fetch(b.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      d = await res.json();
    } catch (e) {
      throw new Error(`配列の定義を GitHub から読めませんでした(${e.message})。インターネットにつながっているか確かめてください。`);
    }
    if (parseInt(d.vendorId, 16) === vid && parseInt(d.productId, 16) === pid) return d;
  }
  return null;
}

// 保存するキーマップ。PC 版の JSON と同じ形(そのまま読み書きできる)
export function newKeycodes(km) {
  // QMK 0.19 でキーコードの番号が変わった。VIA 11 以上、Vial 6 以上が新しい番号
  if (km.vial_protocol !== null && km.vial_protocol !== undefined) return km.vial_protocol >= 6;
  return km.via_protocol >= 11;
}

export function kbWide(km) {
  // QMK 0.19〜0.21(VIA 11)は QK_KB が 0x7E00〜0x7EFF、QK_USER が 0x7F00 から
  return (km.vial_protocol === null || km.vial_protocol === undefined) && km.via_protocol === 11;
}

export function nowIso() {
  const d = new Date();
  const p = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export async function readKeymap(device, progress) {
  const c = new Connection(device);
  await c.open();
  try {
    return await readFrom(c, progress);
  } finally {
    await c.close();
  }
}

// 開いている接続から読む(変更の画面では接続を開いたままにする)
export async function readFrom(c, progress) {
  const device = c.device;
  const via = await c.viaProtocol();
  const vial = await c.vialProtocol();
  let definition;
  if (vial !== null) {
    definition = await c.vialDefinition();
  } else {
    definition = await builtinDefinition(device.vendorId, device.productId);
    if (!definition) {
      throw new Error(`${device.productName} の配列の定義がありません(VIA 用の JSON が要ります)。`);
    }
  }
  const rows = definition.matrix.rows, cols = definition.matrix.cols;
  const n = await c.layerCount();
  const raw = await c.keymapBuffer(n * rows * cols * 2, progress);
  const opts = await c.layoutOptions();
  const dv = new DataView(raw.buffer);
  const layers = [];
  for (let l = 0; l < n; l++) {
    const layer = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let k = 0; k < cols; k++) row.push(dv.getUint16(((l * rows + r) * cols + k) * 2, false));
      layer.push(row);
    }
    layers.push(layer);
  }
  return {
    name: definition.name || device.productName, vid: device.vendorId, pid: device.productId,
    definition, layout_options: opts, via_protocol: via, vial_protocol: vial, layers, read_at: nowIso(),
  };
}
