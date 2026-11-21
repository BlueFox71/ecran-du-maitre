/* ============================================================
   L'éditeur : outils, panneaux, historique, sauvegarde, vue des
   joueurs. Une seule page pour les deux usages :
     - Editeur-de-cartes.html            le MJ prépare et mène ;
     - Editeur-de-cartes.html?vue=joueur  les joueurs regardent la
       carte que le MJ a « montrée », mise à jour en direct.
   Une tablette ou un téléphone ouvre toujours la vue des joueurs
   (ajouter ?vue=mj pour forcer l'éditeur).
   ============================================================ */
"use strict";
(() => {
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const tactile = matchMedia("(hover:none) and (pointer:coarse)").matches;
  const JOUEUR = params.get("vue") === "joueur" || (tactile && params.get("vue") !== "mj");
  if (JOUEUR) document.body.classList.add("joueur");

  const cv = $("#cv"), ctx = cv.getContext("2d"), scene = $("#scene"), panneauEl = $("#panneau");
  const bulle = $("#bulle"), aideEl = $("#aideOutil");
  let carte = Carte.nouvelle();
  let cam = { x: 0, y: 0, z: 1 }, W = 1, H = 1, DPR = 1;
  let selection = [];
  let geste = null, survol = null, mesureFixe = null, pings = [];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Les réglages des outils, retenus d'une séance à l'autre. */
  const etat = Object.assign({
    outil: "select", terrain: 6, pinceau: 1, formePinceau: "rond",
    tampon: "arbre", tamponEchelle: 1, tamponRotAlea: true, tamponTrainee: true,
    pion: { type: "ennemi", nom: "Gobelin", taille: 1 },
    dessin: { trait: "#1a1410", ep: 4, rempli: false, rempliCouleur: "#6a5a48", tirets: false },
    mur: { ep: 0 },
    texte: { taille: 32, couleur: "#f3ece2", police: "wow", gras: false },
    brouillard: { mode: "reveler", forme: "pinceau", taille: 2 },
    mesure: { forme: "ligne" },
    aimant: true, fermees: {}
  }, (() => { try { return JSON.parse(Stock.ls.get("cartes:etat")) || {}; } catch (e) { return {}; } })());
  const garderEtat = () => Stock.ls.set("cartes:etat", JSON.stringify(etat));
  if (JOUEUR) etat.outil = "main";

  /* Les tracés tout faits ; les épaisseurs suivent la taille des cases. */
  const TRACES = {
    route: { nom: "Route", trait: "#e2cd96", style: S => ({ trait: "#e2cd96", bord: "#5a3e1e", bordCouleur: "#5a3e1e", ep: Math.round(S * .16), tirets: false, lisse: true, rempli: false, route: true }) },
    riviere: { nom: "Rivière", trait: "#7aa6aa", style: S => ({ trait: "#7aa6aa", bord: "#3a4a4c", bordCouleur: "#3a4a4c", ep: Math.round(S * .26), tirets: false, lisse: true, rempli: false }) },
    frontiere: { nom: "Frontière", trait: "#8a1a12", style: S => ({ trait: "#8a1a12", bord: "", ep: Math.max(2, Math.round(S * .06)), tirets: true, lisse: true, rempli: false }) },
    encre: { nom: "Encre", trait: "#2a1a0a", style: () => ({ trait: "#2a1a0a", bord: "", ep: 3, tirets: false, lisse: false, rempli: false }) }
  };
  const STYLES_TEXTE = {
    titre: { nom: "Titre de zone", style: S => ({ police: "wow", dore: true, maj: true, espace: .08, contour: true, couleurContour: "#2a1606", gras: false, taille: Math.round(S * 1.4) }) },
    lieu: { nom: "Lieu", style: S => ({ police: "wow", dore: false, maj: true, espace: .04, contour: true, couleur: "#f6e7bf", couleurContour: "#3a2610", gras: false, taille: Math.round(S * .55) }) },
    normal: { nom: "Normal", style: () => ({ police: "sans", dore: false, maj: false, espace: 0, contour: true, couleur: "#f3ece2", couleurContour: "", gras: false, taille: 32 }) }
  };
  const TYPES_PION = {
    pj: { nom: "Joueur", couleur: "#3a7ad0" }, pnj: { nom: "PNJ", couleur: "#d8b030" },
    ennemi: { nom: "Ennemi", couleur: "#c8302a" }, boss: { nom: "Boss", couleur: "#9a40d0" },
    neutre: { nom: "Neutre", couleur: "#7a7a72" }
  };

  /* ================================================================ */
  /* Affichage                                                         */
  /* ================================================================ */
  let demande = false;
  function redessiner() { if (!demande) { demande = true; requestAnimationFrame(image); } }
  Images.quandCharge(redessiner);

  function taille() {
    const r = scene.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); DPR = window.devicePixelRatio || 1;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    redessiner();
  }
  new ResizeObserver(taille).observe(scene);

  const versMonde = (sx, sy) => ({ x: cam.x + sx / cam.z, y: cam.y + sy / cam.z });
  const versEcran = (x, y) => ({ x: (x - cam.x) * cam.z, y: (y - cam.y) * cam.z });

  function ajuster() {
    const w = Geo.largeur(carte), h = Geo.hauteur(carte);
    cam.z = Math.min(W / w, H / h) * .92;
    cam.x = w / 2 - W / (2 * cam.z); cam.y = h / 2 - H / (2 * cam.z);
    majZoom(); redessiner();
  }
  function zoomer(f, sx = W / 2, sy = H / 2) {
    const p = versMonde(sx, sy);
    cam.z = Math.max(.03, Math.min(8, cam.z * f));
    cam.x = p.x - sx / cam.z; cam.y = p.y - sy / cam.z;
    majZoom(); redessiner();
  }
  function majZoom() { $("#zoom").textContent = Math.round(cam.z * 100) + " %"; }

  function image() {
    demande = false;
    const brouillon = !!(geste && geste.type === "peindre");
    Rendu.dessiner(ctx, carte, { mode: JOUEUR ? "joueur" : "mj", cam, w: W, h: H, dpr: DPR, brouillon });
    surcouches();
    if (pings.length) redessiner();
  }

  /* -------- ce qui se dessine par-dessus la carte : sélection, aperçus -------- */
  function surcouches() {
    const z = cam.z, S = carte.grille.taille;
    ctx.save();
    if (!JOUEUR) {
      for (const o of objetsSel()) {
        const pts = coinsBoite(o);
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
        ctx.lineWidth = 1.5 / z; ctx.strokeStyle = "#ffd76a"; ctx.setLineDash([6 / z, 4 / z]); ctx.stroke(); ctx.setLineDash([]);
      }
      const p = poigneesSel();
      if (p) {
        for (const h of p.coins) carre(h[0], h[1], 5 / z);
        if (p.rot) {
          ctx.beginPath(); ctx.moveTo(p.haut[0], p.haut[1]); ctx.lineTo(p.rot[0], p.rot[1]);
          ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 1.2 / z; ctx.stroke();
          ctx.beginPath(); ctx.arc(p.rot[0], p.rot[1], 5 / z, 0, Math.PI * 2); ctx.fillStyle = "#ffd76a"; ctx.fill();
        }
      }
    }
    /* Pinceau : les cases qui seront touchées. */
    const o = OUTILS[etat.outil];
    if (survol && o && o.curseurCases && !(geste && geste.type === "cadreBrouillard")) {
      const n = o.curseurCases();
      const cases = Geo.disque(carte, survol.x, survol.y, n);
      ctx.beginPath();
      for (const v of cases) { const cs = Geo.coins(carte, v.k, v.r); cs.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
      ctx.fillStyle = "rgba(255,215,106,.12)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,215,106,.8)"; ctx.lineWidth = 1.5 / z; ctx.stroke();
    }
    if (geste && geste.apercu) geste.apercu();
    const m = (geste && geste.type === "mesure") ? geste : mesureFixe;
    if (m) dessinerMesure(m);
    /* Les signaux : des ondes qui s'élargissent. */
    const t = performance.now();
    pings = pings.filter(p => t - p.t0 < 2600);
    for (const p of pings) {
      for (let i = 0; i < 3; i++) {
        const k = ((t - p.t0) / 1300 - i * .3); if (k < 0 || k > 1) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, S * (.3 + k * 2.2), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,215,106,${1 - k})`; ctx.lineWidth = 4 / z; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, S * .18, 0, Math.PI * 2); ctx.fillStyle = "#ffd76a"; ctx.fill();
    }
    ctx.restore();
    function carre(x, y, r) { ctx.fillStyle = "#1a1410"; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 1.5 / z; ctx.strokeRect(x - r, y - r, 2 * r, 2 * r); }
  }

  function mesurer(a, b) {
    const g = carte.grille;
    if (g.type === "aucune") {
      const c = Math.hypot(b.x - a.x, b.y - a.y) / g.taille;
      return { cases: c, txt: (c * g.metres).toFixed(1).replace(".0", "") + " " + g.unite };
    }
    const n = Geo.distance(carte, Geo.cellule(carte, a.x, a.y), Geo.cellule(carte, b.x, b.y));
    return { cases: n, txt: n + (n > 1 ? " cases" : " case") + " · " + +(n * g.metres).toFixed(1) + " " + g.unite };
  }
  function dessinerMesure(m) {
    const z = cam.z, a = m.a, b = m.b, r = Math.hypot(b.x - a.x, b.y - a.y);
    if (etat.mesure.forme === "cercle") {
      const n = mesurer(a, b).cases;
      const cases = Geo.disque(carte, a.x, a.y, n + 1);
      ctx.beginPath();
      for (const v of cases) { const cs = Geo.coins(carte, v.k, v.r); cs.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
      ctx.fillStyle = "rgba(255,120,60,.22)"; ctx.fill();
      ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,160,90,.9)"; ctx.lineWidth = 2 / z; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 6 / z; ctx.stroke();
    ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 2.5 / z; ctx.setLineDash([10 / z, 6 / z]); ctx.stroke(); ctx.setLineDash([]);
    for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 5 / z, 0, Math.PI * 2); ctx.fillStyle = "#ffd76a"; ctx.fill(); }
    Rendu.etiquette(ctx, mesurer(a, b).txt, b.x, b.y + 10 / z, 14 / z, "#ffd76a");
  }

  function montrerBulle(txt, sx, sy) {
    if (!txt) { bulle.style.display = "none"; return; }
    bulle.textContent = txt; bulle.style.display = "block";
    bulle.style.left = Math.min(W - 160, sx + 16) + "px"; bulle.style.top = (sy + 18) + "px";
  }
  let tToast = null;
  function toast(txt) {
    const t = $("#toast"); t.textContent = txt; t.classList.add("vu");
    clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove("vu"), 2600);
  }

  /* ================================================================ */
  /* Objets et sélection                                               */
  /* ================================================================ */
  const nouvelIdObjet = () => "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const parId = id => carte.objets.find(o => o.id === id);
  const objetsSel = () => selection.map(parId).filter(Boolean);
  const BOITES = ["image", "rect", "ellipse", "tampon", "texte"];

  function ajouter(o) {
    o.id = nouvelIdObjet();
    o.calque = o.calque || CALQUE_PAR_TYPE[o.type];
    carte.objets.push(o);
    return o;
  }
  function selectionner(ids) { selection = ids; panneau(); redessiner(); }

  function coinsBoite(o) {
    const b = Rendu.boite(carte, o), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const a = BOITES.includes(o.type) ? (o.rot || 0) * Math.PI / 180 : 0, c = Math.cos(a), s = Math.sin(a);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const lx = sx * b.w / 2, ly = sy * b.h / 2;
      return [cx + lx * c - ly * s, cy + lx * s + ly * c];
    });
  }
  function poigneesSel() {
    if (selection.length !== 1) return null;
    const o = parId(selection[0]);
    if (!o || !BOITES.includes(o.type) || carte.calques[o.calque].verrou) return null;
    const pts = coinsBoite(o), z = cam.z;
    const hx = (pts[0][0] + pts[1][0]) / 2, hy = (pts[0][1] + pts[1][1]) / 2;
    const a = (o.rot || 0) * Math.PI / 180;
    return { o, coins: pts, haut: [hx, hy], rot: [hx + Math.sin(a) * 26 / z, hy - Math.cos(a) * 26 / z] };
  }

  function distSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
    let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  }
  function dansPoly(px, py, p) {
    let dedans = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      if ((p[i + 1] > py) !== (p[j + 1] > py) && px < (p[j] - p[i]) * (py - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) dedans = !dedans;
    }
    return dedans;
  }
  function touche(o, p) {
    const tol = 5 / cam.z, b = Rendu.boite(carte, o);
    if (o.type === "pion" || o.type === "note") return Math.hypot(p.x - b.x - b.w / 2, p.y - b.y - b.h / 2) <= b.w / 2 + tol;
    if (o.type === "trait") {
      if (o.ferme && o.rempli && dansPoly(p.x, p.y, o.pts)) return true;
      const ep = (o.mur ? (o.ep || carte.grille.taille * .2) : o.ep || 2) / 2 + tol;
      const n = o.pts.length;
      for (let i = 0; i + 3 < n; i += 2) if (distSegment(p.x, p.y, o.pts[i], o.pts[i + 1], o.pts[i + 2], o.pts[i + 3]) <= ep) return true;
      if (o.ferme && n >= 6 && distSegment(p.x, p.y, o.pts[n - 2], o.pts[n - 1], o.pts[0], o.pts[1]) <= ep) return true;
      return false;
    }
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, a = -(o.rot || 0) * Math.PI / 180;
    const dx = p.x - cx, dy = p.y - cy, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (o.type === "ellipse") return (lx / (b.w / 2 + tol)) ** 2 + (ly / (b.h / 2 + tol)) ** 2 <= 1;
    return Math.abs(lx) <= b.w / 2 + tol && Math.abs(ly) <= b.h / 2 + tol;
  }
  const selectionnable = o => { const c = carte.calques[o.calque]; return c && c.vis && !c.verrou; };
  function objetSous(p) {
    for (let i = CALQUES.length - 1; i >= 0; i--) {
      const id = CALQUES[i].id;
      for (let j = carte.objets.length - 1; j >= 0; j--) {
        const o = carte.objets[j];
        if (o.calque === id && selectionnable(o) && touche(o, p)) return o;
      }
    }
    return null;
  }

  /* ================================================================ */
  /* Historique et sauvegarde                                          */
  /* ================================================================ */
  const hist = { pile: [], i: -1 };
  function valider() {
    const s = Carte.versJSON(carte);
    if (hist.pile[hist.i] === s) return;
    hist.pile.splice(hist.i + 1); hist.pile.push(s);
    if (hist.pile.length > 120) hist.pile.shift();
    hist.i = hist.pile.length - 1;
    programmerSauvegarde();
  }
  function restaurer(s) {
    const ping = carte.ping, vue = carte.vueJoueurs;
    carte = Carte.depuisJSON(s); carte.ping = ping; carte.vueJoueurs = vue;
    selection = selection.filter(parId);
    $("#nomCarte").value = carte.nom;
    panneau(); redessiner(); programmerSauvegarde();
  }
  function annuler() { if (geste) return annulerGeste(); if (hist.i > 0) { hist.i--; restaurer(hist.pile[hist.i]); toast("Annulé"); } }
  function refaire() { if (hist.i < hist.pile.length - 1) { hist.i++; restaurer(hist.pile[hist.i]); toast("Rétabli"); } }

  let tSauve = null, enCours = false, encore = false, etatSauve = "ok";
  function programmerSauvegarde() { if (JOUEUR) return; clearTimeout(tSauve); etatSauve = "attente"; statut(); tSauve = setTimeout(sauver, 500); }
  async function sauver() {
    if (enCours) { encore = true; return; }
    enCours = true;
    try {
      carte.maj = Date.now();
      await Stock.ecrire(carte.id, Carte.versJSON(carte));
      await majIndex();
      Stock.ls.set("cartes:derniere", carte.id);
      etatSauve = "ok";
    } catch (e) { etatSauve = "erreur"; toast("Sauvegarde impossible : " + e.message); }
    enCours = false; statut();
    if (encore) { encore = false; sauver(); }
  }
  let indexCache = null;
  async function majIndex() {
    if (!indexCache) indexCache = await Stock.index();
    const e = indexCache.find(x => x.id === carte.id);
    const info = { id: carte.id, nom: carte.nom, maj: carte.maj, grille: carte.grille.type, cols: carte.grille.cols, rows: carte.grille.rows };
    if (e && e.nom === info.nom && Date.now() - (e.maj || 0) < 60000) return;
    if (e) Object.assign(e, info); else indexCache.unshift(info);
    await Stock.ecrireIndex(indexCache);
  }
  function statut() {
    const el = $("#statut");
    const lieu = Stock.serveur ? "Sauvegardes\\ ✔" : "navigateur seul";
    if (JOUEUR) { el.textContent = Stock.serveur ? "en direct" : "hors ligne"; el.className = Stock.serveur ? "ok" : "err"; return; }
    el.textContent = lieu + (etatSauve === "attente" ? " · …" : etatSauve === "erreur" ? " · erreur" : " · enregistré");
    el.className = etatSauve === "erreur" ? "err" : Stock.serveur ? "ok" : "";
    el.title = Stock.serveur ? "Les cartes vont dans Application\\Sauvegardes\\Cartes\\" :
      "Pas de serveur : les cartes restent dans ce navigateur. Lance l'Écran du Maître pour les écrire sur le disque.";
  }

  async function chargerCarte(id) {
    const txt = await Stock.lire(id);
    if (!txt) { toast("Carte introuvable"); return false; }
    ouvrirCarte(Carte.depuisJSON(txt));
    return true;
  }
  function ouvrirCarte(c) {
    carte = c; selection = []; geste = null; mesureFixe = null;
    hist.pile = [Carte.versJSON(carte)]; hist.i = 0;
    $("#nomCarte").value = carte.nom;
    Stock.ls.set("cartes:derniere", carte.id);
    const u = new URL(location.href); u.searchParams.set("carte", carte.id); history.replaceState(null, "", u);
    ajuster(); panneau(); majTable();
  }

  /* ================================================================ */
  /* Aimant                                                            */
  /* ================================================================ */
  let altBas = false;
  const aimantActif = e => etat.aimant && !(e && e.altKey) && !altBas;
  const aimanter = (p, e) => aimantActif(e) ? Geo.aimant(carte, p.x, p.y) : p;
  /* Pour un objet de « l × h » cases : sur un centre de case si la taille
     est impaire, sur un coin si elle est paire (un pion de 2 couvre 4 cases). */
  function aimanterTaille(p, l, h, e) {
    if (!aimantActif(e) || carte.grille.type === "aucune") return p;
    if (Geo.hex(carte)) return Geo.aimant(carte, p.x, p.y, true);
    const S = carte.grille.taille;
    const f = (v, n) => (Math.round(n) % 2 ? Math.floor(v / S) + .5 : Math.round(v / S)) * S;
    return { x: f(p.x, l), y: f(p.y, h) };
  }

  /* ================================================================ */
  /* Les outils                                                        */
  /* ================================================================ */
  const svg = s => `<svg viewBox="0 0 24 24">${s.startsWith("<") ? s : `<path d="${s}"/>`}</svg>`;
  function cellulesPinceau(p, n, forme) {
    if (forme === "carre" && !Geo.hex(carte)) {
      const v = Geo.cellule(carte, p.x, p.y), out = [], a = Math.floor((n - 1) / 2), b = Math.ceil((n - 1) / 2);
      for (let r = v.r - a; r <= v.r + b; r++) for (let k = v.k - a; k <= v.k + b; k++) if (Geo.dedans(carte, k, r)) out.push({ k, r });
      return out;
    }
    return Geo.disque(carte, p.x, p.y, n);
  }
  /* Peindre le long du geste, pas seulement aux points reçus : un geste
     rapide ne laisse pas de trous. */
  function trainee(a, b, fn) {
    const pas = carte.grille.taille / 3, d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / pas));
    for (let i = 1; i <= n; i++) fn({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n });
  }
  function peindreCases(p, val, n, forme, tableau) {
    let change = false;
    for (const v of cellulesPinceau(p, n, forme)) {
      const i = v.r * carte.grille.cols + v.k;
      if (tableau[i] !== val) { tableau[i] = val; change = true; }
    }
    return change;
  }
  function styleDessin() {
    const d = etat.dessin;
    return { trait: d.trait, ep: d.ep, rempli: d.rempli ? d.rempliCouleur : "", rempliCouleur: d.rempliCouleur, tirets: d.tirets, bord: d.bord || "", lisse: !!d.lisse };
  }

  const outilPinceau = (gomme) => ({
    curseurCases: () => gomme ? etat.pinceau : etat.pinceau,
    down(p) {
      const val = gomme ? 0 : etat.terrain;
      geste = { type: "peindre", dernier: p, val };
      if (peindreCases(p, val, etat.pinceau, etat.formePinceau, carte.terrain)) redessiner();
    },
    move(p) {
      if (!geste) return;
      trainee(geste.dernier, p, q => peindreCases(q, geste.val, etat.pinceau, etat.formePinceau, carte.terrain));
      geste.dernier = p; redessiner();
    },
    up() { geste = null; valider(); redessiner(); }
  });

  const outilPoly = (genre) => ({
    down(p, e) {
      const q = aimanter(p, e);
      if (!geste || geste.type !== "poly") {
        geste = { type: "poly", pts: [q.x, q.y], curseur: q, apercu: apercuPoly };
        aideOutil(); return;
      }
      const pts = geste.pts, n = pts.length;
      if (e.double) return finirPoly(false);
      if (n >= 6 && Math.hypot(q.x - pts[0], q.y - pts[1]) < 10 / cam.z) return finirPoly(true);
      if (q.x !== pts[n - 2] || q.y !== pts[n - 1]) pts.push(q.x, q.y);
      redessiner();
    },
    move(p, e) {
      if (!geste || geste.type !== "poly") return;
      geste.curseur = aimanter(p, e);
      const n = geste.pts.length, a = { x: geste.pts[n - 2], y: geste.pts[n - 1] };
      const l = Math.hypot(geste.curseur.x - a.x, geste.curseur.y - a.y) / carte.grille.taille;
      montrerBulle(+(l * carte.grille.metres).toFixed(1) + " " + carte.grille.unite, ...Object.values(versEcran(geste.curseur.x, geste.curseur.y)));
      redessiner();
    },
    up() {},
    genre
  });
  function apercuPoly() {
    const g = geste, z = cam.z, pts = g.pts.concat([g.curseur.x, g.curseur.y]);
    const o = Object.assign({ type: "trait", pts, ferme: etat.outil === "polygone" }, etat.outil === "mur"
      ? { mur: true, ep: etat.mur.ep || carte.grille.taille * .2 } : styleDessin());
    if (!o.ep) o.ep = 1.5 / z;
    ctx.globalAlpha = .75;
    dessinerApercu(o);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(g.pts[0], g.pts[1], 6 / z, 0, Math.PI * 2); ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 2 / z; ctx.stroke();
  }
  /* Un aperçu se dessine avec le vrai rendu, par-dessus la carte. */
  function dessinerApercu(o) {
    ctx.save(); Rendu.dessinerObjet(ctx, carte, o, "mj", cam.z); ctx.restore();
  }
  function finirPoly(ferme) {
    const g = geste; if (!g || g.type !== "poly") return;
    const pts = g.pts.slice();
    const n = pts.length;
    if (n >= 4 && pts[n - 1] === pts[n - 3] && pts[n - 2] === pts[n - 4]) pts.splice(n - 2);
    geste = null; montrerBulle(null);
    const outil = etat.outil, min = outil === "polygone" ? 6 : 4;
    if (pts.length >= min) {
      const o = outil === "mur"
        ? { type: "trait", pts, mur: true, ep: etat.mur.ep || carte.grille.taille * .2, ferme }
        : Object.assign({ type: "trait", pts, ferme: ferme || outil === "polygone" }, styleDessin());
      if (outil === "ligne" && !ferme) o.rempli = "";
      if (outil !== "ligne") o.lisse = false;
      ajouter(o); valider();
    }
    aideOutil(); redessiner();
  }

  const outilBoite = (type) => ({
    down(p, e) { const a = aimanter(p, e); geste = { type: "boite", a, b: a, apercu: () => dessinerApercu(boiteDe(type, geste.a, geste.b)) }; },
    move(p, e) {
      if (!geste) return;
      let b = aimanter(p, e);
      if (e.shiftKey) { const d = Math.max(Math.abs(b.x - geste.a.x), Math.abs(b.y - geste.a.y)); b = { x: geste.a.x + Math.sign(b.x - geste.a.x || 1) * d, y: geste.a.y + Math.sign(b.y - geste.a.y || 1) * d }; }
      geste.b = b;
      const S = carte.grille.taille;
      montrerBulle(Math.abs(b.x - geste.a.x) / S + " × " + Math.abs(b.y - geste.a.y) / S + " cases", ...Object.values(versEcran(b.x, b.y)));
      redessiner();
    },
    up() {
      const g = geste; geste = null; montrerBulle(null);
      if (!g) return;
      const o = boiteDe(type, g.a, g.b);
      if (o.w * cam.z > 4 && o.h * cam.z > 4) { ajouter(o); selectionner([o.id]); valider(); }
      redessiner();
    }
  });
  function boiteDe(type, a, b) {
    return Object.assign({ type, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), rot: 0 }, styleDessin());
  }

  function placerTampon(p, e) {
    const ic = Icones.parId[etat.tampon]; if (!ic) return null;
    const S = carte.grille.taille, k = etat.tamponEchelle;
    const l = ic.l * k, h = ic.h * k, q = aimanterTaille(p, l, h, e);
    let rot = etat.tamponRot || 0;
    if (etat.tamponRotAlea && ic.cat === "Nature") rot = Math.round(Math.random() * 360);
    return ajouter({ type: "tampon", icone: ic.id, x: q.x - l * S / 2, y: q.y - h * S / 2, w: l * S, h: h * S, rot });
  }

  function nomPion(base, type) {
    if (type === "pj") return base;
    const re = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?: (\\d+))?$");
    let max = 0;
    for (const o of carte.objets) if (o.type === "pion") { const m = re.exec(o.nom || ""); if (m) max = Math.max(max, +(m[1] || 1)); }
    return base + " " + (max + 1);
  }

  function appliquerBrouillardRect(a, b, val) {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const pl = Geo.plage(carte, x0, y0, x1, y1);
    for (let r = pl.r0; r <= pl.r1; r++) for (let k = pl.k0; k <= pl.k1; k++) {
      const c = Geo.centre(carte, k, r);
      if (c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) carte.brouillard.cases[r * carte.grille.cols + k] = val;
    }
  }

  const OUTILS = {
    select: { nom: "Sélection", touche: "V", ic: "M5 3l14 8-6 2-2 6z",
      aide: "Clic : choisir · glisser : déplacer · Maj : ajouter · glisser dans le vide : cadre · Suppr : effacer · Alt : sans aimant",
      down(p, e) {
        const h = poigneesSel(), tol = 9 / cam.z;
        if (h) {
          if (h.rot && Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) < tol) { geste = { type: "rot", o: h.o }; return; }
          const i = h.coins.findIndex(c => Math.hypot(p.x - c[0], p.y - c[1]) < tol);
          if (i >= 0) {
            const o = h.o, b = Rendu.boite(carte, o);
            geste = { type: "redim", o, i, oppose: h.coins[(i + 2) % 4], w0: b.w, h0: b.h, t0: o.taille };
            return;
          }
        }
        const o = objetSous(p);
        if (o) {
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            selection = selection.includes(o.id) ? selection.filter(x => x !== o.id) : selection.concat(o.id);
          } else if (!selection.includes(o.id)) selection = [o.id];
          panneau();
          if (e.double && (o.type === "texte" || o.type === "note")) { focusChamp(o.type === "texte" ? "txt" : "texte"); return; }
          const origines = {};
          for (const s of objetsSel()) origines[s.id] = s.pts ? { pts: s.pts.slice() } : { x: s.x, y: s.y };
          geste = { type: "deplacer", depart: p, origines, ancre: ancreDe(o), o, bouge: false };
        } else {
          if (!(e.shiftKey || e.ctrlKey)) selection = [];
          panneau();
          geste = { type: "cadre", a: p, b: p, apercu() {
            const g = geste; ctx.fillStyle = "rgba(255,215,106,.08)"; ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 1 / cam.z;
            ctx.setLineDash([5 / cam.z, 4 / cam.z]);
            ctx.fillRect(g.a.x, g.a.y, g.b.x - g.a.x, g.b.y - g.a.y); ctx.strokeRect(g.a.x, g.a.y, g.b.x - g.a.x, g.b.y - g.a.y);
            ctx.setLineDash([]);
          } };
        }
        redessiner();
      },
      move(p, e) {
        const g = geste; if (!g) return;
        if (g.type === "deplacer") {
          let dx = p.x - g.depart.x, dy = p.y - g.depart.y;
          if (!g.bouge && Math.hypot(dx, dy) * cam.z < 3) return;
          g.bouge = true;
          const a = g.ancre, n = a.snap({ x: a.x + dx, y: a.y + dy }, e);
          dx = n.x - a.x; dy = n.y - a.y;
          for (const s of objetsSel()) {
            const og = g.origines[s.id]; if (!og) continue;
            if (og.pts) s.pts = og.pts.map((v, i) => v + (i % 2 ? dy : dx));
            else { s.x = og.x + dx; s.y = og.y + dy; }
          }
          if (g.o.type === "pion") {
            const m = mesurer({ x: a.x, y: a.y }, { x: a.x + dx, y: a.y + dy });
            const sp = versEcran(a.x + dx, a.y + dy); montrerBulle(m.txt, sp.x, sp.y);
          }
          redessiner();
        } else if (g.type === "cadre") { g.b = p; redessiner(); }
        else if (g.type === "rot") {
          const b = Rendu.boite(carte, g.o), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
          let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
          if (e.shiftKey || aimantActif(e)) a = Math.round(a / 15) * 15;
          g.o.rot = ((a % 360) + 360) % 360;
          montrerBulle(Math.round(g.o.rot) + "°", ...Object.values(versEcran(p.x, p.y)));
          redessiner();
        } else if (g.type === "redim") redimensionner(g, p, e);
      },
      up() {
        const g = geste; geste = null; montrerBulle(null);
        if (!g) return;
        if (g.type === "deplacer" && g.bouge) valider();
        if (g.type === "cadre") {
          const x0 = Math.min(g.a.x, g.b.x), x1 = Math.max(g.a.x, g.b.x), y0 = Math.min(g.a.y, g.b.y), y1 = Math.max(g.a.y, g.b.y);
          if ((x1 - x0) * cam.z > 4 || (y1 - y0) * cam.z > 4) {
            for (const o of carte.objets) {
              if (!selectionnable(o) || selection.includes(o.id)) continue;
              const b = Rendu.boite(carte, o), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
              if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) selection.push(o.id);
            }
          }
          panneau();
        }
        if (g.type === "rot" || g.type === "redim") { valider(); panneau(); }
        redessiner();
      }
    },
    main: { nom: "Déplacer la vue", touche: "H", ic: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
      aide: "Glisser pour déplacer la vue · molette pour zoomer · Espace maintenu marche avec tous les outils" },
    sep1: "sep",
    pinceau: Object.assign(outilPinceau(false), { nom: "Pinceau de terrain", touche: "B",
      ic: "M3 21c4 0 6-2 6-5l10-10-3-3-10 10c-3 0-3 4-3 8z",
      aide: "Peindre le sol case par case · [ et ] : taille du pinceau" }),
    remplir: { nom: "Remplir", touche: "G", ic: "M5 11l7-7 7 7-7 7z M19 15c0 2 2 3 2 5a2 2 0 0 1-4 0c0-2 2-3 2-5",
      aide: "Clic : remplir toute la zone du même sol",
      down(p) {
        const v = Geo.cellule(carte, p.x, p.y); if (!Geo.dedans(carte, v.k, v.r)) return;
        const cols = carte.grille.cols, t = carte.terrain, de = t[v.r * cols + v.k], vers = etat.terrain;
        if (de === vers) return;
        const pile = [v]; t[v.r * cols + v.k] = vers;
        while (pile.length) {
          const c = pile.pop();
          for (const [k, r] of Geo.voisins(carte, c.k, c.r)) {
            if (!Geo.dedans(carte, k, r) || t[r * cols + k] !== de) continue;
            t[r * cols + k] = vers; pile.push({ k, r });
          }
        }
        valider(); redessiner();
      } },
    gomme: Object.assign(outilPinceau(true), { nom: "Gomme de terrain", touche: "E",
      ic: "M4 16l9-9 6 6-7 7H7z M13 20h7", aide: "Effacer le sol (les objets s'effacent avec la sélection + Suppr)" }),
    sep2: "sep",
    mur: Object.assign(outilPoly("mur"), { nom: "Mur", touche: "W", ic: "M3 6h18v12H3z M3 12h18 M9 6v6 M15 12v6",
      aide: "Clic : point suivant · double-clic ou Entrée : finir · clic sur le 1er point : fermer · Échap : annuler" }),
    ligne: Object.assign(outilPoly("ligne"), { nom: "Ligne", touche: "L", ic: "M4 20L20 4",
      aide: "Clic : point suivant · double-clic ou Entrée : finir · Retour arrière : enlever le dernier point" }),
    polygone: Object.assign(outilPoly("polygone"), { nom: "Polygone", touche: "P", ic: "M12 3l9 7-4 10H7L3 10z",
      aide: "Clic : point suivant · double-clic, Entrée ou clic sur le 1er point : fermer" }),
    libre: { nom: "Main levée", touche: "F", ic: "M3 17c3-6 5 2 8-4s5-6 10-2", aide: "Dessiner à main levée",
      down(p) { geste = { type: "libre", pts: [p.x, p.y], apercu: () => dessinerApercu(Object.assign({ type: "trait", pts: geste.pts, lisse: true }, styleDessin(), { rempli: "" })) }; },
      move(p) {
        if (!geste) return;
        const n = geste.pts.length;
        if (Math.hypot(p.x - geste.pts[n - 2], p.y - geste.pts[n - 1]) * cam.z > 3) { geste.pts.push(p.x, p.y); redessiner(); }
      },
      up() {
        const g = geste; geste = null; if (!g || g.pts.length < 4) return;
        ajouter(Object.assign({ type: "trait", pts: g.pts, lisse: true }, styleDessin(), { rempli: "" })); valider(); redessiner();
      } },
    rect: Object.assign(outilBoite("rect"), { nom: "Rectangle", touche: "R", ic: "M4 6h16v12H4z", aide: "Glisser · Maj : carré" }),
    ellipse: Object.assign(outilBoite("ellipse"), { nom: "Ellipse", touche: "O", ic: '<ellipse cx="12" cy="12" rx="9" ry="7"/>', aide: "Glisser · Maj : cercle" }),
    texte: { nom: "Texte", touche: "T", ic: "M5 5h14 M12 5v14 M9 19h6", aide: "Clic : poser un texte, puis l'écrire dans le panneau",
      down(p, e) {
        const q = aimanter(p, e), t = etat.texte;
        const o = ajouter({ type: "texte", x: q.x, y: q.y, txt: "Texte", taille: t.taille, couleur: t.couleur, police: t.police, gras: t.gras, rot: 0,
          dore: !!t.dore, maj: !!t.maj, espace: t.espace || 0, couleurContour: t.couleurContour || "" });
        valider(); choisirOutil("select"); selectionner([o.id]); focusChamp("txt");
      } },
    sep3: "sep",
    tampon: { nom: "Décor", touche: "I", ic: "M12 3a6 6 0 0 1 6 6 5 5 0 0 1-6 7 5 5 0 0 1-6-7 6 6 0 0 1 6-6z M12 16v5",
      aide: "Clic : poser le décor choisi · glisser : en semer plusieurs (forêt…) · Alt : sans aimant",
      down(p, e) { const o = placerTampon(p, e); if (o) { geste = { type: "tampon", dernier: p }; redessiner(); } },
      move(p, e) {
        if (!geste || !etat.tamponTrainee) return;
        const ic = Icones.parId[etat.tampon], d = Math.max(ic.l, ic.h) * etat.tamponEchelle * carte.grille.taille * .85;
        if (Math.hypot(p.x - geste.dernier.x, p.y - geste.dernier.y) >= d) {
          const j = d * .25, q = { x: p.x + (Math.random() - .5) * j, y: p.y + (Math.random() - .5) * j };
          placerTampon(q, e); geste.dernier = p; redessiner();
        }
      },
      up() { if (geste) { geste = null; valider(); } } },
    pion: { nom: "Pion", touche: "K", ic: '<circle cx="12" cy="9" r="4"/><path d="M5 21c0-4 3-6 7-6s7 2 7 6"/>',
      aide: "Clic : poser un pion (numéroté tout seul) · déplace-le ensuite avec la sélection",
      down(p, e) {
        const pr = etat.pion, t = TYPES_PION[pr.type] || TYPES_PION.ennemi;
        const q = aimanterTaille(p, pr.taille, pr.taille, e);
        const o = ajouter({ type: "pion", x: q.x, y: q.y, nom: nomPion(pr.nom || t.nom, pr.type), couleur: t.couleur, genre: pr.type,
          taille: pr.taille, pv: pr.pvMax || 0, pvMax: pr.pvMax || 0, pvVisibles: pr.type === "pj", img: pr.img || "", cache: !!pr.cache });
        valider(); selectionner([o.id]);
      } },
    note: { nom: "Note du MJ", touche: "N", ic: "M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5",
      aide: "Clic : épingler une note (jamais visible des joueurs)",
      down(p) {
        const o = ajouter({ type: "note", x: p.x, y: p.y, titre: "Note", texte: "" });
        valider(); choisirOutil("select"); selectionner([o.id]); focusChamp("titre");
      } },
    sep4: "sep",
    mesure: { nom: "Mesurer", touche: "M", ic: "M3 17L17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2",
      aide: "Glisser pour mesurer · forme « cercle » : zone d'effet d'un sort",
      down(p) {
        const a = carte.grille.type === "aucune" ? p : Geo.aimant(carte, p.x, p.y, true);
        mesureFixe = null; geste = { type: "mesure", a, b: a }; redessiner();
      },
      move(p) { if (geste) { geste.b = carte.grille.type === "aucune" ? p : Geo.aimant(carte, p.x, p.y, true); redessiner(); } },
      up() { if (geste) { mesureFixe = { a: geste.a, b: geste.b }; geste = null; redessiner(); } } },
    signal: { nom: "Signal", touche: "Q", ic: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10" opacity=".5"/>',
      aide: "Clic : faire apparaître un signal sur les écrans des joueurs",
      down(p) {
        carte.ping = { x: p.x, y: p.y, t: Date.now() };
        pings.push({ x: p.x, y: p.y, t0: performance.now() });
        redessiner(); programmerSauvegarde();
      } },
    brouillard: { nom: "Brouillard de guerre", touche: "X", ic: "M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11-1A4.5 4.5 0 0 0 7 18z",
      aide: "Révéler ou cacher des cases aux joueurs · Alt : l'inverse",
      curseurCases: () => etat.brouillard.forme === "pinceau" ? etat.brouillard.taille : 0,
      down(p, e) {
        if (!carte.brouillard.actif) { carte.brouillard.actif = true; panneau(); toast("Brouillard activé"); }
        let val = etat.brouillard.mode === "cacher" ? 1 : 0;
        if (e.altKey) val = 1 - val;
        if (etat.brouillard.forme === "rect") {
          geste = { type: "cadreBrouillard", a: p, b: p, val, apercu() {
            const g = geste; ctx.fillStyle = g.val ? "rgba(20,20,40,.4)" : "rgba(255,215,106,.15)";
            ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 1.5 / cam.z;
            ctx.fillRect(g.a.x, g.a.y, g.b.x - g.a.x, g.b.y - g.a.y); ctx.strokeRect(g.a.x, g.a.y, g.b.x - g.a.x, g.b.y - g.a.y);
          } };
        } else {
          geste = { type: "peindreBrouillard", dernier: p, val };
          peindreCases(p, val, etat.brouillard.taille, "rond", carte.brouillard.cases);
        }
        redessiner();
      },
      move(p) {
        if (!geste) return;
        if (geste.type === "cadreBrouillard") geste.b = p;
        else { trainee(geste.dernier, p, q => peindreCases(q, geste.val, etat.brouillard.taille, "rond", carte.brouillard.cases)); geste.dernier = p; }
        redessiner();
      },
      up() {
        const g = geste; geste = null; if (!g) return;
        if (g.type === "cadreBrouillard") appliquerBrouillardRect(g.a, g.b, g.val);
        valider(); redessiner();
      } }
  };
  OUTILS.mur.curseur = OUTILS.ligne.curseur = "crosshair";

  /* Déplacer en gardant l'aimant sur le bon point de chaque objet. */
  function ancreDe(o) {
    if (o.type === "pion") return { x: o.x, y: o.y, snap: (p, e) => aimanterTaille(p, o.taille || 1, o.taille || 1, e) };
    if (o.type === "tampon") {
      const S = carte.grille.taille;
      return { x: o.x + o.w / 2, y: o.y + o.h / 2, snap: (p, e) => aimanterTaille(p, Math.round(o.w / S), Math.round(o.h / S), e) };
    }
    if (o.type === "note") return { x: o.x, y: o.y, snap: (p) => p };
    if (o.type === "trait") return { x: o.pts[0], y: o.pts[1], snap: aimanter };
    return { x: o.x, y: o.y, snap: aimanter };
  }

  function redimensionner(g, p, e) {
    const o = g.o, a = (o.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const q = (o.type === "texte" || o.rot) ? p : aimanter(p, e);
    const dx = q.x - g.oppose[0], dy = q.y - g.oppose[1];
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;
    const sx = [-1, 1, 1, -1][g.i], sy = [-1, -1, 1, 1][g.i];
    let w = Math.max(4, lx * sx), h = Math.max(4, ly * sy);
    const garde = (o.type === "image" || o.type === "tampon" || o.type === "texte") ? !e.shiftKey : e.shiftKey;
    if (garde) { const k = Math.max(w / g.w0, h / g.h0); w = g.w0 * k; h = g.h0 * k; }
    if (o.type === "texte") {
      o.taille = Math.max(6, Math.round(g.t0 * h / g.h0));
      const b = Rendu.boiteTexte(o); w = b.w; h = b.h;
    } else { o.w = w; o.h = h; }
    const cx = g.oppose[0] + (sx * w / 2) * c - (sy * h / 2) * s, cy = g.oppose[1] + (sx * w / 2) * s + (sy * h / 2) * c;
    o.x = cx - w / 2; o.y = cy - h / 2;
    const S = carte.grille.taille;
    montrerBulle(o.type === "texte" ? o.taille + " px" : (w / S).toFixed(1).replace(".0", "") + " × " + (h / S).toFixed(1).replace(".0", "") + " cases",
      ...Object.values(versEcran(p.x, p.y)));
    redessiner();
  }

  function annulerGeste() {
    if (!geste) return;
    if (geste.type === "deplacer") {
      for (const s of objetsSel()) { const og = geste.origines[s.id]; if (!og) continue; if (og.pts) s.pts = og.pts; else { s.x = og.x; s.y = og.y; } }
    }
    if (geste.type === "peindre" || geste.type === "peindreBrouillard") { geste = null; restaurer(hist.pile[hist.i]); }
    geste = null; montrerBulle(null); aideOutil(); redessiner();
  }

  /* ================================================================ */
  /* Souris, doigts, clavier                                           */
  /* ================================================================ */
  const pointeurs = new Map();
  let pan = null, pince = null, espace = false, dernierClic = { t: 0, x: 0, y: 0 };

  cv.addEventListener("contextmenu", e => e.preventDefault());
  cv.addEventListener("pointerdown", e => {
    cv.setPointerCapture(e.pointerId);
    pointeurs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pointeurs.size === 2) {
      if (geste && geste.type !== "poly") annulerGeste();
      pan = null;
      const [a, b] = [...pointeurs.values()];
      pince = { d: Math.hypot(a.x - b.x, a.y - b.y), m: versMonde((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    if (pointeurs.size > 2) return;
    const now = performance.now();
    e.double = now - dernierClic.t < 380 && Math.hypot(e.offsetX - dernierClic.x, e.offsetY - dernierClic.y) < 8;
    dernierClic = { t: e.double ? 0 : now, x: e.offsetX, y: e.offsetY };
    const outil = JOUEUR ? (modeMesureJoueur ? "mesure" : "main") : etat.outil;
    if (e.button === 1 || e.button === 2 || espace || outil === "main") {
      if (e.button === 2 && geste && geste.type === "poly") { finirPoly(false); return; }
      pan = { sx: e.offsetX, sy: e.offsetY, x: cam.x, y: cam.y };
      cv.style.cursor = "grabbing";
      return;
    }
    const o = OUTILS[outil];
    if (o && o.down) o.down(versMonde(e.offsetX, e.offsetY), e);
  });
  cv.addEventListener("pointermove", e => {
    if (pointeurs.has(e.pointerId)) pointeurs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pince && pointeurs.size >= 2) {
      const [a, b] = [...pointeurs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.z = Math.max(.03, Math.min(8, cam.z * d / pince.d)); pince.d = d;
      cam.x = pince.m.x - mx / cam.z; cam.y = pince.m.y - my / cam.z;
      majZoom(); redessiner(); return;
    }
    const p = versMonde(e.offsetX, e.offsetY);
    if (pan) {
      cam.x = pan.x - (e.offsetX - pan.sx) / cam.z; cam.y = pan.y - (e.offsetY - pan.sy) / cam.z;
      redessiner(); return;
    }
    survol = p;
    if (!JOUEUR) {
      const v = Geo.cellule(carte, p.x, p.y);
      $("#coord").textContent = Geo.dedans(carte, v.k, v.r) ? "case " + (v.k + 1) + ", " + (v.r + 1) : "";
    }
    const outil = JOUEUR ? (modeMesureJoueur ? "mesure" : "main") : etat.outil;
    const o = OUTILS[outil];
    if (o && o.move) o.move(p, e);
    else if (o && o.curseurCases) redessiner();
    if (o && o.curseurCases) redessiner();
  });
  const fin = e => {
    pointeurs.delete(e.pointerId);
    if (pince) { if (pointeurs.size < 2) pince = null; return; }
    if (pan) { pan = null; cv.style.cursor = curseur(); return; }
    const outil = JOUEUR ? (modeMesureJoueur ? "mesure" : "main") : etat.outil;
    const o = OUTILS[outil];
    if (o && o.up) o.up(versMonde(e.offsetX, e.offsetY), e);
  };
  cv.addEventListener("pointerup", fin);
  cv.addEventListener("pointercancel", e => { pointeurs.delete(e.pointerId); pince = null; pan = null; if (geste && geste.type !== "poly") annulerGeste(); });
  cv.addEventListener("pointerleave", () => { survol = null; if (!geste) redessiner(); });
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 40 : 1;
    zoomer(Math.exp(-e.deltaY * k * (e.ctrlKey ? .01 : .0015)), e.offsetX, e.offsetY);
  }, { passive: false });

  const curseur = () => JOUEUR ? (modeMesureJoueur ? "crosshair" : "grab") :
    etat.outil === "main" ? "grab" : etat.outil === "select" ? "default" : "crosshair";

  document.addEventListener("keydown", e => {
    const champ = e.target.closest && e.target.closest("input,textarea,select");
    if (e.key === "Alt") { altBas = true; e.preventDefault(); }
    if (champ) { if (e.key === "Escape") e.target.blur(); return; }
    if (!$("#voile").hidden) { if (e.key === "Escape") fermerModale(); return; }
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === " ") { if (!espace) { espace = true; cv.style.cursor = "grab"; } e.preventDefault(); return; }
    if (JOUEUR) { if (k === "0") ajuster(); if (k === "+" || k === "=") zoomer(1.25); if (k === "-") zoomer(.8); if (e.key === "Escape") { mesureFixe = null; redessiner(); } return; }
    if (ctrl && k === "z") { e.preventDefault(); e.shiftKey ? refaire() : annuler(); return; }
    if (ctrl && k === "y") { e.preventDefault(); refaire(); return; }
    if (ctrl && k === "s") { e.preventDefault(); sauver(); toast("Enregistré"); return; }
    if (ctrl && k === "o") { e.preventDefault(); actions.ouvrir(); return; }
    if (ctrl && k === "d") { e.preventDefault(); actions.dupliquer(); return; }
    if (ctrl && k === "c") { if (selection.length) { pressePapier = JSON.stringify(objetsSel()); toast(selection.length + " objet(s) copié(s)"); } return; }
    if (ctrl && k === "x") { if (selection.length) { pressePapier = JSON.stringify(objetsSel()); actions.supprimer(); } return; }
    if (ctrl && k === "a") { e.preventDefault(); selectionner(carte.objets.filter(selectionnable).map(o => o.id)); return; }
    if (e.key === "Escape") {
      if (geste) annulerGeste(); else if (mesureFixe) { mesureFixe = null; redessiner(); } else selectionner([]);
      return;
    }
    if (e.key === "Enter" && geste && geste.type === "poly") { finirPoly(etat.outil === "polygone"); return; }
    if (e.key === "Backspace" && geste && geste.type === "poly") {
      e.preventDefault();
      if (geste.pts.length > 2) geste.pts.splice(-2); else geste = null;
      redessiner(); return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selection.length) { e.preventDefault(); actions.supprimer(); return; }
    if (e.key.startsWith("Arrow") && selection.length) {
      e.preventDefault();
      const S = e.shiftKey ? carte.grille.taille / 4 : carte.grille.taille;
      const dx = e.key === "ArrowLeft" ? -S : e.key === "ArrowRight" ? S : 0, dy = e.key === "ArrowUp" ? -S : e.key === "ArrowDown" ? S : 0;
      for (const o of objetsSel()) { if (o.pts) o.pts = o.pts.map((v, i) => v + (i % 2 ? dy : dx)); else { o.x += dx; o.y += dy; } }
      valider(); redessiner(); return;
    }
    if (k === "[" || k === "]") {
      const d = k === "]" ? 1 : -1;
      if (etat.outil === "brouillard") etat.brouillard.taille = Math.max(1, Math.min(12, etat.brouillard.taille + d));
      else etat.pinceau = Math.max(1, Math.min(12, etat.pinceau + d));
      garderEtat(); panneau(); redessiner(); return;
    }
    if (k === "0") { ajuster(); return; }
    if (k === "+" || k === "=") { zoomer(1.25); return; }
    if (k === "-") { zoomer(.8); return; }
    if (ctrl || e.altKey) return;
    for (const id in OUTILS) if (OUTILS[id].touche && OUTILS[id].touche.toLowerCase() === k) { choisirOutil(id); return; }
  });
  document.addEventListener("keyup", e => {
    if (e.key === " ") { espace = false; cv.style.cursor = curseur(); }
    if (e.key === "Alt") altBas = false;
  });
  window.addEventListener("blur", () => { espace = false; altBas = false; });

  let pressePapier = null;
  document.addEventListener("paste", async e => {
    if (JOUEUR || (e.target.closest && e.target.closest("input,textarea"))) return;
    const f = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.startsWith("image/"));
    if (f) { e.preventDefault(); importerImage(f.getAsFile()); return; }
    if (pressePapier) {
      const S = carte.grille.taille, ids = [];
      for (const o of JSON.parse(pressePapier)) {
        if (o.pts) o.pts = o.pts.map(v => v + S); else { o.x += S; o.y += S; }
        ids.push(ajouter(o).id);
      }
      pressePapier = JSON.stringify(ids.map(parId));
      valider(); selectionner(ids);
    }
  });
  scene.addEventListener("dragover", e => { if (!JOUEUR) e.preventDefault(); });
  scene.addEventListener("drop", e => {
    if (JOUEUR) return;
    e.preventDefault();
    const f = [...e.dataTransfer.files].find(f => f.type.startsWith("image/"));
    const r = cv.getBoundingClientRect();
    if (f) importerImage(f, versMonde(e.clientX - r.left, e.clientY - r.top));
    else { const j = [...e.dataTransfer.files].find(f => /\.json$/i.test(f.name)); if (j) importerJson(j); }
  });

  /* ================================================================ */
  /* Images                                                            */
  /* ================================================================ */
  async function importerImage(fichier, ou) {
    if (!fichier) return;
    toast("Import de l'image…");
    let src;
    try { src = await Stock.image(fichier); } catch (e) { toast("Image illisible"); return; }
    placerImage(src, ou);
  }
  function placerImage(src, ou) {
    const img = new Image();
    img.onload = () => {
      const vide = !carte.objets.length && !carte.terrain.some(v => v);
      const W0 = Geo.largeur(carte);
      let w = img.naturalWidth, h = img.naturalHeight;
      /* Sur une carte vide, l'image prend la largeur de la carte ; sinon
         elle arrive à sa taille, centrée là où on l'a lâchée. */
      if (vide || !ou) { const k = W0 / w; w *= k; h *= k; }
      const x = ou && !vide ? ou.x - w / 2 : 0, y = ou && !vide ? ou.y - h / 2 : 0;
      const o = ajouter({ type: "image", src, x, y, w, h, rot: 0, natW: img.naturalWidth, natH: img.naturalHeight });
      carte.objets.splice(carte.objets.indexOf(o), 1); carte.objets.unshift(o);
      if (vide) Carte.redimensionner(carte, carte.grille.cols, Math.max(1, Math.ceil(h / carte.grille.taille - .01)));
      valider(); choisirOutil("select"); selectionner([o.id]); ajuster();
      toast("Image posée · règle « Cases de large » si la carte a déjà une grille dessinée");
    };
    img.onerror = () => toast("Image illisible");
    img.src = src;
  }

  /* ================================================================ */
  /* Le panneau de droite                                              */
  /* ================================================================ */
  function choisirOutil(id) {
    if (geste && geste.type === "poly") finirPoly(false);
    etat.outil = id; garderEtat();
    document.querySelectorAll("#outils button").forEach(b => b.classList.toggle("on", b.dataset.outil === id));
    cv.style.cursor = curseur();
    mesureFixe = null; montrerBulle(null);
    aideOutil(); panneau(); redessiner();
  }
  function aideOutil() {
    if (JOUEUR) { aideEl.textContent = messageJoueur || ""; return; }
    const o = OUTILS[etat.outil];
    aideEl.textContent = o ? o.nom + " — " + o.aide : "";
  }
  function barreOutils() {
    $("#outils").innerHTML = Object.entries(OUTILS).map(([id, o]) => o === "sep" ? '<div class="sep"></div>' :
      `<button data-outil="${id}" title="${esc(o.nom)} (${o.touche})" class="${id === etat.outil ? "on" : ""}">${svg(o.ic)}</button>`).join("");
  }
  $("#outils").addEventListener("click", e => { const b = e.target.closest("button[data-outil]"); if (b) choisirOutil(b.dataset.outil); });

  const sec = (id, titre, html) => `<section class="sec ${etat.fermees[id] ? "ferme" : ""}" data-sec="${id}"><h2>${titre}</h2><div class="cont">${html}</div></section>`;
  const ligne = (lab, html) => `<div class="ligne"><label>${lab}</label>${html}</div>`;
  const num = (c, v, min, max, pas = 1) => `<input type="number" data-c="${c}" value="${v == null ? "" : +(+v).toFixed(2)}" min="${min}" max="${max}" step="${pas}">`;
  const coul = (c, v) => `<input type="color" data-c="${c}" value="${v || "#000000"}">`;
  const coche = (c, v, lab) => `<label class="ligne" style="gap:6px"><input type="checkbox" data-c="${c}" ${v ? "checked" : ""}> ${lab}</label>`;
  const curseurC = (c, v, min, max, pas) => `<input type="range" data-c="${c}" value="${v}" min="${min}" max="${max}" step="${pas}">`;
  const choix = (c, v, opts) => `<div class="choix">${opts.map(([val, lab]) =>
    `<button data-act="poser" data-c="${c}" data-v="${val}" class="${String(v) === String(val) ? "on" : ""}">${lab}</button>`).join("")}</div>`;
  const texteC = (c, v) => `<input type="text" data-c="${c}" value="${esc(v)}">`;

  /* En parchemin, la palette montre la couleur peinte, pas la texture de bataille. */
  function apercuTerrain(t) {
    if (carte.style !== "parchemin") return "background-image:url(" + t.apercu + ")";
    const rgb = a => "rgb(" + a.map(Math.round) + ")";
    const e = Parchemin.EAU[t.id], c = Parchemin.COUL[t.id];
    return "background:linear-gradient(135deg," + (e ? rgb(e.bord) + "," + rgb(e.fond) : rgb(c[0]) + "," + rgb(c[1])) + ")";
  }
  function paletteTerrain() {
    return `<div class="grillePal">${Tex.TERRAINS.map(t => `<div class="pal ${etat.terrain === t.id ? "on" : ""}" data-act="terrain" data-v="${t.id}" title="${t.nom}">
      <div class="sw" style="${apercuTerrain(t)}"></div>${t.nom}</div>`).join("")}</div>`;
  }
  function paletteTampons() {
    const cats = {};
    for (const i of Icones.LISTE) (cats[i.cat] = cats[i.cat] || []).push(i);
    return Object.entries(cats).map(([c, l]) => `<div class="cat">${c}</div><div class="grillePal">${l.map(i =>
      `<div class="pal ${etat.tampon === i.id ? "on" : ""}" data-act="tampon" data-v="${i.id}" title="${i.nom}"><img src="${Icones.apercu(i)}" alt="">${i.nom}</div>`).join("")}</div>`).join("");
  }

  function htmlOutil() {
    const t = etat.outil, d = etat.dessin;
    const aimant = coche("etat|aimant", etat.aimant, "Aimant sur la grille (Alt : désactiver)");
    switch (t) {
      case "select": return aimant + `<div class="petit">Double-clic sur un texte ou une note pour l'écrire. Ctrl+C / Ctrl+V : copier-coller. Flèches : déplacer d'une case.</div>`;
      case "main": return `<div class="petit">Molette : zoom. Clic droit ou clic molette : déplacer la vue avec n'importe quel outil.</div>`;
      case "pinceau": case "gomme": return (t === "pinceau" ? paletteTerrain() : "") +
        ligne("Taille", curseurC("etat|pinceau", etat.pinceau, 1, 12, 1) + `<b>${etat.pinceau}</b>`) +
        (Geo.hex(carte) ? "" : ligne("Forme", choix("etat|formePinceau", etat.formePinceau, [["rond", "Rond"], ["carre", "Carré"]])));
      case "remplir": return paletteTerrain();
      case "mur": return ligne("Épaisseur", num("etat|mur.ep", etat.mur.ep || carte.grille.taille * .2, 2, 200)) +
        `<div class="petit">Les murs se dessinent par-dessus le sol. Pour un donjon creusé dans la roche, peins plutôt le sol « Roche » au pinceau : ses bords se dessinent tout seuls.</div>`;
      case "ligne": case "polygone": case "libre": case "rect": case "ellipse":
        return (t === "ligne" || t === "libre" ? `<div class="boutons">${Object.entries(TRACES).map(([k, v]) =>
            `<button data-act="trace" data-v="${k}" style="border-left:4px solid ${v.trait}">${v.nom}</button>`).join("")}</div>` : "") +
          ligne("Trait", coul("etat|dessin.trait", d.trait) + num("etat|dessin.ep", d.ep, 0, 100)) +
          (t !== "ligne" && t !== "libre" ? ligne("Remplir", `<input type="checkbox" data-c="etat|dessin.rempli" ${d.rempli ? "checked" : ""}>` + coul("etat|dessin.rempliCouleur", d.rempliCouleur)) : "") +
          ligne("Bordure", `<input type="checkbox" data-c="etat|dessin._bord" ${d.bord ? "checked" : ""}>` + coul("etat|dessin.bordCouleur", d.bordCouleur || "#3a2814")) +
          coche("etat|dessin.tirets", d.tirets, "Pointillés") + (t === "ligne" ? coche("etat|dessin.lisse", d.lisse, "Lissé (courbes)") : "");
      case "texte": return `<div class="boutons">${Object.entries(STYLES_TEXTE).map(([k, v]) => `<button data-act="styleTexte" data-v="${k}">${v.nom}</button>`).join("")}</div>` +
        ligne("Taille", num("etat|texte.taille", etat.texte.taille, 6, 400)) + ligne("Couleur", coul("etat|texte.couleur", etat.texte.couleur)) +
        ligne("Police", choix("etat|texte.police", etat.texte.police, [["wow", "WoW"], ["sans", "Simple"]])) + coche("etat|texte.gras", etat.texte.gras, "Gras") +
        coche("etat|texte.dore", etat.texte.dore, "Lettres dorées") + coche("etat|texte.maj", etat.texte.maj, "MAJUSCULES");
      case "tampon": return ligne("Échelle", curseurC("etat|tamponEchelle", etat.tamponEchelle, .5, 4, .5) + `<b>×${etat.tamponEchelle}</b>`) +
        ligne("Rotation", choix("etat|tamponRot", etat.tamponRot || 0, [[0, "0°"], [90, "90°"], [180, "180°"], [270, "270°"]])) +
        coche("etat|tamponRotAlea", etat.tamponRotAlea, "Rotation au hasard (nature)") + coche("etat|tamponTrainee", etat.tamponTrainee, "Semer en glissant") + aimant + paletteTampons();
      case "pion": {
        const p = etat.pion;
        return `<div class="boutons">${Object.entries(TYPES_PION).map(([k, v]) =>
          `<button data-act="poser" data-c="etat|pion.type" data-v="${k}" class="${p.type === k ? "on" : ""}" style="border-left:4px solid ${v.couleur}">${v.nom}</button>`).join("")}</div>` +
          ligne("Nom", texteC("etat|pion.nom", p.nom)) +
          ligne("Taille", choix("etat|pion.taille", p.taille, [[1, "1"], [2, "2"], [3, "3"], [4, "4"]])) +
          ligne("PV max", num("etat|pion.pvMax", p.pvMax || 0, 0, 9999)) +
          coche("etat|pion.cache", p.cache, "Caché aux joueurs en le posant") +
          ligne("Portrait", `<button data-act="imagePionOutil">${p.img ? "Changer…" : "Choisir…"}</button>${p.img ? `<button data-act="sansImagePionOutil">Aucun</button>` : ""}`) +
          `<div class="petit">Les ennemis sont numérotés tout seuls : Gobelin 1, Gobelin 2…</div>`;
      }
      case "note": return `<div class="petit">Les notes ne sont jamais montrées aux joueurs : pièges, PNJ, texte à lire…</div>`;
      case "mesure": return ligne("Forme", choix("etat|mesure.forme", etat.mesure.forme, [["ligne", "Ligne"], ["cercle", "Cercle"]])) +
        `<div class="petit">Échelle : 1 case = ${carte.grille.metres} ${esc(carte.grille.unite)} (réglable dans « Carte »).</div>`;
      case "signal": return `<div class="petit">Le signal apparaît aussi sur les écrans des joueurs (vue joueurs ouverte).</div>`;
      case "brouillard": {
        const b = etat.brouillard;
        return coche("carte|brouillard.actif", carte.brouillard.actif, "<b>Brouillard actif</b>") +
          ligne("Action", choix("etat|brouillard.mode", b.mode, [["reveler", "Révéler"], ["cacher", "Cacher"]])) +
          ligne("Forme", choix("etat|brouillard.forme", b.forme, [["pinceau", "Pinceau"], ["rect", "Rectangle"]])) +
          (b.forme === "pinceau" ? ligne("Taille", curseurC("etat|brouillard.taille", b.taille, 1, 12, 1) + `<b>${b.taille}</b>`) : "") +
          `<div class="boutons"><button data-act="brouillardTout" data-v="1">Tout cacher</button><button data-act="brouillardTout" data-v="0">Tout révéler</button></div>
          <div class="petit">Pour toi le brouillard est translucide ; pour les joueurs il est noir.</div>`;
      }
    }
    return "";
  }

  function htmlSelection() {
    const l = objetsSel();
    if (!l.length) return "";
    const o = l[0], S = carte.grille.taille;
    const communs = ligne("Calque", `<select data-c="sel|calque">${CALQUES.filter(c => c.id !== "terrain" && c.id !== "brouillard")
      .map(c => `<option value="${c.id}" ${o.calque === c.id ? "selected" : ""}>${c.nom}</option>`).join("")}</select>`) +
      (o.type !== "note" ? coche("sel|cache", o.cache, "Caché aux joueurs") : "") +
      ligne("Opacité", curseurC("sel|op", o.op == null ? 1 : o.op, .05, 1, .05)) +
      `<div class="boutons"><button data-act="avant" title="Premier plan">▲ Devant</button><button data-act="arriere" title="Arrière-plan">▼ Derrière</button>
       <button data-act="dupliquer" title="Ctrl+D">Dupliquer</button><button class="danger" data-act="supprimer" title="Suppr">Supprimer</button></div>`;
    if (l.length > 1) return `<div>${l.length} objets sélectionnés</div>` + communs;
    let h = "";
    const rot = ligne("Rotation", num("sel|rot", o.rot || 0, -360, 360, 15) + "°");
    switch (o.type) {
      case "image":
        h = ligne("Cases de large", `<input type="number" data-c="sel|_casesLarge" value="${+(o.w / S).toFixed(2)}" min="1" max="500" step="1">`) +
          ligne("Taille", `${Math.round(o.w)} × ${Math.round(o.h)} px`) + rot +
          `<div class="boutons"><button data-act="carteSurImage" title="Régler le nombre de cases pour couvrir l'image">Carte à la taille de l'image</button>
           <button data-act="imageOrigine">Taille d'origine</button></div>
           <div class="petit">Astuce : verrouille le calque « Images de fond » (🔒) pour pouvoir dessiner par-dessus sans la déplacer.</div>`;
        break;
      case "trait":
        if (o.mur) h = ligne("Épaisseur", num("sel|ep", o.ep, 1, 300)) + ligne("Couleur", coul("sel|trait", o.trait || "#14110e"));
        else h = ligne("Trait", coul("sel|trait", o.trait) + num("sel|ep", o.ep, 0, 200)) +
          (o.ferme ? ligne("Remplir", `<input type="checkbox" data-c="sel|_rempli" ${o.rempli ? "checked" : ""}>` + coul("sel|rempliCouleur", o.rempliCouleur || o.rempli || "#6a5a48")) : "") +
          ligne("Bordure", `<input type="checkbox" data-c="sel|_bord" ${o.bord ? "checked" : ""}>` + coul("sel|bordCouleur", o.bordCouleur || o.bord || "#3a2814")) +
          coche("sel|tirets", o.tirets, "Pointillés") + coche("sel|lisse", o.lisse, "Lissé");
        h += coche("sel|mur", o.mur, "C'est un mur") + coche("sel|ferme", o.ferme, "Fermé");
        break;
      case "rect": case "ellipse":
        h = ligne("Trait", coul("sel|trait", o.trait) + num("sel|ep", o.ep, 0, 200)) +
          ligne("Remplir", `<input type="checkbox" data-c="sel|_rempli" ${o.rempli ? "checked" : ""}>` + coul("sel|rempliCouleur", o.rempliCouleur || o.rempli || "#6a5a48")) +
          coche("sel|tirets", o.tirets, "Pointillés") + rot;
        break;
      case "tampon": {
        const ic = Icones.parId[o.icone];
        h = `<div><b>${ic ? ic.nom : o.icone}</b> · ${+(o.w / S).toFixed(1)} × ${+(o.h / S).toFixed(1)} cases</div>` + rot +
          `<div class="boutons"><button data-act="echelle" data-v=".5">× ½</button><button data-act="echelle" data-v="2">× 2</button><button data-act="tourner">↻ 90°</button></div>` +
          coche("sel|ombre", o.ombre !== false, "Ombre portée");
        break;
      }
      case "texte":
        h = `<textarea data-c="sel|txt" rows="3">${esc(o.txt)}</textarea>` +
          `<div class="boutons">${Object.entries(STYLES_TEXTE).map(([k, v]) => `<button data-act="styleTexte" data-v="${k}">${v.nom}</button>`).join("")}</div>` +
          ligne("Taille", num("sel|taille", o.taille, 6, 600)) + ligne("Couleur", coul("sel|couleur", o.couleur)) +
          ligne("Police", choix("sel|police", o.police, [["wow", "WoW"], ["sans", "Simple"]])) +
          coche("sel|gras", o.gras, "Gras") + coche("sel|contour", o.contour !== false, "Contour sombre") +
          coche("sel|dore", o.dore, "Lettres dorées") + coche("sel|maj", o.maj, "MAJUSCULES") + rot;
        break;
      case "pion":
        h = ligne("Nom", texteC("sel|nom", o.nom)) +
          `<div class="boutons">${Object.entries(TYPES_PION).map(([k, v]) =>
            `<button data-act="genrePion" data-v="${k}" class="${o.genre === k ? "on" : ""}" style="border-left:4px solid ${v.couleur}">${v.nom}</button>`).join("")}</div>` +
          ligne("Couleur", coul("sel|couleur", o.couleur)) +
          ligne("Taille", choix("sel|taille", o.taille || 1, [[1, "1"], [2, "2"], [3, "3"], [4, "4"]])) +
          ligne("PV", num("sel|pv", o.pv || 0, -999, 9999) + " / " + num("sel|pvMax", o.pvMax || 0, 0, 9999)) +
          `<div class="boutons"><button data-act="pv" data-v="-5">−5</button><button data-act="pv" data-v="-1">−1</button><button data-act="pv" data-v="1">+1</button><button data-act="pv" data-v="5">+5</button><button data-act="pv" data-v="max">Max</button></div>` +
          coche("sel|pvVisibles", o.pvVisibles, "PV visibles des joueurs") +
          coche("sel|etiquette", o.etiquette !== false, "Nom affiché") +
          ligne("État", texteC("sel|etat", o.etat || "")) +
          ligne("Portrait", `<button data-act="imagePion">${o.img ? "Changer…" : "Choisir…"}</button>${o.img ? `<button data-act="sansImagePion">Aucun</button>` : ""}`);
        break;
      case "note":
        h = ligne("Titre", texteC("sel|titre", o.titre)) + `<textarea data-c="sel|texte" rows="6" placeholder="Ce que les joueurs trouvent ici…">${esc(o.texte)}</textarea>` +
          ligne("Couleur", coul("sel|couleur", o.couleur || "#ffd76a"));
        break;
    }
    return h + communs;
  }

  function htmlCalques() {
    return CALQUES.slice().reverse().map(c => {
      const e = carte.calques[c.id];
      return `<div class="calque"><button data-act="calqueVis" data-v="${c.id}" title="Afficher / masquer" class="${e.vis ? "" : "on"}">${e.vis ? "👁" : "—"}</button>
        <button data-act="calqueVerrou" data-v="${c.id}" title="Verrouiller (on ne peut plus le sélectionner)" class="${e.verrou ? "on" : ""}">${e.verrou ? "🔒" : "🔓"}</button>
        <span>${c.nom}</span>${curseurC("calque|" + c.id + ".op", e.op, 0, 1, .05)}</div>`;
    }).join("") + `<div class="petit">Un calque masqué l'est aussi pour les joueurs. Les notes du MJ ne sont jamais montrées.</div>`;
  }

  function htmlCarte() {
    const g = carte.grille;
    return ligne("Style", choix("carte|style", carte.style || "bataille", [["bataille", "Bataille"], ["parchemin", "Parchemin"]])) +
      (carte.style === "parchemin" ? coche("carte|cadre", carte.cadre !== false, "Cadre doré") +
        `<div class="boutons"><button data-act="varierPeinture" title="Redessine les bords des terrains autrement">🎨 Varier la peinture</button></div>` : "") +
      ligne("Grille", choix("carte|grille.type", g.type, [["carre", "Carrés"], ["hex", "Hexa"], ["aucune", "Aucune"]])) +
      ligne("Cases", `<input type="number" id="nCols" value="${g.cols}" min="1" max="400"> × <input type="number" id="nRows" value="${g.rows}" min="1" max="400"> <button data-act="redim">OK</button>`) +
      ligne("Taille d'une case", num("carte|grille.taille", g.taille, 16, 400) + " px") +
      ligne("1 case =", num("carte|grille.metres", g.metres, .1, 1000, .5) + `<input type="text" data-c="carte|grille.unite" value="${esc(g.unite)}" style="width:50px">`) +
      ligne("Lignes", coul("carte|grille.couleur", g.couleur) + curseurC("carte|grille.opacite", g.opacite, 0, 1, .05)) +
      coche("carte|grille.visible", g.visible, "Grille visible") +
      ligne("Fond", coul("carte|fond", carte.fond)) +
      coche("carte|brouillard.actif", carte.brouillard.actif, "Brouillard de guerre actif") +
      `<div class="boutons"><button data-act="viderTerrain" class="danger">Vider le terrain</button></div>`;
  }

  let tPanneau = null;
  function panneau() {
    if (JOUEUR) return;
    clearTimeout(tPanneau);
    tPanneau = setTimeout(construirePanneau, 0);
  }
  function construirePanneau() {
    const haut = panneauEl.scrollTop;
    const o = OUTILS[etat.outil], sel = htmlSelection();
    panneauEl.innerHTML =
      sec("outil", "Outil · " + (o ? o.nom : ""), htmlOutil()) +
      (sel ? sec("sel", "Sélection", sel) : "") +
      sec("calques", "Calques", htmlCalques()) +
      sec("carte", "Carte", htmlCarte());
    panneauEl.scrollTop = haut;
  }
  function focusChamp(nom) {
    clearTimeout(tPanneau); construirePanneau();
    const el = panneauEl.querySelector(`[data-c="sel|${nom}"]`);
    if (el) { el.focus(); el.select && el.select(); }
  }
  panneauEl.addEventListener("click", e => {
    const h = e.target.closest(".sec>h2");
    if (h) { const s = h.parentElement; s.classList.toggle("ferme"); etat.fermees[s.dataset.sec] = s.classList.contains("ferme"); garderEtat(); }
  });

  /* -------- les champs : « cible|chemin », cible = etat, sel, carte, calque -------- */
  function poser(obj, chemin, v) {
    const p = chemin.split("."); let o = obj;
    for (let i = 0; i < p.length - 1; i++) o = o[p[i]] = o[p[i]] || {};
    o[p[p.length - 1]] = v;
  }
  function lire(obj, chemin) { return chemin.split(".").reduce((o, k) => o && o[k], obj); }
  function valeurChamp(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "number" || el.type === "range") { const v = parseFloat(el.value); return isNaN(v) ? null : v; }
    if (el.dataset.v != null) { const v = el.dataset.v; return /^-?\d+(\.\d+)?$/.test(v) ? +v : v; }
    return el.value;
  }
  function appliquer(c, v, fin) {
    const [cible, chemin] = c.split("|");
    if (v === null) return;
    if (cible === "etat") {
      if (chemin === "dessin._bord") etat.dessin.bord = v ? (etat.dessin.bordCouleur || "#3a2814") : "";
      else if (chemin === "dessin.bordCouleur") { etat.dessin.bordCouleur = v; if (etat.dessin.bord) etat.dessin.bord = v; }
      else poser(etat, chemin, v);
      garderEtat();
      if (fin || /^(pinceau|brouillard\.taille|tamponEchelle)$/.test(chemin)) panneau();
      redessiner(); return;
    }
    if (cible === "calque") { poser(carte.calques, chemin, v); redessiner(); if (fin) valider(); return; }
    if (cible === "carte") {
      if (chemin === "style") {
        carte.style = v;
        /* Le parchemin se lit sans quadrillage ; la bataille en a besoin. */
        carte.grille.visible = v !== "parchemin";
        panneau();
      } else if (chemin === "grille.type") { const a = { x: cam.x + W / 2 / cam.z, y: cam.y + H / 2 / cam.z }; carte.grille.type = v; cam.x = a.x - W / 2 / cam.z; cam.y = a.y - H / 2 / cam.z; panneau(); }
      else if (chemin === "grille.taille") {
        const k = v / carte.grille.taille;
        if (fin && k > 0 && k !== 1) mettreAEchelle(k);
        else if (!fin) return;
      } else poser(carte, chemin, v);
      redessiner(); if (fin) { valider(); if (chemin.startsWith("brouillard")) panneau(); } return;
    }
    if (cible === "sel") {
      for (const o of objetsSel()) {
        if (chemin === "_casesLarge") { if (!fin) continue; const k = v * carte.grille.taille / o.w; o.w *= k; o.h *= k; }
        else if (chemin === "_rempli") o.rempli = v ? (o.rempliCouleur || "#6a5a48") : "";
        else if (chemin === "_bord") o.bord = v ? (o.bordCouleur || "#3a2814") : "";
        else if (chemin === "bordCouleur") { o.bordCouleur = v; if (o.bord) o.bord = v; }
        else if (chemin === "rempliCouleur") { o.rempliCouleur = v; if (o.rempli) o.rempli = v; }
        else if (chemin === "rot") { const b = Rendu.boite(carte, o); o.rot = v; if (o.type === "texte") { o.x = b.x; o.y = b.y; } }
        else poser(o, chemin, v);
      }
      redessiner();
      if (fin) { valider(); if (/^(calque|_casesLarge|_rempli|mur|ferme|taille|police)$/.test(chemin)) panneau(); }
    }
  }
  /* Changer la taille d'une case garde le dessin calé sur la grille. */
  function mettreAEchelle(k) {
    carte.grille.taille *= k;
    for (const o of carte.objets) {
      if (o.pts) o.pts = o.pts.map(v => v * k);
      if (o.x != null) { o.x *= k; o.y *= k; }
      if (o.w != null) { o.w *= k; o.h *= k; }
      if (o.type === "texte") o.taille *= k;
      if (o.ep && o.mur) o.ep *= k;
    }
    cam.x *= k; cam.y *= k; cam.z /= k; majZoom();
  }
  panneauEl.addEventListener("input", e => { const c = e.target.dataset.c; if (c && e.target.type !== "checkbox") appliquer(c, valeurChamp(e.target), false); });
  panneauEl.addEventListener("change", e => { const c = e.target.dataset.c; if (c) appliquer(c, valeurChamp(e.target), true); });

  /* ================================================================ */
  /* Les actions (boutons de la barre, du panneau, des fenêtres)       */
  /* ================================================================ */
  let modeMesureJoueur = false;
  const actions = {
    poser(el) { appliquer(el.dataset.c, valeurChamp(el), true); },
    terrain(el) { etat.terrain = +el.dataset.v; garderEtat(); if (etat.outil !== "remplir") choisirOutil("pinceau"); else panneau(); },
    tampon(el) { etat.tampon = el.dataset.v; garderEtat(); choisirOutil("tampon"); },
    annuler, refaire,
    zoomPlus: () => zoomer(1.25), zoomMoins: () => zoomer(.8), ajuster,
    supprimer() {
      if (!selection.length) return;
      carte.objets = carte.objets.filter(o => !selection.includes(o.id));
      selection = []; valider(); panneau(); redessiner();
    },
    dupliquer() {
      const S = carte.grille.taille, ids = [];
      for (const o of objetsSel()) {
        const c = JSON.parse(JSON.stringify(o));
        if (c.pts) c.pts = c.pts.map(v => v + S); else { c.x += S; c.y += S; }
        if (c.type === "pion") c.nom = nomPion(String(c.nom).replace(/ \d+$/, ""), c.genre);
        ids.push(ajouter(c).id);
      }
      if (ids.length) { valider(); selectionner(ids); }
    },
    avant() { const l = objetsSel(); carte.objets = carte.objets.filter(o => !l.includes(o)).concat(l); valider(); redessiner(); },
    arriere() { const l = objetsSel(); carte.objets = l.concat(carte.objets.filter(o => !l.includes(o))); valider(); redessiner(); },
    echelle(el) {
      const k = +el.dataset.v;
      for (const o of objetsSel()) { const cx = o.x + o.w / 2, cy = o.y + o.h / 2; o.w *= k; o.h *= k; o.x = cx - o.w / 2; o.y = cy - o.h / 2; }
      valider(); panneau(); redessiner();
    },
    tourner() { for (const o of objetsSel()) o.rot = ((o.rot || 0) + 90) % 360; valider(); panneau(); redessiner(); },
    pv(el) {
      for (const o of objetsSel()) {
        if (o.type !== "pion") continue;
        o.pv = el.dataset.v === "max" ? o.pvMax : (o.pv || 0) + +el.dataset.v;
      }
      valider(); panneau(); redessiner();
    },
    genrePion(el) {
      const t = TYPES_PION[el.dataset.v];
      for (const o of objetsSel()) if (o.type === "pion") { o.genre = el.dataset.v; o.couleur = t.couleur; if (el.dataset.v === "pj") o.pvVisibles = true; }
      valider(); panneau(); redessiner();
    },
    imagePion() { choisirImage("Portrait du pion", src => { for (const o of objetsSel()) if (o.type === "pion") o.img = src; valider(); panneau(); redessiner(); }); },
    sansImagePion() { for (const o of objetsSel()) if (o.type === "pion") o.img = ""; valider(); panneau(); redessiner(); },
    imagePionOutil() { choisirImage("Portrait des prochains pions", src => { etat.pion.img = src; garderEtat(); panneau(); }); },
    sansImagePionOutil() { etat.pion.img = ""; garderEtat(); panneau(); },
    calqueVis(el) { const c = carte.calques[el.dataset.v]; c.vis = !c.vis; selection = selection.filter(id => selectionnable(parId(id))); valider(); panneau(); redessiner(); },
    calqueVerrou(el) { const c = carte.calques[el.dataset.v]; c.verrou = !c.verrou; selection = selection.filter(id => selectionnable(parId(id))); valider(); panneau(); redessiner(); },
    redim() {
      const c = Math.max(1, Math.min(400, +$("#nCols").value || 1)), r = Math.max(1, Math.min(400, +$("#nRows").value || 1));
      Carte.redimensionner(carte, c, r); valider(); ajuster(); panneau();
    },
    carteSurImage() {
      const o = objetsSel()[0]; if (!o) return;
      const S = carte.grille.taille;
      const c = Math.ceil((o.x + o.w) / (Geo.hex(carte) ? 1.5 * Geo.R(carte) : S) - 1e-6), r = Math.ceil((o.y + o.h) / S - 1e-6);
      Carte.redimensionner(carte, Math.max(1, c), Math.max(1, r)); valider(); ajuster(); panneau();
    },
    imageOrigine() {
      for (const o of objetsSel()) if (o.type === "image" && o.natW) { o.w = o.natW; o.h = o.natH; }
      valider(); panneau(); redessiner();
    },
    viderTerrain(el) {
      if (el.dataset.ok !== "1") { el.dataset.ok = "1"; el.textContent = "Sûr ? Cliquer encore"; return; }
      carte.terrain.fill(0); valider(); panneau(); redessiner();
    },
    brouillardTout(el) { carte.brouillard.actif = true; carte.brouillard.cases.fill(+el.dataset.v); valider(); panneau(); redessiner(); },
    trace(el) { Object.assign(etat.dessin, TRACES[el.dataset.v].style(carte.grille.taille)); garderEtat(); panneau(); },
    styleTexte(el) {
      const st = STYLES_TEXTE[el.dataset.v].style(carte.grille.taille);
      const l = objetsSel().filter(o => o.type === "texte");
      if (l.length) { for (const o of l) Object.assign(o, st); valider(); panneau(); redessiner(); }
      else { Object.assign(etat.texte, st); garderEtat(); panneau(); }
    },
    varierPeinture() { carte.parcheminGraine = (carte.parcheminGraine || 0) + 1; valider(); redessiner(); },
    nouvelle: () => fenetreNouvelle(),
    ouvrir: () => fenetreOuvrir(),
    generer: () => fenetreGenerer(),
    exporter: () => fenetreExporter(),
    image() { const f = $("#fichier"); f.onchange = () => { importerImage(f.files[0]); f.value = ""; }; f.click(); },
    async table() {
      const t = await Stock.table();
      const montre = !(t && t.carte === carte.id);
      await sauver();
      await Stock.ecrireTable({ carte: montre ? carte.id : null, t: Date.now() });
      majTable(); toast(montre ? "Les joueurs voient maintenant « " + carte.nom + " »" : "Plus aucune carte montrée aux joueurs");
    },
    recentrer() {
      carte.vueJoueurs = { cx: cam.x + W / 2 / cam.z, cy: cam.y + H / 2 / cam.z, lw: W / cam.z, lh: H / cam.z, t: Date.now() };
      programmerSauvegarde(); toast("Vue des joueurs recentrée ici");
    },
    lienJoueurs: () => fenetreLien(),
    mesureJoueur(el) { modeMesureJoueur = !modeMesureJoueur; el.classList.toggle("on", modeMesureJoueur); mesureFixe = null; cv.style.cursor = curseur(); redessiner(); },
    pleinEcran() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
  };
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const f = actions[b.dataset.act];
    if (f) f(b, e);
  });

  async function majTable() {
    if (JOUEUR) return;
    const t = await Stock.table();
    $("#table").classList.toggle("on", !!(t && t.carte === carte.id));
    $("#table").textContent = t && t.carte === carte.id ? "📡 Montrée aux joueurs" : "📡 Montrer aux joueurs";
  }

  $("#nomCarte").addEventListener("change", e => { carte.nom = e.target.value.trim() || "Sans nom"; valider(); });

  /* ================================================================ */
  /* Les fenêtres                                                      */
  /* ================================================================ */
  function modale(titre, corps, pied) {
    const m = $("#modale");
    m.innerHTML = `<header><h1>${titre}</h1><button data-act="fermer">✕</button></header><div class="corpsM">${corps}</div>${pied ? `<footer>${pied}</footer>` : ""}`;
    $("#voile").hidden = false;
    return m;
  }
  function fermerModale() { $("#voile").hidden = true; $("#modale").innerHTML = ""; }
  actions.fermer = fermerModale;
  $("#voile").addEventListener("pointerdown", e => { if (e.target.id === "voile") fermerModale(); });

  const MODELES = [
    { id: "vierge", nom: "Vierge", d: "Une carte vide, sol à peindre", type: "carre", cols: 30, rows: 20 },
    { id: "taverne", nom: "Salle / taverne", d: "Plancher et murs de pierre", type: "carre", cols: 24, rows: 16 },
    { id: "donjon", nom: "Donjon", d: "Salles et couloirs tirés au sort", type: "carre", cols: 40, rows: 30 },
    { id: "grotte", nom: "Grotte", d: "Galeries naturelles, eau souterraine", type: "carre", cols: 40, rows: 30 },
    { id: "exterieur", nom: "Extérieur", d: "Forêts, rivières, chemin", type: "carre", cols: 50, rows: 35 },
    { id: "region", nom: "Région (parchemin)", d: "Façon carte de zone de WoW : montagnes, forêts, villages", type: "aucune", cols: 60, rows: 40 },
    { id: "hex", nom: "Région (hexagones)", d: "Voyage et exploration", type: "hex", cols: 30, rows: 22 },
    { id: "monde", nom: "Carte du monde", d: "Une image (Azeroth…), sans grille, des repères", type: "aucune", cols: 40, rows: 30 }
  ];
  function fenetreNouvelle(premiere) {
    modale("Nouvelle carte", `
      ${premiere ? `<div>Bienvenue dans l'éditeur de cartes ! Choisis un point de départ :</div>` : ""}
      ${ligne("Nom", `<input type="text" id="nNom" placeholder="Le nom du modèle choisi">`)}
      <div class="modeles">${MODELES.map(m => `<button data-act="creer" data-v="${m.id}"><b>${m.nom}</b><span>${m.d}</span><span>${m.type === "hex" ? "hexagones" : m.type === "aucune" ? "sans grille" : "cases carrées"} · ${m.cols} × ${m.rows}</span></button>`).join("")}</div>
      <div class="petit">Tout se règle ensuite dans le panneau « Carte » : nombre de cases, type de grille, échelle.</div>`);
    setTimeout(() => { const n = $("#nNom"); n.focus(); n.select(); });
  }
  actions.creer = el => {
    const m = MODELES.find(x => x.id === el.dataset.v), nom = ($("#nNom").value || "").trim() || m.nom;
    const c = Carte.nouvelle({ nom, type: m.type, cols: m.cols, rows: m.rows });
    const graine = Math.floor(Math.random() * 1e9);
    if (m.id === "vierge" || m.id === "hex") c.terrain.fill(m.id === "hex" ? 1 : 0);
    if (m.id === "taverne") {
      const { cols, rows } = c.grille;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++)
        c.terrain[r * cols + k] = (r < 2 || k < 2 || r >= rows - 2 || k >= cols - 2) ? 1 : (r === 2 || k === 2 || r === rows - 3 || k === cols - 3) ? 17 : 8;
    }
    if (m.id === "donjon" || m.id === "grotte" || m.id === "exterieur") {
      const res = Generateurs[m.id](c.grille.cols, c.grille.rows, { graine });
      c.terrain = res.terrain; poserTampons(c, res.tampons);
    }
    if (m.id === "monde") { c.fond = "#1a2a3a"; c.grille.metres = 1; c.grille.unite = "km"; }
    if (m.id === "region") {
      c.style = "parchemin"; c.grille.visible = false; c.grille.metres = .2; c.grille.unite = "km";
      poserResultat(c, Generateurs.exterieur(c.grille.cols, c.grille.rows, { graine, region: true }));
    }
    fermerModale(); ouvrirCarte(c); valider(); sauver();
    if (m.id === "monde") setTimeout(() => toast("Clique « Image… » (ou glisse une image sur la carte) pour poser la carte du monde"), 300);
  };
  /* Le résultat d'un générateur : le sol, le décor, et pour une région le
     chemin en route lissée. */
  function poserResultat(c, res) {
    c.terrain = res.terrain;
    poserTampons(c, res.tampons);
    if (res.chemin && res.chemin.length > 1) {
      const pts = [];
      res.chemin.forEach(([k, r], i) => { if (i % 2 === 0 || i === res.chemin.length - 1) { const p = Geo.centre(c, k, r); pts.push(p.x, p.y); } });
      c.objets.push(Object.assign({ id: nouvelIdObjet(), type: "trait", calque: "dessin", pts, ferme: false }, TRACES.route.style(c.grille.taille), { lisse: true }));
    }
  }
  function poserTampons(c, liste) {
    const S = c.grille.taille;
    for (const t of liste) {
      const ic = Icones.parId[t.icone]; if (!ic) continue;
      const l = t.l || ic.l, h = t.h || ic.h, p = Geo.centre(c, t.c, t.r);
      /* Un tampon de 2 cases se cale sur le coin entre quatre cases. */
      const x = p.x + (l % 2 ? 0 : S / 2), y = p.y + (h % 2 ? 0 : S / 2);
      c.objets.push({ id: nouvelIdObjet(), type: "tampon", calque: "decor", icone: ic.id, x: x - l * S / 2, y: y - h * S / 2, w: l * S, h: h * S, rot: t.rot || 0 });
    }
  }

  async function fenetreOuvrir() {
    const liste = indexCache = await Stock.index();
    const t = await Stock.table();
    const date = ms => ms ? new Date(ms).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    modale("Ouvrir une carte", liste.length ? `<div class="liste">${liste.map(c => `
      <div class="el ${c.id === carte.id ? "cour" : ""}"><b>${esc(c.nom)}</b>
        <span class="petit">${t && t.carte === c.id ? "📡 " : ""}${c.cols || "?"} × ${c.rows || "?"} · ${date(c.maj)}</span>
        <button class="prim" data-act="charger" data-v="${esc(c.id)}">Ouvrir</button>
        <button data-act="copierCarte" data-v="${esc(c.id)}" title="Faire une copie">Copier</button>
        <button class="danger" data-act="retirer" data-v="${esc(c.id)}" title="Retirer de la liste">✕</button></div>`).join("")}</div>
      <div class="petit">« ✕ » retire la carte de la liste ; son fichier reste dans Sauvegardes\\Cartes\\ au cas où.</div>`
      : `<div class="vide">Aucune carte enregistrée pour l'instant.</div>`,
      `<button data-act="importerJson">Importer un .json…</button><button data-act="nouvelle">Nouvelle carte</button>`);
  }
  actions.charger = async el => { fermerModale(); await chargerCarte(el.dataset.v); };
  actions.copierCarte = async el => {
    const txt = await Stock.lire(el.dataset.v); if (!txt) return toast("Carte introuvable");
    const c = Carte.depuisJSON(txt); c.id = Carte.nouvelId(c.nom); c.nom += " (copie)";
    fermerModale(); ouvrirCarte(c); valider(); await sauver(); toast("Copie créée");
  };
  actions.retirer = async el => {
    if (el.dataset.ok !== "1") { el.dataset.ok = "1"; el.textContent = "Sûr ?"; return; }
    indexCache = (await Stock.index()).filter(c => c.id !== el.dataset.v);
    await Stock.ecrireIndex(indexCache); fenetreOuvrir();
  };
  actions.importerJson = () => { const f = $("#fichierJson"); f.onchange = () => { importerJson(f.files[0]); f.value = ""; }; f.click(); };
  async function importerJson(f) {
    try {
      const c = Carte.depuisJSON(await f.text());
      if (indexCache && indexCache.some(x => x.id === c.id)) c.id = Carte.nouvelId(c.nom);
      fermerModale(); ouvrirCarte(c); valider(); await sauver(); toast("Carte importée");
    } catch (e) { toast("Ce fichier n'est pas une carte"); }
  }

  function fenetreGenerer() {
    modale("Générer", `
      <div class="petit">Remplace le sol de la carte actuelle (${carte.grille.cols} × ${carte.grille.rows} cases) et ajoute du décor. Ctrl+Z pour revenir en arrière ; recommence autant que tu veux.</div>
      <div class="modeles">
        <button data-act="gen" data-v="donjon"><b>Donjon</b><span>Salles, couloirs, portes, coffres</span></button>
        <button data-act="gen" data-v="donjonBrique"><b>Crypte</b><span>Murs de briques, sol pavé</span></button>
        <button data-act="gen" data-v="grotte"><b>Grotte</b><span>Galeries, lacs souterrains, cristaux</span></button>
        <button data-act="gen" data-v="exterieur"><b>Forêt d'Elwynn</b><span>Prairies, bois, rivière, chemin</span></button>
        <button data-act="gen" data-v="neige"><b>Dun Morogh</b><span>Neige, glace, sapins</span></button>
        <button data-act="gen" data-v="desert"><b>Tanaris</b><span>Sable, roche, oasis</span></button>
      </div>
      ${coche("etat|genGarde", etat.genGarde, "Garder le décor déjà posé")}`);
  }
  actions.gen = el => {
    const v = el.dataset.v, { cols, rows } = carte.grille, graine = Math.floor(Math.random() * 1e9);
    let res;
    if (v === "donjon") res = Generateurs.donjon(cols, rows, { graine });
    else if (v === "donjonBrique") {
      res = Generateurs.donjon(cols, rows, { graine, sol: 7 });
      for (let i = 0; i < res.terrain.length; i++) if (res.terrain[i] === 17) res.terrain[i] = 18;
    }
    else if (v === "grotte") res = Generateurs.grotte(cols, rows, { graine });
    else res = Generateurs.exterieur(cols, rows, { graine, climat: v === "neige" ? "neige" : v === "desert" ? "desert" : "", region: carte.style === "parchemin" });
    if (!etat.genGarde) carte.objets = carte.objets.filter(o => o.calque !== "decor" && !o.route);
    poserResultat(carte, res);
    selection = []; fermerModale(); valider(); panneau(); redessiner();
  };

  function fenetreExporter() {
    modale("Exporter", `
      <div class="modeles">
        <button data-act="png" data-v="mj"><b>Image PNG (MJ)</b><span>Tout, notes et objets cachés compris</span></button>
        <button data-act="png" data-v="joueur"><b>Image PNG (joueurs)</b><span>Avec le brouillard, sans les secrets</span></button>
        <button data-act="json"><b>Fichier .json</b><span>Pour sauvegarder ou envoyer la carte</span></button>
      </div>`);
  }
  function telecharger(blob, nom) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  actions.png = async el => {
    fermerModale(); toast("Fabrication de l'image…");
    await Images.toutes(carte.objets.map(o => o.src || o.img).filter(Boolean));
    const w = Geo.largeur(carte), h = Geo.hauteur(carte), k = Math.min(1, 8000 / Math.max(w, h));
    const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    Rendu.dessiner(c.getContext("2d"), carte, { mode: el.dataset.v, cam: { x: 0, y: 0, z: k }, w: c.width, h: c.height, dpr: 1, exporter: true });
    c.toBlob(b => { if (!b) return toast("Image trop grande pour le navigateur"); telecharger(b, carte.nom + (el.dataset.v === "joueur" ? " (joueurs)" : "") + ".png"); }, "image/png");
  };
  actions.json = () => { fermerModale(); telecharger(new Blob([Carte.versJSON(carte)], { type: "application/json" }), carte.nom + ".json"); };

  async function choisirImage(titre, fn) {
    const gal = await Stock.galeries();
    const dossiers = Object.entries(gal).filter(([, l]) => l.length).sort(([a], [b]) => a === "cartes" ? -1 : b === "cartes" ? 1 : a.localeCompare(b));
    modale(titre, `<div><button class="prim" data-act="imageDuPc">Importer depuis le PC…</button></div>` +
      (dossiers.length ? dossiers.map(([d, l]) => `<div class="cat">${esc(d)}</div><div class="galerie">${l.map(f =>
        `<img loading="lazy" src="Images/${encodeURIComponent(d)}/${encodeURIComponent(f)}" title="${esc(f)}" data-act="imageChoisie" data-v="Images/${esc(d)}/${esc(f)}">`).join("")}</div>`).join("")
        : `<div class="petit">${Stock.serveur ? "Aucune image dans Images\\ pour l'instant." : "Sans le serveur, seules les images du PC sont possibles."}</div>`));
    actions.imageChoisie = el => { fermerModale(); fn(el.dataset.v.split("/").map((s, i) => i ? encodeURIComponent(s) : s).join("/")); };
    actions.imageDuPc = () => {
      const f = $("#fichier");
      f.onchange = async () => { const x = f.files[0]; f.value = ""; if (!x) return; fermerModale(); fn(await Stock.image(x)); };
      f.click();
    };
  }

  async function fenetreLien() {
    let adr = [], dist = [];
    try { const r = await fetch("/__reseau", { cache: "no-store" }); const j = await r.json(); adr = j.adresses || []; dist = j.distance || []; } catch (e) {}
    const conv = u => u.replace(/Arbre-de-talents\.html.*$/, "Editeur-de-cartes.html?vue=joueur");
    const ici = location.origin + location.pathname + "?vue=joueur";
    modale("La vue des joueurs", `
      <div>Les joueurs ouvrent cette adresse sur leur tablette, leur téléphone ou leur PC. Ils voient la carte que tu as <b>montrée</b> (📡), avec le brouillard, et elle se met à jour toute seule.</div>
      ${adr.length ? `<div class="cat">Même Wi-Fi que ce PC</div>${adr.map(u => `<code>${esc(conv(u))}</code>`).join("<br>")}` : `<div class="petit">Pour les tablettes : lance l'appli avec l'Écran du Maître (mode réseau).</div>`}
      ${dist.length ? `<div class="cat">À distance (Tailscale)</div>${dist.map(u => `<code>${esc(conv(u))}</code>`).join("<br>")}` : ""}
      <div class="cat">Sur ce PC</div><code>${esc(ici)}</code>`,
      `<button data-act="ouvrirVueJoueurs" class="prim">Ouvrir la vue joueurs ici</button>`);
    actions.ouvrirVueJoueurs = () => { window.open(ici, "_blank"); fermerModale(); };
  }

  /* ================================================================ */
  /* La vue des joueurs                                                */
  /* ================================================================ */
  let dernierTexte = "", messageJoueur = "", vuePrise = 0, pingVu = 0;
  async function boucleJoueur() {
    try {
      let id = params.get("carte");
      if (!id) { const t = await Stock.table(); id = t && t.carte; }
      if (!id) {
        messageJoueur = "Le MJ n'a pas encore montré de carte…"; dernierTexte = "";
        carte = Carte.nouvelle({ nom: "", cols: 1, rows: 1 }); carte.calques.terrain.vis = false;
        $("#nomCarte").value = ""; aideOutil(); redessiner();
      } else {
        const txt = await Stock.lire(id);
        if (txt && txt !== dernierTexte) {
          dernierTexte = txt;
          const c = Carte.depuisJSON(txt), nouvelle = c.id !== carte.id;
          carte = c; $("#nomCarte").value = c.nom; messageJoueur = ""; aideOutil();
          if (nouvelle) { ajuster(); vuePrise = c.vueJoueurs ? c.vueJoueurs.t : 0; pingVu = c.ping ? c.ping.t : 0; }
          if (c.vueJoueurs && c.vueJoueurs.t > vuePrise) { vuePrise = c.vueJoueurs.t; allerVers(c.vueJoueurs); }
          if (c.ping && c.ping.t > pingVu) { pingVu = c.ping.t; if (Date.now() - c.ping.t < 15000) pings.push({ x: c.ping.x, y: c.ping.y, t0: performance.now() }); }
          redessiner();
        }
      }
    } catch (e) { messageJoueur = "Connexion perdue avec le PC du MJ…"; aideOutil(); }
    setTimeout(boucleJoueur, 1200);
  }
  function allerVers(v) {
    const z = Math.min(W / v.lw, H / v.lh);
    const de = { x: cam.x, y: cam.y, z: cam.z }, vers = { z, x: v.cx - W / 2 / z, y: v.cy - H / 2 / z }, t0 = performance.now();
    const pas = () => {
      const k = Math.min(1, (performance.now() - t0) / 500), e = k * (2 - k);
      cam.z = de.z + (vers.z - de.z) * e; cam.x = de.x + (vers.x - de.x) * e; cam.y = de.y + (vers.y - de.y) * e;
      majZoom(); redessiner(); if (k < 1) requestAnimationFrame(pas);
    };
    pas();
  }

  /* ================================================================ */
  /* Démarrage                                                         */
  /* ================================================================ */
  (async () => {
    taille();
    await Stock.sonder();
    statut();
    if (JOUEUR) { barreOutils(); boucleJoueur(); cv.style.cursor = curseur(); return; }
    barreOutils(); aideOutil();
    indexCache = await Stock.index();
    const voulu = params.get("carte") || Stock.ls.get("cartes:derniere");
    if (voulu && await chargerCarte(voulu)) return;
    if (indexCache.length && await chargerCarte(indexCache[0].id)) return;
    ouvrirCarte(Carte.nouvelle({ nom: "Nouvelle carte" }));
    fenetreNouvelle(true);
  })();
  cv.style.cursor = curseur();
})();
