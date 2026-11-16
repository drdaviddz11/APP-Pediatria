// Configuración de Metro (el empaquetador de Expo).
// Necesaria para la versión de computadora (navegador): la base de datos SQLite funciona en el
// navegador con WebAssembly y requiere estos dos encabezados de seguridad (aislamiento de origen).
// Según la documentación de expo-sqlite (SDK 58), sección "Web setup".

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
