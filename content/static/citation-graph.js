function initCitationGraph() {
  const container = document.getElementById('citation-graph')
  if (!container || container.dataset.ready === 'true') return
  if (!window.cytoscape) {
    setTimeout(initCitationGraph, 100)
    return
  }
  container.dataset.ready = 'true'

  const search = document.getElementById('citation-search')
  const project = document.getElementById('citation-project')
  const reset = document.getElementById('citation-reset')
  const detail = document.getElementById('citation-detail')

  fetch('./static/citation-graph-data.json')
    .then((res) => res.json())
    .then((data) => {
      const incoming = new Map()
      const outgoing = new Map()
      for (const node of data.nodes) {
        incoming.set(node.id, [])
        outgoing.set(node.id, [])
      }
      for (const edge of data.edges) {
        outgoing.get(edge.source)?.push(edge.target)
        incoming.get(edge.target)?.push(edge.source)
      }

      const byId = new Map(data.nodes.map((node) => [node.id, node]))
      const elements = [
        ...data.nodes.map((node) => ({
          data: {
            ...node,
            label: shortTitle(node.title),
            project: (node.tags || []).includes('project-full-duplex-data')
              ? 'full-duplex'
              : (node.tags || []).includes('project-tts-data-pipeline')
                ? 'tts'
                : '',
            indegree: incoming.get(node.id)?.length || 0,
            outdegree: outgoing.get(node.id)?.length || 0,
            search: [node.title, node.year, node.venue, ...(node.tags || [])].join(' ').toLowerCase(),
          },
        })),
        ...data.edges.map((edge) => ({ data: { id: `${edge.source}->${edge.target}`, ...edge } })),
      ]

      const cy = cytoscape({
        container,
        elements,
        wheelSensitivity: 0.15,
        minZoom: 0.25,
        maxZoom: 2.5,
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              width: 'mapData(indegree, 0, 8, 30, 72)',
              height: 'mapData(indegree, 0, 8, 30, 72)',
              'background-color': '#284b63',
              color: '#2b2b2b',
              'font-size': 10,
              'text-wrap': 'wrap',
              'text-max-width': 110,
              'text-valign': 'bottom',
              'text-margin-y': 6,
              'border-width': 2,
              'border-color': '#ffffff',
            },
          },
          {
            selector: 'node[project = "tts"]',
            style: { 'background-color': '#7b3f62' },
          },
          {
            selector: 'node[project = "full-duplex"]',
            style: { 'background-color': '#2f6f5e' },
          },
          {
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#9aa4ad',
              'target-arrow-color': '#9aa4ad',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              opacity: 0.72,
            },
          },
          {
            selector: '.faded',
            style: { opacity: 0.12, 'text-opacity': 0.12 },
          },
          {
            selector: '.selected',
            style: { 'background-color': '#c8553d', 'line-color': '#c8553d', 'target-arrow-color': '#c8553d', opacity: 1 },
          },
          {
            selector: '.hidden',
            style: { display: 'none' },
          },
        ],
        layout: {
          name: 'cose',
          animate: false,
          nodeRepulsion: 7000,
          idealEdgeLength: 120,
          componentSpacing: 140,
        },
      })

      function renderDetail(id) {
        const node = byId.get(id)
        if (!node || !detail) return
        const ins = incoming.get(id) || []
        const outs = outgoing.get(id) || []
        detail.innerHTML = `
          <h2>${escapeHtml(node.title)}</h2>
          <p class="citation-meta">${escapeHtml([node.year, node.venue].filter(Boolean).join(', '))}</p>
          <p><a class="internal" href="${node.url}">Open paper note</a></p>
          <h3>Cited by local papers (${ins.length})</h3>
          ${listLinks(ins)}
          <h3>Cites local papers (${outs.length})</h3>
          ${listLinks(outs)}
        `
      }

      function listLinks(ids) {
        if (!ids.length) return '<p class="citation-empty">None matched yet.</p>'
        return `<ul>${ids.map((id) => `<li><a class="internal" href="${byId.get(id)?.url || '#'}">${escapeHtml(byId.get(id)?.title || id)}</a></li>`).join('')}</ul>`
      }

      function focusNode(node) {
        cy.elements().addClass('faded').removeClass('selected')
        const neighborhood = node.closedNeighborhood()
        neighborhood.removeClass('faded').addClass('selected')
        node.removeClass('faded').addClass('selected')
        cy.animate({ fit: { eles: neighborhood, padding: 80 }, duration: 180 })
        renderDetail(node.id())
      }

      function applyFilter() {
        const q = (search?.value || '').trim().toLowerCase()
        const tag = project?.value || ''
        cy.elements().removeClass('hidden faded selected')
        cy.nodes().forEach((node) => {
          const okText = !q || node.data('search').includes(q)
          const okTag = !tag || (node.data('tags') || []).includes(tag)
          if (!(okText && okTag)) node.addClass('hidden')
        })
        cy.edges().forEach((edge) => {
          if (edge.source().hasClass('hidden') || edge.target().hasClass('hidden')) edge.addClass('hidden')
        })
      }

      cy.on('tap', 'node', (event) => focusNode(event.target))
      cy.on('tap', (event) => {
        if (event.target !== cy) return
        cy.elements().removeClass('faded selected')
      })
      search?.addEventListener('input', applyFilter)
      project?.addEventListener('change', applyFilter)
      reset?.addEventListener('click', () => {
        if (search) search.value = ''
        if (project) project.value = ''
        cy.elements().removeClass('hidden faded selected')
        cy.fit(undefined, 60)
      })
      applyFilter()
      cy.fit(undefined, 60)
    })
}

function shortTitle(title) {
  const words = String(title || '').split(/\s+/)
  return words.length > 8 ? `${words.slice(0, 8).join(' ')}...` : words.join(' ')
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}

document.addEventListener('DOMContentLoaded', initCitationGraph)
document.addEventListener('nav', initCitationGraph)
window.addEventListener('pageshow', initCitationGraph)
setTimeout(initCitationGraph, 0)
