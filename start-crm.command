#!/bin/bash
# Doble clic en este archivo para arrancar el CRM sin usar la Terminal a mano.
cd "$(dirname "$0")"

if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "El CRM ya está corriendo en el puerto 3000."
else
  echo "Arrancando el CRM..."
  nohup npm run dev > /tmp/crm.log 2>&1 &
  disown
  sleep 3
fi

open http://localhost:3000
echo ""
echo "Listo. Puedes cerrar esta ventana — el CRM se queda corriendo en segundo plano."
echo "(Para pararlo del todo, usa stop-crm.command)"
read -p "Pulsa Enter para cerrar esta ventana... "
