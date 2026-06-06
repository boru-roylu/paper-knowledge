function initCitationGraph() {
  const container = document.getElementById('citation-graph')
  if (!container || container.dataset.ready === 'true') return
  if (!window.cytoscape) {
    loadScriptOnce('https://cdn.jsdelivr.net/npm/cytoscape@3.31.2/dist/cytoscape.min.js')
      .then(initCitationGraph)
      .catch(() => {
        container.textContent = 'Citation graph could not load the graph library.'
      })
    return
  }
  container.dataset.ready = 'true'

  const search = document.getElementById('citation-search')
  const project = document.getElementById('citation-project')
  const showIsolated = document.getElementById('citation-show-isolated')
  const showIsolatedToggle = showIsolated?.closest('.citation-toggle')
  const reset = document.getElementById('citation-reset')
  const detail = document.getElementById('citation-detail')

  fetch('/static/citation-graph-data.json')
    .then((res) => res.json())
    .then((data) => {
      const nodeIds = new Set((data.nodes || []).map((node) => node.id))
      const validEdges = (data.edges || []).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      const incoming = new Map()
      const outgoing = new Map()
      for (const node of data.nodes) {
        incoming.set(node.id, [])
        outgoing.set(node.id, [])
      }
      for (const edge of validEdges) {
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
        ...validEdges.map((edge) => ({ data: { id: `${edge.source}->${edge.target}`, ...edge } })),
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
              width: 'mapData(indegree, 0, 8, 24, 54)',
              height: 'mapData(indegree, 0, 8, 24, 54)',
              'background-color': '#284b63',
              color: '#2b2b2b',
              'font-size': 9,
              'font-weight': 600,
              'text-wrap': 'wrap',
              'text-max-width': 78,
              'text-halign': 'center',
              'text-valign': 'bottom',
              'text-margin-y': 14,
              'text-background-color': '#faf8f8',
              'text-background-opacity': 0.86,
              'text-background-padding': 2,
              'text-background-shape': 'roundrectangle',
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
              'line-color': '#4f6472',
              'target-arrow-color': '#4f6472',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              opacity: 0.95,
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
          nodeRepulsion: 22000,
          idealEdgeLength: 260,
          componentSpacing: 180,
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
        const includeIsolated = Boolean(showIsolated?.checked)
        showIsolatedToggle?.classList.toggle('is-active', includeIsolated)
        showIsolatedToggle?.setAttribute('aria-pressed', String(includeIsolated))
        cy.elements().removeClass('hidden faded selected')
        cy.nodes().forEach((node) => {
          const okText = !q || node.data('search').includes(q)
          const okTag = !tag || (node.data('tags') || []).includes(tag)
          const degree = (node.data('indegree') || 0) + (node.data('outdegree') || 0)
          const okDegree = includeIsolated || degree > 0
          if (!(okText && okTag && okDegree)) node.addClass('hidden')
        })
        cy.edges().forEach((edge) => {
          if (edge.source().hasClass('hidden') || edge.target().hasClass('hidden')) edge.addClass('hidden')
        })
        cy.elements().removeClass('faded selected')
        relayoutVisible()
      }

      function relayoutVisible() {
        const visible = cy.elements().not('.hidden')
        const nodes = visible.nodes()
        const edges = visible.edges()
        if (!nodes.length) return
        if (edges.length <= 1 && nodes.length <= 3) {
          const box = container.getBoundingClientRect()
          const cx = Math.max(box.width / 2, 260)
          const cyMid = Math.max(box.height / 2, 220)
          const ordered = nodes.sort((a, b) => (a.data('outdegree') || 0) - (b.data('outdegree') || 0))
          if (ordered.length === 1) ordered[0].position({ x: cx, y: cyMid })
          if (ordered.length === 2) {
            ordered[0].position({ x: cx - 120, y: cyMid })
            ordered[1].position({ x: cx + 120, y: cyMid })
          }
          if (ordered.length === 3) {
            ordered[0].position({ x: cx - 150, y: cyMid })
            ordered[1].position({ x: cx + 150, y: cyMid })
            ordered[2].position({ x: cx, y: cyMid + 130 })
          }
        } else {
          visible.layout({
            name: edges.length ? 'breadthfirst' : 'grid',
            directed: true,
            spacingFactor: edges.length ? 1.35 : 1.15,
            animate: false,
            padding: 80,
          }).run()
        }
        cy.fit(visible, 90)
      }

      cy.on('tap', 'node', (event) => focusNode(event.target))
      cy.on('tap', (event) => {
        if (event.target !== cy) return
        cy.elements().removeClass('faded selected')
      })
      search?.addEventListener('input', applyFilter)
      project?.addEventListener('change', applyFilter)
      showIsolated?.addEventListener('change', applyFilter)
      reset?.addEventListener('click', () => {
        if (search) search.value = ''
        if (project) project.value = ''
        if (showIsolated) showIsolated.checked = false
        cy.elements().removeClass('hidden faded selected')
        applyFilter()
      })
      applyFilter()
    })
}

function initPaperOutline() {
  if (!document.body.dataset.slug?.startsWith('papers/')) return
  const sidebar = document.querySelector('.right.sidebar')
  const article = document.querySelector('article .markdown-rendered')
  if (!article || document.querySelector('.generated-paper-outline')) return

  const headings = Array.from(article.querySelectorAll('h2[id], h3[id]'))
    .filter((heading) => heading.id && heading.textContent.trim())
  if (headings.length < 2) return

  const toc = document.createElement('div')
  toc.className = 'toc generated-paper-outline'
  toc.innerHTML = `
    <button type="button" class="toc-header" aria-expanded="true">
      <h3>Outline</h3>
    </button>
    <div class="toc-content">
      <ul></ul>
    </div>
  `

  const list = toc.querySelector('ul')
  for (const heading of headings) {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.href = `#${heading.id}`
    link.dataset.for = heading.id
    link.className = `depth-${heading.tagName === 'H3' ? '1' : '0'}`
    link.textContent = heading.textContent.trim()
    item.appendChild(link)
    list.appendChild(item)
  }

  const header = toc.querySelector('.toc-header')
  const content = toc.querySelector('.toc-content')
  header?.addEventListener('click', () => {
    const collapsed = content.classList.toggle('collapsed')
    header.classList.toggle('collapsed', collapsed)
    header.setAttribute('aria-expanded', String(!collapsed))
  })

  if (sidebar) {
    sidebar.insertBefore(toc, sidebar.firstChild)
  } else {
    article.insertBefore(toc, article.firstChild)
    toc.classList.add('inline-paper-outline')
  }

  const links = Array.from(toc.querySelectorAll('a[data-for]'))
  const setActive = (id) => {
    links.forEach((link) => link.classList.toggle('in-view', link.dataset.for === id))
  }
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible?.target?.id) setActive(visible.target.id)
    },
    { rootMargin: '-20% 0px -65% 0px', threshold: [0, 1] },
  )
  headings.forEach((heading) => observer.observe(heading))
  setActive(headings[0].id)
}

function initPaperCopyButton() {
  if (!document.body.dataset.slug?.startsWith('papers/')) return
  const article = document.querySelector('article .markdown-rendered')
  if (!article || article.querySelector('.paper-copy-button')) return

  const nav = article.querySelector('.paper-nav')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'paper-copy-button'
  button.setAttribute('aria-label', 'Copy paper note')
  button.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span>Copy note</span>
  `

  button.addEventListener('click', async () => {
    const originalLabel = button.querySelector('span')?.textContent || 'Copy note'
    try {
      await copyText(buildPaperCopyText(article))
      setCopyButtonState(button, 'Copied')
    } catch {
      setCopyButtonState(button, 'Copy failed')
    } finally {
      window.setTimeout(() => setCopyButtonState(button, originalLabel), 1600)
    }
  })

  if (nav) {
    nav.appendChild(button)
  } else {
    article.insertBefore(button, article.firstChild)
  }
}

function buildPaperCopyText(article) {
  const title = document.querySelector('h1.article-title')?.textContent?.trim()
    || document.title.replace(/\s+-\s+Paper Knowledge$/, '').trim()
  const pageUrl = canonicalPageUrl()
  const links = collectArticleLinks(article)
  const body = articleToPlainText(article)
  const parts = [
    'Paper Knowledge Note',
    '',
    `Title: ${title}`,
    `Page URL: ${pageUrl}`,
  ]

  if (links.length) {
    parts.push('', 'Links:')
    for (const link of links) parts.push(`- ${link.label}: ${link.url}`)
  }

  parts.push('', 'Summary:', body)
  return parts.join('\n').replace(/\n{4,}/g, '\n\n\n').trim() + '\n'
}

function canonicalPageUrl() {
  const fromMeta = document.querySelector('meta[property="og:url"]')?.content
    || document.querySelector('meta[property="twitter:url"]')?.content
  const raw = fromMeta || window.location.href
  const url = new URL(raw, window.location.origin)
  url.hash = ''
  return url.toString()
}

function collectArticleLinks(article) {
  const seen = new Set()
  return Array.from(article.querySelectorAll('a[href]'))
    .filter((link) => !link.closest('.paper-nav') && link.getAttribute('role') !== 'anchor')
    .map((link) => {
      const label = link.textContent.replace(/\s+/g, ' ').trim() || link.getAttribute('href')
      const url = new URL(link.getAttribute('href'), window.location.href).toString()
      return { label, url }
    })
    .filter((link) => {
      if (!link.label || !link.url || seen.has(link.url)) return false
      seen.add(link.url)
      return true
    })
}

function articleToPlainText(article) {
  const clone = article.cloneNode(true)
  clone.querySelectorAll('.paper-copy-button, .generated-paper-outline, .paper-nav, a[role="anchor"], svg').forEach((el) => el.remove())
  return (clone.innerText || clone.textContent)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-1000px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  textarea.remove()
  if (!ok) throw new Error('copy failed')
}

function setCopyButtonState(button, label) {
  const span = button.querySelector('span')
  if (span) span.textContent = label
  button.classList.toggle('copied', label === 'Copied')
}

function loadScriptOnce(src) {
  const existing = document.querySelector(`script[src="${src}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.cytoscape) resolve()
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.defer = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function shortTitle(title) {
  const words = String(title || '')
    .replace(/[^A-Za-z0-9 -]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const short = words.slice(0, 5).join(' ')
  return words.length > 5 ? `${short}...` : short
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}

function initPaperKnowledgeWidgets() {
  initCitationGraph()
  initPaperOutline()
  initPaperCopyButton()
}

document.addEventListener('DOMContentLoaded', initPaperKnowledgeWidgets)
document.addEventListener('nav', initPaperKnowledgeWidgets)
window.addEventListener('pageshow', initPaperKnowledgeWidgets)
setTimeout(initPaperKnowledgeWidgets, 0)
