import { useEffect, useRef } from 'react'
import type { ArcGISItem, DependencyCounts } from '../types/arcgis'
import { buildItemUrl } from '../utils/portalUrl'
import { iconFor } from '../utils/itemIcons'
import { type GraphNode, buildGraphData } from '../utils/dependencyGraph'

// ─── Internal: type colour palette ───────────────────────────────────────────

const TYPE_COLOURS = [
  '#0079c1', '#56a0d3', '#4caf50', '#ff9800',
  '#e91e63', '#9c27b0', '#00bcd4', '#795548',
]

function colourForType(type: string): string {
  let hash = 0
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) >>> 0
  return TYPE_COLOURS[hash % TYPE_COLOURS.length]
}

// ─── Physics constants ────────────────────────────────────────────────────────

const IDEAL_DISTANCE = 120
const REPULSION_STRENGTH = 6000
const SPRING_STRENGTH = 0.05
const FRICTION = 0.82
const ENERGY_THRESHOLD = 0.05

// ─── DependencyGraph component ────────────────────────────────────────────────

interface DependencyGraphProps {
  rootItem: ArcGISItem
  counts: DependencyCounts
  webMapItems?: import('../types/arcgis').RelatedItemRef[]  // nodes from JSON scan (rendered distinctly)
  portalHostname?: string | null
}

export function DependencyGraph({ rootItem, counts, webMapItems = [], portalHostname }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const svg = svgRef.current
    if (!container || !svg) return

    const { width, height } = container.getBoundingClientRect()
    const cx = width / 2
    const cy = height / 2

    // Build initial graph data (includes formal deps + web map scan results)
    const { nodes, edges } = buildGraphData(rootItem, counts, cx, cy, webMapItems)
    const nodeById = new Map<string, GraphNode>(nodes.map(n => [n.id, n]))

    // ── SVG setup ──────────────────────────────────────────────────────────────
    const NS = 'http://www.w3.org/2000/svg'
    const mkEl = (tag: string) => document.createElementNS(NS, tag) as SVGElement

    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.style.display = 'block'
    svg.style.cursor = 'grab'
    svg.style.background = 'var(--calcite-color-foreground-1)'

    // Drop-shadow filter for dragged nodes
    const defs = mkEl('defs') as SVGDefsElement
    const filter = mkEl('filter') as SVGFilterElement
    filter.setAttribute('id', 'dep-drag-shadow')
    const shadow = mkEl('feDropShadow')
    shadow.setAttribute('dx', '0')
    shadow.setAttribute('dy', '2')
    shadow.setAttribute('stdDeviation', '4')
    shadow.setAttribute('flood-color', 'rgba(0,0,0,0.18)')
    filter.appendChild(shadow)
    defs.appendChild(filter)
    svg.appendChild(defs)

    // Zoom/pan group — all content lives inside this
    const view = { x: 0, y: 0, scale: 1 }
    const viewGroup = mkEl('g') as SVGGElement
    svg.appendChild(viewGroup)

    const applyViewTransform = () => {
      viewGroup.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.scale})`)
    }
    applyViewTransform()

    // ── Edge elements ──────────────────────────────────────────────────────────
    const edgeGroup = mkEl('g') as SVGGElement
    viewGroup.appendChild(edgeGroup)

    const edgeEls: SVGLineElement[] = edges.map(edge => {
      const line = mkEl('line') as SVGLineElement
      line.style.strokeWidth = '1'
      if (edge.direction === 'webmap') {
        // Scanned Web Map connections — blue, distinct dash
        line.style.stroke = '#56a0d3'
        line.style.strokeDasharray = '6 3'
      } else {
        line.style.stroke = 'var(--calcite-color-border-2)'
        if (edge.direction === 'downstream') {
          line.style.strokeDasharray = '4 4'
        }
      }
      line.style.pointerEvents = 'none'
      edgeGroup.appendChild(line)
      return line
    })

    // ── Node elements ──────────────────────────────────────────────────────────
    const nodeGroup = mkEl('g') as SVGGElement
    viewGroup.appendChild(nodeGroup)

    const nodeEls: SVGGElement[] = nodes.map(node => {
      const g = mkEl('g') as SVGGElement
      g.setAttribute('transform', `translate(${node.x},${node.y})`)

      const r = node.isRoot ? 28 : 20

      const circle = mkEl('circle') as SVGCircleElement
      circle.setAttribute('r', String(r))
      if (node.isRoot) {
        circle.style.fill = 'var(--calcite-color-brand)'
      } else if (node.isWebMapScan) {
        // Scanned Web Map/Scene nodes — lighter blue fill, no border
        circle.style.fill = '#56a0d3'
      } else {
        circle.style.fill = 'white'
        circle.style.stroke = colourForType(node.type)
        circle.style.strokeWidth = '1.5'
      }

      // Item type icon via <foreignObject> — embeds a calcite-icon centred inside
      // the circle. Size is 18px for root (r=28) and 14px for neighbours (r=20).
      const iconSize = node.isRoot ? 18 : 14
      const fo = mkEl('foreignObject') as SVGForeignObjectElement
      fo.setAttribute('x', String(-iconSize / 2))
      fo.setAttribute('y', String(-iconSize / 2))
      fo.setAttribute('width', String(iconSize))
      fo.setAttribute('height', String(iconSize))
      fo.style.pointerEvents = 'none'
      fo.style.overflow = 'visible'

      const iconWrapper = document.createElement('div')
      iconWrapper.style.width = '100%'
      iconWrapper.style.height = '100%'
      iconWrapper.style.display = 'flex'
      iconWrapper.style.alignItems = 'center'
      iconWrapper.style.justifyContent = 'center'

      const iconEl = document.createElement('calcite-icon')
      iconEl.setAttribute('icon', iconFor(node.type))
      iconEl.setAttribute('scale', 's')
      iconEl.style.color = (node.isRoot || node.isWebMapScan) ? 'white' : colourForType(node.type)
      iconEl.style.display = 'block'

      iconWrapper.appendChild(iconEl)
      fo.appendChild(iconWrapper)

      const text = mkEl('text') as SVGTextElement
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('dy', String(r + 14))
      text.style.fontSize = node.isRoot ? '12px' : '11px'
      text.style.fontWeight = node.isRoot ? '600' : 'normal'
      text.style.fill = 'var(--calcite-color-text-2)'
      text.style.fontFamily = 'var(--calcite-font-family, "Avenir Next", sans-serif)'
      text.style.pointerEvents = 'none'
      text.style.userSelect = 'none'
      text.textContent = node.label

      g.appendChild(circle)
      g.appendChild(fo)
      g.appendChild(text)

      if (!node.isRoot) {
        g.style.cursor = 'pointer'
        g.setAttribute('role', 'button')
        g.setAttribute('tabindex', '0')
        g.setAttribute('aria-label', `${node.label} — click to open in ArcGIS Online`)

        // Hover highlight
        circle.addEventListener('mouseenter', () => {
          if (!node.pinned) {
            if (node.isWebMapScan) circle.style.opacity = '0.8'
            else circle.style.strokeWidth = '2.5'
          }
        })
        circle.addEventListener('mouseleave', () => {
          if (!node.pinned) {
            if (node.isWebMapScan) circle.style.opacity = '1'
            else circle.style.strokeWidth = '1.5'
          }
        })

        const openItemUrl = () => window.open(
          buildItemUrl(portalHostname, node.id),
          '_blank',
          'noopener,noreferrer'
        )

        // Click — open in ArcGIS Online
        g.addEventListener('click', (e: Event) => {
          e.stopPropagation()
          openItemUrl()
        })

        // Keyboard — Enter or Space opens the item (mirrors click behaviour)
        g.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            openItemUrl()
          }
        })
      }

      nodeGroup.appendChild(g)
      return g
    })

    // ── Position update (called each RAF tick) ────────────────────────────────
    function updatePositions() {
      nodes.forEach((node, i) => {
        nodeEls[i].setAttribute('transform', `translate(${node.x},${node.y})`)
      })
      edges.forEach((edge, i) => {
        const src = nodeById.get(edge.sourceId)!
        const tgt = nodeById.get(edge.targetId)!
        edgeEls[i].setAttribute('x1', String(src.x))
        edgeEls[i].setAttribute('y1', String(src.y))
        edgeEls[i].setAttribute('x2', String(tgt.x))
        edgeEls[i].setAttribute('y2', String(tgt.y))
      })
    }

    // ── Physics tick ──────────────────────────────────────────────────────────
    function tick() {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].pinned) continue

        let fx = 0
        let fy = 0

        // Repulsion: push away from every other node
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 300) {
            const force = REPULSION_STRENGTH / (dist * dist)
            fx += (dx / dist) * force
            fy += (dy / dist) * force
          }
        }

        // Spring: pull toward connected nodes at ideal distance
        for (const edge of edges) {
          let otherId: string | null = null
          if (edge.sourceId === nodes[i].id) otherId = edge.targetId
          else if (edge.targetId === nodes[i].id) otherId = edge.sourceId
          if (otherId === null) continue

          const other = nodeById.get(otherId)
          if (!other) continue

          const dx = other.x - nodes[i].x
          const dy = other.y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const displacement = dist - IDEAL_DISTANCE
          fx += (dx / dist) * displacement * SPRING_STRENGTH
          fy += (dy / dist) * displacement * SPRING_STRENGTH
        }

        nodes[i].vx = (nodes[i].vx + fx) * FRICTION
        nodes[i].vy = (nodes[i].vy + fy) * FRICTION
        nodes[i].x += nodes[i].vx
        nodes[i].y += nodes[i].vy
      }
    }

    function kineticEnergy(): number {
      return nodes.reduce((sum, n) => sum + n.vx * n.vx + n.vy * n.vy, 0)
    }

    // ── RAF loop ──────────────────────────────────────────────────────────────
    let rafId = 0
    let running = false

    function startSimulation() {
      if (running) return
      running = true
      const loop = () => {
        if (!running) return
        tick()
        updatePositions()
        if (kineticEnergy() > ENERGY_THRESHOLD) {
          rafId = requestAnimationFrame(loop)
        } else {
          running = false
        }
      }
      rafId = requestAnimationFrame(loop)
    }

    updatePositions() // render initial positions immediately
    startSimulation()

    // ── Drag & pan ────────────────────────────────────────────────────────────
    let dragNode: GraphNode | null = null
    let isPanning = false
    let panStart = { x: 0, y: 0 }

    nodeEls.forEach((g, i) => {
      const node = nodes[i]
      if (node.isRoot) return

      g.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation() // prevent svg pointerdown from starting pan
        svg.setPointerCapture(e.pointerId) // capture to svg so move fires even outside
        dragNode = node
        node.pinned = true
        node.vx = 0
        node.vy = 0
        const circle = g.querySelector('circle') as SVGCircleElement
        circle.setAttribute('filter', 'url(#dep-drag-shadow)')
        circle.style.strokeWidth = '2.5'
        svg.style.cursor = 'grabbing'
      })
    })

    svg.addEventListener('pointerdown', (e: PointerEvent) => {
      // Fires only when a node's stopPropagation did NOT cancel it (i.e. background click)
      if (dragNode) return
      svg.setPointerCapture(e.pointerId)
      isPanning = true
      panStart = { x: e.clientX, y: e.clientY }
      svg.style.cursor = 'grabbing'
    })

    svg.addEventListener('pointermove', (e: PointerEvent) => {
      if (dragNode) {
        const rect = svg.getBoundingClientRect()
        dragNode.x = (e.clientX - rect.left - view.x) / view.scale
        dragNode.y = (e.clientY - rect.top - view.y) / view.scale
        updatePositions()
        return
      }
      if (isPanning) {
        view.x += e.clientX - panStart.x
        view.y += e.clientY - panStart.y
        panStart = { x: e.clientX, y: e.clientY }
        applyViewTransform()
      }
    })

    svg.addEventListener('pointerup', (e: PointerEvent) => {
      svg.releasePointerCapture(e.pointerId)
      if (dragNode) {
        // Find the corresponding nodeEl and restore style
        const i = nodes.indexOf(dragNode)
        if (i >= 0) {
          const circle = nodeEls[i].querySelector('circle') as SVGCircleElement
          circle.removeAttribute('filter')
          if (!dragNode.isWebMapScan) circle.style.strokeWidth = '1.5'
        }
        dragNode.pinned = false
        dragNode.vx = 0
        dragNode.vy = 0
        dragNode = null
        startSimulation()
      }
      isPanning = false
      svg.style.cursor = 'grab'
    })

    // ── Zoom ──────────────────────────────────────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(0.3, Math.min(4, view.scale * factor))
      view.x = mouseX - (mouseX - view.x) * (newScale / view.scale)
      view.y = mouseY - (mouseY - view.y) * (newScale / view.scale)
      view.scale = newScale
      applyViewTransform()
    }

    svg.addEventListener('wheel', onWheel, { passive: false })

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      running = false
      cancelAnimationFrame(rafId)
      svg.removeEventListener('wheel', onWheel)
      // Clear SVG — React never owned these children so this is safe
      while (svg.firstChild) svg.removeChild(svg.firstChild)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // runs once on mount; rootItem and counts are stable for the modal lifetime

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef} />
    </div>
  )
}
