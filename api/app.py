from flask import Flask, jsonify

app = Flask(__name__)

MENU = [
    {"id": 1, "name": "Espresso", "price": 120},
    {"id": 2, "name": "Cappuccino", "price": 180},
    {"id": 3, "name": "Latte", "price": 170},
    {"id": 4, "name": "Cold Brew", "price": 190},
    {"id": 5, "name": "Mocha", "price": 210},
]


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.get("/menu")
def menu():
    return jsonify(MENU)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
