/* ============================================================
   Les générateurs : un donjon, une grotte ou un extérieur tirés au
   sort, prêts à retoucher. Ils travaillent en cases (colonne, ligne)
   et rendent le terrain plus une liste de tampons à poser :
     { terrain: Uint8Array, tampons: [{ icone, c, r, rot }] }
   ============================================================ */
"use strict";
const Generateurs = (() => {
  const ROCHE = 17, DALLES = 6, PAVES = 7, TERRE = 3, CHEMIN = 4, HERBE = 1,
        HERBE_SECHE = 2, SABLE = 5, EAU = 9, EAU_PROFONDE = 10, MARAIS = 11, NEIGE = 12;

  const voisins8 = (t, cols, rows, c, r, val) => {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = c + dx, y = r + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows || t[y * cols + x] === val) n++;
    }
    return n;
  };

  /* ---------------- Donjon : des salles reliées par des couloirs ---------------- */
  function donjon(cols, rows, o = {}) {
    const al = Tex.rng(o.graine || Date.now()), t = new Uint8Array(cols * rows).fill(ROCHE);
    const sol = o.sol || DALLES, couloir = o.couloir || sol;
    const voulu = o.salles || Math.max(3, Math.round(cols * rows / 70));
    const salles = [];
    for (let essai = 0; essai < 400 && salles.length < voulu; essai++) {
      const w = 3 + Math.floor(al() * 7), h = 3 + Math.floor(al() * 6);
      if (w > cols - 2 || h > rows - 2) continue;
      const x = 1 + Math.floor(al() * (cols - w - 1)), y = 1 + Math.floor(al() * (rows - h - 1));
      if (salles.some(s => x < s.x + s.w + 2 && x + w + 2 > s.x && y < s.y + s.h + 2 && y + h + 2 > s.y)) continue;
      salles.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
    const dansSalle = new Uint8Array(cols * rows);
    for (const s of salles) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
      t[y * cols + x] = sol; dansSalle[y * cols + x] = 1;
    }
    const creuser = (x, y) => { if (t[y * cols + x] === ROCHE) t[y * cols + x] = couloir; };
    const relier = (a, b) => {
      let x = a.cx, y = a.cy;
      const horizFirst = al() < .5;
      const allerX = () => { while (x !== b.cx) { creuser(x, y); x += Math.sign(b.cx - x); } };
      const allerY = () => { while (y !== b.cy) { creuser(x, y); y += Math.sign(b.cy - y); } };
      if (horizFirst) { allerX(); allerY(); } else { allerY(); allerX(); }
      creuser(x, y);
    };
    /* Chaque salle rejoint la plus proche des précédentes, puis deux ou
       trois boucles en plus : on n'est pas obligé de revenir sur ses pas. */
    for (let i = 1; i < salles.length; i++) {
      let best = 0, bd = 1e9;
      for (let j = 0; j < i; j++) {
        const d = Math.abs(salles[i].cx - salles[j].cx) + Math.abs(salles[i].cy - salles[j].cy);
        if (d < bd) { bd = d; best = j; }
      }
      relier(salles[i], salles[best]);
    }
    for (let k = 0; k < Math.min(3, salles.length >> 1); k++) {
      const a = salles[Math.floor(al() * salles.length)], b = salles[Math.floor(al() * salles.length)];
      if (a !== b) relier(a, b);
    }

    const tampons = [];
    const poser = (icone, c, r, rot = 0) => tampons.push({ icone, c, r, rot });
    /* Les portes, là où un couloir entre dans une salle. */
    for (const s of salles) {
      const bord = [];
      for (let x = s.x; x < s.x + s.w; x++) { bord.push([x, s.y - 1, 0]); bord.push([x, s.y + s.h, 0]); }
      for (let y = s.y; y < s.y + s.h; y++) { bord.push([s.x - 1, y, 90]); bord.push([s.x + s.w, y, 90]); }
      for (const [x, y, rot] of bord) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = y * cols + x;
        /* Une porte seulement dans un couloir d'une case de large, pas
           le long d'un couloir qui frôle la salle. */
        const roc = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= cols || yy >= rows || t[yy * cols + xx] === ROCHE; };
        const etroit = rot ? roc(0, -1) && roc(0, 1) : roc(-1, 0) && roc(1, 0);
        if (t[i] !== ROCHE && !dansSalle[i] && etroit && al() < .7) {
          poser("porte", x, y, rot); dansSalle[i] = 2;
        }
      }
    }
    salles.forEach((s, k) => {
      const coin = () => [s.x + (al() < .5 ? 0 : s.w - 1), s.y + (al() < .5 ? 0 : s.h - 1)];
      if (k === 0) poser("escalier", s.x, s.cy, 0);
      else if (k === salles.length - 1) { poser("autel", s.cx, s.y, 0); poser("coffre", s.cx, s.y + 1, 0); }
      else {
        if (al() < .35) poser("coffre", ...coin());
        if (al() < .4) poser(al() < .5 ? "tonneau" : "caisse", ...coin());
        if (al() < .25) poser("os", s.x + Math.floor(al() * s.w), s.y + Math.floor(al() * s.h));
        if (al() < .2) poser("toile", ...coin());
        if (al() < .15) poser("piege", s.cx, s.cy);
      }
      if (al() < .6) { poser("brasero", s.x, s.y); poser("brasero", s.x + s.w - 1, s.y + s.h - 1); }
    });
    return { terrain: t, tampons };
  }

  /* ---------------- Grotte : automate cellulaire ---------------- */
  function grotte(cols, rows, o = {}) {
    const al = Tex.rng(o.graine || Date.now());
    const sol = o.sol || TERRE;
    let t = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      t[r * cols + c] = (c === 0 || r === 0 || c === cols - 1 || r === rows - 1 || al() < .46) ? ROCHE : sol;
    for (let pas = 0; pas < 6; pas++) {
      const n = new Uint8Array(t);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const k = voisins8(t, cols, rows, c, r, ROCHE);
        n[r * cols + c] = (k >= 5 || (pas < 3 && k <= 1)) ? ROCHE : sol;
      }
      t = n;
    }
    /* On garde la plus grande poche : pas de salle inaccessible. */
    const zone = new Int32Array(cols * rows).fill(-1);
    let meilleure = -1, taille = 0, z = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === ROCHE || zone[i] >= 0) continue;
      const pile = [i]; zone[i] = z; let n = 0;
      while (pile.length) {
        const j = pile.pop(); n++;
        const c = j % cols, r = (j / cols) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = c + dx, y = r + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const k = y * cols + x;
          if (t[k] !== ROCHE && zone[k] < 0) { zone[k] = z; pile.push(k); }
        }
      }
      if (n > taille) { taille = n; meilleure = z; }
      z++;
    }
    for (let i = 0; i < t.length; i++) if (t[i] !== ROCHE && zone[i] !== meilleure) t[i] = ROCHE;

    if (o.eau !== false) {
      const n = Tex.fbm((o.graine || 1) + 7, 4, 3);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c; if (t[i] === ROCHE) continue;
        const v = n(c / cols, r / rows);
        if (v > .66) t[i] = EAU_PROFONDE; else if (v > .6) t[i] = EAU;
      }
    }
    const tampons = [];
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c; if (t[i] !== sol) continue;
      const mur = voisins8(t, cols, rows, c, r, ROCHE);
      const x = al();
      if (mur >= 3 && x < .06) tampons.push({ icone: al() < .5 ? "cristal" : "champignons", c, r, rot: al() * 360 });
      else if (mur >= 2 && x < .09) tampons.push({ icone: "rocher", c, r, rot: al() * 360 });
      else if (mur === 0 && x < .012) tampons.push({ icone: "os", c, r, rot: al() * 360 });
    }
    return { terrain: t, tampons };
  }

  /* ---------------- Extérieur : relief, rivières, forêts, chemin ---------------- */
  function exterieur(cols, rows, o = {}) {
    const g = o.graine || Date.now(), al = Tex.rng(g);
    const haut = Tex.fbm(g, 3, 4), humide = Tex.fbm(g + 50, 3, 3), foret = Tex.fbm(g + 90, 4, 3);
    const hiver = o.climat === "neige", desert = o.climat === "desert";
    const t = new Uint8Array(cols * rows);
    /* Les seuils se calent sur la carte tirée, pas sur des valeurs fixes :
       chaque carte a son lac et ses montagnes, en proportions voulues. */
    const alt = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) alt[r * cols + c] = haut(c / cols, r / rows);
    const tri = Float32Array.from(alt).sort(), q = p => tri[Math.min(tri.length - 1, Math.floor(p * tri.length))];
    const sP = q(.08), sE = q(.17), sS = q(.21), sR = q(o.region ? .9 : .93), sT = q(.7), sM = q(.45);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const e = alt[r * cols + c], m = humide(c / cols, r / rows);
      let id;
      if (e < sP) id = EAU_PROFONDE;
      else if (e < sE) id = EAU;
      else if (e < sS) id = hiver ? NEIGE : SABLE;
      else if (e > sR) id = ROCHE;
      else if (desert) id = e > sT ? TERRE : SABLE;
      else if (hiver) id = m > .72 ? 13 : NEIGE;
      else if (m > .62 && e < sM) id = MARAIS;
      else if (m < .4) id = HERBE_SECHE;
      else id = HERBE;
      t[r * cols + c] = id;
    }
    const tampons = [], chemin = [];
    /* Une carte de région (style parchemin) ne peint pas le chemin dans le
       sol : elle rend son tracé, que l'éditeur dessine en route lissée. */
    const region = !!o.region;
    /* Un chemin d'un bord à l'autre ; un pont là où il traverse l'eau. */
    if (o.chemin !== false) {
      let y = Math.floor(rows * (.3 + al() * .4)), pont = null;
      for (let c = 0; c < cols; c++) {
        const i = y * cols + c, eau = t[i] === EAU || t[i] === EAU_PROFONDE;
        if (region) {
          chemin.push([c, y]);
          if (c % 3 === 2 && al() < .5) { y = Math.max(1, Math.min(rows - 2, y + (al() < .5 ? -1 : 1))); chemin.push([c, y]); }
          continue;
        }
        if (eau) { if (!pont) pont = { c, r: y }; }
        else {
          if (pont) { tampons.push({ icone: "pont", c: (pont.c + c - 1) / 2, r: y, rot: 90, l: 1, h: c - pont.c + 1 }); pont = null; }
          if (t[i] !== ROCHE) t[i] = desert ? TERRE : CHEMIN; else t[i] = CHEMIN;
        }
        if (c % 3 === 2 && al() < .5) {
          const ny = Math.max(1, Math.min(rows - 2, y + (al() < .5 ? -1 : 1)));
          const j = ny * cols + c;
          if (t[j] !== EAU && t[j] !== EAU_PROFONDE) { t[j] = desert ? TERRE : CHEMIN; y = ny; }
        }
      }
    }
    if (region) {
      /* Des forêts en masses serrées, quelques villages près du chemin, une
         cité, une entrée de donjon au pied des montagnes, des ruines. */
      const libre = (c, r) => { const id = t[r * cols + c]; return id === HERBE || id === HERBE_SECHE || id === NEIGE || id === SABLE || id === TERRE; };
      /* Le sable seulement en bord d'eau : ailleurs, de l'herbe sèche. */
      const eauPres = (c, r) => {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const x = c + dx, y = r + dy;
          if (x >= 0 && y >= 0 && x < cols && y < rows && (t[y * cols + x] === EAU || t[y * cols + x] === EAU_PROFONDE)) return true;
        }
        return false;
      };
      if (!desert) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        if (t[r * cols + c] === SABLE && !eauPres(c, r)) t[r * cols + c] = HERBE_SECHE;
      /* Les arbres, serrés et décalés au hasard : une masse, pas un damier. */
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const id = t[r * cols + c], f = foret(c / cols, r / rows);
        if ((id === HERBE || id === HERBE_SECHE || id === NEIGE || id === MARAIS) && f > .53) {
          /* Au cœur de la forêt, deux arbres par case. */
          const n = f > .6 ? 2 : al() < .85 ? 1 : 0;
          for (let q = 0; q < n; q++) {
            const taille = .9 + al() * .6;
            tampons.push({ icone: hiver ? "sapiniere" : "touffe", c: c + (al() - .5) * .9, r: r + (al() - .5) * .9, rot: 0, l: taille, h: taille });
          }
        }
      }
      tampons.sort((a, b) => a.r - b.r);
      const pres = chemin.filter(([c, r]) => libre(c, r) && foret(c / cols, r / rows) <= .55);
      for (let n = 0; n < Math.max(2, Math.round(cols / 18)) && pres.length; n++) {
        const [c, r] = pres.splice(Math.floor(al() * pres.length), 1)[0];
        tampons.push({ icone: n === 0 ? "cite" : "village", c, r: Math.max(1, r - 1), rot: 0 });
      }
      const piedMont = [];
      for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++)
        if (libre(c, r) && t[(r - 1) * cols + c] === ROCHE) piedMont.push([c, r]);
      if (piedMont.length) { const [c, r] = piedMont[Math.floor(al() * piedMont.length)]; tampons.push({ icone: "entree_donjon", c, r, rot: 0 }); }
      for (let n = 0; n < 2; n++) {
        const c = 2 + Math.floor(al() * (cols - 4)), r = 2 + Math.floor(al() * (rows - 4));
        if (libre(c, r)) tampons.push({ icone: "ruines", c, r, rot: 0 });
      }
      return { terrain: t, tampons, chemin };
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const id = t[r * cols + c], x = al(), f = foret(c / cols, r / rows);
      if (id === HERBE || id === HERBE_SECHE || id === NEIGE) {
        if (f > .56 && x < .3) tampons.push({ icone: hiver ? "sapin" : ["arbre", "arbre2", "sapin"][Math.floor(al() * 3)], c, r, rot: al() * 360 });
        else if (x < .025) tampons.push({ icone: "buisson", c, r, rot: al() * 360 });
        else if (x < .035 && !hiver) tampons.push({ icone: "fleurs", c, r, rot: al() * 360 });
        else if (x < .042) tampons.push({ icone: "rocher", c, r, rot: al() * 360 });
      } else if (id === MARAIS && x < .06) tampons.push({ icone: x < .03 ? "arbre_mort" : "champignons", c, r, rot: al() * 360 });
      else if (id === SABLE && desert && x < .015) tampons.push({ icone: "rochers", c, r, rot: al() * 360 });
    }
    return { terrain: t, tampons };
  }

  return { donjon, grotte, exterieur };
})();
