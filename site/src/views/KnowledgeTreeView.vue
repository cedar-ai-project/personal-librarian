<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { coverUrl, findBook } from '@/data/books'
import type { Book, KnowledgePoint, KnowledgeTree } from '@/types/book'
import treeData from '@/generated/knowledge.json'

const tree = treeData as KnowledgeTree | null

// ---- Layout: a tree growing up from the ground (y = 0, upwards is negative y) ----
// The trunk tapers from the root up; each domain is a limb branching off the trunk, alternating
// left and right, with the domains holding the most books nearest the root. Every book is a twig
// on its limb, carrying its cover like a fruit, and every knowledge point is a leaf on the twig.

const TRUNK_BASE = 50 // trunk width at the root
const TRUNK_TOP = 12
const FIRST_LIMB = -150 // height of the lowest limb
const LIMB_STEP = 74 // minimum height between two limbs (on opposite sides)
const SIDE_GAP = 48 // clearance between two limbs on the same side
const LIMB_START = 150 // distance from the trunk to the first twig
const COVER_W = 24
const COVER_H = 34
const LEAF_STEP = 24
const FIRST_LEAF = 76 // from the limb up to the first leaf

interface P {
	x: number
	y: number
}

interface LeafNode extends KnowledgePoint {
	key: string
	x: number
	y: number
	stalk: P[]
}

interface TwigNode {
	key: string
	title: string
	short: string
	book: Book | undefined
	reading: boolean
	path: string
	side: number
	x: number // where the twig leaves the limb
	limbY: number
	coverY: number // centre of the cover
	twig: P[]
	leaves: LeafNode[]
	domainIndex: number
}

interface LimbNode {
	name: string
	index: number // position in knowledge/知识树.md, which picks the colour
	side: number
	attachY: number
	limb: P[]
	label: P
	labelW: number
	top: number
	twigs: TwigNode[]
}

// Rough text width for layout, good enough for CJK-heavy labels.
function textWidth(text: string, size: number) {
	return [...text].reduce((w, c) => w + (c.charCodeAt(0) > 0xff ? size : size * 0.58), 0)
}

// "认知觉醒：开启自我改变的原动力" -> "认知觉醒"
function shortTitle(title: string) {
	const short = title.replace(/（.*?）/g, '').split('：')[0]
	return short.length > 8 ? short.slice(0, 7) + '…' : short
}

// The trunk sways a little so it does not look ruler-straight.
const trunkX = (y: number) => 5 * Math.sin(y / 170)

const layout = computed(() => {
	if (!tree) return null
	const domains = tree.domains.map((d, index) => {
		const books = d.subdomains.flatMap((s) => s.books.map((b) => ({ ...b, sub: s.name })))
		return { ...d, index, books, points: books.reduce((n, b) => n + b.points.length, 0) }
	})
	// Most books (then most points) nearest the root.
	const order = [...domains].sort((a, b) => b.books.length - a.books.length || b.points - a.points)

	const sideTop: Record<number, number> = { [-1]: 0, [1]: 0 }
	let lastY = FIRST_LIMB + LIMB_STEP
	const limbs: LimbNode[] = order.map((d, i) => {
		const side = i % 2 === 0 ? 1 : -1
		const attachY = Math.min(lastY - LIMB_STEP, sideTop[side] - SIDE_GAP)
		lastY = attachY

		// One column per book; labels grow outwards, away from the trunk.
		const columns = d.books.map((b) =>
			Math.max(textWidth(shortTitle(b.title), 12) + 34, ...b.points.map((p) => textWidth(p.name, 12) + 36), 104),
		)
		const length = LIMB_START + columns.reduce((a, b) => a + b, 0) - 24
		const lift = 36 + length * 0.12
		const x0 = trunkX(attachY)
		const limbYAt = (dx: number) => attachY - lift * Math.pow(Math.min(dx / length, 1), 1.4)
		const limb = Array.from({ length: 33 }, (_, k) => {
			const dx = (length * k) / 32
			return { x: x0 + side * dx, y: limbYAt(dx) }
		})

		let offset = LIMB_START
		const twigs: TwigNode[] = d.books.map((b, j) => {
			const dx = offset + 8
			offset += columns[j]
			const x = x0 + side * dx
			const limbY = limbYAt(dx)
			const book = findBook(b.title)
			const key = `${d.name}/${b.sub}/${b.title}`
			const leaves: LeafNode[] = b.points.map((p, n) => {
				const y = limbY - FIRST_LEAF - n * LEAF_STEP
				const tx = x + side * (2 + n * 0.8)
				return {
					...p,
					key: `${key}/${p.name}`,
					x: x + side * 15,
					y,
					stalk: [
						{ x: tx, y: y + 6 },
						{ x: x + side * 8, y: y + 2 },
					],
				}
			})
			const top = leaves.length ? leaves[leaves.length - 1].y - 4 : limbY - 56
			return {
				key,
				title: b.title,
				short: shortTitle(b.title),
				book,
				reading: book ? !book.finished : false,
				path: `${d.name} › ${b.sub}`,
				side,
				x,
				limbY,
				coverY: limbY - 36,
				twig: Array.from({ length: 9 }, (_, k) => ({ x: x + side * 2 * (k / 8) * (k / 8) * 3, y: limbY + ((top - limbY) * k) / 8 })),
				leaves,
				domainIndex: d.index,
			}
		})
		const top = Math.min(...twigs.map((t) => t.twig[t.twig.length - 1].y)) - 16
		sideTop[side] = top
		return {
			name: d.name,
			index: d.index,
			side,
			attachY,
			limb,
			label: { x: x0 + side * 78, y: attachY + 28 },
			labelW: textWidth(d.name, 14) + 30,
			top,
			twigs,
		}
	})

	const top = Math.min(...limbs.map((l) => l.top)) - 10
	const trunk = Array.from({ length: 41 }, (_, k) => {
		const y = 8 + ((top + 40 - 8) * k) / 40
		return { x: trunkX(y), y }
	})
	const reach = Math.max(...limbs.map((l) => Math.abs(l.limb[l.limb.length - 1].x))) + 140
	const twigs = limbs.flatMap((l) => l.twigs)
	return { limbs, twigs, trunk, bounds: { minX: -reach, maxX: reach, minY: top - 20, maxY: 60 } }
})

const stats = computed(() => ({
	domains: tree?.domains.length ?? 0,
	books: layout.value?.twigs.length ?? 0,
	points: layout.value?.twigs.reduce((n, t) => n + t.leaves.length, 0) ?? 0,
}))

// A tapered ribbon along a polyline: w0 wide at the first point, w1 at the last.
function ribbon(pts: P[], w0: number, w1: number) {
	const left: string[] = []
	const right: string[] = []
	pts.forEach((p, i) => {
		const a = pts[Math.max(i - 1, 0)]
		const b = pts[Math.min(i + 1, pts.length - 1)]
		const dx = b.x - a.x
		const dy = b.y - a.y
		const len = Math.hypot(dx, dy) || 1
		const half = (w0 + ((w1 - w0) * i) / (pts.length - 1)) / 2
		left.push(`${(p.x - (dy / len) * half).toFixed(1)} ${(p.y + (dx / len) * half).toFixed(1)}`)
		right.push(`${(p.x + (dy / len) * half).toFixed(1)} ${(p.y - (dx / len) * half).toFixed(1)}`)
	})
	return `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`
}

// Roots spreading over the ground.
const roots = [-1, 1].flatMap((s) => [
	[{ x: s * 8, y: -4 }, { x: s * 40, y: 10 }, { x: s * 86, y: 20 }, { x: s * 130, y: 26 }],
	[{ x: s * 14, y: -2 }, { x: s * 30, y: 16 }, { x: s * 44, y: 32 }, { x: s * 56, y: 44 }],
])

const trunkWidth = (k: number, n: number) => TRUNK_BASE + ((TRUNK_TOP - TRUNK_BASE) * k) / n
const domainColor = (i: number) => `var(--domain-${(i % 7) + 1})`
const tint = (i: number, amount: number) => `color-mix(in srgb, ${domainColor(i)} ${amount}%, var(--c-bg))`
// Leaves point outwards and slightly up; on the left side the shape is mirrored.
const leafTransform = (leaf: LeafNode, side: number) => `translate(${leaf.x} ${leaf.y}) scale(${side} 1) rotate(-24)`

// ---- Selection and cross-book highlighting ----

const selected = ref<{ type: 'book' | 'point'; key: string } | null>(null)

const selectedPoint = computed(() => {
	if (selected.value?.type !== 'point') return null
	for (const t of layout.value?.twigs ?? []) {
		const leaf = t.leaves.find((l) => l.key === selected.value!.key)
		if (leaf) return { ...leaf, twigKey: t.key, title: t.title }
	}
	return null
})

const selectedBook = computed(() =>
	selected.value?.type === 'book' ? layout.value?.twigs.find((t) => t.key === selected.value!.key) ?? null : null,
)

// Other books that share the selected point's name.
const related = computed(() =>
	selectedPoint.value
		? (layout.value?.twigs ?? []).filter((t) => t.key !== selectedPoint.value!.twigKey && t.leaves.some((l) => l.name === selectedPoint.value!.name))
		: [],
)

function selectRelated(twigKey: string, name: string) {
	selected.value = { type: 'point', key: `${twigKey}/${name}` }
	const leaf = layout.value?.twigs.find((t) => t.key === twigKey)?.leaves.find((l) => l.name === name)
	if (leaf) centerOn(leaf.x, leaf.y)
}

function pointLink(p: { tab: string | null; anchor: string | null }, title: string) {
	return { name: 'book', params: { title }, query: p.tab ? { tab: p.tab } : {}, hash: p.anchor ? `#${p.anchor}` : '' }
}

// ---- Pan and zoom: drag or wheel to scroll, Ctrl + wheel / pinch / buttons to zoom ----

const viewport = ref<HTMLDivElement | null>(null)
const view = reactive({ x: 0, y: 0, k: 1 })
const MIN_K = 0.2
const MAX_K = 2

// Show the whole tree; if that makes it too small to read, start from the root at a readable size instead.
function fit() {
	const el = viewport.value
	const bounds = layout.value?.bounds
	if (!el || !bounds) return
	const w = bounds.maxX - bounds.minX
	const h = bounds.maxY - bounds.minY
	const minK = el.clientWidth < 700 ? 0.45 : 0.42
	const k = Math.min(el.clientWidth / w, el.clientHeight / h, 1)
	view.k = Math.max(k, minK)
	view.x = el.clientWidth / 2 - ((bounds.minX + bounds.maxX) / 2) * view.k
	view.y = k >= minK ? el.clientHeight / 2 - ((bounds.minY + bounds.maxY) / 2) * view.k : el.clientHeight - 16 - bounds.maxY * view.k
}

function centerOn(x: number, y: number, k = Math.max(view.k, 0.9)) {
	const el = viewport.value
	if (!el) return
	view.k = k
	view.x = el.clientWidth / 2 - x * k
	view.y = el.clientHeight / 2 - y * k
}

function focusDomain(index: number) {
	const limb = layout.value?.limbs.find((l) => l.index === index)
	if (!limb) return
	const end = limb.limb[limb.limb.length - 1]
	centerOn((limb.limb[0].x + end.x) / 2, (limb.attachY + limb.top) / 2, 0.8)
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

// A click that ended a drag should not select anything.
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
					<p class="text-muted note">
						<span class="note-cover"></span>半透明的书表示还在读、尚未读完
					</p>
				</div>
				<div class="legend">
					<button v-for="d in tree.domains.map((d, i) => ({ name: d.name, i }))" :key="d.name" class="legend-item" :title="`看看「${d.name}」`" @click="focusDomain(d.i)">
						<span class="dot" :style="{ background: domainColor(d.i) }"></span>{{ d.name }}
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
						<!-- Ground and roots -->
						<ellipse class="ground" cx="0" cy="30" rx="260" ry="22" />
						<path v-for="(r, i) in roots" :key="`root-${i}`" class="wood" :d="ribbon(r, 14, 2)" />

						<!-- Limbs (one per domain) and the twigs carrying each book -->
						<template v-for="l in layout.limbs" :key="l.name">
							<path :d="ribbon(l.limb, 15, 3)" :style="{ fill: domainColor(l.index) }" />
							<template v-for="t in l.twigs" :key="t.key">
								<path :d="ribbon(t.twig, 3.2, 1)" :style="{ fill: domainColor(l.index) }" :fill-opacity="t.reading ? 0.45 : 1" />
								<path v-for="leaf in t.leaves" :key="`${leaf.key}/stalk`" :d="ribbon(leaf.stalk, 1.4, 0.8)" :style="{ fill: domainColor(l.index) }" />
							</template>
						</template>

						<!-- Trunk, drawn over the limb bases so they grow out of it -->
						<path class="wood" :d="ribbon(layout.trunk, TRUNK_BASE, TRUNK_TOP)" />
						<path
						v-for="(p, k) in layout.trunk.filter((_, k) => k % 6 === 3 && k < 34)"
						:key="`bark-${k}`"
						class="bark"
						:d="`M ${p.x - trunkWidth(k * 6 + 3, 40) * 0.18} ${p.y + 10} q 3 -12 0 -24`"
						/>

						<!-- Domain labels, just under each limb near the trunk -->
						<g v-for="l in layout.limbs" :key="`${l.name}/label`" class="domain-label" @click="clickGuard(() => focusDomain(l.index))">
							<rect
							:x="l.label.x - l.labelW / 2"
							:y="l.label.y - 15"
							:width="l.labelW"
							height="30"
							rx="15"
							:style="{ fill: tint(l.index, 18), stroke: domainColor(l.index) }"
							/>
							<text :x="l.label.x" :y="l.label.y + 5" text-anchor="middle">{{ l.name }}</text>
						</g>

						<!-- Books: a cover on each twig, title beside it -->
						<g
						v-for="t in layout.twigs"
						:key="`${t.key}/book`"
						:class="['book', { reading: t.reading, active: selectedBook?.key === t.key }]"
						role="button"
						:aria-label="`《${t.title}》`"
						@click="clickGuard(() => (selected = { type: 'book', key: t.key }))"
						>
							<rect
							class="hit"
							:x="t.side > 0 ? t.x - COVER_W / 2 - 4 : t.x - COVER_W / 2 - 10 - textWidth(t.short, 12) - 4"
							:y="t.coverY - COVER_H / 2 - 4"
							:width="COVER_W + 18 + textWidth(t.short, 12)"
							:height="COVER_H + 8"
							rx="6"
							/>
							<image
							v-if="t.book && coverUrl(t.book)"
							:href="coverUrl(t.book)!"
							:x="t.x - COVER_W / 2"
							:y="t.coverY - COVER_H / 2"
							:width="COVER_W"
							:height="COVER_H"
							preserveAspectRatio="xMidYMid slice"
							/>
							<rect
							class="cover-frame"
							:x="t.x - COVER_W / 2"
							:y="t.coverY - COVER_H / 2"
							:width="COVER_W"
							:height="COVER_H"
							rx="2"
							:style="{ stroke: domainColor(t.domainIndex) }"
							/>
							<text
							:x="t.x + t.side * (COVER_W / 2 + 6)"
							:y="t.coverY + 4"
							:text-anchor="t.side > 0 ? 'start' : 'end'"
							class="book-title"
							>
								{{ t.short }}
							</text>
						</g>

						<!-- Leaves: one per knowledge point -->
						<template v-for="t in layout.twigs" :key="`${t.key}/leaves`">
							<g
							v-for="leaf in t.leaves"
							:key="leaf.key"
							:class="[
								'leaf',
								{
									selected: selectedPoint && leaf.key === selected?.key,
									related: selectedPoint && leaf.key !== selected?.key && leaf.name === selectedPoint.name,
								},
							]"
							role="button"
							:aria-label="`知识点：${leaf.name}`"
							@click="clickGuard(() => (selected = { type: 'point', key: leaf.key }))"
							>
								<rect
								class="hit"
								:x="t.side > 0 ? leaf.x - 12 : leaf.x - 18 - textWidth(leaf.name, 12)"
								:y="leaf.y - 11"
								:width="textWidth(leaf.name, 12) + 30"
								height="22"
								rx="11"
								:style="{ '--accent': domainColor(t.domainIndex) }"
								/>
								<path class="blade" :transform="leafTransform(leaf, t.side)" d="M -9 0 C -4 -7, 5 -7, 10 0 C 5 7, -4 7, -9 0 Z" :style="{ fill: domainColor(t.domainIndex) }" />
								<path class="vein" :transform="leafTransform(leaf, t.side)" d="M -7 0 L 8 0" />
								<text :x="leaf.x + t.side * 14" :y="leaf.y + 4" :text-anchor="t.side > 0 ? 'start' : 'end'">{{ leaf.name }}</text>
							</g>
						</template>
					</g>
				</svg>

				<div class="controls">
					<v-btn icon="mdi-plus" size="small" variant="tonal" title="放大" @click="zoomButton(1.25)"></v-btn>
					<v-btn icon="mdi-minus" size="small" variant="tonal" title="缩小" @click="zoomButton(0.8)"></v-btn>
					<v-btn icon="mdi-fit-to-screen-outline" size="small" variant="tonal" title="看全貌" @click="fit()"></v-btn>
				</div>

				<p class="hint text-muted">拖动或滚轮浏览 · Ctrl + 滚轮或双指缩放 · 点击叶子查看知识点</p>

				<!-- Detail card for the selected leaf or book -->
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
							<a v-for="r in related" :key="r.key" href="#" @click.prevent="selectRelated(r.key, selectedPoint.name)">《{{ r.title }}》</a>
						</div>
					</template>
					<template v-else-if="selectedBook">
						<div class="detail-kicker text-muted">{{ selectedBook.path }}</div>
						<h2 class="detail-title">《{{ selectedBook.title }}》</h2>
						<p class="detail-text text-muted">
							{{ selectedBook.leaves.length }} 个知识点<template v-if="selectedBook.reading"> · 在读</template>
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

.note {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	margin-top: 2px;
}

/* A tiny faded book cover, matching how books still being read look on the tree. */
.note-cover {
	width: 10px;
	height: 14px;
	border-radius: 1px;
	border: 1.5px solid var(--c-text-muted);
	background: var(--c-bg-soft);
	opacity: 0.5;
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
	min-height: 520px;
	border: 1px solid var(--c-card-border);
	border-radius: 12px;
	overflow: hidden;
	background: linear-gradient(to bottom, var(--c-quote-bg), var(--c-bg) 70%);
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

.ground {
	fill: var(--c-bg-soft);
}

.wood {
	fill: var(--c-trunk);
}

.bark {
	fill: none;
	stroke: var(--c-bg);
	stroke-width: 1.5;
	stroke-linecap: round;
	opacity: 0.25;
}

.domain-label {
	cursor: pointer;
}

.domain-label rect {
	stroke-width: 2;
}

.domain-label text {
	font-size: 14px;
	font-weight: bold;
	fill: var(--c-text);
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
	font-size: 12px;
	font-weight: bold;
	fill: var(--c-text);
}

.book.reading image,
.book.reading .book-title {
	opacity: 0.5;
}

.leaf {
	cursor: pointer;
}

.leaf .hit {
	fill: transparent;
	stroke: transparent;
	stroke-width: 1.5;
}

.leaf:hover .hit {
	fill: var(--c-bg-soft);
}

.leaf.selected .hit {
	fill: var(--c-quote-bg);
	stroke: var(--accent);
}

.leaf.related .hit {
	fill: var(--c-idea-bg);
	stroke: var(--accent);
	stroke-dasharray: 4 3;
}

.vein {
	stroke: var(--c-bg);
	stroke-width: 1;
	opacity: 0.6;
}

.leaf text {
	font-size: 12px;
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
