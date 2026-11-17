// Configuración de Expo. Toma todo de app.json; solo en la publicación web (GitHub Pages)
// la app vive dentro de la carpeta /APP-Pediatria, y esa ruta llega con la variable PEDIACONTROL_BASE_URL.
module.exports = ({ config }) => {
  const base = process.env.PEDIACONTROL_BASE_URL;
  if (!base) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl: base } };
};
