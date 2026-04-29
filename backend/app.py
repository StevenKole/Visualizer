from flask import Flask, jsonify, request
from flask_cors import CORS

from github_api import GitHubAPIError, fetch_commits


app = Flask(__name__)
CORS(app)


@app.get("/api/commits")
def get_commits():
    repo = request.args.get("repo", "").strip()

    if not repo:
        return jsonify({"error": "Missing required repo query parameter."}), 400

    try:
        return jsonify(fetch_commits(repo))
    except GitHubAPIError as error:
        return jsonify({"error": error.message}), error.status_code


@app.get("/api/health")
def health_check():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
