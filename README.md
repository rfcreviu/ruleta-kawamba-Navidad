# Ruleta Kawamba � — Campaña de Navidad

Aplicación web de ruleta de premios con temática navideña, pensada para el stand/evento de **Kawamba**.

## 🚀 Puesta en marcha

1. Instala las dependencias (solo la primera vez):
   ```bash
   pip install -r requirements.txt
   ```
2. Arranca el servidor:
   ```bash
   python server.py
   ```
3. Abre en el navegador:
   - App pública: http://localhost:5000
   - Panel admin: http://localhost:5000/admin (PIN inicial: `1810`)

## 📱 Uso en móvil (durante el evento)

Con el servidor corriendo en un ordenador/portátil conectado a la misma red WiFi, desde el móvil entra a:
`http://<IP-del-ordenador>:5000`

## ⚙️ Panel de administración

Desde `/admin` puedes:
- Activar/desactivar premios.
- Ajustar el **peso** (probabilidad relativa) de cada premio — el panel muestra el % real resultante.
- Cambiar el PIN de acceso.
- Ver el historial de giros con su código único.
- Restaurar la configuración original.

El sorteo se calcula **en el servidor** (no en el navegador), por lo que no se puede manipular desde el cliente.

## 🖼️ Premios

Las imágenes de los premios están en `assets/premio1.jpg` ... `assets/premio7.jpg`.
Puedes sustituir estas imágenes por otras (mismo nombre de archivo) sin tocar el código.

## 🗂️ Estructura

```
server.py        -> Backend Flask (API + sorteo + persistencia)
index.html / app.js / styles.css -> App pública (ruleta)
admin.html / admin.js            -> Panel de administración
assets/           -> Imágenes de premios y fondo
data/config.json  -> Configuración de premios y PIN (se crea automáticamente)
data/history.json -> Historial de giros (se crea automáticamente)
```
