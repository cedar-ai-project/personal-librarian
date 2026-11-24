<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { coverUrl, findBook } from '@/data/books'
import type { Book, KnowledgePoint, KnowledgeTree } from '@/types/book'
import treeData from '@/generated/knowledge.json'

const tree = treeData as KnowledgeTree | null

// ---- Layout: a horizontal mind map, 我 on the left and the knowledge points as leaves on the right ----

const ROOT_X = 46
const ROOT_R = 28
const DOMAIN_X = 130 // left edge of the domain nodes
const SUB_X = 330
const BOOK_X = 478
const BOOK_W = 214
const BOOK_H = 52
const POINT_X = BOOK_X + BOOK_W + 64 // where the leaves start
const POINT_H = 30
const GAP_BOOK = 10
const GAP_SUB = 18
const GAP_DOMAIN = 36
const DOMAIN_H = 38
const SUB_H = 30

interface PointNode extends KnowledgePoint {
	key: string
	y: number
	w: number
}

interface BookNode {
	key: string
	title: string
	short: string
	book: Book | undefined
	y: number
	expanded: boolean
	reading: boolean
	count: number
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

// "认知觉醒：开启自我改变的原动力" -> "认知觉醒"
function shortTitle(title: string) {
	const short = title.replace(/（.*?）/g, '').split('：')[0]
	return short.length > 11 ? short.slice(0, 10) + '…' : short
}

const layout = computed(() => {
	if (!tree) return null
	let cursor = 0
	let right = POINT_X
	const domains = tree.domains.map((domain, domainIndex) => {
		const subdomains = domain.subdomains.map((sub) => {
			const books: BookNode[] = sub.books.map((b) => {
				const key = `${domain.name}/${sub.name}/${b.title}`
				const isOpen = expanded.has(key) && b.points.length > 0
				const rowH = isOpen ? Math.max(BOOK_H, b.points.length * POINT_H) : BOOK_H
				const y = cursor + rowH / 2
				cursor += rowH + GAP_BOOK
				const book = findBook(b.title)
				const points = isOpen
					? b.points.map((p, i) => {
						const w = textWidth(p.name, 13) + 34
						right = Math.max(right, POINT_X + w)
						return { ...p, key: `${key}/${p.name}`, y: y + (i - (b.points.length - 1) / 2) * POINT_H, w }
					})
					: []
				return {
					key,
					title: b.title,
					short: shortTitle(b.title),
					book,
					y,
					expanded: isOpen,
					reading: book ? !book.finished : false,
					count: b.points.length,
					points,
					domainIndex,
					path: `${domain.name} › ${sub.name}`,
				}
			})
			cursor += GAP_SUB - GAP_BOOK
			return { name: sub.name, y: (books[0].y + books[books.length - 1].y) / 2, w: textWidth(sub.name, 13) + 26, books }
		})
		cursor += GAP_DOMAIN - GAP_SUB
		const top = subdomains[0].books[0].y - BOOK_H / 2
		const last = subdomains[subdomains.length - 1].books
		const bottom = last[last.length - 1].y + BOOK_H / 2
		return {
			name: domain.name,
			index: domainIndex,
			y: (subdomains[0].y + subdomains[subdomains.length - 1].y) / 2,
			w: textWidth(domain.name, 15) + 34,
			top,
			bottom,
			subdomains,
		}
	})
	const height = cursor - GAP_DOMAIN
	// 我 sits at the top left; a trunk runs down from it and every domain branches off the trunk.
	const rootY = Math.min(domains[0].y - 60, 0)
	const trunkEnd = domains[domains.length - 1].y - 36
	const books = domains.flatMap((d) => d.subdomains.flatMap((s) => s.books))
	return { domains, books, rootY, trunkEnd, bounds: { minX: 0, maxX: right + 24, minY: rootY - ROOT_R - 20, maxY: height + 24 } }
})

const stats = computed(() => ({
	domains: tree?.domains.length ?? 0,
	books: layout.value?.books.length ?? 0,
	points: layout.value?.books.reduce((n, b) => n + b.count, 0) ?? 0,
}))

// A tapered branch: a filled ribbon along a horizontal S-curve, w1 wide at the parent and w2 at the child.
function branch(x1: number, y1: number, x2: number, y2: number, w1: number, w2: number) {
	const dx = (x2 - x1) * 0.5
	const steps = 24
	const left: string[] = []
	const right: string[] = []
	for (let i = 0; i <= steps; i++) {
		const t = i / steps
		const u = 1 - t
		// Cubic Bezier P0=(x1,y1) P1=(x1+dx,y1) P2=(x2-dx,y2) P3=(x2,y2) and its derivative.
		const x = u * u * u * x1 + 3 * u * u * t * (x1 + dx) + 3 * u * t * t * (x2 - dx) + t * t * t * x2
		const y = u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2
		const tx = 3 * u * u * dx + 6 * u * t * (x2 - x1 - 2 * dx) + 3 * t * t * dx
		const ty = 6 * u * t * (y2 - y1)
		const len = Math.hypot(tx, ty) || 1
		const half = (w1 + (w2 - w1) * t) / 2
		left.push(`${(x - (ty / len) * half).toFixed(1)} ${(y + (tx / len) * half).toFixed(1)}`)
		right.push(`${(x + (ty / len) * half).toFixed(1)} ${(y - (tx / len) * half).toFixed(1)}`)
	}
	return `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`
}

// A domain branch leaves the trunk a little above its own row and curves out to the domain node.
function sprout(y: number) {
	// Both edges start inside the trunk (at least 7 wide), so the branch grows out of it rather than beside it.
	const from = Math.max(y - 44, layout.value?.rootY ?? 0)
	return `M ${ROOT_X - 2} ${from} C ${ROOT_X - 2} ${y - 6}, ${ROOT_X + 24} ${y - 4}, ${DOMAIN_X + 2} ${y - 3.5} L ${DOMAIN_X + 2} ${y + 3.5} C ${ROOT_X + 24} ${y + 4}, ${ROOT_X + 2} ${y + 6}, ${ROOT_X + 2} ${from} Z`
}

const domainColor = (i: number) => `var(--domain-${(i % 7) + 1})`
const tint = (i: number, amount: number) => `color-mix(in srgb, ${domainColor(i)} ${amount}%, var(--c-bg))`

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

// Expanding a book makes its row taller and pushes the rows below down; keep the clicked book where it was on screen.
async function keepInPlace(bookKey: string, change: () => void) {
	const before = layout.value?.books.find((b) => b.key === bookKey)?.y
	change()
	await nextTick()
	const book = layout.value?.books.find((b) => b.key === bookKey)
	if (before !== undefined && book) view.y -= (book.y - before) * view.k
	// The leaves grow to the right: pan left if they ran past the edge.
	const el = viewport.value
	if (el && book?.points.length) {
		const edge = view.x + (POINT_X + Math.max(...book.points.map((p) => p.w)) + 16) * view.k
		if (edge > el.clientWidth) view.x -= edge - el.clientWidth
	}
}

function toggleBook(book: BookNode) {
	keepInPlace(book.key, () => {
		if (expanded.has(book.key)) {
			expanded.delete(book.key)
			if (selected.value?.key.startsWith(book.key)) selected.value = null
		} else {
			expanded.add(book.key)
			selected.value = { type: 'book', key: book.key }
		}
	})
}

function selectPoint(bookKey: string, name: string) {
	keepInPlace(bookKey, () => {
		expanded.add(bookKey)
		selected.value = { type: 'point', key: `${bookKey}/${name}` }
		// Grow the related books too, so the highlighted points are visible.
		for (const b of related.value) expanded.add(b.key)
	})
}

function expandAll() {
	for (const b of layout.value?.books ?? []) expanded.add(b.key)
}

function collapseAll() {
	expanded.clear()
	selected.value = null
}

const allExpanded = computed(() => (layout.value?.books ?? []).every((b) => b.expanded || !b.count))

function pointLink(p: { tab: string | null; anchor: string | null }, title: string) {
	return { name: 'book', params: { title }, query: p.tab ? { tab: p.tab } : {}, hash: p.anchor ? `#${p.anchor}` : '' }
}

// ---- Pan and zoom: drag or wheel to scroll, Ctrl + wheel / pinch / buttons to zoom ----

const viewport = ref<HTMLDivElement | null>(null)
const view = reactive({ x: 0, y: 0, k: 1 })
const MIN_K = 0.25
const MAX_K = 2

// Fit the map's width (never above 100%, and not too small on phones), aligned to the top.
function fit() {
	const el = viewport.value
	const bounds = layout.value?.bounds
	if (!el || !bounds) return
	const w = bounds.maxX - bounds.minX
	const minK = el.clientWidth < 700 ? 0.6 : MIN_K
	view.k = Math.max(Math.min(el.clientWidth / w, 1), minK)
	// When the map is wider than the viewport, leave room on the left for the zoom buttons.
	view.x = w * view.k <= el.clientWidth ? (el.clientWidth - w * view.k) / 2 - bounds.minX * view.k : 48 - bounds.minX * view.k
	view.y = -bounds.minY * view.k
}

function focusDomain(index: number) {
	const domain = layout.value?.domains[index]
	if (!domain) return
	view.y = 16 - (domain.top - 8) * view.k
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
	if (e.ctrlKey || e.metaKey) {
		// Ctrl + wheel, and trackpad pinch (reported as ctrl + wheel), zoom around the cursor.
		const rect = viewport.value!.getBoundingClientRect()
		zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)
	} else {
		view.x -= e.shiftKey ? e.deltaY : e.deltaX
		view.y -= e.shiftKey ? 0 : e.deltaY
	}
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
	fit()
	viewport.value?.addEventListener('wheel', onWheel, { passive: false })
	window.addEventListener('resize', fit)
})

onBeforeUnmount(() => {
	viewport.value?.removeEventListener('wheel', onWheel)
	window.removeEventListener('resize', fit)
})
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
					<button v-for="d in layout.domains" :key="d.name" class="legend-item" :title="`跳到「${d.name}」`" @click="focusDomain(d.index)">
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
						<!-- Branches taper from the root towards the leaves. -->
						<g class="branches">
							<template v-for="d in layout.domains" :key="d.name">
								<path :d="sprout(d.y)" :style="{ fill: domainColor(d.index) }" />
								<template v-for="s in d.subdomains" :key="s.name">
									<path :d="branch(DOMAIN_X + d.w - 2, d.y, SUB_X + 2, s.y, 6, 3.5)" :style="{ fill: domainColor(d.index) }" />
									<path
									v-for="b in s.books"
									:key="b.key"
									:d="branch(SUB_X + s.w - 2, s.y, BOOK_X + 2, b.y, 3, 1.6)"
									:style="{ fill: domainColor(d.index) }"
									:fill-opacity="b.reading ? 0.4 : 1"
									/>
								</template>
							</template>
							<!-- Twigs from a book to its leaves -->
							<template v-for="b in layout.books" :key="`${b.key}/twigs`">
								<path
								v-for="p in b.points"
								:key="p.key"
								:d="branch(BOOK_X + BOOK_W + 10, b.y, POINT_X, p.y, 1.6, 0.8)"
								:style="{ fill: domainColor(b.domainIndex) }"
								/>
							</template>
							<!-- Trunk: thick under 我, thinning towards the last domain; drawn last so the domain branches grow out of it. -->
							<path class="trunk" :d="branch(ROOT_X, layout.rootY, ROOT_X, layout.trunkEnd, 16, 7)" />
						</g>

						<!-- Root -->
						<g class="root">
							<circle :cx="ROOT_X" :cy="layout.rootY" :r="ROOT_R" />
							<text :x="ROOT_X" :y="layout.rootY + 8" text-anchor="middle">我</text>
						</g>

						<!-- Domains and subdomains -->
						<template v-for="d in layout.domains" :key="`${d.name}/label`">
							<g class="label domain-label" @click="clickGuard(() => focusDomain(d.index))">
								<rect
								:x="DOMAIN_X"
								:y="d.y - DOMAIN_H / 2"
								:width="d.w"
								:height="DOMAIN_H"
								:rx="DOMAIN_H / 2"
								:style="{ fill: tint(d.index, 18), stroke: domainColor(d.index) }"
								/>
								<text :x="DOMAIN_X + d.w / 2" :y="d.y + 5" text-anchor="middle">{{ d.name }}</text>
							</g>
							<g v-for="s in d.subdomains" :key="s.name" class="label sub-label">
								<rect
								:x="SUB_X"
								:y="s.y - SUB_H / 2"
								:width="s.w"
								:height="SUB_H"
								:rx="SUB_H / 2"
								:style="{ fill: tint(d.index, 8), stroke: domainColor(d.index) }"
								/>
								<text :x="SUB_X + s.w / 2" :y="s.y + 5" text-anchor="middle">{{ s.name }}</text>
							</g>
						</template>

						<!-- Books -->
						<g
						v-for="b in layout.books"
						:key="`${b.key}/node`"
						:class="['book', { reading: b.reading, active: selectedBook?.key === b.key, open: b.expanded }]"
						role="button"
						:aria-label="`《${b.title}》${b.expanded ? '，收起知识点' : '，展开知识点'}`"
						@click="clickGuard(() => toggleBook(b))"
						>
							<rect
							class="card"
							:x="BOOK_X"
							:y="b.y - BOOK_H / 2"
							:width="BOOK_W"
							:height="BOOK_H"
							rx="10"
							:style="{ fill: tint(b.domainIndex, 6), '--accent': domainColor(b.domainIndex) }"
							/>
							<image
							v-if="b.book && coverUrl(b.book)"
							:href="coverUrl(b.book)!"
							:x="BOOK_X + 8"
							:y="b.y - 20"
							width="30"
							height="40"
							preserveAspectRatio="xMidYMid slice"
							/>
							<text :x="BOOK_X + 48" :y="b.y - 3" class="book-title">{{ b.short }}</text>
							<text :x="BOOK_X + 48" :y="b.y + 14" class="book-meta">
								{{ b.reading ? '在读 · ' : '' }}{{ b.count }} 个知识点
							</text>
							<!-- Expand / collapse knob on the right edge -->
							<g v-if="b.count" class="knob">
								<circle :cx="BOOK_X + BOOK_W" :cy="b.y" r="10" :style="{ stroke: domainColor(b.domainIndex) }" />
								<text :x="BOOK_X + BOOK_W" :y="b.y + 4" text-anchor="middle">{{ b.expanded ? '−' : '+' }}</text>
							</g>
						</g>

						<!-- Leaves: the knowledge points -->
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
								<rect class="hit" :x="POINT_X - 4" :y="p.y - 12" :width="p.w" height="24" rx="12" :style="{ '--accent': domainColor(b.domainIndex) }" />
								<!-- A small leaf with its midrib -->
								<path
								class="leaf"
								:transform="`translate(${POINT_X + 8} ${p.y}) rotate(-18)`"
								d="M -8 0 Q 0 -7 8 0 Q 0 7 -8 0 Z"
								:style="{ fill: domainColor(b.domainIndex) }"
								/>
								<path class="midrib" :transform="`translate(${POINT_X + 8} ${p.y}) rotate(-18)`" d="M -6 0 L 6 0" />
								<text :x="POINT_X + 22" :y="p.y + 4.5">{{ p.name }}</text>
							</g>
						</template>
					</g>
				</svg>

				<div class="controls">
					<v-btn icon="mdi-plus" size="small" variant="tonal" title="放大" @click="zoomButton(1.25)"></v-btn>
					<v-btn icon="mdi-minus" size="small" variant="tonal" title="缩小" @click="zoomButton(0.8)"></v-btn>
					<v-btn icon="mdi-fit-to-screen-outline" size="small" variant="tonal" title="适应宽度" @click="fit()"></v-btn>
					<v-btn
					:icon="allExpanded ? 'mdi-arrow-collapse-horizontal' : 'mdi-arrow-expand-horizontal'"
					size="small"
					variant="tonal"
					:title="allExpanded ? '全部收起' : '全部展开'"
					@click="allExpanded ? collapseAll() : expandAll()"
					></v-btn>
				</div>

				<p class="hint text-muted">拖动或滚轮浏览 · Ctrl + 滚轮或双指缩放 · 点击书本展开知识点</p>

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
							{{ selectedBook.count }} 个知识点<template v-if="selectedBook.reading"> · 在读</template>
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
	padding-bottom: 24px;
}

.head {
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
	height: calc(100vh - 200px);
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
	fill: var(--c-trunk);
}

.root circle {
	fill: var(--c-text);
	filter: drop-shadow(0 2px 6px var(--c-shadow));
}

.root text {
	font-size: 22px;
	font-weight: bold;
	fill: var(--c-bg);
}

.label rect {
	stroke-width: 2;
}

.label text {
	fill: var(--c-text);
}

.domain-label {
	cursor: pointer;
}

.domain-label text {
	font-size: 15px;
	font-weight: bold;
}

.sub-label rect {
	stroke-width: 1.5;
}

.sub-label text {
	font-size: 13px;
}

.book {
	cursor: pointer;
}

.book .card {
	stroke: transparent;
	stroke-width: 1.5;
	transition: stroke 0.15s;
}

.book:hover .card,
.book.active .card,
.book.open .card {
	stroke: var(--accent);
}

.book-title {
	font-size: 14px;
	font-weight: bold;
	fill: var(--c-text);
}

.book-meta {
	font-size: 11px;
	fill: var(--c-text-muted);
}

.book.reading image,
.book.reading .book-title {
	opacity: 0.55;
}

.knob circle {
	fill: var(--c-bg);
	stroke-width: 1.5;
}

.knob text {
	font-size: 14px;
	font-weight: bold;
	fill: var(--c-text);
}

.point {
	cursor: pointer;
}

.point .hit {
	fill: transparent;
	stroke: transparent;
	stroke-width: 1.5;
}

.point:hover .hit {
	fill: var(--c-bg-soft);
}

.point.selected .hit {
	fill: var(--c-quote-bg);
	stroke: var(--accent);
}

.point.related .hit {
	fill: var(--c-idea-bg);
	stroke: var(--accent);
	stroke-dasharray: 4 3;
}

.midrib {
	stroke: var(--c-bg);
	stroke-width: 1;
	opacity: 0.7;
}

.point text {
	font-size: 13px;
	fill: var(--c-text);
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
	right: 12px;
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
