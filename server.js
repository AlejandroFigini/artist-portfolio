const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Servir todos los archivos estáticos desde el directorio raíz
app.use(express.static(path.join(__dirname)));

// Para manejar cualquier ruta no especificada y evitar errores 404 si el navegador busca rutas limpias
app.get('*', (req, res, next) => {
  // Si la petición no parece un archivo (no tiene extensión), asumimos que puede ser una ruta estática o el index
  if (!req.path.includes('.')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de Lucia Montaña corriendo en el puerto ${PORT}`);
});
