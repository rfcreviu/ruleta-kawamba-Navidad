#!/bin/bash
# Acceso directo para abrir la Ruleta Kawamba - Campaña de Navidad
# Doble clic en este archivo para arrancar el servidor y abrir la app en el navegador.

cd "$(dirname "$0")"

PORT=5050

# Si el puerto ya está en uso, asumimos que el servidor ya está corriendo y solo abrimos el navegador
if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "El servidor ya está corriendo en el puerto $PORT."
else
  echo "Iniciando servidor Kawamba..."
  PORT=$PORT /usr/local/bin/python3 server.py &
  sleep 1.5
fi

open "http://localhost:$PORT"

echo ""
echo "🎡 Ruleta Kawamba lista en http://localhost:$PORT"
echo "⚙  Panel Admin: http://localhost:$PORT/admin"
echo ""
echo "Puedes cerrar esta ventana sin problema; el servidor seguirá corriendo en segundo plano."
echo "Para detenerlo del todo, cierra la terminal o ejecuta: kill \$(lsof -ti :$PORT)"
read -p "Pulsa Enter para cerrar esta ventana..."
