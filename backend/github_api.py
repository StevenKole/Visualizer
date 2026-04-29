import os
from typing import Any

import requests


GITHUB_API_BASE_URL = "https://api.github.com"
MAX_COMMITS = 100
PER_PAGE = 100


class GitHubAPIError(Exception):
    """Raised when GitHub returns an error that should be surfaced to clients."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _github_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-commit-history-visualizer",
    }

    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    return headers


def fetch_commits(repo: str) -> dict[str, list[dict[str, Any]]]:
    """
    Fetch and simplify the most recent commits for a GitHub repository.

    Args:
        repo: Repository name in "owner/repo" format.

    Returns:
        A graph-shaped payload containing commit nodes and parent-child edges.
    """
    repo = repo.strip()
    if not repo or "/" not in repo or len(repo.split("/")) != 2:
        raise GitHubAPIError("Repository must be in owner/repo format.", 400)

    commits: list[dict[str, Any]] = []
    page = 1

    while len(commits) < MAX_COMMITS:
        response = requests.get(
            f"{GITHUB_API_BASE_URL}/repos/{repo}/commits",
            headers=_github_headers(),
            params={"per_page": PER_PAGE, "page": page},
            timeout=15,
        )

        if response.status_code == 404:
            raise GitHubAPIError("Repository not found.", 404)

        if response.status_code == 409:
            # GitHub returns 409 for empty repositories.
            return {"nodes": [], "edges": []}

        if response.status_code in {403, 429}:
            remaining = response.headers.get("X-RateLimit-Remaining")
            reset = response.headers.get("X-RateLimit-Reset")
            if remaining == "0":
                raise GitHubAPIError(
                    "GitHub API rate limit exceeded. Try again later or set GITHUB_TOKEN.",
                    429,
                )

            raise GitHubAPIError(
                "GitHub API request was forbidden. Check repository access or API limits.",
                response.status_code,
            )

        if not response.ok:
            raise GitHubAPIError(
                f"GitHub API request failed with status {response.status_code}.",
                response.status_code,
            )

        page_commits = response.json()
        if not page_commits:
            break

        commits.extend(page_commits)

        if len(page_commits) < PER_PAGE:
            break

        page += 1

    return _transform_commits(commits[:MAX_COMMITS])


def _transform_commits(commits: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    nodes = []
    edges = []

    for item in commits:
        sha = item.get("sha", "")
        commit = item.get("commit", {})
        author = commit.get("author") or {}

        nodes.append(
            {
                "id": sha,
                "message": commit.get("message", ""),
                "author": author.get("name", "Unknown author"),
                "date": author.get("date", ""),
            }
        )

        for parent in item.get("parents", []):
            parent_sha = parent.get("sha")
            if parent_sha and sha:
                edges.append({"source": parent_sha, "target": sha})

    return {"nodes": nodes, "edges": edges}
