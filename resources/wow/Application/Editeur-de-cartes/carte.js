/* ============================================================
   La carte : ses données, sa géométrie (cases carrées ou hexagones),
   son stockage (Sauvegardes\Cartes\ ou le navigateur) et son rendu.
   Le même rendu sert à l'éditeur du MJ, à la vue des joueurs et à
   l'export PNG : seul le « mode » change ce qui est montré.
   ============================================================ */
"use strict";

/* L'ordre des calques, du fond vers le dessus. Le brouillard couvre tout
   ce qui est en dessous ; les notes du MJ passent par-dessus (MJ seul). */
const CALQUES = [
  { id: "fond", nom: "Images de fond" },
  { id: "terrain", nom: "Terrain" },
  { id: "dessin", nom: "Murs et dessins" },
  { id: "decor", nom: "Décor" },
  { id: "texte", nom: "Textes" },
  { id: "pions", nom: "Pions" },
  { id: "brouillard", nom: "Brouillard" },
  { id: "mj", nom: "Notes du MJ" }
];
const CALQUE_PAR_TYPE = { image: "fond", trait: "dessin", rect: "dessin", ellipse: "dessin",
  tampon: "decor", texte: "texte", pion: "pions", note: "mj" };

const SOMBRE = "#0d0b09";
const POLICE_WOW = '"Friz Quadrata TT","Palatino Linotype","Book Antiqua",Georgia,serif';

/* ------------------------------------------------------------------ */
/* Création, copie, (dé)sérialisation                                  */
/* ------------------------------------------------------------------ */
const Carte = {
  nouvelle(o = {}) {
    const cols = o.cols || 30, rows = o.rows || 20;
    const calques = {};
    for (const c of CALQUES) calques[c.id] = { vis: true, verrou: false, op: 1 };
    return {
      v: 1,
      id: o.id || Carte.nouvelId(o.nom || "carte"),
      nom: o.nom || "Nouvelle carte",
      grille: { type: o.type || "carre", taille: 64, cols, rows, couleur: "#000000", opacite: .28,
                metres: 1.5, unite: "m", visible: true },
      fond: o.fond || "#2a2520",
      style: o.style || "bataille",
      cadre: true,
      terrain: new Uint8Array(cols * rows),
      brouillard: { actif: false, cases: new Uint8Array(cols * rows) },
      objets: [],
      calques,
      ping: null,
      vueJoueurs: null,
      maj: Date.now()
    };
  },
  nouvelId(nom) {
    const base = String(nom).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "carte";
    return base + "-" + Math.random().toString(36).slice(2, 6);
  },
  /* Le terrain et le brouillard voyagent compressés : [valeur, nombre, …]. */
  rle(a) {
    const out = [];
    for (let i = 0; i < a.length;) {
      let j = i; while (j < a.length && a[j] === a[i]) j++;
      out.push(a[i], j - i); i = j;
    }
    return out;
  },
  derle(r, n) {
    const a = new Uint8Array(n); let k = 0;
    if (Array.isArray(r)) for (let i = 0; i < r.length; i += 2) { a.fill(r[i], k, Math.min(n, k + r[i + 1])); k += r[i + 1]; }
    return a;
  },
  versJSON(c) {
    return JSON.stringify(Object.assign({}, c, {
      terrain: Carte.rle(c.terrain),
      brouillard: { actif: c.brouillard.actif, cases: Carte.rle(c.brouillard.cases) }
    }));
  },
  depuisJSON(txt) {
    const d = typeof txt === "string" ? JSON.parse(txt) : txt;
    const base = Carte.nouvelle({ id: d.id, nom: d.nom, cols: d.grille.cols, rows: d.grille.rows });
    const c = Object.assign(base, d);
    c.grille = Object.assign(base.grille, d.grille);
    const n = c.grille.cols * c.grille.rows;
    c.terrain = Carte.derle(d.terrain, n);
    c.brouillard = { actif: !!(d.brouillard && d.brouillard.actif), cases: Carte.derle(d.brouillard && d.brouillard.cases, n) };
    for (const k of CALQUES) c.calques[k.id] = Object.assign({ vis: true, verrou: false, op: 1 }, (d.calques || {})[k.id]);
    c.objets = (d.objets || []).filter(o => o && o.type);
    return c;
  },
  /* Agrandir ou rétrécir sans perdre ce qui reste dans le cadre. */
  redimensionner(c, cols, rows) {
    const g = c.grille, t = new Uint8Array(cols * rows), b = new Uint8Array(cols * rows);
    for (let r = 0; r < Math.min(rows, g.rows); r++) for (let k = 0; k < Math.min(cols, g.cols); k++) {
      t[r * cols + k] = c.terrain[r * g.cols + k];
      b[r * cols + k] = c.brouillard.cases[r * g.cols + k];
    }
    g.cols = cols; g.rows = rows; c.terrain = t; c.brouillard.cases = b;
  }
};

/* ------------------------------------------------------------------ */
/* Géométrie : carrés, hexagones (sommet plat, colonnes impaires        */
/* décalées vers le bas) ou pas de grille (des carrés invisibles).     */
/* ------------------------------------------------------------------ */
const Geo = {
  hex: c => c.grille.type === "hex",
  S: c => c.grille.taille,
  R: c => c.grille.taille / Math.sqrt(3),
  largeur(c) { const g = c.grille; return Geo.hex(c) ? 1.5 * Geo.R(c) * g.cols + .5 * Geo.R(c) : g.cols * g.taille; },
  hauteur(c) { const g = c.grille; return Geo.hex(c) ? g.rows * g.taille + g.taille / 2 : g.rows * g.taille; },
  dedans: (c, k, r) => k >= 0 && r >= 0 && k < c.grille.cols && r < c.grille.rows,
  centre(c, k, r) {
    const S = c.grille.taille;
    if (!Geo.hex(c)) return { x: (k + .5) * S, y: (r + .5) * S };
    const R = Geo.R(c);
    return { x: R + k * 1.5 * R, y: S / 2 + r * S + (Math.round(k) & 1) * S / 2 };
  },
  cellule(c, x, y) {
    const S = c.grille.taille;
    if (!Geo.hex(c)) return { k: Math.floor(x / S), r: Math.floor(y / S) };
    const R = Geo.R(c), px = x - R, py = y - S / 2;
    const q = (2 / 3 * px) / R, ra = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / R, s = -q - ra;
    let rq = Math.round(q), rr = Math.round(ra), rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - ra), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
    return { k: rq, r: rr + (rq - (rq & 1)) / 2 };
  },
  coins(c, k, r) {
    const p = Geo.centre(c, k, r);
    if (!Geo.hex(c)) {
      const h = c.grille.taille / 2;
      return [[p.x - h, p.y - h], [p.x + h, p.y - h], [p.x + h, p.y + h], [p.x - h, p.y + h]];
    }
    const R = Geo.R(c), out = [];
    for (let i = 0; i < 6; i++) out.push([p.x + R * Math.cos(i * Math.PI / 3), p.y + R * Math.sin(i * Math.PI / 3)]);
    return out;
  },
  /* Les voisins, avec pour chacun le côté partagé (indices de coins). */
  voisins(c, k, r) {
    if (!Geo.hex(c)) return [[k + 1, r, 1, 2], [k, r + 1, 2, 3], [k - 1, r, 3, 0], [k, r - 1, 0, 1]];
    const p = Geo.centre(c, k, r), S = c.grille.taille, out = [];
    for (let i = 0; i < 6; i++) {
      const a = (30 + 60 * i) * Math.PI / 180, v = Geo.cellule(c, p.x + Math.cos(a) * S, p.y + Math.sin(a) * S);
      out.push([v.k, v.r, i, (i + 1) % 6]);
    }
    return out;
  },
  /* Les cases (bornées à la carte) qui touchent un rectangle du monde. */
  plage(c, x0, y0, x1, y1) {
    const g = c.grille, S = g.taille;
    let k0, k1, r0, r1;
    if (Geo.hex(c)) {
      const R = Geo.R(c);
      k0 = Math.floor((x0 - 2 * R) / (1.5 * R)); k1 = Math.ceil(x1 / (1.5 * R));
      r0 = Math.floor(y0 / S) - 1; r1 = Math.ceil(y1 / S);
    } else { k0 = Math.floor(x0 / S); k1 = Math.floor(x1 / S); r0 = Math.floor(y0 / S); r1 = Math.floor(y1 / S); }
    return { k0: Math.max(0, k0), k1: Math.min(g.cols - 1, k1), r0: Math.max(0, r0), r1: Math.min(g.rows - 1, r1) };
  },
  /* Distance en cases : la plus grande des deux pour les carrés (une
     diagonale compte une case), la vraie distance pour les hexagones. */
  distance(c, a, b) {
    if (!Geo.hex(c)) return Math.max(Math.abs(a.k - b.k), Math.abs(a.r - b.r));
    const cube = p => { const q = p.k, r = p.r - (p.k - (p.k & 1)) / 2; return [q, r, -q - r]; };
    const A = cube(a), B = cube(b);
    return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2]));
  },
  /* L'aimant : coins et milieux des cases pour les carrés ; centre et
     sommets pour les hexagones ; rien sans grille. */
  aimant(c, x, y, centreSeul) {
    const S = c.grille.taille;
    if (c.grille.type === "aucune") return { x, y };
    const v = Geo.cellule(c, x, y), p = Geo.centre(c, v.k, v.r);
    if (centreSeul) return p;
    if (!Geo.hex(c)) return { x: Math.round(x / (S / 2)) * S / 2, y: Math.round(y / (S / 2)) * S / 2 };
    let best = p, bd = Math.hypot(x - p.x, y - p.y);
    for (const [cx, cy] of Geo.coins(c, v.k, v.r)) {
      const d = Math.hypot(x - cx, y - cy); if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    return best;
  },
  /* Toutes les cases dont le centre est à moins de « rayon » cases. */
  disque(c, x, y, rayon) {
    const v = Geo.cellule(c, x, y), out = [];
    if (rayon <= 1) { if (Geo.dedans(c, v.k, v.r)) out.push(v); return out; }
    const S = c.grille.taille, lim = (rayon - .5) * S, p0 = Geo.centre(c, v.k, v.r);
    const pl = Geo.plage(c, p0.x - lim - S, p0.y - lim - S, p0.x + lim + S, p0.y + lim + S);
    for (let r = pl.r0; r <= pl.r1; r++) for (let k = pl.k0; k <= pl.k1; k++) {
      const p = Geo.centre(c, k, r);
      if (Math.hypot(p.x - p0.x, p.y - p0.y) <= lim + .01) out.push({ k, r });
    }
    return out;
  }
};

/* ------------------------------------------------------------------ */
/* Les images (fonds, portraits des pions) : chargées une fois.        */
/* ------------------------------------------------------------------ */
const Images = (() => {
  const cache = {};
  let surCharge = () => {};
  return {
    get(src) {
      if (!src) return null;
      let e = cache[src];
      if (!e) {
        e = cache[src] = { img: new Image(), ok: false };
        e.img.onload = () => { e.ok = true; surCharge(); };
        e.img.onerror = () => { e.erreur = true; surCharge(); };
        e.img.src = src;
      }
      return e.ok ? e.img : null;
    },
    erreur: src => !!(cache[src] && cache[src].erreur),
    toutes(srcs) {
      return Promise.all(srcs.map(s => new Promise(res => {
        const e = cache[s];
        if (e && (e.ok || e.erreur)) return res();
        Images.get(s); const i = cache[s].img;
        i.addEventListener("load", res, { once: true }); i.addEventListener("error", res, { once: true });
      })));
    },
    quandCharge(fn) { surCharge = fn; }
  };
})();

/* ------------------------------------------------------------------ */
/* Le stockage : Sauvegardes\Cartes\ par le serveur local, sinon le    */
/* navigateur (localStorage).                                          */
/* ------------------------------------------------------------------ */
const Stock = (() => {
  let serveur = false;
  const DOSSIER = "Sauvegardes/Cartes/";
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };
  async function lireFichier(nom) {
    const r = await fetch(DOSSIER + nom + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return null;
    return r.text();
  }
  async function ecrireFichier(nom, txt) {
    const r = await fetch(DOSSIER + nom, { method: "PUT", body: txt, headers: { "Content-Type": "application/json" } });
    if (!r.ok) throw new Error("écriture refusée (" + r.status + ")");
  }
  return {
    get serveur() { return serveur; },
    async sonder() {
      try { const r = await fetch("/__sauvegardes", { cache: "no-store" }); serveur = r.ok; }
      catch (e) { serveur = false; }
      return serveur;
    },
    async index() {
      const txt = serveur ? await lireFichier("index.json").catch(() => null) : ls.get("cartes:index");
      try { return JSON.parse(txt) || []; } catch (e) { return []; }
    },
    async ecrireIndex(liste) {
      const txt = JSON.stringify(liste, null, 1);
      if (serveur) await ecrireFichier("index.json", txt); else ls.set("cartes:index", txt);
    },
    async lire(id) {
      return serveur ? lireFichier(id + ".json").catch(() => null) : ls.get("cartes:" + id);
    },
    async ecrire(id, txt) {
      if (serveur) return ecrireFichier(id + ".json", txt);
      if (!ls.set("cartes:" + id, txt)) throw new Error("le navigateur est plein (images trop lourdes ?)");
    },
    async table() {
      const txt = serveur ? await lireFichier("table.json").catch(() => null) : ls.get("cartes:table");
      try { return JSON.parse(txt); } catch (e) { return null; }
    },
    async ecrireTable(o) {
      const txt = JSON.stringify(o);
      if (serveur) await ecrireFichier("table.json", txt); else ls.set("cartes:table", txt);
    },
    lireBrut: lireFichier,
    /* Une image importée : copiée dans Images\cartes\ quand le serveur est
       là (la carte n'en garde que le chemin), sinon gardée dans la carte. */
    async image(fichier) {
      if (serveur) {
        const ext = (fichier.name.match(/\.(png|jpe?g|webp|gif|bmp)$/i) || [".png"])[0].toLowerCase();
        const base = fichier.name.replace(/\.[^.]+$/, "").toLowerCase().normalize("NFD")
          .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
        const chemin = "Images/cartes/" + base + "-" + Date.now().toString(36) + ext;
        const r = await fetch(chemin, { method: "PUT", body: fichier });
        if (r.ok) return chemin;
      }
      return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(fichier);
      });
    },
    async galeries() {
      if (!serveur) return {};
      try { const r = await fetch("/__images", { cache: "no-store" }); return r.ok ? r.json() : {}; }
      catch (e) { return {}; }
    },
    ls
  };
})();

/* ------------------------------------------------------------------ */
/* Le rendu                                                            */
/* ------------------------------------------------------------------ */
const Rendu = (() => {
  const mesureCtx = document.createElement("canvas").getContext("2d");

  const texteAffiche = o => o.maj ? String(o.txt || "").toUpperCase() : String(o.txt || "");
  function espacement(ctx, o) { if ("letterSpacing" in ctx) ctx.letterSpacing = o.espace ? Math.round(o.taille * o.espace) + "px" : "0px"; }
  function policeTexte(o) { return (o.gras ? "bold " : "") + o.taille + "px " + (o.police === "wow" ? POLICE_WOW : '"Segoe UI",system-ui,sans-serif'); }
  /* La boîte d'un texte dépend de sa police : on la mesure à la demande. */
  function boiteTexte(o) {
    mesureCtx.font = policeTexte(o); espacement(mesureCtx, o);
    const lignes = (texteAffiche(o) || " ").split("\n");
    const w = Math.max(...lignes.map(l => mesureCtx.measureText(l).width), o.taille * .5);
    return { w, h: lignes.length * o.taille * 1.2 };
  }
  /* La boîte (non tournée) de n'importe quel objet, et son centre. */
  function boite(c, o) {
    switch (o.type) {
      case "image": case "rect": case "ellipse": case "tampon": return { x: o.x, y: o.y, w: o.w, h: o.h };
      case "texte": { const b = boiteTexte(o); return { x: o.x, y: o.y, w: b.w, h: b.h }; }
      case "pion": { const r = rayonPion(c, o); return { x: o.x - r, y: o.y - r, w: 2 * r, h: 2 * r }; }
      case "note": { const r = c.grille.taille * .3; return { x: o.x - r, y: o.y - r, w: 2 * r, h: 2 * r }; }
      case "trait": {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < o.pts.length; i += 2) {
          x0 = Math.min(x0, o.pts[i]); x1 = Math.max(x1, o.pts[i]);
          y0 = Math.min(y0, o.pts[i + 1]); y1 = Math.max(y1, o.pts[i + 1]);
        }
        const m = (o.ep || 2) / 2; return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
      }
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const rayonPion = (c, o) => (o.taille || 1) * c.grille.taille * (Geo.hex(c) ? .4 : .44);

  function avecBoite(ctx, o, b, fn) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    if (o.rot) ctx.rotate(o.rot * Math.PI / 180);
    fn(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
  }

  function cheminTrait(ctx, o) {
    const p = o.pts;
    ctx.beginPath();
    if (o.lisse && p.length > 4) {
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length - 2; i += 2) {
        ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
      }
      ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    } else {
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    }
    if (o.ferme) ctx.closePath();
  }

  function dessinerObjet(ctx, c, o, mode, z) {
    const S = c.grille.taille;
    switch (o.type) {
      case "image": {
        const img = Images.get(o.src);
        avecBoite(ctx, o, o, (x, y, w, h) => {
          if (img) ctx.drawImage(img, x, y, w, h);
          else {
            ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.setLineDash([8 / z, 6 / z]); ctx.lineWidth = 1 / z; ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
            ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = 14 / z + "px sans-serif"; ctx.textAlign = "center";
            ctx.fillText(Images.erreur(o.src) ? "image introuvable" : "chargement…", x + w / 2, y + h / 2);
          }
        });
        break;
      }
      case "trait": {
        if (o.pts.length < 4) break;
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        cheminTrait(ctx, o);
        if (o.mur) {
          const ep = o.ep || S * .2;
          ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = ep * 1.9; ctx.stroke();
          ctx.strokeStyle = o.trait || "#14110e"; ctx.lineWidth = ep; ctx.stroke();
          ctx.strokeStyle = Tex.motif(ctx, 17); ctx.lineWidth = ep * .62; ctx.stroke();
          break;
        }
        if (o.ferme && o.rempli) { ctx.fillStyle = o.rempli; ctx.fill(); }
        if (o.ep > 0) {
          if (o.bord) { ctx.strokeStyle = o.bord; ctx.lineWidth = o.ep + Math.max(2, o.ep * .45); ctx.stroke(); }
          if (o.tirets) ctx.setLineDash([o.ep * 3, o.ep * 2]);
          ctx.strokeStyle = o.trait || "#000"; ctx.lineWidth = o.ep; ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case "rect": case "ellipse": {
        avecBoite(ctx, o, o, (x, y, w, h) => {
          ctx.beginPath();
          if (o.type === "rect") ctx.rect(x, y, w, h);
          else ctx.ellipse(0, 0, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
          if (o.rempli) { ctx.fillStyle = o.rempli; ctx.fill(); }
          if (o.ep > 0) {
            if (o.tirets) ctx.setLineDash([o.ep * 3, o.ep * 2]);
            ctx.strokeStyle = o.trait || "#000"; ctx.lineWidth = o.ep; ctx.lineJoin = "round"; ctx.stroke();
            ctx.setLineDash([]);
          }
        });
        break;
      }
      case "tampon": {
        const ic = Icones.parId[o.icone]; if (!ic) break;
        avecBoite(ctx, o, o, (x, y, w, h) => {
          /* L'ombre floue coûte cher : pas pour un décor minuscule à l'écran,
             ni pour les décors « de carte », qui dessinent la leur. */
          if (o.ombre !== false && ic.cat !== "Carte" && Math.min(w, h) * z > 24) {
            ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = Math.min(w, h) * .12 * z * (ctx.dpr || 1);
            ctx.shadowOffsetX = ctx.shadowOffsetY = Math.min(w, h) * .05 * z * (ctx.dpr || 1);
          }
          ctx.scale(w, h); ic.draw(ctx);
        });
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
        break;
      }
      case "texte": {
        const b = boiteTexte(o);
        avecBoite(ctx, o, { x: o.x, y: o.y, w: b.w, h: b.h }, (x, y) => {
          ctx.font = policeTexte(o); ctx.textBaseline = "top"; ctx.textAlign = "left"; espacement(ctx, o);
          let remplissage = o.couleur || "#fff";
          if (o.dore) {
            const g = ctx.createLinearGradient(0, y, 0, y + o.taille * 1.1);
            g.addColorStop(0, "#fff4c0"); g.addColorStop(.45, "#f2c84a"); g.addColorStop(.55, "#d89a24"); g.addColorStop(1, "#9a6410");
            remplissage = g;
          }
          texteAffiche(o).split("\n").forEach((l, i) => {
            const ly = y + i * o.taille * 1.2 + o.taille * .1;
            if (o.contour !== false) {
              ctx.lineJoin = "round"; ctx.lineWidth = o.taille * .18; ctx.strokeStyle = o.couleurContour || "rgba(0,0,0,.85)";
              ctx.strokeText(l, x, ly);
            }
            ctx.fillStyle = remplissage; ctx.fillText(l, x, ly);
          });
          espacement(ctx, {});
        });
        break;
      }
      case "pion": dessinerPion(ctx, c, o, mode, z); break;
      case "note": {
        const r = S * .3;
        ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
        ctx.fillStyle = o.couleur || "#ffd76a"; ctx.fill();
        ctx.lineWidth = r * .18; ctx.strokeStyle = "#3a2a00"; ctx.stroke();
        ctx.fillStyle = "#3a2a00"; ctx.font = "bold " + r * 1.2 + "px Georgia,serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("✎", o.x, o.y + r * .05);
        if (o.titre) etiquette(ctx, o.titre, o.x, o.y + r * 1.25, Math.max(r * .8, 11 / z), "#ffd76a");
        break;
      }
    }
  }

  function etiquette(ctx, txt, x, y, taille, couleur) {
    ctx.font = "600 " + taille + "px \"Segoe UI\",system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const w = ctx.measureText(txt).width + taille * .7, h = taille * 1.35;
    ctx.fillStyle = "rgba(10,8,6,.78)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y, w, h, h / 2); else ctx.rect(x - w / 2, y, w, h);
    ctx.fill();
    ctx.fillStyle = couleur || "#f3ece2"; ctx.fillText(txt, x, y + taille * .17);
  }

  function initiales(nom) {
    const m = String(nom || "?").trim().split(/\s+/).filter(Boolean);
    if (!m.length) return "?";
    const n = m[m.length - 1];
    return (m.length > 1 && /^\d+$/.test(n)) ? (m[0][0] + n).toUpperCase().slice(0, 3) : (m[0][0] + (m[1] ? m[1][0] : (m[0][1] || ""))).toUpperCase();
  }

  function dessinerPion(ctx, c, o, mode, z) {
    const r = rayonPion(c, o), x = o.x, y = o.y;
    const mort = o.pvMax > 0 && o.pv <= 0;
    ctx.save();
    if (o.cache && mode === "mj") ctx.globalAlpha *= .5;
    if (mort) ctx.globalAlpha *= .65;
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = r * .35 * z * (ctx.dpr || 1); ctx.shadowOffsetY = r * .08 * z * (ctx.dpr || 1);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = o.fond || "#2a2420"; ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const img = o.img && Images.get(o.img);
    if (img) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * .93, 0, Math.PI * 2); ctx.clip();
      const k = Math.max(2 * r / img.width, 2 * r / img.height);
      ctx.drawImage(img, x - img.width * k / 2, y - img.height * k / 2, img.width * k, img.height * k);
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
      g.addColorStop(0, o.couleur || "#3a7ad0"); g.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.beginPath(); ctx.arc(x, y, r * .93, 0, Math.PI * 2); ctx.fillStyle = o.couleur || "#3a7ad0"; ctx.fill();
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold " + r * .72 + "px \"Segoe UI\",system-ui,sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(initiales(o.nom), x, y + r * .04);
    }
    ctx.beginPath(); ctx.arc(x, y, r * .95, 0, Math.PI * 2);
    ctx.lineWidth = r * .13; ctx.strokeStyle = o.couleur || "#3a7ad0";
    if (o.cache && mode === "mj") ctx.setLineDash([r * .3, r * .2]);
    ctx.stroke(); ctx.setLineDash([]);
    if (mort) {
      ctx.strokeStyle = "#d02020"; ctx.lineWidth = r * .16; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - r * .55, y - r * .55); ctx.lineTo(x + r * .55, y + r * .55);
      ctx.moveTo(x + r * .55, y - r * .55); ctx.lineTo(x - r * .55, y + r * .55); ctx.stroke();
    }
    /* Les points de vie : toujours pour le MJ, pour les joueurs si coché. */
    if (o.pvMax > 0 && (mode === "mj" || o.pvVisibles)) {
      const w = r * 1.8, h = Math.max(r * .16, 3 / z), bx = x - w / 2, by = y - r - h * 1.8;
      const t = Math.max(0, Math.min(1, o.pv / o.pvMax));
      ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(bx - h * .2, by - h * .2, w + h * .4, h * 1.4);
      ctx.fillStyle = t > .5 ? "#3cc04a" : t > .25 ? "#e0b030" : "#d83030"; ctx.fillRect(bx, by, w * t, h);
    }
    ctx.restore();
    const ts = Math.max(r * .36, 10 / z);
    let ly = y + r * 1.04;
    if (o.etiquette !== false && o.nom) { etiquette(ctx, o.nom, x, ly, ts); ly += ts * 1.45; }
    if (o.etat) etiquette(ctx, o.etat, x, ly, ts * .85, "#ff9a7a");
    if (o.cache && mode === "mj") {
      ctx.font = r * .5 + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("👁", x + r * .8, y - r * .8);
    }
  }

  /* -------- le terrain : une forme par type de sol, remplie d'un motif -------- */
  function dessinerTerrain(ctx, c, pl, z) {
    const g = c.grille, t = c.terrain, chemins = {};
    for (let r = pl.r0; r <= pl.r1; r++) for (let k = pl.k0; k <= pl.k1; k++) {
      const id = t[r * g.cols + k]; if (!id) continue;
      const p = chemins[id] || (chemins[id] = new Path2D());
      if (Geo.hex(c)) {
        const cs = Geo.coins(c, k, r); p.moveTo(cs[0][0], cs[0][1]);
        for (let i = 1; i < 6; i++) p.lineTo(cs[i][0], cs[i][1]); p.closePath();
      } else p.rect(k * g.taille, r * g.taille, g.taille, g.taille);
    }
    ctx.lineWidth = 1.5 / z;
    for (const id in chemins) {
      const m = Tex.motif(ctx, +id);
      ctx.fillStyle = m; ctx.strokeStyle = m;
      ctx.fill(chemins[id]); ctx.stroke(chemins[id]);
    }
    /* Le bord des terrains « solides » (roche, briques) : un trait sombre
       et une ombre portée sur le sol, comme un mur vu de dessus. */
    const bord = new Path2D();
    let rien = true;
    for (let r = pl.r0; r <= pl.r1; r++) for (let k = pl.k0; k <= pl.k1; k++) {
      const id = t[r * g.cols + k], tt = Tex.parId[id];
      if (!tt || !tt.solide) continue;
      for (const [vk, vr, a, b] of Geo.voisins(c, k, r)) {
        if (!Geo.dedans(c, vk, vr)) continue;
        const vid = t[vr * g.cols + vk], vt = Tex.parId[vid];
        if (!vid || (vt && vt.solide)) continue;
        const cs = Geo.coins(c, k, r);
        bord.moveTo(cs[a][0], cs[a][1]); bord.lineTo(cs[b][0], cs[b][1]); rien = false;
      }
    }
    if (!rien) {
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0,0,0,.32)"; ctx.lineWidth = g.taille * .32; ctx.stroke(bord);
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = g.taille * .16; ctx.stroke(bord);
      ctx.strokeStyle = "#16120f"; ctx.lineWidth = g.taille * .07; ctx.stroke(bord);
    }
  }

  function dessinerGrille(ctx, c, pl, z) {
    const g = c.grille;
    if (g.type === "aucune" || !g.visible || g.opacite <= 0) return;
    const p = new Path2D(), S = g.taille;
    if (Geo.hex(c)) {
      for (let r = pl.r0; r <= pl.r1; r++) for (let k = pl.k0; k <= pl.k1; k++) {
        const cs = Geo.coins(c, k, r);
        p.moveTo(cs[0][0], cs[0][1]); for (let i = 1; i < 6; i++) p.lineTo(cs[i][0], cs[i][1]); p.closePath();
      }
    } else {
      for (let k = pl.k0; k <= pl.k1 + 1; k++) { p.moveTo(k * S, pl.r0 * S); p.lineTo(k * S, (pl.r1 + 1) * S); }
      for (let r = pl.r0; r <= pl.r1 + 1; r++) { p.moveTo(pl.k0 * S, r * S); p.lineTo((pl.k1 + 1) * S, r * S); }
    }
    ctx.globalAlpha = g.opacite; ctx.strokeStyle = g.couleur; ctx.lineWidth = Math.max(1 / z, S * .015);
    ctx.stroke(p); ctx.globalAlpha = 1;
  }

  function cheminCases(c, pl, test) {
    const g = c.grille, p = new Path2D(); let n = 0;
    for (let r = pl.r0; r <= pl.r1; r++) for (let k = pl.k0; k <= pl.k1; k++) {
      if (!test(r * g.cols + k)) continue;
      n++;
      if (Geo.hex(c)) {
        const cs = Geo.coins(c, k, r);
        p.moveTo(cs[0][0], cs[0][1]); for (let i = 1; i < 6; i++) p.lineTo(cs[i][0], cs[i][1]); p.closePath();
      } else p.rect(k * g.taille, r * g.taille, g.taille, g.taille);
    }
    return n ? p : null;
  }

  function dessinerBrouillard(ctx, c, pl, mode, z) {
    if (!c.brouillard.actif) return;
    const b = c.brouillard.cases;
    const p = cheminCases(c, pl, i => b[i]);
    if (!p) return;
    if (mode === "mj") {
      ctx.fillStyle = "rgba(8,10,24,.55)"; ctx.fill(p);
      ctx.strokeStyle = "rgba(120,140,255,.35)"; ctx.lineWidth = 1.5 / z; ctx.stroke(p);
      return;
    }
    /* Côté joueurs : opaque, avec un bord adouci qui déborde un peu sur la
       zone découverte (l'ombre portée est floutée, la forme reste nette). */
    ctx.lineWidth = 2 / z; ctx.fillStyle = ctx.strokeStyle = "#050507";
    ctx.fill(p); ctx.stroke(p);
    const d = ctx.dpr || 1, loin = 100000;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,1)"; ctx.shadowBlur = c.grille.taille * .45 * z * d;
    ctx.shadowOffsetX = loin * z * d;
    ctx.translate(-loin, 0);
    ctx.fill(p);
    ctx.restore();
  }

  /* Dessine la carte entière. opts : { mode, cam:{x,y,z}, w, h, dpr, exporter } */
  function dessiner(ctx, c, opts) {
    const { cam, w, h } = opts, d = opts.dpr || 1, z = cam.z, mode = opts.mode || "mj";
    ctx.dpr = d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = opts.exporter ? c.fond : SOMBRE; ctx.fillRect(0, 0, w, h);
    ctx.setTransform(d * z, 0, 0, d * z, -cam.x * z * d, -cam.y * z * d);
    const W = Geo.largeur(c), H = Geo.hauteur(c);
    const x0 = cam.x, y0 = cam.y, x1 = cam.x + w / z, y1 = cam.y + h / z;
    const pl = Geo.plage(c, x0, y0, x1, y1);

    if (!opts.exporter) { ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 30 * d; }
    const parchemin = c.style === "parchemin";
    ctx.fillStyle = parchemin ? "rgb(" + Parchemin.PAPIER + ")" : c.fond; ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;

    /* Côté joueurs, rien ne dépasse du cadre : un arbre posé au bord ne
       doit pas trahir ce que cache le brouillard. */
    const cadre = mode !== "mj";
    if (cadre) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); }
    const visible = id => c.calques[id].vis && !(mode !== "mj" && id === "mj");
    for (const cal of CALQUES) {
      if (!visible(cal.id)) continue;
      ctx.globalAlpha = c.calques[cal.id].op;
      if (cal.id === "terrain") {
        if (parchemin) Parchemin.dessinerTerrain(ctx, c, pl, z, opts.brouillon);
        else dessinerTerrain(ctx, c, pl, z);
        ctx.globalAlpha = 1;
        dessinerGrille(ctx, c, pl, z);
        continue;
      }
      if (cal.id === "brouillard") {
        ctx.globalAlpha = 1; dessinerBrouillard(ctx, c, pl, mode, z);
        if (parchemin && c.cadre !== false) Parchemin.dessinerCadre(ctx, c);
        continue;
      }
      const base = ctx.globalAlpha;
      for (const o of c.objets) {
        if (o.calque !== cal.id) continue;
        if (o.cache && mode !== "mj") continue;
        const b = boite(c, o), m = Math.max(b.w, b.h);
        if (b.x - m > x1 || b.y - m > y1 || b.x + b.w + m < x0 || b.y + b.h + m < y0) continue;
        ctx.globalAlpha = base * (o.op == null ? 1 : o.op);
        dessinerObjet(ctx, c, o, mode, z);
      }
    }
    ctx.globalAlpha = 1;
    if (cadre) ctx.restore();
  }

  return { dessiner, dessinerObjet, boite, boiteTexte, rayonPion, avecBoite, etiquette, initiales, cheminCases };
})();
