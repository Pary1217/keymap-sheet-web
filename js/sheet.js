// 読んだキーマップから、チートシートのページ(SVG)を作る。PC 版の sheet.py と同じ描き方。
// ブラウザの「印刷 → PDF に保存」で PDF にする。

import * as keycodes from "./keycodes.js";
import * as kle from "./kle.js";
import { kbWide, newKeycodes } from "./device.js";

const PW = 842, PH = 595; // A4 横(pt)
const MARGIN = 28;
const FONT = "'BIZ UDPGothic', 'Yu Gothic', 'Meiryo', sans-serif";
const FILL = { key: "#FFFFFF", mod: "#FCE7C8", layer: "#CFE3F7", special: "#E6DDF5", trans: "#FFFFFF", none: "#EEEEEE" };
const ACCESS = "#D9480F"; // このレイヤーへ行くキーの枠
const INK = "#222222", GRAY = "#9A9A9A", LINE = "#777777";
const SVGNS = "http://www.w3.org/2000/svg";

const measureCtx = document.createElement("canvas").getContext("2d");
function textWidth(text, size, bold) {
  measureCtx.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
  return measureCtx.measureText(text).width;
}
function fit(text, size, width, bold) {
  while (size > 4 && textWidth(text, size, bold) > width) size -= 0.5;
  return size;
}

function el(name, attrs = {}, parent = null) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
function text(parent, x, y, str, size, color, { bold = false, anchor = "middle" } = {}) {
  const t = el("text", {
    x, y, "font-size": size, fill: color, "text-anchor": anchor,
    "font-weight": bold ? 700 : 400, "font-family": FONT,
  }, parent);
  t.textContent = str;
  return t;
}

export function customNames(km) {
  const cks = km.definition.customKeycodes;
  if (cks && cks.length) return cks.map((c) => c.shortName || c.name || "");
  if (km.name.toLowerCase().includes("keyball")) return keycodes.KEYBALL_KB;
  return null;
}

export function labelsOf(km, jis) {
  const cn = customNames(km);
  const isNew = newKeycodes(km), wide = kbWide(km);
  return km.layers.map((layer) => layer.map((row) => row.map((c) => keycodes.label(c, jis, isNew, cn, wide))));
}

// 中身のあるレイヤーと、そこから行けるレイヤー(KC_NO だけでも入力を止める意味がある)
export function usedLayers(km, keys, labels) {
  const used = new Set([0]);
  for (let n = 1; n < km.layers.length; n++) {
    if (keys.some((k) => !["trans", "none"].includes(labels[n][k.row][k.col].kind))) used.add(n);
  }
  const todo = [...used];
  while (todo.length) {
    const m = todo.pop();
    for (const k of keys) {
      const lb = labels[m][k.row][k.col];
      if (lb.kind === "layer" && lb.layer !== null && lb.layer < km.layers.length && !used.has(lb.layer)) {
        used.add(lb.layer);
        todo.push(lb.layer);
      }
    }
  }
  return [...used].sort((a, b) => a - b);
}

// レイヤー n へ行くキー: [{m: レイヤー, k: キー, lb: 表示}]
export function accessKeys(keys, labels, n) {
  const out = [];
  labels.forEach((layer, m) => {
    if (m === n) return;
    for (const k of keys) {
      const lb = layer[k.row][k.col];
      if (lb.kind === "layer" && lb.layer === n) out.push({ m, k, lb });
    }
  });
  return out;
}

function side(k, mid) {
  return kle.center(k)[0] < mid ? "左" : "右";
}

export function accessText(acc, mid) {
  const parts = acc.map(({ m, k, lb }) => {
    const where = lb.hold ? `${side(k, mid)}の ${lb.tap || "?"} ` : `${side(k, mid)}の「${lb.tap}」`;
    let how = lb.hold ? "を長押し" : `(${keycodes.ACTION_WORDS[lb.action] || ""})`;
    if (lb.hold && lb.action === "tt") how = "を長押し(連打で切替)";
    const src = m === 0 ? "" : `(L${m} で)`;
    return `${where}${how}${src}`;
  });
  return [...new Set(parts)].join(" / ");
}

// 1 レイヤーを描く。onKey があれば、キーを押したときに呼ぶ(変更の画面で使う)
export function drawLayer(svg, keys, labels, n, ox, oy, unit, mid, { onKey = null, selected = null } = {}) {
  const acc = accessKeys(keys, labels, n);
  const accPos = new Map(acc.filter((a) => a.m === 0).map((a) => [`${a.k.row},${a.k.col}`, a.lb.action]));
  const all = keys.flatMap((k) => kle.corners(k));
  const minx = Math.min(...all.map((p) => p[0]));
  const miny = Math.min(...all.map((p) => p[1]));
  const toPx = ([px, py]) => [ox + (px - minx) * unit, oy + (py - miny) * unit];

  for (const k of keys) {
    const lb = labels[n][k.row][k.col];
    const base = labels[0][k.row][k.col];
    let pts = kle.corners(k).map(toPx);
    const cx = pts.reduce((s, p) => s + p[0], 0) / 4;
    const cy = pts.reduce((s, p) => s + p[1], 0) / 4;
    // 少し内側に縮めて、キーの間にすき間を作る
    pts = pts.map(([x, y]) => [cx + (x - cx) * 0.92, cy + (y - cy) * 0.92]);
    const act = accPos.get(`${k.row},${k.col}`);
    // 押したままにするキーだけ、行き先の図で赤枠にする(切替・移るは押した後は離してよい)
    const holdHere = n > 0 && keycodes.HOLD_ACTIONS.includes(act);
    const isSel = selected && selected.row === k.row && selected.col === k.col;
    const g = el("g", {}, svg);
    el("polygon", {
      points: pts.map((p) => p.join(",")).join(" "),
      fill: isSel ? "#FFF3BF" : FILL[lb.kind],
      stroke: isSel ? "#1C7ED6" : holdHere ? ACCESS : LINE,
      "stroke-width": isSel ? 2.6 : holdHere ? 2.2 : 0.6,
    }, g);
    if (onKey) {
      g.style.cursor = "pointer";
      g.addEventListener("click", () => onKey(k));
    }
    const t = el("g", { transform: `translate(${cx},${cy}) rotate(${k.r})` }, g);
    const w = k.w * unit * 0.84;
    if (lb.kind === "trans") {
      // 下のレイヤー(L0)のキーを薄く出す
      if (n > 0 && base.tap) {
        const s = fit(base.tap, unit * 0.26, w, false);
        text(t, 0, s * 0.35, base.tap, s, GRAY);
      }
    } else if (lb.tap) {
      const s = fit(lb.tap, unit * (lb.hold ? 0.27 : 0.30), w, true);
      text(t, 0, s * 0.35 - (lb.hold ? unit * 0.10 : 0), lb.tap, s, INK, { bold: true });
    }
    if (lb.hold) {
      const s = fit(lb.hold, unit * 0.19, w, false);
      text(t, 0, unit * 0.30, lb.hold, s, lb.kind === "layer" ? "#1F5FA8" : "#A15C00");
    }
    if (holdHere) {
      text(t, 0, -unit * 0.27, act === "tt" ? "長押し/連打" : "押したまま", unit * 0.16, ACCESS, { bold: true });
    }
  }
  return acc;
}

export function layoutInfo(km) {
  const keys = kle.parse(km.definition, km.layout_options);
  const all = keys.flatMap((k) => kle.corners(k));
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const kw = Math.max(...xs) - Math.min(...xs);
  const kh = Math.max(...ys) - Math.min(...ys);
  const mid = (Math.max(...xs) + Math.min(...xs)) / 2;
  return { keys, kw, kh, mid };
}

function legend(svg) {
  let x = MARGIN;
  const y = PH - MARGIN + 6;
  const items = [["mod", "修飾キー(長押しで Ctrl など)"], ["layer", "レイヤーキー"], ["special", "特別なキー"],
    ["trans", "灰色の字 = 下のレイヤーと同じ(L0 の字を参考に表示)"]];
  for (const [kind, str] of items) {
    el("rect", { x, y: y - 8, width: 10, height: 8, fill: FILL[kind], stroke: LINE, "stroke-width": 0.6 }, svg);
    text(svg, x + 14, y - 1, str, 8, INK, { anchor: "start" });
    x += 22 + textWidth(str, 8, false);
  }
  el("rect", { x, y: y - 8, width: 10, height: 8, fill: "none", stroke: ACCESS, "stroke-width": 1.6 }, svg);
  text(svg, x + 14, y - 1, "このレイヤーへ行くために押したままにするキー(TT は連打で切替も)", 8, INK, { anchor: "start" });
}

// チートシートのページ(SVG の配列)を作る
export function buildPages(keymaps, jis = true, perPage = 2) {
  const pages = [];
  for (const km of keymaps) {
    const { keys, kw, kh, mid } = layoutInfo(km);
    const labels = labelsOf(km, jis);
    const used = usedLayers(km, keys, labels);
    const slotH = (PH - 2 * MARGIN - 30) / perPage;
    const unit = Math.min((PW - 2 * MARGIN) / kw, (slotH - 30) / kh);

    for (let i = 0; i < used.length; i += perPage) {
      const svg = el("svg", { viewBox: `0 0 ${PW} ${PH}`, class: "page" });
      el("rect", { x: 0, y: 0, width: PW, height: PH, fill: "#FFFFFF" }, svg);
      text(svg, MARGIN, MARGIN + 6, km.name, 15, INK, { bold: true, anchor: "start" });
      text(svg, PW - MARGIN, MARGIN + 6,
        `${jis ? "JIS" : "US"} 配列の表示 / 読み込み ${km.read_at.replace("T", " ")}`, 9, GRAY, { anchor: "end" });
      used.slice(i, i + perPage).forEach((n, j) => {
        const top = MARGIN + 30 + j * slotH;
        const acc = accessKeys(keys, labels, n);
        const title = n === 0 ? "レイヤー 0(基本)" : `レイヤー ${n}`;
        text(svg, MARGIN, top + 14, title, 12, INK, { bold: true, anchor: "start" });
        if (n > 0) {
          const how = accessText(acc, mid) || "(このレイヤーへ行くキーが見つかりません)";
          text(svg, MARGIN + textWidth(title, 12, true) + 12, top + 14, "行き方: " + how, 9.5, ACCESS, { anchor: "start" });
        }
        const ox = MARGIN + (PW - 2 * MARGIN - kw * unit) / 2;
        drawLayer(svg, keys, labels, n, ox, top + 24, unit, mid);
      });
      legend(svg);
      pages.push(svg);
    }
  }
  return pages;
}
