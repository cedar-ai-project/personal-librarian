<script setup lang="ts">
import { computed, ref } from 'vue'
import BookCover from '@/components/BookCover.vue'
import { books, WEREAD_ID } from '@/data/books'
import { useShelfFilter, type ShelfFilter } from '@/composables/useShelfFilter'

const { query, filter } = useShelfFilter()
const copied = ref(false)

const stats = {
	books: books.length,
	highlights: books.reduce((sum, book) => sum + (book.highlights ?? 0), 0),
	ideas: books.reduce((sum, book) => sum + (book.ideas ?? 0), 0),
	reflections: books.filter((book) => book.hasReflection).length,
}

// A book with a reflection counts as finished; one with only notes is still being read.
const filters: { value: ShelfFilter; title: string; count: number }[] = [
	{ value: 'all', title: '全部', count: books.length },
	{ value: 'finished', title: '读完', count: stats.reflections },
	{ value: 'reading', title: '在读', count: books.length - stats.reflections },
]

const visibleBooks = computed(() => {
	const keyword = query.value.trim().toLowerCase()
	return books.filter((book) => {
		if (filter.value === 'finished' && !book.hasReflection) return false
		if (filter.value === 'reading' && book.hasReflection) return false
		if (!keyword) return true
		return [book.title, book.author ?? ''].some((text) => text.toLowerCase().includes(keyword))
	})
})

async function copyWereadId() {
	await navigator.clipboard.writeText(WEREAD_ID)
	copied.value = true
}
</script>

<template>
	<div class="page">
		<section class="intro">
			<h1 class="intro-title">📚 Personal Librarian</h1>
			<p class="intro-text text-muted">我的私人图书馆：收藏在微信读书里留下的每一条划线、想法，以及读完一本书后写下的读书心得。</p>
			<div class="intro-meta">
				<v-chip
				prepend-icon="mdi-book-open-page-variant-outline"
				append-icon="mdi-content-copy"
				variant="tonal"
				color="primary"
				title="点击复制微信读书 ID"
				@click="copyWereadId"
				>
					微信读书 ID：{{ WEREAD_ID }}
				</v-chip>
				<span class="stats text-muted">
					共 <b>{{ stats.books }}</b> 本 · 划线 <b>{{ stats.highlights }}</b> 条 · 想法 <b>{{ stats.ideas }}</b> 条 · 心得 <b>{{ stats.reflections }}</b> 篇
				</span>
			</div>
		</section>

		<section class="toolbar">
			<v-chip-group v-model="filter" mandatory selected-class="text-primary" class="filters">
				<v-chip v-for="item in filters" :key="item.value" :value="item.value" variant="outlined" filter>
					{{ item.title }} {{ item.count }}
				</v-chip>
			</v-chip-group>
			<v-text-field
			v-model="query"
			class="search"
			placeholder="搜索书名或作者"
			prepend-inner-icon="mdi-magnify"
			variant="outlined"
			density="compact"
			hide-details
			clearable
			></v-text-field>
		</section>

		<section v-if="visibleBooks.length" class="shelf">
			<router-link
			v-for="book in visibleBooks"
			:key="book.id"
			:to="{ name: 'book', params: { title: book.title } }"
			class="book-card"
			>
				<BookCover :book="book" />
				<div class="book-title">{{ book.title }}</div>
				<div class="book-author text-muted">{{ book.author ?? ' ' }}</div>
				<div class="book-tags">
					<span v-if="book.hasReflection" class="tag tag-finished">心得</span>
					<span v-else class="tag tag-reading">在读</span>
					<span v-if="book.highlights !== null" class="tag">划线 {{ book.highlights }}</span>
				</div>
			</router-link>
		</section>
		<p v-else class="empty text-muted">没有找到相关的书。</p>

		<v-snackbar v-model="copied" :timeout="1500" location="top">已复制微信读书 ID</v-snackbar>
	</div>
</template>

<style scoped>
.intro {
	margin-bottom: 24px;
}

.intro-title {
	font-size: 30px;
	font-weight: bold;
	line-height: 1.3;
}

.intro-text {
	margin: 8px 0 14px;
	font-size: 16px;
}

.intro-meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px 16px;
}

.stats b {
	font-weight: bold;
	color: var(--c-text);
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px 16px;
	margin-bottom: 20px;
	padding-top: 16px;
	border-top: 1px dashed var(--c-card-border);
}

.search {
	flex: 0 1 280px;
	min-width: 200px;
}

.shelf {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	gap: 28px 22px;
}

.book-card {
	display: block;
	color: var(--c-text);
	transition: transform 0.2s;
}

@media (hover: hover) {
	.book-card:hover {
		transform: translateY(-4px);
	}
}

.book-title {
	margin-top: 10px;
	font-size: 15px;
	font-weight: bold;
	line-height: 1.4;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.book-author {
	font-size: 13px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.book-tags {
	display: flex;
	gap: 6px;
	margin-top: 6px;
}

.tag {
	font-size: 12px;
	line-height: 1;
	padding: 4px 6px;
	border-radius: 4px;
	color: var(--c-text-muted);
	background: var(--c-bg-soft);
}

.tag-finished {
	color: #1b8a5a;
	background: rgba(46, 184, 114, 0.15);
}

.tag-reading {
	color: #b7791f;
	background: rgba(240, 180, 41, 0.18);
}

.empty {
	text-align: center;
	padding: 48px 0;
}
</style>
