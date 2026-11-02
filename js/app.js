// 画面の動き: キーボードを読む → ブラウザに保存 → チートシートを作る → 印刷して PDF にする
import * as device from "./device.js";
import { buildPages } from "./sheet.js";
import { DEMO_LAYERS } from "./demo.js";
import { parse } from "./kle.js";
import * as editor from "./editor.js";

const STORE_KEY = "keymap-sheet:keymaps";
const MAX_JSON = 4 * 1024 * 1024;
const $ = (id) => document.getElementById(id);

// 保存したキーマップ: [{id, checked, km}]。ブラウザの localStorage に入れる
let saved = [];

function load() {
  let raw = [];
  try {
    raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    raw = [];
  }
  saved = (Array.isArray(raw) ? raw : []).filter(
    (s) => s && typeof s.id === "string" && checkKeymap(s.km) === null);
  saved.forEach((s) => { s.checked = !!s.checked; });
}

function store() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    setStatus("ブラウザに保存できませんでした(この画面を閉じると消えます)。JSON で保存しておいてください。", true);
    return false;
  }
}

function setStatus(msg, error = false) {
  const s = $("status");
  s.textContent = msg;
  s.classList.toggle("warn", error);
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// キーマップの形を確かめる。よければ null、だめなら理由を返す
function checkKeymap(km) {
  if (!km || typeof km !== "object") return "中身がありません";
  if (typeof km.name !== "string" || km.name.length > 200) return "name がおかしい";
  if (typeof km.read_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(km.read_at.slice(0, 19))) {
    return "read_at(読んだ日時)がおかしい";
  }
  if (!isInt(km.layout_options, 0, 0xFFFFFFFF)) return "layout_options がおかしい";
  if (!isInt(km.via_protocol, 0, 0xFFFF)) return "via_protocol がおかしい";
  if (km.vial_protocol !== null && !isInt(km.vial_protocol, 0, 0xFFFFFFFF)) return "vial_protocol がおかしい";
  const d = km.definition;
  if (!d || !d.matrix || !d.layouts || !Array.isArray(d.layouts.keymap)) return "definition(配列の定義)がおかしい";
  const rows = d.matrix.rows, cols = d.matrix.cols;
  if (!isInt(rows, 1, 64) || !isInt(cols, 1, 64)) return "行列の大きさがおかしい";
  if (!Array.isArray(km.layers) || !isInt(km.layers.length, 1, 32)) return "レイヤーの数がおかしい";
  for (const layer of km.layers) {
    if (!Array.isArray(layer) || layer.length !== rows) return "レイヤーの行の数が合いません";
    for (const row of layer) {
      if (!Array.isArray(row) || row.length !== cols || !row.every((c) => isInt(c, 0, 0xFFFF))) {
        return "キーコードの並びがおかしい";
      }
    }
  }
  try {
    const keys = parse(d, km.layout_options);
    if (!keys.length) return "配列にキーがありません";
    if (keys.some((k) => !isInt(k.row, 0, rows - 1) || !isInt(k.col, 0, cols - 1))) return "配列のキーが行列の外を指しています";
  } catch (e) {
    return `配列の定義が読めません(${e.message})`;
  }
  return null;
}

// 足して保存する。ブラウザに保存できたら true
function add(km) {
  return addEntry(km).ok;
}

function addEntry(km) {
  // 新しいものだけに印を付ける
  saved.forEach((s) => { s.checked = false; });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  saved.unshift({ id, checked: true, km });
  const ok = store();
  render();
  return { id, ok };
}

// 変更の画面から: 同じ項目を新しい中身にする
function update(id, km) {
  const s = saved.find((x) => x.id === id);
  if (!s) return addEntry(km).ok;
  s.km = km;
  const ok = store();
  render();
  return ok;
}

const NOT_STORED = "ただし、ブラウザに保存できませんでした(この画面を閉じると消えます)。「JSON で保存」で残してください。";

function download(km) {
  const blob = new Blob([JSON.stringify(km, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const stamp = km.read_at.slice(0, 19).replace(/[-:]/g, "");
  a.download = `${km.name.replace(/[\\/:*?"<>|]+/g, "_")}_${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function render() {
  const ul = $("saved");
  ul.replaceChildren();
  if (!saved.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "まだありません。1 でキーボードを読むか、見本を入れてください。";
    ul.appendChild(li);
    return;
  }
  for (const s of saved) {
    const li = document.createElement("li");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = s.checked;
    cb.addEventListener("change", () => { s.checked = cb.checked; store(); });
    const name = document.createElement("label");
    name.className = "name";
    name.append(cb, ` ${s.km.name} `);
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `(${s.km.read_at.replace("T", " ")}、${s.km.layers.length} 層)`;
    name.appendChild(meta);
    const dl = document.createElement("button");
    dl.textContent = "JSON で保存";
    dl.addEventListener("click", () => download(s.km));
    const del = document.createElement("button");
    del.textContent = "消す";
    del.addEventListener("click", () => {
      if (!confirm(`${s.km.name}(${s.km.read_at.replace("T", " ")})を消しますか?`)) return;
      saved = saved.filter((x) => x !== s);
      store();
      render();
    });
    li.append(name, dl, del);
    ul.appendChild(li);
  }
}

let busy = false;
async function readKeyboard() {
  if (busy) return;
  try {
    device.claim("読み込み");
  } catch (e) {
    setStatus(e.message, true);
    return;
  }
  busy = true;
  try {
    await readKeyboardInner();
  } finally {
    busy = false;
    device.release("読み込み");
  }
}

async function readKeyboardInner() {
  let dev;
  try {
    dev = await device.requestDevice();
  } catch (e) {
    setStatus(`キーボードを選べませんでした: ${e.message}`, true);
    return;
  }
  if (!dev) {
    setStatus("キーボードが選ばれませんでした。");
    return;
  }
  $("read").disabled = true;
  const bar = $("progress");
  bar.hidden = false;
  bar.value = 0;
  setStatus(`${dev.productName} を読んでいます…`);
  try {
    const km = await device.readKeymap(dev, (p) => { bar.value = p; });
    const problem = checkKeymap(km);
    if (problem) throw new Error(problem);
    const ok = add(km);
    setStatus(`読みました: ${km.name}(${km.layers.length} 層)。${ok ? "" : NOT_STORED}`, !ok);
  } catch (e) {
    setStatus(`読み込みに失敗しました: ${e.message}`, true);
  } finally {
    $("read").disabled = false;
    bar.hidden = true;
  }
}

async function addDemo() {
  let d;
  try {
    d = await device.builtinDefinition(0x5957, 0x0400);
  } catch (e) {
    setStatus(`見本を入れられませんでした: ${e.message}`, true);
    return;
  }
  const ok = add({
    name: "Keyball44(見本・自作)", vid: 0x5957, pid: 0x0400, definition: d, layout_options: 1,
    via_protocol: 12, vial_protocol: null, layers: DEMO_LAYERS, read_at: "2026-11-01T00:00:00",
  });
  setStatus(`見本を入れました。3 の「チートシートを作る」を押してください。${ok ? "" : NOT_STORED}`, !ok);
}

async function importFiles(files) {
  let n = 0, allStored = true;
  for (const f of files) {
    try {
      if (f.size > MAX_JSON) throw new Error("ファイルが大きすぎます");
      const km = JSON.parse(await f.text());
      const problem = checkKeymap(km);
      if (problem) throw new Error(`キーマップの JSON ではありません(${problem})`);
      allStored = add(km) && allStored;
      n++;
    } catch (e) {
      setStatus(`${f.name} を読めませんでした: ${e.message}`, true);
      return;
    }
  }
  setStatus(`${n} 個読み込みました。${allStored ? "" : NOT_STORED}`, !allStored);
}

async function build() {
  const kms = saved.filter((s) => s.checked).map((s) => s.km);
  if (!kms.length) {
    setStatus("2 で、チートシートにするキーマップに印を付けてください。", true);
    return;
  }
  await document.fonts.ready; // 字の幅を正しく測るため
  const box = $("pages");
  try {
    box.replaceChildren(...buildPages(kms, $("jis").checked));
  } catch (e) {
    setStatus(`チートシートを作れませんでした: ${e.message}`, true);
    return;
  }
  $("print").disabled = false;
  setStatus(`${box.children.length} ページ作りました。下に表示しています。`);
  box.scrollIntoView({ behavior: "smooth" });
}

load();
render();
if (!device.isSupported()) {
  $("unsupported").hidden = false;
  $("read").disabled = true;
}
$("read").addEventListener("click", readKeyboard);
$("demo").addEventListener("click", addDemo);
$("import").addEventListener("change", (e) => { importFiles([...e.target.files]); e.target.value = ""; });
$("build").addEventListener("click", build);
$("print").addEventListener("click", () => window.print());
$("jis").addEventListener("change", () => editor.refresh());
editor.init({ add, addQuiet: (km) => addEntry(km).id, update });
