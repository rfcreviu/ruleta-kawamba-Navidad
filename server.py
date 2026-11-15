"""
Servidor backend para la Ruleta de Premios - Campaña de Navidad (Kawamba)
Sirve el frontend estático y expone una API para:
 - Obtener la configuración de premios (nombre, imagen, peso/probabilidad, activo)
 - Actualizar la configuración desde el panel de administración (protegido con PIN)
 - Registrar el historial de giros (para estadísticas en el panel admin)
 - Realizar el "sorteo" real en el servidor para que no se pueda manipular desde el cliente
"""

import json
import os
import random
import string
import threading
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "config.json"
HISTORY_FILE = BASE_DIR / "data" / "history.json"
LOCK = threading.Lock()

app = Flask(__name__, static_folder=None)

def _p(id_, nombre, imagen, stock, peso=None):
    """Crea un premio. Si peso no se indica, se usa el stock como peso inicial.
    stock=None significa stock ilimitado (no se agota nunca)."""
    return {
        "id": id_,
        "nombre": nombre,
        "imagen": imagen,
        "peso": peso if peso is not None else (stock if stock is not None else 5),
        "stock": stock,
        "activo": True,
    }


DEFAULT_PRIZES = [
    _p("premio01", "Balde Coca-Cola", "assets/01-balde-coca-cola.png", None, peso=1),
    _p("premio02", "Kit Powerade Fanta", "assets/02-kit-powerade-fanta.png", None, peso=1),
    _p("premio03", "Nevera Frigo", "assets/03-nevera-frigo.png", None, peso=1),
    _p("premio04", "Ballantines", "assets/04-ballantines.png", None, peso=1),
    _p("premio05", "Ron Barceló", "assets/05-ron-barcelo.png", None, peso=1),
    _p("premio06", "Amaretto", "assets/06-amaretto.png", None, peso=1),
    _p("premio07", "Vino Tinto", "assets/07-vino-tinto.png", None, peso=1),
    _p("premio08", "Veterano", "assets/08-veterano.png", None, peso=1),
    _p("premio09", "Licor Melocotón", "assets/09-licor-melocoton.png", None, peso=1),
    _p("premio10", "Absolut", "assets/10-absolut.png", None, peso=1),
    _p("premio11", "Jägermeister", "assets/11-jagermeister.png", None, peso=1),
    _p("premio12", "Bombay", "assets/12-bombay.png", None, peso=1),
    _p("premio13", "Etiqueta Roja", "assets/13-etiqueta-roja.png", None, peso=1),
    _p("premio14", "Acompañamientos", "assets/14-acompanamientos.png", None, peso=1),
    _p("premio15", "Refrescos y Aguas", "assets/15-refrescos-aguas.png", None, peso=1),
    _p("premio16", "Cóctel", "assets/16-coctel.png", None, peso=1),
    _p("premio17", "Postre", "assets/17-postre.png", None, peso=1),
    _p("premio18", "Mahou para Dos", "assets/18-mahou-para-dos.png", None, peso=1),
    _p("premio19", "Pack Monster", "assets/19-pack-monster.png", None, peso=1),
    _p("premio20", "Reloj Coca-Cola", "assets/20-reloj-coca-cola.png", None, peso=1),
    _p("premio21", "Kit Fanta Polo", "assets/21-kit-fanta-polo.png", None, peso=1),
    _p("premio22", "Pack Fuze Tea", "assets/22-pack-fuze-tea.png", None, peso=1),
    _p("premio23", "Brindis Rosa", "assets/23-brindis-rosa.png", None, peso=1),
    _p("premio24", "Silla Nevera", "assets/24-silla-nevera.png", None, peso=1),
    _p("premio25", "7UP Camiseta", "assets/25-7up-camiseta.png", None, peso=1),
    _p("premio26", "Entreno Pádel", "assets/26-entreno-padel.png", None, peso=1),
    _p("premio27", "7UP Vaso", "assets/27-7up-vaso.png", None, peso=1),
    _p("premio28", "7UP Vaso + Dos Refrescos", "assets/28-7up-vaso-dos-refrescos.png", None, peso=1),
    _p("premio29", "Pack Canario 7UP Gorro", "assets/29-pack-canario-7up-gorro.png", None, peso=1),
    _p("premio30", "Pack Schweppes Sacachapas", "assets/30-pack-schweppes-sacachapas.png", None, peso=1),
]

DEFAULT_CONFIG = {
    "admin_pin": "2512",  # 25 de diciembre -> Navidad (cambiable desde el panel)
    "premios": DEFAULT_PRIZES,
}


def ensure_data_files():
    (BASE_DIR / "data").mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(json.dumps(DEFAULT_CONFIG, ensure_ascii=False, indent=2), encoding="utf-8")
    if not HISTORY_FILE.exists():
        HISTORY_FILE.write_text(json.dumps([], ensure_ascii=False, indent=2), encoding="utf-8")


def load_config():
    with LOCK:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def save_config(config):
    with LOCK:
        DATA_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def load_history():
    with LOCK:
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))


def append_history(entry):
    with LOCK:
        history = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        history.insert(0, entry)
        history = history[:500]  # limitar historial
        HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


def remove_history_entries(codigos):
    with LOCK:
        history = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        codigos_set = set(codigos)
        nueva_historia = [h for h in history if h.get("codigo") not in codigos_set]
        eliminados = len(history) - len(nueva_historia)
        HISTORY_FILE.write_text(json.dumps(nueva_historia, ensure_ascii=False, indent=2), encoding="utf-8")
        return eliminados


def gen_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def pick_prize(premios):
    activos = [
        p for p in premios
        if p.get("activo", True) and p.get("peso", 0) > 0
        and (p.get("stock") is None or p.get("stock", 0) > 0)
    ]
    if not activos:
        return None
    total = sum(p["peso"] for p in activos)
    r = random.uniform(0, total)
    acumulado = 0
    for p in activos:
        acumulado += p["peso"]
        if r <= acumulado:
            return p
    return activos[-1]


def decrement_stock(premio_id):
    """Descuenta 1 unidad de stock del premio indicado (si tiene stock limitado)."""
    with LOCK:
        config = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        for p in config["premios"]:
            if p["id"] == premio_id and p.get("stock") is not None:
                p["stock"] = max(0, p["stock"] - 1)
                if p["stock"] == 0:
                    p["activo"] = False
                break
        DATA_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def pick_prize_and_decrement():
    """Sortea un premio y descuenta su stock en una sola operación atómica,
    evitando que dos giros simultáneos ganen la última unidad del mismo premio."""
    with LOCK:
        config = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        premios = config["premios"]
        activos = [
            p for p in premios
            if p.get("activo", True) and p.get("peso", 0) > 0
            and (p.get("stock") is None or p.get("stock", 0) > 0)
        ]
        if not activos:
            return None, None
        total = sum(p["peso"] for p in activos)
        r = random.uniform(0, total)
        acumulado = 0
        elegido = activos[-1]
        for p in activos:
            acumulado += p["peso"]
            if r <= acumulado:
                elegido = p
                break

        for p in premios:
            if p["id"] == elegido["id"] and p.get("stock") is not None:
                p["stock"] = max(0, p["stock"] - 1)
                if p["stock"] == 0:
                    p["activo"] = False
                break

        DATA_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
        index_en_rueda = next(i for i, p in enumerate(premios) if p["id"] == elegido["id"])
        return dict(elegido), index_en_rueda


# ---------------------- RUTAS ESTÁTICAS ----------------------

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/admin")
def admin():
    return send_from_directory(BASE_DIR, "admin.html")


PUBLIC_FILES = {"app.js", "admin.js", "styles.css"}


@app.route("/<path:path>")
def static_files(path):
    # Solo se sirven los archivos públicos de la web y la carpeta assets/.
    # Nunca data/, server.py, etc. (contienen el PIN y datos de participantes).
    if path in PUBLIC_FILES:
        return send_from_directory(BASE_DIR, path)
    if path.startswith("assets/"):
        return send_from_directory(BASE_DIR / "assets", path[len("assets/"):])
    return jsonify({"error": "No encontrado"}), 404


# ---------------------- API PÚBLICA ----------------------

@app.route("/api/premios", methods=["GET"])
def api_premios():
    config = load_config()
    # No exponemos el pin de admin al público
    premios_publicos = [
        {"id": p["id"], "nombre": p["nombre"], "imagen": p["imagen"], "activo": p.get("activo", True)}
        for p in config["premios"]
    ]
    return jsonify({"premios": premios_publicos})


@app.route("/api/girar", methods=["POST"])
def api_girar():
    data = request.get_json(force=True, silent=True) or {}
    jugador = str(data.get("nombre", "")).strip()
    if not jugador:
        return jsonify({"error": "Debes indicar tu nombre antes de girar"}), 400
    if len(jugador) > 60:
        jugador = jugador[:60]

    correo = str(data.get("correo", "")).strip()
    if len(correo) > 120:
        correo = correo[:120]

    premio, index_en_rueda = pick_prize_and_decrement()
    if not premio:
        return jsonify({"error": "No hay premios activos configurados"}), 400

    codigo = gen_code()
    entry = {
        "codigo": codigo,
        "jugador": jugador,
        "correo": correo,
        "premio_id": premio["id"],
        "premio_nombre": premio["nombre"],
        "fecha": datetime.now().strftime("%d/%m/%Y %H:%M"),
    }
    append_history(entry)

    # Devolvemos el índice del premio dentro de la lista completa (incluye inactivos)
    # para que el frontend pueda animar la ruleta hacia el segmento correcto.

    return jsonify({
        "premio": {"id": premio["id"], "nombre": premio["nombre"], "imagen": premio["imagen"]},
        "index": index_en_rueda,
        "codigo": codigo,
    })


# ---------------------- API ADMIN ----------------------

def check_pin(data, config):
    return data.get("pin") == config.get("admin_pin")


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(force=True, silent=True) or {}
    config = load_config()
    if check_pin(data, config):
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "PIN incorrecto"}), 401


@app.route("/api/admin/premios", methods=["GET"])
def admin_get_premios():
    pin = request.args.get("pin", "")
    config = load_config()
    if pin != config.get("admin_pin"):
        return jsonify({"error": "No autorizado"}), 401
    return jsonify({"premios": config["premios"]})


@app.route("/api/admin/premios", methods=["POST"])
def admin_update_premios():
    data = request.get_json(force=True, silent=True) or {}
    config = load_config()
    if not check_pin(data, config):
        return jsonify({"ok": False, "error": "PIN incorrecto"}), 401

    nuevos_premios = data.get("premios")
    if not isinstance(nuevos_premios, list) or not nuevos_premios:
        return jsonify({"ok": False, "error": "Lista de premios inválida"}), 400

    for p in nuevos_premios:
        if "id" not in p or "nombre" not in p or "peso" not in p:
            return jsonify({"ok": False, "error": "Formato de premio inválido"}), 400
        p["peso"] = max(0, float(p["peso"]))
        p["activo"] = bool(p.get("activo", True))
        stock = p.get("stock", None)
        if stock is None or stock == "":
            p["stock"] = None
        else:
            p["stock"] = max(0, int(stock))

    config["premios"] = nuevos_premios
    save_config(config)
    return jsonify({"ok": True, "premios": config["premios"]})


@app.route("/api/admin/pin", methods=["POST"])
def admin_change_pin():
    data = request.get_json(force=True, silent=True) or {}
    config = load_config()
    if not check_pin(data, config):
        return jsonify({"ok": False, "error": "PIN incorrecto"}), 401
    nuevo_pin = str(data.get("nuevo_pin", "")).strip()
    if not nuevo_pin or len(nuevo_pin) < 4:
        return jsonify({"ok": False, "error": "El PIN debe tener al menos 4 caracteres"}), 400
    config["admin_pin"] = nuevo_pin
    save_config(config)
    return jsonify({"ok": True})


@app.route("/api/admin/historial", methods=["GET"])
def admin_historial():
    pin = request.args.get("pin", "")
    config = load_config()
    if pin != config.get("admin_pin"):
        return jsonify({"error": "No autorizado"}), 401
    history = load_history()
    return jsonify({"historial": history})


@app.route("/api/admin/historial", methods=["DELETE"])
def admin_historial_delete():
    data = request.get_json(force=True, silent=True) or {}
    config = load_config()
    if not check_pin(data, config):
        return jsonify({"ok": False, "error": "PIN incorrecto"}), 401

    codigos = data.get("codigos")
    if not isinstance(codigos, list) or not codigos:
        return jsonify({"ok": False, "error": "Debes indicar al menos un código a eliminar"}), 400

    eliminados = remove_history_entries(codigos)
    return jsonify({"ok": True, "eliminados": eliminados, "historial": load_history()})


@app.route("/api/admin/historial/clear", methods=["POST"])
def admin_historial_clear():
    data = request.get_json(force=True, silent=True) or {}
    config = load_config()
    if not check_pin(data, config):
        return jsonify({"ok": False, "error": "PIN incorrecto"}), 401
    with LOCK:
        HISTORY_FILE.write_text(json.dumps([], ensure_ascii=False, indent=2), encoding="utf-8")
    return jsonify({"ok": True})


@app.route("/api/admin/reset", methods=["POST"])
def admin_reset():
    data = request.get_json(force=True, silent=True) or {}
    config = load_config()
    if not check_pin(data, config):
        return jsonify({"ok": False, "error": "PIN incorrecto"}), 401
    config["premios"] = DEFAULT_PRIZES
    save_config(config)
    return jsonify({"ok": True, "premios": config["premios"]})


# Se ejecuta también cuando arranca con gunicorn (Railway)
ensure_data_files()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n� Ruleta Kawamba - Campaña de Navidad")
    print(f"   App:   http://localhost:{port}")
    print(f"   Admin: http://localhost:{port}/admin  (PIN inicial: 2512)\n")
    app.run(host="0.0.0.0", port=port, debug=True)
