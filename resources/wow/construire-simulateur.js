/* ============================================================
   Le simulateur : une copie de l'appli à publier sur le web (GitHub Pages),
   pour que les joueurs découvrent les races et les classes avant de choisir.
   - la Création se regarde (sans « Modifier », sans créer de personnage) ;
   - le Jeu et le Grimoire de chaque classe, sans rien pouvoir modifier ;
   - les arbres, les sorts et la création sont ceux du MJ au moment du
     lancement de ce script : il faut le relancer après des retouches.

   Lancé par l'Écran du Maître (Azeroth › Simulateur), qui lui donne :
     WOW_DONNEES  le dossier des données (Sauvegardes, Images) ;
     WOW_SORTIE   le dépôt du simulateur (par défaut ..\..\Simulateur à côté des données).
   Le code du jeu est celui de l'Écran, à côté de ce script.
   ============================================================ */
const fs = require("fs"), path = require("path");

/* Le code (la page), dans l'Écran ; les données, dans leur dossier. */
const APP = path.join(__dirname, "Application");
const DONNEES = process.env.WOW_DONNEES || APP;
const SORTIE = process.env.WOW_SORTIE || path.resolve(DONNEES, "..", "..", "Simulateur");
const SAVE = path.join(DONNEES, "Sauvegardes");
const IMAGES = path.join(DONNEES, "Images");
/* Les dossiers d'images qui ne servent qu'à l'Aventure ou au codex du MJ. */
const SANS = ["codex", "objets"];

const lit = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };

/* Chaque classe : la copie la plus récente, Permanent ou sauvegarde auto,
   comme le fait l'appli au démarrage. La fiche de perso du MJ n'est pas publiée. */
const classes = {};
const ids = new Set(["Permanent", "Temporaire"].flatMap(d => {
  try { return fs.readdirSync(path.join(SAVE, d)).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)); } catch (e) { return []; }
}));
ids.forEach(id => {
  const copies = ["Permanent", "Temporaire"].map(d => lit(path.join(SAVE, d, id + ".json"))).filter(Boolean)
    .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
  if (!copies.length) return;
  const d = copies[0];
  delete d.progress;
  classes[id] = d;
});

/* Les images : les dossiers utiles, copiés, et leur liste (le site n'a pas de serveur pour la lire). */
const EST_IMAGE = /\.(jpe?g|png|webp|gif|svg)$/i;
const galeries = {};
/* On repart d'un dossier propre, sauf son dépôt git (.git) : c'est lui qu'on publie. */
fs.mkdirSync(SORTIE, { recursive: true });
fs.readdirSync(SORTIE).filter(f => f !== ".git").forEach(f => fs.rmSync(path.join(SORTIE, f), { recursive: true, force: true, maxRetries: 3 }));
fs.mkdirSync(path.join(SORTIE, "Application", "Images"), { recursive: true });
fs.readdirSync(IMAGES, { withFileTypes: true }).filter(e => e.isDirectory() && !SANS.includes(e.name)).forEach(e => {
  const src = path.join(IMAGES, e.name), dst = path.join(SORTIE, "Application", "Images", e.name);
  fs.mkdirSync(dst, { recursive: true });
  galeries[e.name] = fs.readdirSync(src).filter(f => EST_IMAGE.test(f) && fs.statSync(path.join(src, f)).isFile());
  galeries[e.name].forEach(f => fs.copyFileSync(path.join(src, f), path.join(dst, f)));
});

/* La musique de fond : l'écran de connexion de Wrath of the Lich King. */
const MUSIQUE = path.resolve(DONNEES, "..", "..", "World of Warcraft Wrath of the Lich King Login Music.mp3");
if (fs.existsSync(MUSIQUE)) {
  fs.mkdirSync(path.join(SORTIE, "Application", "musique"), { recursive: true });
  fs.copyFileSync(MUSIQUE, path.join(SORTIE, "Application", "musique", "lich-king-connexion.mp3"));
} else console.log("  (musique introuvable : " + MUSIQUE + ")");

/* La page : l'appli, avec ses données embarquées juste après <base>. */
const donnees = { classes: classes, creation: lit(path.join(SAVE, "creation.json")), galeries: galeries,
                  construit: new Date().toISOString() };
const html = fs.readFileSync(path.join(APP, "Arbre-de-talents.html"), "utf8");
const base = '<base href="../">';
if (!html.includes(base)) throw new Error("<base href=\"../\"> introuvable dans Arbre-de-talents.html");
const json = JSON.stringify(donnees).replace(/</g, "\\u003c");
fs.writeFileSync(path.join(SORTIE, "Application", "index.html"),
  html.replace(base, base + "\n<script>window.SIMU_DONNEES = " + json + ";</script>"));

/* L'adresse du site mène directement au simulateur. */
fs.writeFileSync(path.join(SORTIE, "index.html"),
  '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Simulateur — World of Warcraft JDR</title>' +
  '<meta http-equiv="refresh" content="0; url=Application/index.html"></head>' +
  '<body style="background:#111;color:#ddd;font-family:sans-serif"><a href="Application/index.html" style="color:#ffd100">Ouvrir le simulateur</a></body></html>\n');
fs.writeFileSync(path.join(SORTIE, ".nojekyll"), "");
fs.writeFileSync(path.join(SORTIE, "README.md"),
  "# Simulateur — World of Warcraft JDR\n\n" +
  "Découvrir les races et les classes avant de créer son personnage : la création, " +
  "l'arbre de talents (mode Jeu) et le grimoire de chaque classe.\n\n" +
  "Fabriqué par l’Écran du Maître (Azeroth › Simulateur) — ne pas modifier ces fichiers à la main.\n");

const taille = d => fs.readdirSync(d, { withFileTypes: true }).filter(e => e.name !== ".git").reduce((s, e) =>
  s + (e.isDirectory() ? taille(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log("Simulateur fabriqué dans " + SORTIE);
console.log("  " + Object.keys(classes).length + " classes · " + Object.keys(galeries).length + " dossiers d'images · " +
  Math.round(taille(SORTIE) / 1048576) + " Mo");
