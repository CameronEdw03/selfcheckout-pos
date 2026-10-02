from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

# Allow requests from the React frontend
CORS(app)


@app.route("/")
def home():
    return jsonify({
        "message": "Python backend is running!"
    })


@app.route("/api/hello")
def hello():
    return jsonify({
        "message": "Hello from Flask!"
    })


if __name__ == "__main__":
    app.run(debug=True)