<script setup lang="ts">
import { computed } from 'vue'
import BookCover from '@/components/BookCover.vue'
import ColumnChart, { type Column } from '@/components/ColumnChart.vue'
import { books, findBook } from '@/data/books'
import type { Book, Profile } from '@/types/book'
import profileData from '@/generated/profile.json'

const { stats, persona } = profileData as Profile

function hours(seconds: number): string {
	const h = seconds / 3600
	return h >= 10 ? `${Math.round(h)} 小时` : `${h.toFixed(1)} 小时`
}

function duration(seconds: number): string {
	const h = Math.floor(seconds / 3600)
	const m = Math.round((seconds % 3600) / 60)
	return h ? `${h} 小时 ${m} 分钟` : `${m} 分钟`
}

const tiles = stats
	? [
		{ value: hours(stats.overview.totalReadTime).replace(' 小时', ''), unit: '小时', label: '累计阅读' },
		{ value: stats.overview.readDays, unit: '天', label: '阅读天数' },
		{ value: stats.overview.finishCount, unit: '本', label: `读完（读过 ${stats.overview.readCount} 本）` },
		{ value: stats.overview.noteCount, unit: '条', label: '笔记' },
	]
	: []

const yearlyColumns = computed<Column[]>(() =>
	(stats?.yearly ?? []).map((y) => ({ label: `${y.year} 年`, value: y.readTime, valueText: hours(y.readTime), tick: `${y.year}` })),
)

const hourlyColumns = computed<Column[]>(() =>
	(stats?.hourly ?? []).map((secs, h) => ({
		label: `${h}:00–${h + 1}:00`,
		value: secs,
		valueText: duration(secs),
		tick: h % 3 === 0 ? `${h}` : '',
	})),
)

const maxCategory = Math.max(...(stats?.categories ?? []).map((c) => c.readTime), 1)
const topBooks = (stats?.topBooks ?? []).map((t) => ({ ...t, book: findBook(t.title) }))
const maxTop = Math.max(...topBooks.map((t) => t.readTime), 1)

const keywords = computed(() => [...(persona?.keywords ?? [])])

// Footprint date: when a finished book was finished, or when a book still being read was last read.
function footprintDate(book: Book): string | null {
	return book.finished ? book.finishedAt ?? book.readAt : book.readAt
}

// Footprint: every book on the shelf grouped by its footprint year, oldest year first.
const footprint = computed(() => {
	const byYear = new Map<number, { book: Book; date: string }[]>()
	for (const book of books) {
		const date = footprintDate(book)
		if (!date) continue
		const year = Number(date.slice(0, 4))
		byYear.set(year, [...(byYear.get(year) ?? []), { book, date }])
	}
	return [...byYear.entries()]
		.sort(([a], [b]) => a - b)
		.map(([year, list]) => ({
			year,
			books: list.sort((a, b) => a.date.localeCompare(b.date)),
			html: persona?.timeline.find((t) => t.year === year)?.html ?? '',
		}))
})

const quoteGroups = computed(() =>
	persona
		? [
			{ title: '书中原文', icon: 'mdi-format-quote-open', items: persona.quotes.book },
			{ title: '我的感悟', icon: 'mdi-lightbulb-on-outline', items: persona.quotes.mine },
		]
		: [],
)
</script>

<template>
	<div class="page profile">
		<!-- 阅读人格 -->
		<section class="card hero">
			<template v-if="persona">
				<div class="hero-label text-muted">我的阅读人格</div>
				<h1 class="hero-title">{{ persona.title }}</h1>
				<div class="hero-summary" v-html="persona.summary"></div>
				<div v-if="keywords.length" class="keywords">
					<span v-for="k in keywords" :key="k.text" :class="['keyword', `w${k.weight}`]">{{ k.text }}</span>
				</div>
			</template>
			<template v-else>
				<h1 class="hero-title">阅读画像</h1>
				<p class="text-muted">AI 画像尚未生成：使用 generate-reading-profile skill 生成后，这里会展示我的阅读人格、关键词、关注主题和金句。</p>
			</template>
		</section>

		<template v-if="stats">
			<!-- 数据总览 -->
			<section class="tiles">
				<div v-for="t in tiles" :key="t.label" class="card tile">
					<div class="tile-value">{{ t.value }}<span class="tile-unit">{{ t.unit }}</span></div>
					<div class="tile-label text-muted">{{ t.label }}</div>
				</div>
			</section>

			<section class="grid">
				<div class="card">
					<h2 class="card-title">逐年阅读时长</h2>
					<ColumnChart :columns="yearlyColumns" show-values />
				</div>

				<div class="card">
					<h2 class="card-title">阅读时段<span v-if="stats.preferTimeWord" class="card-hint">{{ stats.preferTimeWord }}</span></h2>
					<ColumnChart :columns="hourlyColumns" />
				</div>

				<div class="card">
					<h2 class="card-title">偏好分类<span v-if="stats.preferCategoryWord" class="card-hint">{{ stats.preferCategoryWord }}</span></h2>
					<div class="hbars">
						<div v-for="c in stats.categories" :key="c.title" class="hbar" tabindex="0">
							<span class="hbar-label">{{ c.title }}</span>
							<span class="hbar-track"><span class="hbar-fill" :style="{ width: `${(c.readTime / maxCategory) * 100}%` }"></span></span>
							<span class="hbar-value text-muted">{{ hours(c.readTime) }} · {{ c.count }} 本</span>
						</div>
					</div>
				</div>

				<div class="card">
					<h2 class="card-title">读得最久的书</h2>
					<ol class="top-books">
						<li v-for="(t, i) in topBooks" :key="t.title">
							<span class="rank">{{ i + 1 }}</span>
							<router-link v-if="t.book" :to="{ name: 'book', params: { title: t.title } }" class="top-title">{{ t.title }}</router-link>
							<span v-else class="top-title">{{ t.title }}</span>
							<span class="hbar-track"><span class="hbar-fill" :style="{ width: `${(t.readTime / maxTop) * 100}%` }"></span></span>
							<span class="hbar-value text-muted">{{ hours(t.readTime) }}</span>
						</li>
					</ol>
				</div>
			</section>
		</template>

		<!-- 核心关注主题 -->
		<section v-if="persona?.themes.length">
			<h2 class="section-title">核心关注主题</h2>
			<div class="themes">
				<div v-for="theme in persona.themes" :key="theme.name" class="card theme">
					<h3 class="theme-name">{{ theme.name }}</h3>
					<div class="theme-text" v-html="theme.html"></div>
					<div class="theme-books">
						<template v-for="title in theme.books" :key="title">
							<router-link v-if="findBook(title)" :to="{ name: 'book', params: { title } }">《{{ title }}》</router-link>
							<span v-else>《{{ title }}》</span>
						</template>
					</div>
				</div>
			</div>
		</section>

		<!-- 思想变化轨迹 + 阅读足迹 -->
		<section v-if="footprint.length">
			<h2 class="section-title">{{ persona?.timeline.length ? '思想变化轨迹 · 阅读足迹' : '阅读足迹' }}</h2>
			<div class="timeline">
				<div v-for="year in footprint" :key="year.year" class="year">
					<div class="year-dot"></div>
					<h3 class="year-title">{{ year.year }} 年<span class="text-muted"> · {{ year.books.length }} 本</span></h3>
					<div v-if="year.html" class="year-text" v-html="year.html"></div>
					<div class="year-books">
						<router-link
						v-for="{ book, date } in year.books"
						:key="book.id"
						:to="{ name: 'book', params: { title: book.title } }"
						class="year-book"
						:title="book.title"
						>
							<BookCover :book="book" />
							<span class="year-book-date text-muted">{{ date.slice(5) || date }}<template v-if="!book.finished"> · 在读</template></span>
						</router-link>
					</div>
				</div>
			</div>
		</section>

		<!-- 金句 -->
		<section v-if="quoteGroups.some((g) => g.items.length)">
			<h2 class="section-title">金句</h2>
			<div class="quotes">
				<div v-for="group in quoteGroups" :key="group.title" class="quote-group">
					<h3 class="quote-group-title"><v-icon :icon="group.icon" size="20"></v-icon> {{ group.title }}</h3>
					<figure v-for="(q, i) in group.items" :key="i" class="card quote">
						<blockquote>{{ q.text }}</blockquote>
						<figcaption v-if="q.book" class="text-muted">
							——<router-link v-if="findBook(q.book)" :to="{ name: 'book', params: { title: q.book } }">《{{ q.book }}》</router-link>
							<span v-else>《{{ q.book }}》</span>
						</figcaption>
					</figure>
				</div>
			</div>
		</section>

		<p v-if="stats" class="snapshot text-muted">
			阅读数据来自微信读书，快照于 {{ stats.snapshotDate }}<template v-if="persona?.updated">；画像更新于 {{ persona.updated }}</template>。
		</p>
	</div>
</template>

<style scoped>
.profile section {
	margin-bottom: 24px;
}

.card {
	padding: 20px;
	border: 1px solid var(--c-card-border);
	border-radius: 12px;
	background: var(--c-bg);
}

.hero {
	background: linear-gradient(135deg, var(--c-quote-bg), var(--c-bg) 70%);
}

.hero-label {
	font-size: 14px;
}

.hero-title {
	font-size: 30px;
	font-weight: bold;
	line-height: 1.3;
	margin: 4px 0 12px;
}

.hero-summary {
	font-size: 16px;
	line-height: 1.85;
}

.hero-summary :deep(p) {
	margin-bottom: 8px;
}

.keywords {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 6px 14px;
	margin-top: 14px;
}

.keyword {
	color: var(--c-link);
	line-height: 1.4;
}

.keyword.w1 { font-size: 13px; opacity: 0.7; }
.keyword.w2 { font-size: 15px; opacity: 0.8; }
.keyword.w3 { font-size: 17px; }
.keyword.w4 { font-size: 20px; }
.keyword.w5 { font-size: 24px; font-weight: bold; }

.tiles {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 16px;
}

.tile-value {
	font-size: 32px;
	font-weight: bold;
	line-height: 1.2;
}

.tile-unit {
	font-size: 14px;
	font-weight: normal;
	margin-left: 4px;
}

.tile-label {
	font-size: 14px;
	margin-top: 4px;
}

.grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16px;
}

.card-title {
	font-size: 17px;
	font-weight: bold;
	margin-bottom: 16px;
}

.card-hint {
	margin-left: 10px;
	font-size: 13px;
	font-weight: normal;
	color: var(--c-text-muted);
}

.hbars,
.top-books {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 0;
	list-style: none;
}

.hbar,
.top-books li {
	display: grid;
	grid-template-columns: 5.5em 1fr auto;
	align-items: center;
	gap: 10px;
	font-size: 14px;
	outline: none;
}

.top-books li {
	grid-template-columns: 1.2em minmax(0, 9em) 1fr auto;
}

.rank {
	color: var(--c-text-muted);
	text-align: right;
}

.top-title {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.hbar-track {
	height: 10px;
}

.hbar-fill {
	display: block;
	height: 100%;
	min-width: 2px;
	background: var(--c-chart);
	border-radius: 0 4px 4px 0;
	transition: filter 0.15s;
}

.hbar:hover .hbar-fill,
.hbar:focus-visible .hbar-fill,
.top-books li:hover .hbar-fill {
	filter: brightness(1.2);
}

.hbar-value {
	font-size: 13px;
	white-space: nowrap;
}

.section-title {
	font-size: 22px;
	font-weight: bold;
	margin: 36px 0 16px;
	padding-bottom: 6px;
	border-bottom: 1px dashed var(--c-accent);
}

.themes {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 16px;
}

.theme-name {
	font-size: 18px;
	font-weight: bold;
	margin-bottom: 8px;
}

.theme-text {
	font-size: 15px;
	line-height: 1.8;
}

.theme-books {
	margin-top: 10px;
	font-size: 14px;
}

.timeline {
	padding-left: 24px;
	border-left: 2px solid var(--c-card-border);
	margin-left: 6px;
}

.year {
	padding-bottom: 28px;
}

.year-dot {
	position: absolute;
	left: -32px;
	top: 6px;
	width: 14px;
	height: 14px;
	border-radius: 50%;
	background: var(--c-chart);
	border: 3px solid var(--c-bg);
}

.year-title {
	font-size: 20px;
	font-weight: bold;
	margin-bottom: 8px;
}

.year-title span {
	font-size: 14px;
	font-weight: normal;
}

.year-text {
	font-size: 15px;
	line-height: 1.8;
	margin-bottom: 12px;
}

.year-books {
	display: flex;
	flex-wrap: wrap;
	gap: 14px;
}

.year-book {
	width: 72px;
	text-align: center;
	transition: transform 0.2s;
}

@media (hover: hover) {
	.year-book:hover {
		transform: translateY(-3px);
	}
}

.year-book-date {
	display: block;
	font-size: 12px;
	margin-top: 4px;
}

.quotes {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 24px;
}

.quote-group-title {
	font-size: 17px;
	font-weight: bold;
	margin-bottom: 12px;
	display: flex;
	align-items: center;
	gap: 6px;
}

.quote {
	margin-bottom: 12px;
	background: var(--c-quote-bg);
	border-left: 4px solid var(--c-accent);
}

.quote blockquote {
	font-size: 15px;
	line-height: 1.8;
	white-space: pre-line;
}

.quote figcaption {
	text-align: right;
	font-size: 13px;
	margin-top: 6px;
}

.snapshot {
	font-size: 13px;
	text-align: center;
	margin-top: 32px;
}

@media (max-width: 800px) {
	.tiles {
		grid-template-columns: repeat(2, 1fr);
	}

	.grid,
	.quotes {
		grid-template-columns: 1fr;
	}
}
</style>
