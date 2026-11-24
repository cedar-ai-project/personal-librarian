<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { coverUrl, findBook } from '@/data/books'
import type { Book, KnowledgePoint, KnowledgeTree } from '@/types/book'
import treeData from '@/generated/knowledge.json'

const tree = treeData as KnowledgeTree | null

// ---- Layout (bottom-up: the root sits at y = 0 and the tree grows towards negative y) ----

const BOOK_W = 78
const GAP_SUB = 16
const GAP_DOMAIN = 40
const Y_TRUNK = -90 // top of the trunk, where the domain branches split off
const Y_DOMAIN = -230
const Y_SUB = -390
const Y_BOOK = -550 // bottom of a book node, where its branch arrives
const COVER_W = 38
const COVER_H = 52
const LABEL_H = 30 // two lines of title under the cover
const PILL_H = 24
const PILL_GAP = 8
const STALK = 18 // stem between the cover and the first point

interface PointNode extends KnowledgePoint {
	key: string
	x: number
	y: number
	w: number
}

interface BookNode {
	key: string
	title: string
	book: Book | undefined
	lines: string[]
	x: number
	expanded: boolean
	reading: boolean
	points: PointNode[]
	domainIndex: number
	path: string
}

const expanded = reactive(new Set<string>())
const selected = ref<{ type: 'book'; key: string } | { type: 'point'; key: string } | null>(null)

// Rough text width for layout, good enough for CJK-heavy labels.
function textWidth(text: string, size: number) {
	return [...text].reduce((w, c) => w + (c.charCodeAt(0) > 0xff ? size : size * 0.58), 0)
}

// "认知觉醒：开启自我改变的原动力" -> ["认知觉醒"]; long titles wrap onto two lines.
function titleLines(title: string) {
	const short = title.replace(/（.*?）/g, '').split('：')[0]
	if (short.length <= 6) return [short]
	return [short.slice(0, 6), short.length > 12 ? short.slice(6, 11) + '…' : short.slice(6)]
}

const layout = computed(() => {
	if (!tree) return null
	let cursor = 0
	const domains = tree.domains.map((domain, domainIndex) => {
		const subdomains = domain.subdomains.map((sub) => {
			const books: BookNode[] = sub.books.map((b) => {
				const key = `${domain.name}/${sub.name}/${b.title}`
				const isOpen = expanded.has(key)
				const pillWidths = b.points.map((p) => textWidth(p.name, 12) + 22)
				const w = isOpen ? Math.max(BOOK_W, Math.max(...pillWidths) + 14) : BOOK_W
				const x = cursor + w / 2
				cursor += w
				const book = findBook(b.title)
				const top = Y_BOOK - LABEL_H - COVER_H
				const points = isOpen
					? b.points.map((p, i) => ({
						...p,
						key: `${key}/${p.name}`,
						x,
						y: top - STALK - i * (PILL_H + PILL_GAP) - PILL_H / 2,
						w: pillWidths[i],
					}))
					: []
				return {
					key,
					title: b.title,
					book,
					lines: titleLines(b.title),
					x,
					expanded: isOpen,
					reading: book ? !book.finished : false,
					points,
					domainIndex,
					path: `${domain.name} › ${sub.name}`,
				}
			})
			cursor += GAP_SUB
			return { name: sub.name, x: (books[0].x + books[books.length - 1].x) / 2, w: textWidth(sub.name, 13) + 24, books }
		})
		cursor += GAP_DOMAIN - GAP_SUB
		return {
			name: domain.name,
			index: domainIndex,
			x: (subdomains[0].x + subdomains[subdomains.length - 1].x) / 2,
			w: textWidth(domain.name, 14) + 28,
			subdomains,
		}
	})
	const width = cursor - GAP_DOMAIN
	const rootX = (domains[0].x + domains[domains.length - 1].x) / 2
	const books = domains.flatMap((d) => d.subdomains.flatMap((s) => s.books))
	const tallest = Math.max(0, ...books.map((b) => b.points.length))
	const top = Y_BOOK - LABEL_H - COVER_H - (tallest ? STALK + tallest * (PILL_H + PILL_GAP) : 0) - 20
	return { domains, books, rootX, bounds: { minX: -20, maxX: width + 20, minY: top, maxY: 60 } }
})

const stats = computed(() => {
	const books = layout.value?.books ?? []
	return {
		domains: layout.value?.domains.length ?? 0,
		books: books.length,
		points: tree?.domains.reduce((n, d) => n + d.subdomains.reduce((m, s) => m + s.books.reduce((k, b) => k + b.points.length, 0), 0), 0) ?? 0,
	}
})

// A smooth branch from a parent (below) up to a child (above).
function branch(x1: number, y1: number, x2: number, y2: number) {
	const mid = (y1 + y2) / 2
	return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`
}

const domainColor = (i: number) => `var(--domain-${(i % 7) + 1})`

// ---- Selection and cross-book highlighting ----

const allPoints = computed(() =>
	(tree?.domains ?? []).flatMap((d) =>
		d.subdomains.flatMap((s) => s.books.map((b) => ({ key: `${d.name}/${s.name}/${b.title}`, title: b.title, points: b.points }))),
	),
)

const selectedPoint = computed(() => {
	if (selected.value?.type !== 'point') return null
	for (const b of allPoints.value) {
		const p = b.points.find((p) => `${b.key}/${p.name}` === selected.value!.key)
		if (p) return { ...p, bookKey: b.key, title: b.title }
	}
	return null
})

const selectedBook = computed(() =>
	selected.value?.type === 'book' ? layout.value?.books.find((b) => b.key === selected.value!.key) ?? null : null,
)

// Other books that share the selected point's name.
const related = computed(() =>
	selectedPoint.value
		? allPoints.value.filter((b) => b.key !== selectedPoint.value!.bookKey && b.points.some((p) => p.name === selectedPoint.value!.name))
		: [],
)

function toggleBook(book: BookNode) {
	if (expanded.has(book.key)) {
		expanded.delete(book.key)
		if (selected.value?.key.startsWith(book.key)) selected.value = null
	} else {
		expanded.add(book.key)
		selected.value = { type: 'book', key: book.key }
		ensureVisible()
	}
}

// Points grow upwards; pan down if the top of the tree (e.g. a freshly opened book) left the viewport.
async function ensureVisible() {
	await nextTick()
	if (!layout.value) return
	const top = view.y + layout.value.bounds.minY * view.k
	if (top < 12) view.y += 12 - top
}

function selectPoint(bookKey: string, name: string) {
	expanded.add(bookKey)
	selected.value = { type: 'point', key: `${bookKey}/${name}` }
	// Grow the related books too, so the highlighted points are visible.
	for (const b of related.value) expanded.add(b.key)
	ensureVisible()
}

function expandAll() {
	for (const b of layout.value?.books ?? []) expanded.add(b.key)
}

function collapseAll() {
	expanded.clear()
	selected.value = null
}

const allExpanded = computed(() => (layout.value?.books ?? []).every((b) => b.expanded))

function pointLink(p: { tab: string | null; anchor: string | null }, title: string) {
	return { name: 'book', params: { title }, query: p.tab ? { tab: p.tab } : {}, hash: p.anchor ? `#${p.anchor}` : '' }
}

// ---- Pan and zoom (mouse drag, wheel, touch pinch, buttons) ----

const viewport = ref<HTMLDivElement | null>(null)
const view = reactive({ x: 0, y: 0, k: 1 })
const MIN_K = 0.2
const MAX_K = 2.5

// Fit the bounds into the viewport. On narrow screens never shrink below minK: show the
// part around the root instead and let the reader pan.
function fit(bounds = layout.value?.bounds, maxK = 1, minK = 0) {
	const el = viewport.value
	if (!el || !bounds || !layout.value) return
	const w = bounds.maxX - bounds.minX
	const h = bounds.maxY - bounds.minY
	const k = Math.max(Math.min(el.clientWidth / w, el.clientHeight / h, maxK), minK)
	view.k = k
	view.y = (el.clientHeight - h * k) / 2 - bounds.minY * k
	view.x = w * k <= el.clientWidth ? (el.clientWidth - w * k) / 2 - bounds.minX * k : el.clientWidth / 2 - layout.value.rootX * k
	if (h * k > el.clientHeight) view.y = el.clientHeight - 20 - bounds.maxY * k
}

const initialFit = () => fit(undefined, 1, (viewport.value?.clientWidth ?? 0) < 700 ? 0.55 : 0)

function focusDomain(index: number) {
	const domain = layout.value?.domains[index]
	if (!domain || !layout.value) return
	const books = domain.subdomains.flatMap((s) => s.books)
	const minX = Math.min(...books.map((b) => b.x)) - BOOK_W
	const maxX = Math.max(...books.map((b) => b.x)) + BOOK_W
	fit({ minX: Math.min(minX, layout.value.rootX - 40), maxX: Math.max(maxX, layout.value.rootX + 40), minY: layout.value.bounds.minY, maxY: 60 }, 1.2)
}

function zoomAt(factor: number, cx: number, cy: number) {
	const k = Math.min(MAX_K, Math.max(MIN_K, view.k * factor))
	view.x = cx - ((cx - view.x) * k) / view.k
	view.y = cy - ((cy - view.y) * k) / view.k
	view.k = k
}

function zoomButton(factor: number) {
	const el = viewport.value
	if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
}

function onWheel(e: WheelEvent) {
	e.preventDefault()
	const rect = viewport.value!.getBoundingClientRect()
	zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top)
}

const pointers = new Map<number, { x: number; y: number }>()
let moved = 0

function onPointerDown(e: PointerEvent) {
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
	moved = 0
}

function onPointerMove(e: PointerEvent) {
	const prev = pointers.get(e.pointerId)
	if (!prev) return
	if (pointers.size === 1) {
		view.x += e.clientX - prev.x
		view.y += e.clientY - prev.y
		moved += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y)
		if (moved > 4) viewport.value?.setPointerCapture(e.pointerId)
	} else if (pointers.size === 2) {
		// Pinch: zoom by the change in distance between the two fingers, around their midpoint.
		const [a, b] = [...pointers.entries()].map(([id, p]) => (id === e.pointerId ? { x: e.clientX, y: e.clientY } : p))
		const [pa, pb] = [...pointers.values()]
		const before = Math.hypot(pa.x - pb.x, pa.y - pb.y)
		const after = Math.hypot(a.x - b.x, a.y - b.y)
		const rect = viewport.value!.getBoundingClientRect()
		if (before > 0) zoomAt(after / before, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top)
		moved += 10
	}
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
}

function onPointerUp(e: PointerEvent) {
	pointers.delete(e.pointerId)
}

// A click that ended a drag should not toggle anything.
function clickGuard(fn: () => void) {
	if (moved <= 4) fn()
}

onMounted(() => {
	initialFit()
	viewport.value?.addEventListener('wheel', onWheel, { passive: false })
	window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
	viewport.value?.removeEventListener('wheel', onWheel)
	window.removeEventListener('resize', onResize)
})

function onResize() {
	initialFit()
}
</script>

<template>
	<div class="page knowledge">
		<template v-if="layout && tree">
			<section class="head">
				<div>
					<h1 class="title">我的知识树</h1>
					<p class="text-muted meta">
						{{ stats.domains }} 个领域 · {{ stats.books }} 本书 · {{ stats.points }} 个知识点<template v-if="tree.updated"> · 更新于 {{ tree.updated }}</template>
					</p>
				</div>
				<div class="legend">
					<button v-for="d in layout.domains" :key="d.name" class="legend-item" :title="`聚焦「${d.name}」`" @click="focusDomain(d.index)">
						<span class="dot" :style="{ background: domainColor(d.index) }"></span>{{ d.name }}
					</button>
				</div>
			</section>

			<div
			ref="viewport"
			class="viewport"
			@pointerdown="onPointerDown"
			@pointermove="onPointerMove"
			@pointerup="onPointerUp"
			@pointercancel="onPointerUp"
			>
				<svg class="tree" width="100%" height="100%">
					<g :transform="`translate(${view.x} ${view.y}) scale(${view.k})`">
						<!-- Branches: root -> domain -> subdomain -> book, thinner towards the leaves. -->
						<g fill="none" stroke-linecap="round">
							<template v-for="d in layout.domains" :key="d.name">
								<path :d="branch(layout.rootX, Y_TRUNK + 4, d.x, Y_DOMAIN + 16)" :style="{ stroke: domainColor(d.index) }" stroke-width="9" />
								<template v-for="s in d.subdomains" :key="s.name">
									<path :d="branch(d.x, Y_DOMAIN - 16, s.x, Y_SUB + 14)" :style="{ stroke: domainColor(d.index) }" stroke-width="6" />
									<path
									v-for="b in s.books"
									:key="b.key"
									:d="branch(s.x, Y_SUB - 14, b.x, Y_BOOK)"
									:style="{ stroke: domainColor(d.index) }"
									:stroke-opacity="b.reading ? 0.45 : 1"
									stroke-width="3"
									/>
								</template>
							</template>
							<!-- Stems carrying a book's knowledge points. -->
							<template v-for="b in layout.books" :key="`${b.key}/stem`">
								<path
								v-if="b.points.length"
								:d="`M ${b.x} ${Y_BOOK - LABEL_H - COVER_H} V ${b.points[b.points.length - 1].y}`"
								:style="{ stroke: domainColor(b.domainIndex) }"
								stroke-width="2"
								/>
							</template>
						</g>

						<!-- Trunk and root -->
						<path class="trunk" :d="`M ${layout.rootX} -10 V ${Y_TRUNK}`" />
						<g class="root">
							<circle :cx="layout.rootX" cy="6" r="26" />
							<text :x="layout.rootX" y="12" text-anchor="middle">我</text>
						</g>

						<!-- Domains and subdomains -->
						<template v-for="d in layout.domains" :key="`${d.name}/label`">
							<g class="label domain-label" @click="clickGuard(() => focusDomain(d.index))">
								<rect :x="d.x - d.w / 2" :y="Y_DOMAIN - 16" :width="d.w" height="32" rx="16" :style="{ stroke: domainColor(d.index) }" />
								<text :x="d.x" :y="Y_DOMAIN + 5" text-anchor="middle">{{ d.name }}</text>
							</g>
							<g v-for="s in d.subdomains" :key="s.name" class="label sub-label">
								<rect :x="s.x - s.w / 2" :y="Y_SUB - 14" :width="s.w" height="28" rx="14" :style="{ stroke: domainColor(d.index) }" />
								<text :x="s.x" :y="Y_SUB + 5" text-anchor="middle">{{ s.name }}</text>
							</g>
						</template>

						<!-- Books -->
						<g
						v-for="b in layout.books"
						:key="`${b.key}/node`"
						:class="['book', { reading: b.reading, active: selectedBook?.key === b.key }]"
						role="button"
						:aria-label="`《${b.title}》${b.expanded ? '，收起知识点' : '，展开知识点'}`"
						@click="clickGuard(() => toggleBook(b))"
						>
							<rect
							class="hit"
							:x="b.x - BOOK_W / 2 + 4"
							:y="Y_BOOK - LABEL_H - COVER_H - 4"
							:width="BOOK_W - 8"
							:height="LABEL_H + COVER_H + 8"
							rx="6"
							/>
							<image
							v-if="b.book && coverUrl(b.book)"
							:href="coverUrl(b.book)!"
							:x="b.x - COVER_W / 2"
							:y="Y_BOOK - LABEL_H - COVER_H"
							:width="COVER_W"
							:height="COVER_H"
							preserveAspectRatio="xMidYMid slice"
							/>
							<rect
							class="cover-frame"
							:x="b.x - COVER_W / 2"
							:y="Y_BOOK - LABEL_H - COVER_H"
							:width="COVER_W"
							:height="COVER_H"
							rx="3"
							:style="{ stroke: domainColor(b.domainIndex) }"
							/>
							<text v-for="(line, i) in b.lines" :key="i" :x="b.x" :y="Y_BOOK - LABEL_H + 13 + i * 13" text-anchor="middle" class="book-title">
								{{ line }}
							</text>
						</g>

						<!-- Knowledge points -->
						<template v-for="b in layout.books" :key="`${b.key}/points`">
							<g
							v-for="p in b.points"
							:key="p.key"
							:class="[
								'point',
								{
									selected: selectedPoint && p.key === selected?.key,
									related: selectedPoint && p.key !== selected?.key && p.name === selectedPoint.name,
								},
							]"
							role="button"
							:aria-label="`知识点：${p.name}`"
							@click.stop="clickGuard(() => selectPoint(b.key, p.name))"
							>
								<rect :x="p.x - p.w / 2" :y="p.y - PILL_H / 2" :width="p.w" :height="PILL_H" rx="12" :style="{ stroke: domainColor(b.domainIndex) }" />
								<text :x="p.x" :y="p.y + 4" text-anchor="middle">{{ p.name }}</text>
							</g>
						</template>
					</g>
				</svg>

				<div class="controls">
					<v-btn icon="mdi-plus" size="small" variant="tonal" title="放大" @click="zoomButton(1.25)"></v-btn>
					<v-btn icon="mdi-minus" size="small" variant="tonal" title="缩小" @click="zoomButton(0.8)"></v-btn>
					<v-btn icon="mdi-fit-to-screen-outline" size="small" variant="tonal" title="适应窗口" @click="initialFit()"></v-btn>
					<v-btn
					:icon="allExpanded ? 'mdi-arrow-collapse-vertical' : 'mdi-arrow-expand-vertical'"
					size="small"
					variant="tonal"
					:title="allExpanded ? '全部收起' : '全部展开'"
					@click="allExpanded ? collapseAll() : expandAll()"
					></v-btn>
				</div>

				<p class="hint text-muted">拖动平移 · 滚轮或双指缩放 · 点击书本展开知识点</p>

				<!-- Detail card for the selected point or book -->
				<aside v-if="selectedPoint || selectedBook" class="detail" @pointerdown.stop>
					<v-btn icon="mdi-close" size="x-small" variant="text" class="close" title="关闭" @click="selected = null"></v-btn>
					<template v-if="selectedPoint">
						<div class="detail-kicker text-muted">《{{ selectedPoint.title }}》</div>
						<h2 class="detail-title">{{ selectedPoint.name }}</h2>
						<p class="detail-text">{{ selectedPoint.text }}</p>
						<router-link :to="pointLink(selectedPoint, selectedPoint.title)" class="detail-link">
							查看笔记原文 <v-icon icon="mdi-arrow-right" size="16"></v-icon>
						</router-link>
						<div v-if="related.length" class="detail-related">
							<span class="text-muted">也出现在：</span>
							<a v-for="r in related" :key="r.key" href="#" @click.prevent="selectPoint(r.key, selectedPoint.name)">《{{ r.title }}》</a>
						</div>
					</template>
					<template v-else-if="selectedBook">
						<div class="detail-kicker text-muted">{{ selectedBook.path }}</div>
						<h2 class="detail-title">《{{ selectedBook.title }}》</h2>
						<p class="detail-text text-muted">
							{{ selectedBook.points.length }} 个知识点<template v-if="selectedBook.reading"> · 在读</template>
						</p>
						<router-link :to="{ name: 'book', params: { title: selectedBook.title } }" class="detail-link">
							打开书籍页 <v-icon icon="mdi-arrow-right" size="16"></v-icon>
						</router-link>
					</template>
				</aside>
			</div>
		</template>

		<div v-else class="empty">
			<v-icon icon="mdi-file-tree-outline" size="72" color="primary"></v-icon>
			<h1>知识树</h1>
			<p class="text-muted">还没有知识树：使用 build-knowledge-tree skill 生成后，这里会展示按领域分类的已读书籍和知识点。</p>
		</div>
	</div>
</template>

<style scoped>
.knowledge {
	max-width: none;
	padding-bottom: 24px;
}

.head {
	max-width: 1100px;
	margin: 0 auto 12px;
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	align-items: flex-end;
	gap: 8px 24px;
}

.title {
	font-size: 28px;
	font-weight: bold;
	line-height: 1.3;
}

.meta {
	font-size: 14px;
	margin-top: 4px;
}

.legend {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 12px;
}

.legend-item {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 14px;
	color: var(--c-text);
	padding: 2px 6px;
	border-radius: 6px;
	cursor: pointer;
}

.legend-item:hover {
	background: var(--c-link-hover-bg);
}

.dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
}

.viewport {
	position: relative;
	height: calc(100vh - 210px);
	min-height: 480px;
	border: 1px solid var(--c-card-border);
	border-radius: 12px;
	overflow: hidden;
	background: var(--c-bg);
	touch-action: none;
	cursor: grab;
	user-select: none;
}

.viewport:active {
	cursor: grabbing;
}

.tree {
	display: block;
}

.trunk {
	stroke: var(--c-trunk);
	stroke-width: 18;
	stroke-linecap: round;
	fill: none;
}

.root circle {
	fill: var(--c-bg);
	stroke: var(--c-text);
	stroke-width: 2.5;
}

.root text {
	font-size: 22px;
	font-weight: bold;
	fill: var(--c-text);
}

.label rect {
	fill: var(--c-bg);
	stroke-width: 2;
}

.label text {
	fill: var(--c-text);
}

.domain-label {
	cursor: pointer;
}

.domain-label text {
	font-size: 14px;
	font-weight: bold;
}

.sub-label text {
	font-size: 13px;
}

.book {
	cursor: pointer;
}

.book .hit {
	fill: transparent;
}

.book:hover .hit,
.book.active .hit {
	fill: var(--c-link-hover-bg);
}

.book .cover-frame {
	fill: none;
	stroke-width: 1.5;
}

.book-title {
	font-size: 11px;
	fill: var(--c-text);
}

.book.reading {
	opacity: 0.5;
}

.point {
	cursor: pointer;
}

.point rect {
	fill: var(--c-bg);
	stroke-width: 1.5;
	transition: stroke-width 0.15s;
}

.point text {
	font-size: 12px;
	fill: var(--c-text);
}

.point:hover rect {
	stroke-width: 2.5;
}

.point.selected rect {
	fill: var(--c-quote-bg);
	stroke-width: 3;
}

.point.related rect {
	fill: var(--c-idea-bg);
	stroke-width: 3;
	stroke-dasharray: 4 3;
}

.controls {
	position: absolute;
	left: 12px;
	top: 12px;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.hint {
	position: absolute;
	left: 12px;
	bottom: 8px;
	font-size: 12px;
	pointer-events: none;
}

.detail {
	position: absolute;
	right: 12px;
	top: 12px;
	width: min(320px, calc(100% - 80px));
	padding: 16px 18px;
	border: 1px solid var(--c-card-border);
	border-radius: 12px;
	background: var(--c-bg);
	box-shadow: 0 4px 16px var(--c-shadow);
	cursor: default;
	user-select: text;
}

.close {
	position: absolute;
	right: 6px;
	top: 6px;
}

.detail-kicker {
	font-size: 13px;
	padding-right: 24px;
}

.detail-title {
	font-size: 19px;
	font-weight: bold;
	margin: 2px 0 8px;
}

.detail-text {
	font-size: 14px;
	line-height: 1.75;
}

.detail-link {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	margin-top: 10px;
	font-size: 14px;
}

.detail-related {
	margin-top: 10px;
	font-size: 13px;
	line-height: 1.8;
}

.empty {
	text-align: center;
	padding-top: 96px;
}

.empty h1 {
	font-size: 28px;
	font-weight: bold;
	margin: 12px 0 8px;
}

@media (max-width: 600px) {
	.viewport {
		height: calc(100vh - 260px);
	}

	.hint {
		display: none;
	}

	.detail {
		top: auto;
		bottom: 12px;
		left: 12px;
		right: 12px;
		width: auto;
	}
}
</style>
