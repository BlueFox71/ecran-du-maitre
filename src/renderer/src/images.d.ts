/* Vite rend l'adresse du fichier qu'il range avec le reste de l'application. */
declare module '*.png' {
  const url: string
  export default url
}
