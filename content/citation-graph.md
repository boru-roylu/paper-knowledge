---
title: Citation Graph
---

<div class="citation-graph-shell">
  <div class="citation-graph-toolbar">
    <input id="citation-search" type="search" placeholder="Filter by title, venue, year, or tag" />
    <select id="citation-project">
      <option value="">All projects</option>
      <option value="project-full-duplex-data">Full-duplex data and model</option>
      <option value="project-tts-data-pipeline">TTS data pipeline</option>
    </select>
    <button type="button" id="citation-reset">Reset</button>
  </div>
  <div class="citation-graph-grid">
    <div id="citation-graph" class="citation-graph-canvas"></div>
    <aside id="citation-detail" class="citation-graph-detail">
      <h2>Citation graph</h2>
      <p>Select a node to inspect incoming and outgoing local citations.</p>
    </aside>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.31.2/dist/cytoscape.min.js" defer></script>
<link rel="stylesheet" href="./static/citation-graph.css?v=1" />
<script src="./static/citation-graph.js?v=1" defer></script>
