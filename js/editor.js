// 「4. キーマップを変える」の画面。
//
// 流れ: キーボードを選ぶ → 読む → 変更前として保存 → キーを選ぶ → 新しいキーを選ぶ → 書き込む(読み直して確かめる)
// 「変更前に戻す」で、変更前のキーマップと違うキーだけを書き戻す。

import * as device from "./device.js";
import * as edit from "./edit.js";
import * as keycodes from "./keycodes.js";
import { customNames, drawLayer, labelsOf, layoutInfo } from "./sheet.js";

const $ = (id) => document.getElementById(id);
const SVGNS = "http://www.w3.org/2000/svg";

// 今の変更: {conn, km, backup, layer, selected, entryId, writing, cancelled}
// 書いている途中に抜かれて新しく始めても、前の処理が新しい変更に触らないよう、処理ごとに s として持つ
let ctx = null;
let hooks = null; // app.js から: {add(km, note) -> id, update(id, km), status(msg, err)}

export function init(h) {
  hooks = h;
  $("edit-start").addEventListener("click", start);
  $("edit-end").addEventListener("click", end);
  $("edit-restore").addEventListener("click", restore);
  $("edit-apply").addEventListener("click", applyComposed);
  $("edit-hex-apply").addEventListener("click", applyHex);
  $("edit-kind").addEventListener("change", updateComposeFields);

  if (!device.isSupported()) $("edit-start").disabled = true;
  navigator.hid?.addEventListener("disconnect", (e) => {
    if (ctx && e.device === ctx.conn.device) {
      const s = ctx;
      s.cancelled = true;
      s.conn.cancel(); // 待っている返事をすぐ失敗させる
      saveEdited(s);
      ctx = null;
      showEditor(false);
      device.release("変更");
      setStatus("キーボードが外れました。ここまでに書けたものは「(変更後)」に入っています。", true);
    }
  });
}

function setStatus(msg, err = false) {
  const s = $("edit-status");
  s.textContent = msg;
  s.classList.toggle("warn", err);
}

function showEditor(on) {
  $("editor").hidden = !on;
  $("edit-start").disabled = on || !device.isSupported();
}

function jis() {
  return $("jis").checked;
}

function info() {
  const km = ctx.km;
  return { isNew: device.newKeycodes(km), custom: customNames(km), wide: device.kbWide(km) };
}

let starting = false;
async function start() {
  if (starting || ctx) return;
  try {
    device.claim("変更");
  } catch (e) {
    setStatus(e.message, true);
    return;
  }
  starting = true;
  $("edit-start").disabled = true;
  try {
    await startInner();
  } finally {
    starting = false;
    if (!ctx) {
      device.release("変更");
      $("edit-start").disabled = !device.isSupported();
    }
  }
}

async function startInner() {
  let dev;
  try {
    dev = await device.requestDevice();
  } catch (e) {
    setStatus(`キーボードを選べませんでした: ${e.message}`, true);
    return;
  }
  if (!dev) return;
  const conn = new device.Connection(dev);
  try {
    await conn.open();
    setStatus(`${dev.productName} を読んでいます…`);
    const km = await device.readFrom(conn);
    // 変更前のキーマップを、必ず先に保存する
    const backup = structuredClone(km);
    const stored = hooks.add({ ...backup, name: `${km.name}(変更前)` });
    ctx = { conn, km, backup, layer: 0, selected: null, entryId: null, writing: false, cancelled: false };
    setBusy(ctx, false); // 前の変更が書いている途中で止まっていても、ボタンを戻す
    showEditor(true);
    buildLayerTabs();
    buildCatalog();
    updateComposeFields();
    render();
    setStatus(`読みました。変更前のキーマップを「2. 保存したキーマップ」に入れました${stored ? "" : "(ただしブラウザには保存できませんでした。JSON で保存してください)"}。` +
      "変えたいキーを押してください。", !stored);
  } catch (e) {
    await conn.close().catch(() => {});
    setStatus(`始められませんでした: ${e.message}`, true);
  }
}

async function end() {
  if (!ctx || ctx.writing) return;
  const c = ctx.conn;
  ctx = null;
  showEditor(false);
  await c.close().catch(() => {});
  device.release("変更");
  setStatus("変更を終わりました。");
}

// 中の状態が分からなくなったら、続けさせない(つなぎ直して読み直してもらう)。s の変更だけを止める
async function abort(s, msg) {
  saveEdited(s);
  if (s.cancelled) return; // もう止まっている(抜かれた)
  s.cancelled = true;
  s.conn.cancel("変更を止めました");
  const mine = ctx === s;
  if (mine) {
    ctx = null;
    showEditor(false);
    $("edit-start").disabled = true; // 閉じ終わるまで、始め直せないようにする
    setStatus(`${msg} キーボードの中がどうなったか分からないので、変更を止めました。` +
      "もう一度「変更を始める」で読み直してください(「(変更前)」は 2 に残っています)。", true);
  }
  await s.conn.close().catch(() => {});
  if (mine) {
    device.release("変更");
    if (!ctx) $("edit-start").disabled = !device.isSupported();
  }
}

function setBusy(s, on) {
  s.writing = on;
  if (ctx !== s) return;
  for (const id of ["edit-end", "edit-restore", "edit-apply", "edit-hex-apply"]) $(id).disabled = on;
  $("edit-catalog").classList.toggle("busy", on);
}

// s の結果を画面に出してよいか
const live = (s) => ctx === s && !s.cancelled;

function buildLayerTabs() {
  const box = $("edit-layers");
  box.replaceChildren();
  ctx.km.layers.forEach((_, n) => {
    const b = document.createElement("button");
    b.textContent = n === 0 ? "L0(基本)" : `L${n}`;
    b.addEventListener("click", () => { ctx.layer = n; ctx.selected = null; render(); });
    box.appendChild(b);
  });
}

function render() {
  const { keys, kw, kh, mid } = layoutInfo(ctx.km);
  const labels = labelsOf(ctx.km, jis());
  [...$("edit-layers").children].forEach((b, n) => b.classList.toggle("active", n === ctx.layer));
  const W = 842, unit = Math.min((W - 40) / kw, 60);
  const H = kh * unit + 40;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.classList.add("editor-svg");
  drawLayer(svg, keys, labels, ctx.layer, (W - kw * unit) / 2, 20, unit, mid, {
    onKey: (k) => { ctx.selected = { row: k.row, col: k.col }; render(); },
    selected: ctx.selected,
  });
  $("edit-board").replaceChildren(svg);

  const sel = ctx.selected;
  const changed = countChanges();
  $("edit-restore").disabled = ctx.writing || changed === 0;
  $("edit-changed").textContent = changed ? `変更前と違うキー: ${changed} 個` : "変更前と同じです";
  if (!sel) {
    $("edit-selected").textContent = "キーを選んでください。";
    $("edit-picker").hidden = true;
    return;
  }
  const code = ctx.km.layers[ctx.layer][sel.row][sel.col];
  const lb = labels[ctx.layer][sel.row][sel.col];
  const now = lb.kind === "trans" ? "下のレイヤーと同じ" : lb.kind === "none" ? "なし" : `${lb.tap}${lb.hold ? " / " + lb.hold : ""}`;
  $("edit-selected").textContent =
    `選んだキー: L${ctx.layer} の 行${sel.row}・列${sel.col} — 今は「${now}」(0x${code.toString(16).toUpperCase().padStart(4, "0")})`;
  $("edit-picker").hidden = false;
}

function countChanges() {
  if (!ctx) return 0;
  let n = 0;
  ctx.km.layers.forEach((layer, l) => layer.forEach((row, r) => row.forEach((c, k) => {
    if (c !== ctx.backup.layers[l][r][k]) n++;
  })));
  return n;
}

function buildCatalog() {
  const { isNew, custom, wide } = info();
  // 古い並びでは「レイヤーへ移る(TO)」を作れない(版で番号が違うため)
  const to = $("edit-kind").querySelector('option[value="to"]');
  to.disabled = !isNew;
  if (!isNew && $("edit-kind").value === "to") $("edit-kind").value = "mo";
  const box = $("edit-catalog");
  box.replaceChildren();
  for (const g of edit.catalog(jis(), isNew, custom, wide)) {
    const det = document.createElement("details");
    const sum = document.createElement("summary");
    sum.textContent = g.name;
    det.appendChild(sum);
    const grid = document.createElement("div");
    grid.className = "keys";
    for (const it of g.items) {
      const b = document.createElement("button");
      b.textContent = it.code === 0x01 ? "▽ 下と同じ" : it.code === 0x00 ? "なし" : it.label.tap || "?";
      b.title = `0x${it.code.toString(16).toUpperCase().padStart(4, "0")}`;
      b.addEventListener("click", () => write(it.code));
      grid.appendChild(b);
    }
    det.appendChild(grid);
    box.appendChild(det);
  }
  // 組み立ての「押したとき」のキーの一覧
  const tap = $("edit-tap");
  tap.replaceChildren();
  for (const c of [...range(0x04, 0x27), 0x28, 0x29, 0x2A, 0x2B, 0x2C, ...range(0x2D, 0x38), 0x87, 0x89,
    0x90, 0x91, 0x8A, 0x8B, 0x4C, 0x52, 0x51, 0x50, 0x4F, ...range(0x3A, 0x45)]) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = keycodes.basic(c, jis(), isNew);
    if (c === 0x2C) o.selected = true;
    tap.appendChild(o);
  }
  const layerSel = $("edit-layer-n");
  layerSel.replaceChildren();
  ctx.km.layers.forEach((_, n) => {
    const o = document.createElement("option");
    o.value = n;
    o.textContent = `L${n}`;
    if (n === 1) o.selected = true;
    layerSel.appendChild(o);
  });
}

function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

// 種類によって、要る欄だけ出す
function updateComposeFields() {
  const kind = $("edit-kind").value;
  const needLayer = ["mo", "tg", "to", "tt", "osl", "df", "lt"].includes(kind);
  const needTap = ["lt", "mt", "mods"].includes(kind);
  const needMods = ["mt", "mods", "osm"].includes(kind);
  $("edit-f-layer").hidden = !needLayer;
  $("edit-f-tap").hidden = !needTap;
  $("edit-f-mods").hidden = !needMods;
}

function applyComposed() {
  if (!ctx) return;
  const { isNew } = info();
  const kind = $("edit-kind").value;
  const layer = Number($("edit-layer-n").value);
  if (layer > edit.maxLayer(isNew, kind)) {
    setStatus(`このキーボードでは、この種類で使えるのは L${edit.maxLayer(isNew, kind)} までです。`, true);
    return;
  }
  let mods = 0;
  for (const [name, bit] of edit.MOD_BITS) if ($(`edit-mod-${name}`).checked) mods |= bit;
  if ($("edit-mod-right").checked) mods |= 0x10;
  if (["mt", "mods", "osm"].includes(kind) && !(mods & 0x0F)) {
    setStatus("Ctrl・Shift・Alt・Win のどれかに印を付けてください。", true);
    return;
  }
  let code;
  try {
    code = edit.compose(kind, { layer, tap: Number($("edit-tap").value), mods }, isNew);
  } catch (e) {
    setStatus(e.message, true);
    return;
  }
  write(code);
}

function applyHex() {
  if (!ctx) return;
  const v = $("edit-hex").value.trim();
  if (!/^(0x)?[0-9a-fA-F]{1,4}$/.test(v)) {
    setStatus("0x0000〜0xFFFF の形で入れてください(例: 0x0004)。", true);
    return;
  }
  write(parseInt(v.replace(/^0x/i, ""), 16));
}

async function write(code) {
  if (!ctx || !ctx.selected || ctx.writing) return;
  const s = ctx; // 書いている間に終わっても、別の変更に結果を入れないため
  const { isNew, custom, wide } = info();
  const bad = edit.problem(code, s.km.layers.length, isNew);
  if (bad) {
    setStatus(bad, true);
    return;
  }
  const warn = edit.warnOf(s.km.name, code, isNew);
  if (warn && !confirm(`これは「${warn}」です。押すと設定が変わり、キーマップを戻しても元に戻りません。置きますか?`)) {
    setStatus("置くのをやめました。");
    return;
  }
  const { row, col } = s.selected;
  const layer = s.layer;
  setBusy(s, true);
  setStatus("書き込んでいます…");
  try {
    await s.conn.setKeycode(layer, row, col, code);
    s.km.layers[layer][row][col] = code;
    s.km.read_at = device.nowIso();
    saveEdited(s);
    const lb = keycodes.label(code, jis(), isNew, custom, wide);
    if (live(s)) {
      setStatus(`L${layer} の 行${row}・列${col} を「${lb.tap || (lb.kind === "trans" ? "下と同じ" : "なし")}${lb.hold ? " / " + lb.hold : ""}」にしました。`);
    }
  } catch (e) {
    if (e.actual !== undefined) {
      // キーボードの中の本当の値に合わせる
      s.km.layers[layer][row][col] = e.actual;
      s.km.read_at = device.nowIso();
      saveEdited(s);
      if (live(s)) setStatus(`思ったとおりに書けませんでした: ${e.message}`, true);
    } else {
      await abort(s, `書き込めませんでした: ${e.message}。`);
    }
  } finally {
    setBusy(s, false);
    if (live(s)) render();
  }
}

// 変更後のキーマップを「2. 保存したキーマップ」に入れる(1 回目は足し、2 回目からは上書き)
function saveEdited(s = ctx) {
  const km = { ...structuredClone(s.km), name: `${s.backup.name}(変更後)` };
  if (s.entryId) hooks.update(s.entryId, km);
  else s.entryId = hooks.addQuiet(km);
}

async function restore() {
  if (!ctx || ctx.writing) return;
  const s = ctx;
  const n = countChanges();
  if (!n) return;
  const isNew = info().isNew;
  // 書き戻すキーの中に、押すと設定が変わるキーがあれば、それも伝える
  const warns = new Set();
  s.km.layers.forEach((layer, l) => layer.forEach((row, r) => row.forEach((c, k) => {
    const want = s.backup.layers[l][r][k];
    const w = c !== want && edit.warnOf(s.km.name, want, isNew);
    if (w) warns.add(w);
  })));
  const extra = warns.size ? `\n\n書き戻すキーの中に「${[...warns].join("」「")}」があります。押すと設定が変わります。` : "";
  if (!confirm(`変更前と違う ${n} 個のキーを、変更前に書き戻しますか?${extra}`)) return;
  setBusy(s, true);
  let done = 0, skipped = 0;
  try {
    for (let l = 0; l < s.km.layers.length; l++) {
      for (let r = 0; r < s.km.layers[l].length; r++) {
        for (let k = 0; k < s.km.layers[l][r].length; k++) {
          const want = s.backup.layers[l][r][k];
          if (s.km.layers[l][r][k] === want) continue;
          // 書き戻しでも、置かせないキーは書かない
          if (edit.problem(want, s.km.layers.length, isNew)) { skipped++; continue; }
          if (s.cancelled) throw new Error("変更が止まりました");
          try {
            await s.conn.setKeycode(l, r, k, want);
          } catch (e) {
            if (e.actual !== undefined) s.km.layers[l][r][k] = e.actual;
            throw e;
          }
          s.km.layers[l][r][k] = want;
          done++;
          if (live(s)) setStatus(`書き戻しています… ${done} / ${n}`);
        }
      }
    }
    s.km.read_at = device.nowIso();
    saveEdited(s);
    if (live(s)) {
      setStatus(`${done} 個のキーを書き戻しました。` +
        (skipped ? `${skipped} 個は置かせないキー(QK_BOOT など)なので、書き戻していません。` : ""), skipped > 0);
    }
  } catch (e) {
    s.km.read_at = device.nowIso();
    if (e.actual !== undefined) {
      saveEdited(s);
      if (live(s)) setStatus(`書き戻しの途中で止まりました(${done} / ${n} 個まで済み): ${e.message}`, true);
    } else {
      await abort(s, `書き戻しの途中で止まりました(${done} / ${n} 個まで済み): ${e.message}。`);
    }
  } finally {
    setBusy(s, false);
    if (live(s)) render();
  }
}

// JIS / US を切り替えたら、表示を作り直す
export function refresh() {
  if (!ctx) return;
  buildCatalog();
  updateComposeFields();
  render();
}
