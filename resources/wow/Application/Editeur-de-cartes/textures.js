/* ============================================================
   Les textures des terrains, fabriquées par le code au démarrage.
   Chaque texture fait 128 × 128 et se raccorde sans couture sur
   ses quatre bords : tous les bruits utilisés ici sont périodiques.
   Pour remplacer une texture par une vraie image, il suffit de
   donner « image: 'Images/cartes/herbe.png' » au terrain : elle
   prend alors la place de la texture fabriquée.
   ============================================================ */
"use strict";
const Tex = (() => {
  const T = 128;

  /* Un tirage au sort reproductible : même graine, même texture. */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const hash = (a, b, s) => {
    let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(s | 0, 2147483647);
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  };

  /* Bruit de valeur périodique : u, v dans [0, 1[ ; la période est le
     nombre de mailles sur la largeur de la texture. */
  function valeur(seed, periode) {
    const r = rng(seed), g = new Float32Array(periode * periode);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (u, v) => {
      const fx = (u - Math.floor(u)) * periode, fy = (v - Math.floor(v)) * periode;
      const x0 = Math.floor(fx) % periode, y0 = Math.floor(fy) % periode;
      const x1 = (x0 + 1) % periode, y1 = (y0 + 1) % periode;
      const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[y0 * periode + x0], b = g[y0 * periode + x1];
      const c = g[y1 * periode + x0], d = g[y1 * periode + x1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  /* Plusieurs octaves superposées : des formes larges et du détail fin. */
  function fbm(seed, base, octaves) {
    const n = [];
    for (let i = 0; i < octaves; i++) n.push(valeur(seed + i * 101, base << i));
    return (u, v) => {
      let s = 0, a = 1, tot = 0;
      for (let i = 0; i < octaves; i++) { s += n[i](u, v) * a; tot += a; a *= .5; }
      return s / tot;
    };
  }
  /* Cellules de Voronoï périodiques : pavés, fissures, croûte de lave.
     Rend d1 (distance au germe le plus proche), d2 (au second) et id. */
  function worley(seed, n) {
    const r = rng(seed), px = new Float32Array(n * n), py = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) { px[i] = r(); py[i] = r(); }
    return (u, v) => {
      const fx = u * n, fy = v * n, cx = Math.floor(fx), cy = Math.floor(fy);
      let d1 = 9, d2 = 9, id = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx, gy = cy + dy;
        const k = ((gy % n + n) % n) * n + ((gx % n + n) % n);
        const ex = gx + px[k] - fx, ey = gy + py[k] - fy, d = Math.sqrt(ex * ex + ey * ey);
        if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
      }
      return { d1: d1 / n, d2: d2 / n, id };
    };
  }

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const frac = x => x - Math.floor(x);

  function peindre(fn) {
    const c = document.createElement("canvas");
    c.width = c.height = T;
    const ctx = c.getContext("2d"), img = ctx.createImageData(T, T), d = img.data;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const col = fn(x / T, y / T), i = (y * T + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ------------------------------------------------------------ */
  const TERRAINS = [
    { id: 1, nom: "Herbe", fn() {
      const n = fbm(11, 4, 4), g = valeur(12, 64), h = valeur(13, 32);
      return (u, v) => {
        let c = mix([58, 98, 36], [112, 148, 58], clamp(n(u, v) * 1.4 - .2));
        const b = g(u, v); if (b > .72) c = shade(c, 1.18); else if (b < .2) c = shade(c, .85);
        if (h(u, v) > .82) c = mix(c, [150, 160, 70], .35);
        return c;
      };
    } },
    { id: 2, nom: "Herbe sèche", fn() {
      const n = fbm(21, 4, 4), g = valeur(22, 64);
      return (u, v) => {
        let c = mix([118, 112, 52], [160, 146, 80], clamp(n(u, v) * 1.4 - .2));
        if (g(u, v) > .75) c = shade(c, 1.15);
        return c;
      };
    } },
    { id: 3, nom: "Terre", fn() {
      const n = fbm(31, 4, 4), w = worley(32, 10), g = valeur(33, 64);
      return (u, v) => {
        let c = mix([84, 60, 38], [134, 100, 66], clamp(n(u, v) * 1.5 - .25));
        const p = w(u, v); if (p.d1 < .012) c = mix(c, [150, 136, 120], .7);
        if (g(u, v) > .8) c = shade(c, 1.1);
        return c;
      };
    } },
    { id: 4, nom: "Chemin", fn() {
      const n = fbm(41, 4, 3), g = valeur(42, 64), w = worley(43, 14);
      return (u, v) => {
        let c = mix([146, 118, 80], [182, 152, 108], clamp(n(u, v) * 1.5 - .25));
        if (g(u, v) < .25) c = shade(c, .9);
        if (w(u, v).d1 < .008) c = mix(c, [110, 100, 90], .6);
        return c;
      };
    } },
    { id: 5, nom: "Sable", fn() {
      const n = fbm(51, 4, 3), g = valeur(52, 64);
      return (u, v) => {
        const r = Math.sin((v * 6 + n(u, v) * 1.2 + u * 2) * Math.PI * 2) * .5 + .5;
        let c = mix([196, 166, 110], [228, 204, 150], clamp(n(u, v) * 1.3 - .15));
        c = shade(c, .94 + r * .1);
        if (g(u, v) > .8) c = shade(c, 1.05);
        return c;
      };
    } },
    { id: 6, nom: "Dalles", fn() {
      const n = fbm(61, 8, 3), g = valeur(62, 64);
      return (u, v) => {
        const row = Math.floor(v * 4), off = (row & 1) * .5;
        const fu = frac(u * 4 + off), fv = frac(v * 4);
        const col = Math.floor(frac(u + off / 4) * 4) % 4;
        const e = Math.min(fu, 1 - fu, fv, 1 - fv);
        const t = hash(row, col, 6);
        let c = mix([98, 94, 88], [138, 132, 122], clamp(t * .6 + n(u, v) * .6 - .1));
        if (g(u, v) > .78) c = shade(c, .9);
        if (e < .03) return [42, 38, 34];
        if (e < .07) c = shade(c, fu < .07 || fv < .07 ? 1.12 : .82);
        return c;
      };
    } },
    { id: 7, nom: "Pavés", fn() {
      const w = worley(71, 6), n = fbm(72, 8, 3);
      return (u, v) => {
        const p = w(u, v), e = p.d2 - p.d1;
        if (e < .012) return [48, 44, 40];
        const t = hash(p.id, 3, 7);
        let c = mix([104, 98, 90], [150, 142, 128], clamp(t * .7 + n(u, v) * .5 - .1));
        return shade(c, .85 + clamp(e * 9) * .25);
      };
    } },
    { id: 8, nom: "Plancher", fn() {
      const n = fbm(81, 4, 3);
      return (u, v) => {
        const row = Math.floor(v * 8), fv = frac(v * 8);
        if (fv < .07) return [40, 26, 16];
        const fin = hash(row, 1, 8);
        if (Math.abs(frac(u - fin) - .5) > .494) return [46, 30, 18];
        const grain = Math.sin((u * 2 + n(u, v) * .5 + row * .37) * Math.PI * 2 * 6) * .5 + .5;
        let c = mix([108, 70, 40], [150, 102, 60], grain * .5 + hash(row, 2, 8) * .5);
        return shade(c, .9 + fv * .12);
      };
    } },
    { id: 9, nom: "Eau", fn() {
      const n = fbm(91, 4, 4), m = fbm(92, 8, 2);
      return (u, v) => {
        const w = Math.sin((u * 3 + v * 2 + n(u, v) * 1.6) * Math.PI * 2 * 2) * .5 + .5;
        let c = mix([34, 86, 132], [66, 132, 176], clamp(n(u, v) * 1.4 - .2));
        if (w > .9 && m(u, v) > .5) c = mix(c, [170, 210, 230], .45);
        return c;
      };
    } },
    { id: 10, nom: "Eau profonde", fn() {
      const n = fbm(101, 4, 4);
      return (u, v) => {
        const w = Math.sin((u * 2 + v * 3 + n(u, v) * 1.5) * Math.PI * 2 * 2) * .5 + .5;
        let c = mix([14, 38, 76], [32, 70, 116], clamp(n(u, v) * 1.4 - .2));
        if (w > .94) c = mix(c, [90, 140, 180], .3);
        return c;
      };
    } },
    { id: 11, nom: "Marais", fn() {
      const n = fbm(111, 4, 4), g = valeur(112, 64);
      return (u, v) => {
        const t = n(u, v);
        if (t > .58) return mix([38, 56, 48], [52, 74, 60], clamp((t - .58) * 5));
        let c = mix([62, 72, 38], [96, 98, 54], clamp(t * 1.6 - .2));
        if (g(u, v) > .78) c = shade(c, 1.2);
        return c;
      };
    } },
    { id: 12, nom: "Neige", fn() {
      const n = fbm(121, 4, 4), g = valeur(122, 64);
      return (u, v) => {
        let c = mix([206, 216, 232], [248, 250, 255], clamp(n(u, v) * 1.4 - .15));
        if (g(u, v) > .85) c = [255, 255, 255];
        return c;
      };
    } },
    { id: 13, nom: "Glace", fn() {
      const n = fbm(131, 4, 3), w = worley(132, 4);
      return (u, v) => {
        let c = mix([150, 196, 222], [214, 236, 248], clamp(n(u, v) * 1.4 - .2));
        const p = w(u, v); if (p.d2 - p.d1 < .006) c = mix(c, [250, 254, 255], .8);
        return c;
      };
    } },
    { id: 14, nom: "Lave", fn() {
      const w = worley(141, 5), n = fbm(142, 8, 3);
      return (u, v) => {
        const p = w(u, v), e = p.d2 - p.d1;
        if (e < .05) {
          const k = 1 - e / .05;
          return mix([200, 60, 10], [255, 214, 90], clamp(k * k + n(u, v) * .3));
        }
        return mix([38, 26, 22], [74, 46, 34], clamp(n(u, v) * 1.4 - .2));
      };
    } },
    { id: 15, nom: "Tapis", fn() {
      const g = valeur(151, 64);
      return (u, v) => {
        const a = Math.abs(frac(u * 4 + v * 4) - .5), b = Math.abs(frac(u * 4 - v * 4) - .5);
        let c = [128, 24, 30];
        if (a < .035 || b < .035) c = [196, 150, 60];
        else if (a < .07 || b < .07) c = [92, 16, 22];
        return shade(c, .9 + g(u, v) * .2);
      };
    } },
    { id: 16, nom: "Cendres", fn() {
      const n = fbm(161, 4, 4), g = valeur(162, 64);
      return (u, v) => {
        let c = mix([46, 44, 44], [92, 88, 86], clamp(n(u, v) * 1.5 - .25));
        if (g(u, v) > .86) c = [140, 60, 30];
        return c;
      };
    } },
    { id: 17, nom: "Roche", solide: true, fn() {
      const w = worley(171, 4), n = fbm(172, 8, 3);
      return (u, v) => {
        const p = w(u, v), e = p.d2 - p.d1;
        let c = mix([62, 58, 54], [104, 98, 92], clamp(n(u, v) * 1.3 - .15 + hash(p.id, 1, 17) * .3));
        if (e < .012) return shade(c, .45);
        return shade(c, .8 + clamp(p.d1 * 4) * .3);
      };
    } },
    { id: 18, nom: "Mur de briques", solide: true, fn() {
      const n = fbm(181, 8, 3);
      return (u, v) => {
        const row = Math.floor(v * 8), off = (row & 1) * .5;
        const fu = frac(u * 4 + off), fv = frac(v * 8);
        if (fv < .1 || fu < .05) return [52, 44, 40];
        const t = hash(row, Math.floor(frac(u + off / 4) * 4), 18);
        return mix([110, 52, 38], [150, 82, 56], clamp(t * .6 + n(u, v) * .5));
      };
    } },
    { id: 19, nom: "Vide (gouffre)", solide: false, fn() {
      const n = fbm(191, 4, 3);
      return (u, v) => mix([4, 4, 8], [20, 18, 26], n(u, v));
    } }
  ];

  const parId = {};
  for (const t of TERRAINS) {
    t.canvas = peindre(t.fn());
    t.apercu = t.canvas.toDataURL();
    parId[t.id] = t;
  }

  /* Un motif par terrain et par contexte de dessin (les motifs ne passent
     pas d'un canvas à l'autre). Si le terrain a une image, elle remplace la
     texture dès qu'elle est chargée. */
  const motifs = new WeakMap();
  let version = 0;
  function motif(ctx, id) {
    let m = motifs.get(ctx);
    if (!m || m.v !== version) { m = { v: version }; motifs.set(ctx, m); }
    if (!m[id]) {
      const t = parId[id];
      if (!t) return "#000";
      m[id] = ctx.createPattern(t.canvas, "repeat");
    }
    return m[id];
  }
  function remplacer(id, image) {
    const t = parId[id]; if (!t) return;
    const c = document.createElement("canvas"); c.width = c.height = T;
    c.getContext("2d").drawImage(image, 0, 0, T, T);
    t.canvas = c; t.apercu = c.toDataURL(); version++;
  }

  return { T, TERRAINS, parId, motif, remplacer, valeur, fbm, rng, hash };
})();
