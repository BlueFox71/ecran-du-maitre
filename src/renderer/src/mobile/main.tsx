import { createRoot } from 'react-dom/client'
import { Mobile } from './Mobile'
import '../styles/mobile.css'

/*
 * La hauteur qu'on voit vraiment.
 *
 * L'application tient dans l'écran et fait défiler son milieu. Sur iPad,
 * Safari donne à « 100 % » la hauteur de la page *sous* ses barres : le bas
 * du cadre — et avec lui le bas de chaque onglet — tombait hors de vue, sans
 * qu'aucun défilement y mène. On mesure donc ce qui est visible, et on le
 * remesure quand les barres bougent, quand la tablette tourne ou quand le
 * clavier monte. Le facteur `scale` neutralise un pincement de la page :
 * agrandie, elle ne doit pas rapetisser.
 */
function mesurerHauteur(): void {
  const vv = window.visualViewport
  const h = vv ? vv.height * vv.scale : window.innerHeight
  if (h > 0) document.documentElement.style.setProperty('--haut', `${Math.round(h)}px`)
  /* Où commence ce qu'on voit : sur iPad, Safari peut faire glisser la page
     sous ses barres, et ce qui est fixé « en haut » partait au-dessus du
     visible — l'aperçu d'un document perdait son bouton « Fermer ». */
  const haut = vv && vv.scale === 1 ? Math.max(0, vv.offsetTop) : 0
  document.documentElement.style.setProperty('--haut-debut', `${Math.round(haut)}px`)
}
mesurerHauteur()
window.visualViewport?.addEventListener('resize', mesurerHauteur)
window.visualViewport?.addEventListener('scroll', mesurerHauteur)
window.addEventListener('resize', mesurerHauteur)
window.addEventListener('orientationchange', () => setTimeout(mesurerHauteur, 300))

createRoot(document.getElementById('root')!).render(<Mobile />)
