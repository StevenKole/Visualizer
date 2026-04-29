const API_BASE_URL = "http://127.0.0.1:5000";

const form = document.querySelector("#repo-form");
const repoInput = document.querySelector("#repo-input");
const statusMessage = document.querySelector("#status-message");
const detailsPanel = document.querySelector("#commit-details");
const svg = d3.select("#commit-graph");

let simulation;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const repo = repoInput.value.trim();
  if (!isValidRepo(repo)) {
    showStatus("Enter a repository in owner/repo format.", true);
    return;
  }

  await loadRepository(repo);
});

async function loadRepository(repo) {
  setLoading(true);
  showStatus(`Loading ${repo}...`);
  clearDetails();
  clearGraph();

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/commits?repo=${encodeURIComponent(repo)}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to load repository commits.");
    }

    if (!payload.nodes.length) {
      showStatus("This repository has no commits yet.");
      return;
    }

    showStatus(`Loaded ${payload.nodes.length} commits. Scroll to zoom, drag to pan.`);
    renderGraph(payload);
  } catch (error) {
    showStatus(error.message || "Network error while loading commits.", true);
  } finally {
    setLoading(false);
  }
}

function renderGraph(graph) {
  clearGraph();

  const container = svg.node();
  const { width, height } = container.getBoundingClientRect();

  const root = svg.append("g");
  const linksGroup = root.append("g").attr("class", "links");
  const nodesGroup = root.append("g").attr("class", "nodes");
  const labelsGroup = root.append("g").attr("class", "labels");

  svg.call(
    d3
      .zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        root.attr("transform", event.transform);
      }),
  );

  svg
    .append("defs")
    .append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 18)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", "#64748b")
    .attr("d", "M0,-5L10,0L0,5");

  const knownNodeIds = new Set(graph.nodes.map((node) => node.id));
  const links = graph.edges.filter(
    (edge) => knownNodeIds.has(edge.source) && knownNodeIds.has(edge.target),
  );

  const link = linksGroup
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "link")
    .attr("marker-end", "url(#arrow)");

  const node = nodesGroup
    .selectAll("circle")
    .data(graph.nodes)
    .join("circle")
    .attr("class", "node")
    .attr("r", 8)
    .attr("fill", (_, index) => d3.interpolateTurbo(index / Math.max(graph.nodes.length, 1)))
    .on("click", (event, commit) => {
      event.stopPropagation();
      showCommitDetails(commit);
      node.classed("selected", (candidate) => candidate.id === commit.id);
    })
    .call(
      d3
        .drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded),
    );

  const label = labelsGroup
    .selectAll("text")
    .data(graph.nodes)
    .join("text")
    .attr("class", "node-label")
    .attr("dy", -13)
    .text((commit) => commit.id.slice(0, 7));

  simulation = d3
    .forceSimulation(graph.nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((commit) => commit.id)
        .distance(70)
        .strength(0.8),
    )
    .force("charge", d3.forceManyBody().strength(-180))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(22))
    .on("tick", () => {
      link
        .attr("x1", (edge) => edge.source.x)
        .attr("y1", (edge) => edge.source.y)
        .attr("x2", (edge) => edge.target.x)
        .attr("y2", (edge) => edge.target.y);

      node.attr("cx", (commit) => commit.x).attr("cy", (commit) => commit.y);
      label.attr("x", (commit) => commit.x).attr("y", (commit) => commit.y);
    });
}

function dragStarted(event) {
  if (!event.active) {
    simulation.alphaTarget(0.3).restart();
  }

  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
}

function dragged(event) {
  event.subject.fx = event.x;
  event.subject.fy = event.y;
}

function dragEnded(event) {
  if (!event.active) {
    simulation.alphaTarget(0);
  }

  event.subject.fx = null;
  event.subject.fy = null;
}

function showCommitDetails(commit) {
  detailsPanel.classList.remove("empty");
  detailsPanel.innerHTML = `
    <div>
      <div class="detail-label">Message</div>
      <div class="detail-value">${escapeHtml(commit.message)}</div>
    </div>
    <div>
      <div class="detail-label">Author</div>
      <div class="detail-value">${escapeHtml(commit.author || "Unknown author")}</div>
    </div>
    <div>
      <div class="detail-label">Date</div>
      <div class="detail-value">${formatDate(commit.date)}</div>
    </div>
    <div>
      <div class="detail-label">SHA</div>
      <div class="detail-value sha">${escapeHtml(commit.id)}</div>
    </div>
  `;
}

function clearDetails() {
  detailsPanel.classList.add("empty");
  detailsPanel.textContent = "Click a commit node to view its details.";
}

function clearGraph() {
  if (simulation) {
    simulation.stop();
  }

  svg.selectAll("*").remove();
}

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
  statusMessage.classList.remove("hidden");
}

function setLoading(isLoading) {
  repoInput.disabled = isLoading;
  form.querySelector("button").disabled = isLoading;
}

function isValidRepo(repo) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

function formatDate(value) {
  if (!value) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
