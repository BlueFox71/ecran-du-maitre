/* ============================================================
   Le style « parchemin » : la carte peinte façon carte de zone de
   WoW, au lieu des cases du style « bataille ».
     - le sol est peint d'un seul tenant : les frontières entre terrains
       sont déformées par un bruit, elles ondulent au lieu de suivre
       les cases ;
     - les côtes sont tracées à l'encre, l'eau s'éclaircit près du bord ;
     - la roche devient une chaîne de montagnes dessinées ;
     - grain du papier, bords brûlés, cadre doré.
   La peinture coûte cher : elle est calculée une fois dans une image
   cachée, et refaite seulement quand le terrain change. Pendant un
   coup de pinceau, une version grossière suffit (« brouillon »).
   ============================================================ */
"use strict";
const Parchemin = (() => {
  const PAPIER = [224, 203, 160];
  const ENCRE = [58, 40, 24];
  /* Deux tons par terrain : la peinture passe de l'un à l'autre. */
  const COUL = {
    1: [[112, 132, 58], [146, 156, 76]], 2: [[150, 146, 82], [178, 164, 100]],
    3: [[140, 108, 68], [168, 136, 90]], 4: [[206, 184, 132], [222, 202, 152]],
    5: [[212, 188, 132], [230, 210, 158]], 6: [[146, 138, 120], [168, 160, 140]],
    7: [[136, 126, 108], [160, 150, 130]], 8: [[140, 100, 62], [162, 120, 76]],
    11: [[92, 104, 60], [116, 122, 72]], 12: [[226, 226, 218], [246, 244, 236]],
    13: [[186, 214, 220], [214, 232, 236]], 14: [[190, 70, 26], [236, 140, 50]],
    15: [[138, 42, 40], [160, 60, 52]], 16: [[92, 84, 76], [120, 110, 100]],
    17: [[150, 122, 88], [176, 148, 108]], 18: [[140, 84, 62], [160, 104, 78]],
    19: [[34, 26, 22], [52, 40, 32]]
  };
  const EAU = { 9: { bord: [146, 180, 172], fond: [82, 124, 134] }, 10: { bord: [104, 144, 148], fond: [44, 78, 98] } };
  const estEau = id => id === 9 || id === 10;
  const estTerre = id => id !== 0 && !estEau(id);

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const lisse = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

  /* Distance (en pixels) de chaque pixel « dedans » au plus proche pixel
     « dehors » : deux passes de chanfrein, aller puis retour. */
  function distance(dedans, w, h) {
    const d = new Float32Array(w * h), INF = 1e6, D = 1.4142;
    for (let i = 0; i < d.length; i++) d[i] = dedans[i] ? INF : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let v = d[i]; if (!v) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
      }
      d[i] = v;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x; let v = d[i]; if (!v) continue;
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D);
      }
      d[i] = v;
    }
    return d;
  }

  function cle(c, R) {
    let h = 2166136261;
    const t = c.terrain;
    for (let i = 0; i < t.length; i++) { h ^= t[i]; h = Math.imul(h, 16777619); }
    const g = c.grille;
    return [h >>> 0, g.cols, g.rows, g.type, g.taille, R, c.parcheminGraine || 0].join(":");
  }

  /* -------- la peinture du sol, dans une image cachée -------- */
  const caches = [];
  function image(c, brouillon) {
    const g = c.grille, n = g.cols * g.rows;
    const R = brouillon ? 6 : Math.max(8, Math.min(24, Math.floor(Math.sqrt(1.3e6 / n))));
    const k = cle(c, R);
    let e = caches.find(x => x.cle === k);
    if (e) return e;
    e = { cle: k, canvas: peindre(c, R), R };
    caches.unshift(e); caches.length = Math.min(caches.length, 3);
    return e;
  }

  function peindre(c, R) {
    const g = c.grille, S = g.taille, k = R / S;
    const W = Geo.largeur(c), H = Geo.hauteur(c);
    const w = Math.max(1, Math.ceil(W * k)), h = Math.max(1, Math.ceil(H * k)), N = w * h;
    const graine = 7 + (c.parcheminGraine || 0);
    const P = Math.max(3, Math.round(g.cols / 2)), Q = Math.max(3, Math.round(g.rows / 2));
    const Pn = Math.max(P, Q);
    const wx1 = Tex.valeur(graine, Pn), wy1 = Tex.valeur(graine + 1, Pn);
    const wx2 = Tex.valeur(graine + 2, Pn * 3), wy2 = Tex.valeur(graine + 3, Pn * 3);
    const taches = Tex.fbm(graine + 4, Math.max(2, Math.round(Pn / 4)), 3);
    const coup = Tex.valeur(graine + 5, Math.max(8, Math.round(Pn * 4)));
    const grain = Tex.valeur(graine + 6, Math.max(16, Math.round(Math.max(w, h) / 3)));
    const vague = Tex.valeur(graine + 7, Math.max(4, Pn));
    const A = .42 * S;

    /* 1. Quel terrain sous chaque pixel. Les cases carrées feraient des
       escaliers : chaque pixel « vote » pour les terrains des 4 × 4 cases
       voisines, pondérés par leur distance (noyau en cloche), et le plus
       fort l'emporte — les angles s'arrondissent. Le bruit déforme ensuite
       les frontières pour qu'elles ondulent comme à la main. */
    const ids = new Uint8Array(N);
    const hex = Geo.hex(c), votes = new Float32Array(256), vus = new Uint8Array(16);
    const T = c.terrain, cols = g.cols, rows = g.rows;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = (i + .5) / k, y = (j + .5) / k, u = x / W, v = y / H;
      const dx = ((wx1(u, v) - .5) * .7 + (wx2(u, v) - .5) * .3) * 2 * A;
      const dy = ((wy1(u, v) - .5) * .7 + (wy2(u, v) - .5) * .3) * 2 * A;
      if (hex) {
        const p = Geo.cellule(c, x + dx, y + dy);
        ids[j * w + i] = T[Math.max(0, Math.min(rows - 1, p.r)) * cols + Math.max(0, Math.min(cols - 1, p.k))];
        continue;
      }
      const fx = (x + dx) / S - .5, fy = (y + dy) / S - .5, k0 = Math.floor(fx), r0 = Math.floor(fy);
      let n = 0, best = 0, bv = -1;
      for (let dr = -1; dr <= 2; dr++) {
        const rr = Math.max(0, Math.min(rows - 1, r0 + dr)), ey = fy - (r0 + dr), wy = Math.exp(-ey * ey * 1.8);
        for (let dk = -1; dk <= 2; dk++) {
          const kk = Math.max(0, Math.min(cols - 1, k0 + dk)), ex = fx - (k0 + dk);
          const id = T[rr * cols + kk];
          if (votes[id] === 0) vus[n++] = id;
          votes[id] += wy * Math.exp(-ex * ex * 1.8);
        }
      }
      for (let q = 0; q < n; q++) { const id = vus[q]; if (votes[id] > bv) { bv = votes[id]; best = id; } votes[id] = 0; }
      ids[j * w + i] = best;
    }
    /* 2. Les distances à la côte, de part et d'autre. */
    const terre = new Uint8Array(N), eau = new Uint8Array(N);
    let aDeLeau = false;
    for (let i = 0; i < N; i++) { terre[i] = estTerre(ids[i]) ? 1 : 0; eau[i] = estEau(ids[i]) ? 1 : 0; if (eau[i]) aDeLeau = true; }
    const dTerre = distance(terre, w, h);
    const dEau = aDeLeau ? distance(eau, w, h) : null;

    /* 3. Les couleurs. */
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d"), img = cx.createImageData(w, h), d = img.data;
    const bordBrule = S * 2.2;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = j * w + i, id = ids[p];
      const x = (i + .5) / k, y = (j + .5) / k, u = x / W, v = y / H;
      let col;
      if (!id) col = PAPIER;
      else if (estEau(id)) {
        const e = EAU[id], t = lisse(dEau[p] / (R * 2.4));
        col = mix(e.bord, e.fond, t);
        if (dEau[p] < R * .3) col = mix(col, [214, 222, 200], .4 * (1 - dEau[p] / (R * .3)));
        /* Des vaguelettes au large, comme des coups de plume. */
        if (dEau[p] > R * .8) {
          const s = Math.sin((y / S * 1.6 + vague(u, v) * 3 + x / S * .25) * Math.PI * 2);
          if (s > .93) col = mix(col, [176, 200, 196], .35 * lisse((dEau[p] - R * .8) / R));
        }
      } else {
        const pal = COUL[id] || [[128, 128, 128], [150, 150, 150]];
        col = mix(pal[0], pal[1], lisse(taches(u, v) * 1.6 - .3));
        col = mix(col, mix(pal[0], pal[1], coup(u, v)), .35);
        const dc = dTerre[p];
        if (dc <= 1.7) col = mix(col, ENCRE, .85);
        else if (dc < R * .4) col = mix(col, [70, 52, 32], .22 * (1 - dc / (R * .4)));
        /* Entre deux sols : un liseré à peine plus sombre. */
        const voisin = (i < w - 1 && ids[p + 1] !== id && estTerre(ids[p + 1])) || (j < h - 1 && ids[p + w] !== id && estTerre(ids[p + w]));
        if (voisin) col = mix(col, [60, 44, 28], .28);
      }
      /* Le papier : grain fin, taches, bords brûlés. */
      const gr = .9 + grain(u, v) * .14, ta = .93 + taches(u * 1.7 + .3, v * 1.7 + .1) * .1;
      col = mix(col, PAPIER, .1);
      const bb = Math.min(x, W - x, y, H - y);
      const brule = .72 + .28 * lisse(bb / bordBrule);
      const f = gr * ta * brule;
      d[p * 4] = Math.min(255, col[0] * f); d[p * 4 + 1] = Math.min(255, col[1] * f); d[p * 4 + 2] = Math.min(255, col[2] * f); d[p * 4 + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }

  /* -------- un papier fin par-dessus tout, net même de près -------- */
  let papier = null;
  function motifPapier(ctx) {
    if (!papier) {
      const T = 256, c = document.createElement("canvas"); c.width = c.height = T;
      const x = c.getContext("2d"), im = x.createImageData(T, T), d = im.data;
      const n = Tex.fbm(901, 8, 4), f = Tex.valeur(902, 128), fibre = Tex.valeur(903, 32);
      for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
        const u = i / T, v = j / T, p = (j * T + i) * 4;
        const fi = Math.sin((u * 32 + fibre(u, v) * 2) * Math.PI * 2) * .5 + .5;
        const val = 205 + n(u, v) * 40 + f(u, v) * 12 + (fi > .96 ? -14 : 0);
        d[p] = Math.min(255, val + 10); d[p + 1] = Math.min(255, val + 2); d[p + 2] = Math.min(255, val - 18); d[p + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      papier = c;
    }
    return ctx.createPattern(papier, "repeat");
  }

  function dessinerTerrain(ctx, c, pl, z, brouillon) {
    const e = image(c, brouillon);
    const W = Geo.largeur(c), H = Geo.hauteur(c);
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(e.canvas, 0, 0, W, H);
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = .45;
    const m = motifPapier(ctx);
    ctx.fillStyle = m; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    dessinerMontagnes(ctx, c, pl);
  }

  /* -------- la roche devient une chaîne de montagnes -------- */
  function dessinerMontagnes(ctx, c, pl) {
    const g = c.grille, S = g.taille, t = c.terrain;
    const pics = [];
    const marge = 2;
    for (let r = Math.max(0, pl.r0 - marge); r <= Math.min(g.rows - 1, pl.r1 + marge); r++)
      for (let k = Math.max(0, pl.k0 - marge); k <= Math.min(g.cols - 1, pl.k1 + marge); k++) {
        if (t[r * g.cols + k] !== 17) continue;
        const h = Tex.hash(k, r, 77);
        if (h < .18) continue;
        const p = Geo.centre(c, k, r);
        pics.push({ x: p.x + (Tex.hash(k, r, 78) - .5) * S * .5, y: p.y + (Tex.hash(k, r, 79) - .5) * S * .4, s: S * (1.05 + h * .6), g: h });
      }
    pics.sort((a, b) => a.y - b.y);
    for (const p of pics) Icones.montagne(ctx, p.x, p.y, p.s, p.g);
  }

  /* -------- le cadre doré, coins ornés -------- */
  function dessinerCadre(ctx, c) {
    const W = Geo.largeur(c), H = Geo.hauteur(c), S = c.grille.taille;
    const m = Math.max(S * .45, Math.min(W, H) * .018);
    ctx.save();
    ctx.lineJoin = "miter";
    ctx.strokeStyle = "#24170a"; ctx.lineWidth = m; ctx.strokeRect(m / 2, m / 2, W - m, H - m);
    const or = ctx.createLinearGradient(0, 0, W, H);
    or.addColorStop(0, "#f2d47a"); or.addColorStop(.25, "#b07c24"); or.addColorStop(.5, "#ecc964");
    or.addColorStop(.75, "#9a6a1c"); or.addColorStop(1, "#e8c25a");
    ctx.strokeStyle = or; ctx.lineWidth = m * .5; ctx.strokeRect(m / 2, m / 2, W - m, H - m);
    ctx.strokeStyle = "rgba(255,240,190,.7)"; ctx.lineWidth = m * .08; ctx.strokeRect(m * .4, m * .4, W - m * .8, H - m * .8);
    ctx.strokeStyle = "#24170a"; ctx.lineWidth = m * .12; ctx.strokeRect(m * 1.05, m * 1.05, W - m * 2.1, H - m * 2.1);
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [W, H, -1, -1], [0, H, 1, -1]]) {
      ctx.save(); ctx.translate(x + sx * m / 2, y + sy * m / 2); ctx.scale(sx, sy);
      /* Une volute de chaque côté, puis le médaillon du coin. */
      ctx.strokeStyle = or; ctx.lineWidth = m * .22; ctx.lineCap = "round";
      for (const [a, b] of [[1, 0], [0, 1]]) {
        ctx.beginPath(); ctx.moveTo(a * m * .8, b * m * .8);
        ctx.bezierCurveTo(a * m * 3 + b * m * .9, b * m * 3 + a * m * .9, a * m * 3.6 + b * m * -.2, b * m * 3.6 + a * m * -.2, a * m * 2.6 + b * m * .3, b * m * 2.6 + a * m * .3);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, m * 1.15, 0, Math.PI * 2);
      const r = ctx.createRadialGradient(-m * .3, -m * .3, m * .1, 0, 0, m * 1.15);
      r.addColorStop(0, "#fff0b0"); r.addColorStop(.5, "#d8a840"); r.addColorStop(1, "#7a5010");
      ctx.fillStyle = r; ctx.fill(); ctx.lineWidth = m * .14; ctx.strokeStyle = "#24170a"; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -m * .6); ctx.lineTo(m * .6, 0); ctx.lineTo(0, m * .6); ctx.lineTo(-m * .6, 0); ctx.closePath();
      ctx.fillStyle = "#8a1a12"; ctx.fill(); ctx.lineWidth = m * .08; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  return { dessinerTerrain, dessinerCadre, PAPIER, COUL, EAU };
})();
