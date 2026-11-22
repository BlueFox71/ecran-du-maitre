/* ============================================================
   Les tampons de décor, vus de dessus, dessinés par le code.
   Chaque tampon se dessine dans une boîte de -0.5 à 0.5 (une case
   par défaut) ; l'éditeur l'agrandit et le tourne à la demande.
   « l » et « h » : la taille par défaut, en cases.
   ============================================================ */
"use strict";
const Icones = (() => {
  const P = Math.PI * 2;
  const rond = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, P); };
  const disque = (c, x, y, r, f) => { rond(c, x, y, r); c.fillStyle = f; c.fill(); };
  const boite = (c, x, y, w, h, f, s, lw) => {
    c.beginPath(); c.rect(x, y, w, h);
    if (f) { c.fillStyle = f; c.fill(); }
    if (s) { c.strokeStyle = s; c.lineWidth = lw || .03; c.stroke(); }
  };
  const poly = (c, pts) => {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
  };
  const degrade = (c, r, a, b) => {
    const g = c.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r);
    g.addColorStop(0, a); g.addColorStop(1, b); return g;
  };
  function feuillage(c, r, a, b, lobes, graine) {
    let s = graine;
    const alea = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const g = degrade(c, r, a, b);
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < lobes; i++) {
      const t = i / lobes * P, rr = r * (.62 + alea() * .12);
      c.moveTo(Math.cos(t) * rr + r * .38, Math.sin(t) * rr);
      c.arc(Math.cos(t) * rr, Math.sin(t) * rr, r * .38, 0, P);
    }
    c.moveTo(r * .7, 0); c.arc(0, 0, r * .7, 0, P);
    c.fill();
  }
  function flamme(c, x, y, r) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "#fff6c0"); g.addColorStop(.35, "#ffc23a");
    g.addColorStop(.75, "rgba(230,80,20,.85)"); g.addColorStop(1, "rgba(200,40,10,0)");
    c.fillStyle = g; rond(c, x, y, r); c.fill();
  }


  /* Une montagne « de carte », vue de trois quarts : un versant éclairé,
     un versant dans l'ombre hachuré, le trait à l'encre. Sert aussi au
     style parchemin, qui en couvre la roche. */
  function montagne(c, x, y, s, g = .5) {
    const h = s * (.6 + g * .28), j = (g - .5) * s * .2;
    const pic = [x + j, y - h * .62], bg = [x - s / 2, y + h * .38], bd = [x + s / 2, y + h * .38], bm = [x + j * .3 + s * .07, y + h * .38];
    c.save();
    c.beginPath(); c.ellipse(x + s * .06, y + h * .4, s * .52, h * .12, 0, 0, P); c.fillStyle = "rgba(60,40,20,.2)"; c.fill();
    poly(c, [bg[0], bg[1], pic[0], pic[1], bm[0], bm[1]]);
    const l = c.createLinearGradient(bg[0], pic[1], bm[0], bg[1]);
    l.addColorStop(0, "#e6d2a2"); l.addColorStop(1, "#b8986a"); c.fillStyle = l; c.fill();
    poly(c, [bm[0], bm[1], pic[0], pic[1], bd[0], bd[1]]);
    const o = c.createLinearGradient(pic[0], pic[1], bd[0], bd[1]);
    o.addColorStop(0, "#8a6a44"); o.addColorStop(1, "#5e4428"); c.fillStyle = o; c.fill();
    c.strokeStyle = "rgba(42,28,14,.55)"; c.lineWidth = s * .018; c.lineCap = "round";
    for (let i = 1; i <= 4; i++) {
      const t = i / 5, ax = pic[0] + (bd[0] - pic[0]) * t, ay = pic[1] + (bd[1] - pic[1]) * t;
      c.beginPath(); c.moveTo(ax - s * .02, ay); c.lineTo(ax - s * .1 - t * s * .06, ay + s * .1 + t * s * .04); c.stroke();
    }
    c.beginPath(); c.moveTo(pic[0], pic[1]); c.lineTo(pic[0] + (bm[0] - pic[0]) * .45 + s * .03, pic[1] + (bm[1] - pic[1]) * .45); c.lineTo(bm[0], bm[1]); c.stroke();
    if (g > .72) {
      poly(c, [pic[0], pic[1], pic[0] - s * .1, pic[1] + h * .2, pic[0] - s * .03, pic[1] + h * .16, pic[0] + s * .02, pic[1] + h * .24, pic[0] + s * .09, pic[1] + h * .17]);
      c.fillStyle = "#f6f2e6"; c.fill();
    }
    c.beginPath(); c.moveTo(bg[0], bg[1]); c.lineTo(pic[0], pic[1]); c.lineTo(bd[0], bd[1]);
    c.strokeStyle = "#3a2814"; c.lineWidth = s * .035; c.lineJoin = "round"; c.stroke();
    c.restore();
  }
  /* Un arbre « de carte » : une boule de feuillage peinte, cerclée d'encre. */
  /* Le feuillage est fait de plusieurs lobes : on trace d'abord tous les
     contours épais, puis tous les remplissages par-dessus — il ne reste du
     contour que le bord extérieur, comme un trait d'encre autour du tout. */
  const LOBES = [[0, .12, .62], [-.42, .02, .44], [.42, .04, .46], [-.22, -.36, .44], [.24, -.34, .46], [0, -.52, .36]];
  function touffe(c, x, y, r, teinte) {
    c.beginPath(); c.ellipse(x + r * .3, y + r * .78, r * 1.05, r * .32, 0, 0, P); c.fillStyle = "rgba(40,30,10,.28)"; c.fill();
    c.fillStyle = "#4a3418"; c.fillRect(x - r * .09, y + r * .45, r * .18, r * .45);
    const clair = teinte ? teinte[0] : "#a6b852", sombre = teinte ? teinte[1] : "#3a5620";
    c.strokeStyle = "#26280e"; c.lineWidth = r * .16;
    for (const [lx, ly, lr] of LOBES) { rond(c, x + lx * r, y + ly * r, lr * r); c.stroke(); }
    const g = c.createRadialGradient(x - r * .4, y - r * .5, r * .1, x + r * .1, y, r * 1.1);
    g.addColorStop(0, clair); g.addColorStop(1, sombre);
    c.fillStyle = g;
    for (const [lx, ly, lr] of LOBES) { rond(c, x + lx * r, y + ly * r, lr * r); c.fill(); }
    c.fillStyle = "rgba(255,255,200,.18)";
    for (const [lx, ly, lr] of LOBES.slice(3)) { rond(c, x + (lx - .08) * r, y + (ly - .08) * r, lr * r * .45); c.fill(); }
  }
  function sapinCarte(c, x, y, r) {
    c.fillStyle = "#3a2814"; c.fillRect(x - r * .08, y + r * .5, r * .16, r * .35);
    poly(c, [x, y - r, x + r * .55, y + r * .55, x - r * .55, y + r * .55]);
    const g = c.createLinearGradient(x - r * .5, 0, x + r * .5, 0);
    g.addColorStop(0, "#5e8a48"); g.addColorStop(1, "#24401e"); c.fillStyle = g; c.fill();
    c.strokeStyle = "#1a2a10"; c.lineWidth = r * .08; c.stroke();
  }
  function maison(c, x, y, s, toit) {
    boite(c, x - s * .35, y - s * .1, s * .7, s * .45, "#d8c094", "#3a2814", s * .05);
    poly(c, [x - s * .45, y - s * .08, x, y - s * .5, x + s * .45, y - s * .08]);
    c.fillStyle = toit || "#9a3a22"; c.fill(); c.strokeStyle = "#3a2814"; c.lineWidth = s * .05; c.stroke();
    boite(c, x - s * .07, y + s * .1, s * .14, s * .25, "#4a2a14");
  }

  const LISTE = [
    /* ---- carte de région (style parchemin) ---- */
    { id: "montagne", nom: "Montagne", cat: "Carte", l: 2, h: 2, draw(c) { montagne(c, 0, .1, .95, .8); } },
    { id: "chaine", nom: "Chaîne de montagnes", cat: "Carte", l: 4, h: 2, draw(c) {
      c.save(); c.scale(.5, 1);
      montagne(c, -.55, .15, .7, .4); montagne(c, .5, .18, .65, .55); montagne(c, -.05, .1, .85, .85);
      c.restore();
    } },
    { id: "collines", nom: "Collines", cat: "Carte", l: 2, h: 1, draw(c) {
      for (const [x, s] of [[-.22, .5], [.2, .44]]) {
        c.beginPath(); c.moveTo(x - s / 2, .3); c.quadraticCurveTo(x, -.55, x + s / 2, .3); c.closePath();
        const g = c.createLinearGradient(x - s / 2, 0, x + s / 2, 0); g.addColorStop(0, "#c8b47a"); g.addColorStop(1, "#7a6a3c");
        c.fillStyle = g; c.fill(); c.strokeStyle = "#3a2814"; c.lineWidth = .03; c.stroke();
      }
    } },
    { id: "touffe", nom: "Arbre (carte)", cat: "Carte", l: 1, h: 1, draw(c) { touffe(c, 0, -.05, .36); } },
    { id: "foret_carte", nom: "Forêt", cat: "Carte", l: 3, h: 2, draw(c) {
      c.save(); c.scale(2 / 3, 1);
      const pts = [[-.5, -.15], [-.15, -.25], [.2, -.2], [.5, -.1], [-.35, .1], [0, .05], [.35, .15], [-.6, .25], [.6, .3], [.1, .3]];
      pts.sort((a, b) => a[1] - b[1]).forEach(([x, y], i) => touffe(c, x, y, .17, i % 2 ? ["#a4b456", "#40602a"] : ["#8aa044", "#34501e"]));
      c.restore();
    } },
    { id: "sapiniere", nom: "Forêt de sapins", cat: "Carte", l: 2, h: 2, draw(c) {
      const pts = [[-.25, -.2], [.12, -.25], [.32, 0], [-.05, .02], [-.32, .18], [.18, .22]];
      for (const [x, y] of pts.sort((a, b) => a[1] - b[1])) sapinCarte(c, x, y, .2);
    } },
    { id: "village", nom: "Village", cat: "Carte", l: 2, h: 2, draw(c) {
      maison(c, -.2, -.1, .38); maison(c, .2, -.02, .34, "#6a4a8a"); maison(c, -.02, .22, .36, "#3a5a9a");
    } },
    { id: "cite", nom: "Cité fortifiée", cat: "Carte", l: 3, h: 3, draw(c) {
      c.beginPath(); c.ellipse(0, .1, .46, .32, 0, 0, P); c.fillStyle = "#c8b48a"; c.fill();
      c.strokeStyle = "#5a5048"; c.lineWidth = .05; c.stroke();
      c.strokeStyle = "#3a2814"; c.lineWidth = .012; c.stroke();
      for (let i = 0; i < 6; i++) {
        const t = i / 6 * P, x = Math.cos(t) * .46, y = .1 + Math.sin(t) * .32;
        boite(c, x - .04, y - .1, .08, .12, "#a8a090", "#3a2814", .012);
        poly(c, [x - .05, y - .1, x, y - .17, x + .05, y - .1]); c.fillStyle = "#3a5a9a"; c.fill();
      }
      maison(c, -.15, .12, .2); maison(c, .14, .18, .18, "#6a4a8a");
      boite(c, -.08, -.2, .16, .3, "#b8b0a0", "#3a2814", .015);
      poly(c, [-.11, -.2, 0, -.38, .11, -.2]); c.fillStyle = "#3a5a9a"; c.fill(); c.strokeStyle = "#3a2814"; c.lineWidth = .015; c.stroke();
      c.strokeStyle = "#3a2814"; c.lineWidth = .012; c.beginPath(); c.moveTo(0, -.38); c.lineTo(0, -.47); c.stroke();
      poly(c, [0, -.47, .08, -.44, 0, -.41]); c.fillStyle = "#c8a030"; c.fill();
    } },
    { id: "entree_donjon", nom: "Entrée de donjon", cat: "Carte", l: 1, h: 1, draw(c) {
      montagne(c, 0, .12, .95, .3);
      c.beginPath(); c.moveTo(-.16, .3); c.lineTo(-.16, .1); c.arc(0, .1, .16, Math.PI, 0); c.lineTo(.16, .3); c.closePath();
      const g = c.createRadialGradient(0, .18, .02, 0, .18, .2); g.addColorStop(0, "#7a3ad0"); g.addColorStop(1, "#140a20");
      c.fillStyle = g; c.fill(); c.strokeStyle = "#2a1a0a"; c.lineWidth = .035; c.stroke();
    } },
    { id: "ruines", nom: "Ruines", cat: "Carte", l: 1, h: 1, draw(c) {
      for (const [x, hh] of [[-.25, .4], [-.05, .22], [.18, .5], [.34, .15]]) boite(c, x - .06, .3 - hh, .12, hh, "#c8bca4", "#3a2814", .025);
      boite(c, -.4, .3, .8, .06, "#a89c84", "#3a2814", .02);
    } },
    { id: "bateau", nom: "Bateau", cat: "Carte", l: 1, h: 1, draw(c) {
      c.beginPath(); c.moveTo(-.4, .1); c.lineTo(.4, .1); c.lineTo(.28, .3); c.lineTo(-.3, .3); c.closePath();
      c.fillStyle = "#6a4020"; c.fill(); c.strokeStyle = "#2a1808"; c.lineWidth = .03; c.stroke();
      c.beginPath(); c.moveTo(0, .1); c.lineTo(0, -.42); c.stroke();
      poly(c, [.02, -.38, .3, .02, .02, .02]); c.fillStyle = "#f0e6cc"; c.fill(); c.stroke();
      poly(c, [-.02, -.3, -.24, .02, -.02, .02]); c.fillStyle = "#e0d4b4"; c.fill(); c.stroke();
    } },

    /* ---- nature ---- */
    { id: "arbre", nom: "Arbre", cat: "Nature", l: 2, h: 2, draw(c) {
      feuillage(c, .48, "#7fb04a", "#2c5420", 9, 7);
      c.globalAlpha = .35; feuillage(c, .26, "#a8d06a", "#4f7d30", 6, 3); c.globalAlpha = 1;
    } },
    { id: "arbre2", nom: "Chêne sombre", cat: "Nature", l: 2, h: 2, draw(c) {
      feuillage(c, .48, "#55803a", "#1b3618", 11, 19);
      c.globalAlpha = .3; feuillage(c, .22, "#86b05a", "#35582a", 5, 4); c.globalAlpha = 1;
    } },
    { id: "sapin", nom: "Sapin", cat: "Nature", l: 1, h: 1, draw(c) {
      for (let k = 0; k < 3; k++) {
        const r = .48 - k * .13, pts = [];
        for (let i = 0; i < 16; i++) {
          const t = i / 16 * P + k * .2, rr = i % 2 ? r * .55 : r;
          pts.push(Math.cos(t) * rr, Math.sin(t) * rr);
        }
        poly(c, pts); c.fillStyle = ["#1f4a2c", "#2f6a3c", "#4a8a50"][k]; c.fill();
      }
    } },
    { id: "arbre_mort", nom: "Arbre mort", cat: "Nature", l: 1, h: 1, draw(c) {
      c.strokeStyle = "#4a3a2c"; c.lineCap = "round";
      const branche = (a, l, w, n) => {
        if (n === 0) return;
        c.lineWidth = w; c.beginPath(); c.moveTo(0, 0);
        const x = Math.cos(a) * l, y = Math.sin(a) * l; c.lineTo(x, y); c.stroke();
        c.save(); c.translate(x, y);
        branche(a - .5, l * .6, w * .6, n - 1); branche(a + .45, l * .55, w * .6, n - 1);
        c.restore();
      };
      for (let i = 0; i < 5; i++) branche(i / 5 * P + .3, .22, .07, 3);
      disque(c, 0, 0, .09, "#3a2c20");
    } },
    { id: "buisson", nom: "Buisson", cat: "Nature", l: 1, h: 1, draw(c) {
      feuillage(c, .4, "#6f9a40", "#2f5024", 7, 31);
    } },
    { id: "fleurs", nom: "Fleurs", cat: "Nature", l: 1, h: 1, draw(c) {
      feuillage(c, .32, "#6a9a44", "#36602a", 6, 11);
      const cols = ["#e8d040", "#e06090", "#f0f0f0", "#a070e0"];
      for (let i = 0; i < 9; i++) disque(c, Math.cos(i * 2.4) * .22 * (i % 3) / 2, Math.sin(i * 2.4) * .22 * (i % 3) / 2 + (i % 2) * .05, .045, cols[i % 4]);
    } },
    { id: "rocher", nom: "Rocher", cat: "Nature", l: 1, h: 1, draw(c) {
      poly(c, [-.42, .05, -.3, -.32, .05, -.42, .38, -.22, .44, .14, .2, .4, -.2, .38]);
      c.fillStyle = degrade(c, .45, "#a8a29a", "#4e4a46"); c.fill();
      c.strokeStyle = "#2e2b28"; c.lineWidth = .03; c.stroke();
      c.beginPath(); c.moveTo(-.1, -.2); c.lineTo(.05, .02); c.lineTo(.22, .08);
      c.strokeStyle = "rgba(40,36,32,.6)"; c.lineWidth = .025; c.stroke();
    } },
    { id: "rochers", nom: "Éboulis", cat: "Nature", l: 2, h: 2, draw(c) {
      const pierres = [[-.22, -.18, .2], [.18, -.12, .16], [.02, .2, .22], [-.28, .2, .11], [.3, .22, .1]];
      for (const [x, y, r] of pierres) {
        c.save(); c.translate(x, y);
        poly(c, [-r, 0, -r * .6, -r * .8, r * .3, -r, r, -r * .3, r * .8, r * .6, 0, r]);
        c.fillStyle = degrade(c, r, "#a09a92", "#4a4642"); c.fill();
        c.strokeStyle = "#2a2724"; c.lineWidth = .02; c.stroke(); c.restore();
      }
    } },
    { id: "champignons", nom: "Champignons", cat: "Nature", l: 1, h: 1, draw(c) {
      [[-.15, -.1, .16, "#b03a2e"], [.18, .05, .12, "#c9842a"], [-.05, .22, .1, "#b03a2e"]].forEach(([x, y, r, f]) => {
        disque(c, x, y, r, f);
        for (let i = 0; i < 4; i++) disque(c, x + Math.cos(i * 1.7) * r * .5, y + Math.sin(i * 1.7) * r * .5, r * .16, "#f4ead8");
      });
    } },
    { id: "cristal", nom: "Cristaux", cat: "Nature", l: 1, h: 1, draw(c) {
      [[0, -.05, .26, 0], [-.22, .15, .16, .6], [.22, .14, .15, -.5]].forEach(([x, y, r, a]) => {
        c.save(); c.translate(x, y); c.rotate(a);
        poly(c, [0, -r * 1.3, r * .6, -r * .2, r * .4, r * .9, -r * .4, r * .9, -r * .6, -r * .2]);
        c.fillStyle = "#6fc8f0"; c.fill(); c.strokeStyle = "#e6f8ff"; c.lineWidth = .02; c.stroke();
        poly(c, [0, -r * 1.3, r * .6, -r * .2, 0, r * .2]); c.fillStyle = "rgba(255,255,255,.35)"; c.fill();
        c.restore();
      });
    } },
    { id: "toile", nom: "Toile d'araignée", cat: "Nature", l: 2, h: 2, draw(c) {
      c.strokeStyle = "rgba(235,235,235,.8)"; c.lineWidth = .012;
      for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i / 8 * P) * .5, Math.sin(i / 8 * P) * .5); c.stroke(); }
      for (let r = .08; r < .5; r += .08) {
        c.beginPath();
        for (let i = 0; i <= 8; i++) { const t = i / 8 * P, x = Math.cos(t) * r, y = Math.sin(t) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
    } },

    /* ---- mobilier ---- */
    { id: "porte", nom: "Porte", cat: "Mobilier", l: 1, h: .3, draw(c) {
      boite(c, -.5, -.5, 1, 1, "#7a4a26", "#2a180c", .06);
      for (const x of [-.25, 0, .25]) { c.beginPath(); c.moveTo(x, -.5); c.lineTo(x, .5); c.strokeStyle = "#4a2c14"; c.lineWidth = .03; c.stroke(); }
      boite(c, -.42, -.5, .08, 1, "#3a3a3a"); boite(c, .34, -.5, .08, 1, "#3a3a3a");
    } },
    { id: "porte_fer", nom: "Herse / grille", cat: "Mobilier", l: 1, h: .3, draw(c) {
      boite(c, -.5, -.3, 1, .6, "rgba(30,30,34,.4)", "#1a1a1e", .06);
      c.strokeStyle = "#6a6a72"; c.lineWidth = .06;
      for (let x = -.4; x <= .41; x += .2) { c.beginPath(); c.moveTo(x, -.5); c.lineTo(x, .5); c.stroke(); }
    } },
    { id: "coffre", nom: "Coffre", cat: "Mobilier", l: 1, h: 1, draw(c) {
      boite(c, -.38, -.26, .76, .52, "#7a4a22", "#2a160a", .04);
      boite(c, -.38, -.06, .76, .12, "#5a3416");
      boite(c, -.3, -.26, .08, .52, "#c9a23e"); boite(c, .22, -.26, .08, .52, "#c9a23e");
      boite(c, -.06, -.06, .12, .14, "#e8c860", "#5a4010", .02);
    } },
    { id: "tonneau", nom: "Tonneau", cat: "Mobilier", l: 1, h: 1, draw(c) {
      disque(c, 0, 0, .36, degrade(c, .36, "#a87240", "#5a3418"));
      c.strokeStyle = "#3a3a3a"; c.lineWidth = .04; rond(c, 0, 0, .36); c.stroke(); rond(c, 0, 0, .24); c.stroke();
      disque(c, 0, 0, .04, "#2a1a0a");
    } },
    { id: "caisse", nom: "Caisse", cat: "Mobilier", l: 1, h: 1, draw(c) {
      boite(c, -.36, -.36, .72, .72, "#a07848", "#3a2612", .04);
      c.strokeStyle = "#6a4a26"; c.lineWidth = .06;
      c.beginPath(); c.moveTo(-.32, -.32); c.lineTo(.32, .32); c.moveTo(.32, -.32); c.lineTo(-.32, .32); c.stroke();
      boite(c, -.36, -.36, .72, .72, null, "#5a3a1c", .08);
    } },
    { id: "table", nom: "Table", cat: "Mobilier", l: 2, h: 1, draw(c) {
      boite(c, -.46, -.4, .92, .8, "#8a5a30", "#3a2210", .04);
      c.strokeStyle = "rgba(60,36,16,.5)"; c.lineWidth = .02;
      for (let y = -.2; y < .4; y += .2) { c.beginPath(); c.moveTo(-.46, y); c.lineTo(.46, y); c.stroke(); }
      disque(c, -.2, 0, .07, "#d8d0c0"); disque(c, .15, -.05, .05, "#c0a050");
    } },
    { id: "table_ronde", nom: "Table ronde", cat: "Mobilier", l: 1, h: 1, draw(c) {
      disque(c, 0, 0, .4, degrade(c, .4, "#a06a3a", "#5a3416"));
      c.strokeStyle = "#3a2210"; c.lineWidth = .03; rond(c, 0, 0, .4); c.stroke();
      disque(c, .08, -.06, .07, "#d8d0c0");
    } },
    { id: "chaise", nom: "Chaise / tabouret", cat: "Mobilier", l: .5, h: .5, draw(c) {
      boite(c, -.4, -.4, .8, .8, "#7a4a24", "#2a180a", .08);
      boite(c, -.4, -.4, .8, .2, "#5a3416");
    } },
    { id: "lit", nom: "Lit", cat: "Mobilier", l: 1, h: 2, draw(c) {
      boite(c, -.42, -.48, .84, .96, "#6a4020", "#2a1608", .03);
      boite(c, -.36, -.42, .72, .2, "#e8e0d0", "#a09888", .02);
      boite(c, -.38, -.16, .76, .6, "#6a2830", "#3a1218", .02);
      c.strokeStyle = "rgba(255,220,140,.4)"; c.lineWidth = .02;
      c.beginPath(); c.moveTo(-.38, 0); c.lineTo(.38, 0); c.stroke();
    } },
    { id: "etagere", nom: "Bibliothèque", cat: "Mobilier", l: 2, h: .5, draw(c) {
      boite(c, -.5, -.4, 1, .8, "#5a3416", "#2a1608", .05);
      const cols = ["#7a2a2a", "#2a4a7a", "#2a6a3a", "#8a6a2a", "#5a2a6a"];
      for (let i = 0; i < 12; i++) boite(c, -.46 + i * .077, -.3, .065, .6, cols[i % 5]);
    } },
    { id: "escalier", nom: "Escalier", cat: "Mobilier", l: 1, h: 2, draw(c) {
      for (let i = 0; i < 8; i++) {
        const k = i / 8;
        boite(c, -.45, -.5 + k, .9, 1 / 8, `rgb(${150 - i * 12},${142 - i * 12},${132 - i * 12})`, "#2a2622", .015);
      }
      c.fillStyle = "#e8d8a0"; c.beginPath(); c.moveTo(0, -.42); c.lineTo(.12, -.28); c.lineTo(-.12, -.28); c.fill();
    } },
    { id: "colonne", nom: "Colonne", cat: "Mobilier", l: 1, h: 1, draw(c) {
      boite(c, -.42, -.42, .84, .84, "#7a766e", "#3a3732", .03);
      disque(c, 0, 0, .32, degrade(c, .32, "#d8d2c4", "#7a746a"));
      c.strokeStyle = "#5a554e"; c.lineWidth = .02; rond(c, 0, 0, .32); c.stroke(); rond(c, 0, 0, .22); c.stroke();
    } },
    { id: "statue", nom: "Statue", cat: "Mobilier", l: 1, h: 1, draw(c) {
      boite(c, -.44, -.44, .88, .88, "#6a665e", "#2a2824", .03);
      disque(c, 0, .02, .26, "#a8a49a");
      disque(c, 0, -.1, .13, "#c8c4ba");
      boite(c, -.32, -.02, .64, .1, "#a8a49a");
    } },
    { id: "autel", nom: "Autel", cat: "Mobilier", l: 2, h: 1, draw(c) {
      boite(c, -.46, -.32, .92, .64, "#d8d0c0", "#5a554e", .03);
      boite(c, -.4, -.26, .8, .52, "#6a1a22");
      for (const x of [-.3, .3]) { disque(c, x, 0, .07, "#f0e8d0"); flamme(c, x, 0, .12); }
      c.strokeStyle = "#e8c860"; c.lineWidth = .03;
      c.beginPath(); c.moveTo(0, -.16); c.lineTo(0, .16); c.moveTo(-.1, -.06); c.lineTo(.1, -.06); c.stroke();
    } },
    { id: "puits", nom: "Puits", cat: "Mobilier", l: 1, h: 1, draw(c) {
      disque(c, 0, 0, .42, "#7a746a");
      c.strokeStyle = "#3a3732"; c.lineWidth = .02;
      for (let i = 0; i < 12; i++) { const t = i / 12 * P; c.beginPath(); c.moveTo(Math.cos(t) * .28, Math.sin(t) * .28); c.lineTo(Math.cos(t) * .42, Math.sin(t) * .42); c.stroke(); }
      disque(c, 0, 0, .28, degrade(c, .28, "#3a6a9a", "#0a1a2a"));
      boite(c, -.46, -.04, .92, .08, "#6a4020");
    } },

    /* ---- feu et lumière ---- */
    { id: "feu", nom: "Feu de camp", cat: "Lumière", l: 1, h: 1, draw(c) {
      for (let i = 0; i < 8; i++) { const t = i / 8 * P; disque(c, Math.cos(t) * .3, Math.sin(t) * .3, .09, "#6a6660"); }
      c.strokeStyle = "#4a2c14"; c.lineWidth = .07; c.lineCap = "round";
      c.beginPath(); c.moveTo(-.2, -.12); c.lineTo(.2, .12); c.moveTo(-.2, .12); c.lineTo(.2, -.12); c.stroke();
      flamme(c, 0, 0, .28);
    } },
    { id: "brasero", nom: "Brasero / torche", cat: "Lumière", l: 1, h: 1, draw(c) {
      c.globalAlpha = .35; flamme(c, 0, 0, .5); c.globalAlpha = 1;
      disque(c, 0, 0, .16, "#3a3a3e"); flamme(c, 0, 0, .16);
    } },
    { id: "lumiere", nom: "Halo de lumière", cat: "Lumière", l: 4, h: 4, draw(c) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, .5);
      g.addColorStop(0, "rgba(255,210,120,.45)"); g.addColorStop(1, "rgba(255,180,80,0)");
      c.fillStyle = g; rond(c, 0, 0, .5); c.fill();
    } },

    /* ---- bâtiments ---- */
    { id: "maison", nom: "Maison", cat: "Bâtiments", l: 3, h: 2, draw(c) {
      boite(c, -.48, -.46, .96, .92, "#8a3a2a", "#2a120c", .03);
      poly(c, [-.48, -.46, .48, -.46, .3, 0, -.3, 0]); c.fillStyle = "#a04a34"; c.fill();
      poly(c, [-.48, .46, .48, .46, .3, 0, -.3, 0]); c.fillStyle = "#6a2a1e"; c.fill();
      c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = .015;
      for (let y = -.4; y < .46; y += .08) { c.beginPath(); c.moveTo(-.48, y); c.lineTo(.48, y); c.stroke(); }
      c.strokeStyle = "#3a160e"; c.lineWidth = .03;
      c.beginPath(); c.moveTo(-.3, 0); c.lineTo(.3, 0); c.stroke();
      boite(c, .18, -.36, .1, .12, "#5a5550", "#2a2724", .02);
    } },
    { id: "tente", nom: "Tente", cat: "Bâtiments", l: 2, h: 2, draw(c) {
      poly(c, [0, -.46, .46, 0, 0, .46, -.46, 0]); c.fillStyle = "#c8b48a"; c.fill();
      poly(c, [0, -.46, .46, 0, 0, 0]); c.fillStyle = "#e0cca0"; c.fill();
      poly(c, [0, .46, -.46, 0, 0, 0]); c.fillStyle = "#a8946a"; c.fill();
      c.strokeStyle = "#5a4a30"; c.lineWidth = .02; poly(c, [0, -.46, .46, 0, 0, .46, -.46, 0]); c.stroke();
      c.beginPath(); c.moveTo(0, -.46); c.lineTo(0, .46); c.moveTo(-.46, 0); c.lineTo(.46, 0); c.stroke();
    } },
    { id: "tour", nom: "Tour", cat: "Bâtiments", l: 2, h: 2, draw(c) {
      disque(c, 0, 0, .46, "#6a665e");
      for (let i = 0; i < 12; i++) { const t = i / 12 * P; c.save(); c.translate(Math.cos(t) * .4, Math.sin(t) * .4); c.rotate(t); boite(c, -.06, -.07, .12, .14, "#8a857c", "#3a3732", .015); c.restore(); }
      disque(c, 0, 0, .32, "#5a4632");
      c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = .015;
      for (let x = -.3; x < .32; x += .08) { c.beginPath(); c.moveTo(x, -.3); c.lineTo(x, .3); c.stroke(); }
    } },
    { id: "pont", nom: "Pont de bois", cat: "Bâtiments", l: 1, h: 3, draw(c) {
      for (let i = 0; i < 12; i++) boite(c, -.4, -.5 + i / 12, .8, 1 / 12 - .01, i % 2 ? "#8a5a30" : "#7a4e28", "#3a2210", .008);
      boite(c, -.46, -.5, .06, 1, "#5a3416"); boite(c, .4, -.5, .06, 1, "#5a3416");
    } },

    /* ---- danger et repères ---- */
    { id: "piege", nom: "Piège", cat: "Repères", l: 1, h: 1, draw(c) {
      boite(c, -.4, -.4, .8, .8, "rgba(140,20,20,.35)", "#c0302a", .04);
      for (let i = 0; i < 9; i++) {
        const x = -.26 + (i % 3) * .26, y = -.26 + Math.floor(i / 3) * .26;
        poly(c, [x, y - .09, x + .07, y + .06, x - .07, y + .06]); c.fillStyle = "#c8c8cc"; c.fill();
      }
    } },
    { id: "os", nom: "Crâne et os", cat: "Repères", l: 1, h: 1, draw(c) {
      c.strokeStyle = "#e8e0cc"; c.lineWidth = .07; c.lineCap = "round";
      c.beginPath(); c.moveTo(-.3, .3); c.lineTo(.3, -.05); c.moveTo(.3, .3); c.lineTo(-.3, -.05); c.stroke();
      disque(c, 0, -.12, .2, "#ece4d0");
      disque(c, -.07, -.14, .05, "#2a2420"); disque(c, .07, -.14, .05, "#2a2420");
      boite(c, -.08, .02, .16, .08, "#ece4d0");
    } },
    { id: "sang", nom: "Tache de sang", cat: "Repères", l: 1, h: 1, draw(c) {
      c.fillStyle = "rgba(120,10,14,.8)";
      c.beginPath(); c.arc(0, 0, .22, 0, P);
      for (let i = 0; i < 7; i++) { const t = i * .9, r = .26 + (i % 3) * .07; c.moveTo(Math.cos(t) * r + .06, Math.sin(t) * r); c.arc(Math.cos(t) * r, Math.sin(t) * r, .06, 0, P); }
      c.fill();
    } },
    { id: "quete", nom: "Quête « ! »", cat: "Repères", l: 1, h: 1, draw(c) {
      c.scale(.01, .01); c.font = "bold 90px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineWidth = 8; c.strokeStyle = "#2a1a00"; c.strokeText("!", 0, 4);
      c.fillStyle = "#ffd100"; c.fillText("!", 0, 4);
    } },
    { id: "rendu", nom: "Quête « ? »", cat: "Repères", l: 1, h: 1, draw(c) {
      c.scale(.01, .01); c.font = "bold 90px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineWidth = 8; c.strokeStyle = "#2a1a00"; c.strokeText("?", 0, 4);
      c.fillStyle = "#ffd100"; c.fillText("?", 0, 4);
    } },
    { id: "etoile", nom: "Étoile", cat: "Repères", l: 1, h: 1, draw(c) {
      const pts = [];
      for (let i = 0; i < 10; i++) { const t = i / 10 * P - Math.PI / 2, r = i % 2 ? .18 : .44; pts.push(Math.cos(t) * r, Math.sin(t) * r); }
      poly(c, pts); c.fillStyle = "#ffd76a"; c.fill(); c.strokeStyle = "#6a4a00"; c.lineWidth = .03; c.stroke();
    } },
    { id: "drapeau", nom: "Drapeau", cat: "Repères", l: 1, h: 1, draw(c) {
      c.strokeStyle = "#3a2a1a"; c.lineWidth = .05; c.beginPath(); c.moveTo(-.25, .45); c.lineTo(-.25, -.45); c.stroke();
      poly(c, [-.25, -.45, .4, -.3, -.25, -.12]); c.fillStyle = "#2a5ab0"; c.fill();
      c.strokeStyle = "#ffd100"; c.lineWidth = .02; c.stroke();
    } },
    { id: "croix", nom: "Croix « ici »", cat: "Repères", l: 1, h: 1, draw(c) {
      c.strokeStyle = "#c0201a"; c.lineWidth = .12; c.lineCap = "round";
      c.beginPath(); c.moveTo(-.3, -.3); c.lineTo(.3, .3); c.moveTo(.3, -.3); c.lineTo(-.3, .3); c.stroke();
    } },
    { id: "boussole", nom: "Rose des vents", cat: "Repères", l: 3, h: 3, draw(c) {
      rond(c, 0, 0, .3); c.strokeStyle = "#c9a23e"; c.lineWidth = .015; c.stroke();
      for (let i = 0; i < 8; i++) {
        const t = i / 8 * P - Math.PI / 2, r = i % 2 ? .25 : .46;
        c.save(); c.rotate(t);
        poly(c, [r, 0, 0, -.05, 0, .05]); c.fillStyle = i % 2 ? "#8a7a5a" : "#e8d8a8"; c.fill();
        poly(c, [r, 0, 0, 0, 0, .05]); c.fillStyle = i % 2 ? "#5a4a2a" : "#a8945a"; c.fill();
        c.restore();
      }
      c.scale(.01, .01); c.font = "bold 12px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = "#f0e0b0"; c.fillText("N", 0, -48);
    } }
  ];

  const parId = {};
  for (const i of LISTE) parId[i.id] = i;

  /* L'aperçu pour la palette : un petit PNG de chaque tampon. */
  function apercu(i) {
    if (i.apercu) return i.apercu;
    const c = document.createElement("canvas"), n = 56;
    c.width = c.height = n;
    const x = c.getContext("2d");
    const k = n * .9 / Math.max(i.l, i.h);
    x.translate(n / 2, n / 2); x.scale(k * i.l, k * i.h);
    i.draw(x);
    return (i.apercu = c.toDataURL());
  }

  return { LISTE, parId, apercu, montagne };
})();
