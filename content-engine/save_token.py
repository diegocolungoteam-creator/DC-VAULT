#!/usr/bin/env python3
"""Guarda las credenciales de la API de Instagram (login de Instagram, graph.instagram.com).

Pide tres datos por separado, cada uno en su línea, para que nada se mezcle con un
comando ni quede en el historial del chat:
  - Instagram App ID     (Meta app → Instagram → "API setup with Instagram login")
  - Instagram App Secret (misma pantalla; hay que revelarlo)
  - Token IGAA...        (botón "Generate token" de esa misma pantalla)

Uso:  python3 save_token.py
"""
import json, pathlib, sys

DEST = pathlib.Path.home() / ".config" / "instagram" / "content-engine.json"

print("\n  Pega cada dato y pulsa Enter. Nada de esto se guarda en el historial.\n")
app_id = input("  Instagram App ID:\n  > ").strip()
secret = input("\n  Instagram App Secret (dale a 'Mostrar' y cópialo):\n  > ").strip()
token  = input("\n  Token de acceso (el IGAA... del botón 'Generate token'):\n  > ").strip()

if not app_id or not secret or not token:
    sys.exit("\n  Falta algún dato. No se ha guardado nada.")
if not token.startswith("IGA"):
    print("\n  Aviso: el token no empieza por 'IGA' — ¿seguro que copiaste el de login de Instagram?")

data = {}
if DEST.exists():
    try:
        data = json.loads(DEST.read_text())
    except Exception:
        data = {}

data["ig_app_id"] = app_id
data["ig_app_secret"] = secret
data["ig_user_token"] = token          # el fetch lo normaliza a 60 días y lo refresca solo
data.pop("ig_long_token", None)
data.pop("ig_expires_at", None)

DEST.parent.mkdir(parents=True, exist_ok=True)
DEST.write_text(json.dumps(data, indent=2))
DEST.chmod(0o600)

print(f"\n  Guardado en {DEST} (solo tú puedes leerlo).")
print("  Ahora dile a Claude: token guardado\n")
