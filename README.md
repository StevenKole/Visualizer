# Visualizer
A visualizer for git / github.

## Run Locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

The Flask API runs at `http://127.0.0.1:5000`.

For a higher GitHub API rate limit, set a token before starting Flask:

```powershell
$env:GITHUB_TOKEN = "your_github_token"
```

### Frontend

Open a second terminal from the project root:

```powershell
cd frontend
python -m http.server 8000
```

Then open `http://127.0.0.1:8000` in your browser.
