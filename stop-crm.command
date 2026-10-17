#!/bin/bash
# Doble clic para parar el CRM que arrancó start-crm.command.
PID=$(lsof -ti :3000 -sTCP:LISTEN)
if [ -z "$PID" ]; then
  echo "El CRM no está corriendo."
else
  kill "$PID"
  echo "CRM parado."
fi
read -p "Pulsa Enter para cerrar esta ventana... "
