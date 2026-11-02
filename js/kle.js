// VIA/Vial の定義(KLE の形)から、キーの位置と行列の番号を取り出す。PC 版の kle.py と同じ。

export function corners(k) {
  // 回転後の四隅(KLE の単位、y は下向き)
  const a = (k.r * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  return [[k.x, k.y], [k.x + k.w, k.y], [k.x + k.w, k.y + k.h], [k.x, k.y + k.h]].map(([px, py]) => {
    const dx = px - k.rx, dy = py - k.ry;
    return [k.rx + dx * ca - dy * sa, k.ry + dx * sa + dy * ca];
  });
}

export function center(k) {
  const c = corners(k);
  return [c.reduce((s, p) => s + p[0], 0) / 4, c.reduce((s, p) => s + p[1], 0) / 4];
}

export function optionBits(labels) {
  return labels.map((lab) => (typeof lab === "string" ? 1 : Math.max(1, Math.ceil(Math.log2(lab.length - 1)))));
}

// VIA の layout options の値を、選択肢ごとの番号にする(最初の項目が上位ビット)
export function unpackOptions(labels, value) {
  const out = [];
  for (const b of optionBits(labels).reverse()) {
    out.push(value & ((1 << b) - 1));
    value = Math.floor(value / 2 ** b);
  }
  return out.reverse();
}

export function parse(definition, layoutOptions = 0) {
  const layouts = definition.layouts;
  const labels = layouts.labels || [];
  const chosen = labels.length ? unpackOptions(labels, layoutOptions) : [];

  const found = []; // [key, グループ, 選択肢]
  let r = 0, rx = 0, ry = 0, x = 0, y = 0;
  for (const row of layouts.keymap) {
    let w = 1, h = 1;
    for (const item of row) {
      if (typeof item === "object") {
        if ("r" in item) r = item.r;
        if ("rx" in item) { rx = item.rx; x = rx; y = ry; }
        if ("ry" in item) { ry = item.ry; x = rx; y = ry; }
        x += item.x || 0;
        y += item.y || 0;
        if ("w" in item) w = item.w;
        if ("h" in item) h = item.h;
        continue;
      }
      const parts = item.split("\n");
      let g = null, c = null;
      if (parts.length > 3 && parts[3].trim()) [g, c] = parts[3].split(",").map(Number);
      // 行列の番号が空のキーも、選択肢の位置合わせに使うので残す
      let kr = null, kc = null;
      if (parts[0].trim() && parts[0].includes(",")) [kr, kc] = parts[0].split(",").map(Number);
      found.push([{ row: kr, col: kc, x, y, w, h, r, rx, ry }, g, c]);
      x += w;
      w = 1; h = 1;
    }
    y += 1;
    x = rx;
  }

  // 選択肢ごとの左上(回転前の位置)を先に求め、選んだ選択肢を選択肢 0 の場所へ動かす
  const topLeft = new Map();
  for (const [k, g, c] of found) {
    if (g === null) continue;
    const key = `${g},${c}`;
    const p = topLeft.get(key);
    if (!p) topLeft.set(key, [k.x, k.y]);
    else { p[0] = Math.min(p[0], k.x); p[1] = Math.min(p[1], k.y); }
  }

  const keys = [];
  for (const [k, g, c] of found) {
    if (g !== null) {
      const sel = g < chosen.length ? chosen[g] : 0;
      if (c !== sel) continue;
      if (c !== 0 && topLeft.has(`${g},0`)) {
        const a = topLeft.get(`${g},0`), b = topLeft.get(`${g},${c}`);
        const dx = a[0] - b[0], dy = a[1] - b[1];
        k.x += dx; k.y += dy; k.rx += dx; k.ry += dy;
      }
    }
    if (k.row !== null) keys.push(k);
  }
  return keys;
}
