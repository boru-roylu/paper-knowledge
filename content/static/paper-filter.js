function initPaperFilter() {
  const input = document.getElementById('paper-filter-input')
  const rows = Array.from(document.querySelectorAll('.paper-row'))
  const buttons = Array.from(document.querySelectorAll('[data-paper-tag]'))
  if (!rows.length || !buttons.length) return
  if (input?.dataset.paperFilterBound === 'true') return
  if (input) input.dataset.paperFilterBound = 'true'

  let activeTag = ''
  const applyFilter = () => {
    const q = (input?.value || '').trim().toLowerCase()
    for (const row of rows) {
      const text = (row.dataset.search || '').toLowerCase()
      const tags = (row.dataset.tags || '').split(/\s+/).filter(Boolean)
      const okText = !q || text.includes(q)
      const okTag = !activeTag || tags.includes(activeTag)
      row.classList.toggle('filtered-out', !(okText && okTag))
    }
    for (const button of buttons) {
      button.classList.toggle('active', (button.dataset.paperTag || '') === activeTag)
      button.setAttribute('aria-pressed', String((button.dataset.paperTag || '') === activeTag))
    }
  }

  input?.addEventListener('input', applyFilter)
  for (const button of buttons) {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      activeTag = button.dataset.paperTag || ''
      applyFilter()
    })
  }
  applyFilter()
}

document.addEventListener('DOMContentLoaded', initPaperFilter)
document.addEventListener('nav', initPaperFilter)
window.addEventListener('pageshow', initPaperFilter)
setTimeout(initPaperFilter, 0)
