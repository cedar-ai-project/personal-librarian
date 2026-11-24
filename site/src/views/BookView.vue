<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BookCover from '@/components/BookCover.vue'
import { findBook } from '@/data/books'
import type { BookContent } from '@/types/book'

const props = defineProps<{ title: string }>()
const route = useRoute()
const router = useRouter()

const book = computed(() => findBook(props.title))
const content = ref<BookContent | null>(null)
const loadError = ref(false)
const activeId = ref('')

const tabs = computed(() => {
	if (!book.value) return []
	const list: { key: string; title: string }[] = []
	if (book.value.hasReflection) list.push({ key: 'reflection', title: '读书心得' })
	if (book.value.hasNotes) list.push({ key: 'notes', title: '划线与想法' })
	return [...list, ...book.value.extras]
})

// The tab lives in the query string so it survives reloads and can be shared.
const tab = computed({
	get: () => {
		const wanted = route.query.tab
		return tabs.value.find((t) => t.key === wanted)?.key ?? tabs.value[0]?.key
	},
	set: (key) => router.replace({ query: { ...route.query, tab: key } }),
})

const doc = computed(() => (content.value && tab.value ? content.value[tab.value] : null))

watch(
	book,
	async (current) => {
		content.value = null
		loadError.value = false
		if (!current) return
		document.title = `《${current.title}》· Personal Librarian`
		try {
			const res = await fetch(`${import.meta.env.BASE_URL}data/${current.id}.json`)
			if (!res.ok) throw new Error(res.statusText)
			content.value = await res.json()
		} catch {
			loadError.value = true
		}
	},
	{ immediate: true },
)

watch(doc, async () => {
	await nextTick()
	updateActive()
})

function scrollTo(id: string) {
	document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Highlight the last heading that has scrolled past the top bar.
function updateActive() {
	const toc = doc.value?.toc ?? []
	let current = toc[0]?.id ?? ''
	for (const item of toc) {
		const el = document.getElementById(item.id)
		if (el && el.getBoundingClientRect().top < 120) current = item.id
	}
	activeId.value = current
}

onMounted(() => window.addEventListener('scroll', updateActive, { passive: true }))
onBeforeUnmount(() => {
	window.removeEventListener('scroll', updateActive)
	document.title = 'Personal Librarian'
})
</script>

<template>
	<div v-if="book" class="page">
		<router-link to="/" class="back text-muted">
			<v-icon icon="mdi-arrow-left" size="18"></v-icon> 返回书架
		</router-link>

		<header class="book-header">
			<BookCover :book="book" class="header-cover" />
			<div class="header-info">
				<h1 class="book-title">《{{ book.title }}》</h1>
				<p v-if="book.subtitle" class="book-subtitle">{{ book.subtitle }}</p>
				<p v-if="book.author" class="text-muted">{{ book.author }}</p>
				<div class="header-meta">
					<span :class="['tag', book.hasReflection ? 'tag-finished' : 'tag-reading']">
						{{ book.hasReflection ? '读完' : '在读' }}
					</span>
					<span v-if="book.highlights !== null" class="text-muted">划线 {{ book.highlights }} · 想法 {{ book.ideas }}</span>
				</div>
				<v-btn
				v-if="book.link"
				:href="book.link"
				target="_blank"
				rel="noopener"
				variant="tonal"
				color="primary"
				size="small"
				append-icon="mdi-open-in-new"
				class="mt-3"
				>
					在微信读书中打开
				</v-btn>
			</div>
		</header>

		<v-tabs v-model="tab" color="primary" class="tabs">
			<v-tab v-for="t in tabs" :key="t.key" :value="t.key">{{ t.title }}</v-tab>
		</v-tabs>

		<div class="content">
			<article class="markdown-body">
				<div v-if="doc" v-html="doc.html"></div>
				<p v-else-if="loadError" class="text-muted">内容加载失败，请刷新重试。</p>
				<v-progress-linear v-else indeterminate color="primary"></v-progress-linear>
			</article>

			<aside v-if="doc && doc.toc.length" class="toc">
				<div class="toc-title">目录</div>
				<a
				v-for="item in doc.toc"
				:key="item.id"
				:href="`#${item.id}`"
				:class="['toc-item', `toc-level-${item.level}`, { active: item.id === activeId }]"
				@click.prevent="scrollTo(item.id)"
				>
					{{ item.text }}
				</a>
			</aside>
		</div>
	</div>

	<div v-else class="page not-found">
		<p class="text-muted">书架上没有《{{ title }}》。</p>
		<router-link to="/">返回书架</router-link>
	</div>
</template>

<style scoped>
.back {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 14px;
	margin-bottom: 16px;
}

.book-header {
	display: flex;
	gap: 24px;
	align-items: flex-start;
	margin-bottom: 20px;
}

.header-cover {
	flex: 0 0 120px;
	width: 120px;
}

.book-title {
	font-size: 26px;
	font-weight: bold;
	line-height: 1.35;
	margin-left: -0.5em;
}

.book-subtitle {
	font-size: 17px;
	margin: 4px 0;
}

.header-meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
	margin-top: 6px;
	font-size: 14px;
}

.tag {
	font-size: 12px;
	line-height: 1;
	padding: 4px 6px;
	border-radius: 4px;
}

.tag-finished {
	color: #1b8a5a;
	background: rgba(46, 184, 114, 0.15);
}

.tag-reading {
	color: #b7791f;
	background: rgba(240, 180, 41, 0.18);
}

.tabs {
	border-bottom: 1px solid var(--c-card-border);
	margin-bottom: 24px;
}

.content {
	display: flex;
	gap: 40px;
	align-items: flex-start;
}

.markdown-body {
	flex: 1;
	min-width: 0;
}

.toc {
	flex: 0 0 220px;
	position: sticky;
	top: 88px;
	max-height: calc(100vh - 110px);
	overflow-y: auto;
	padding-left: 12px;
	border-left: 1px solid var(--c-card-border);
	font-size: 14px;
}

.toc-title {
	font-weight: bold;
	margin-bottom: 8px;
}

.toc-item {
	display: block;
	padding: 3px 0;
	line-height: 1.5;
	color: var(--c-text-muted);
}

.toc-item:hover,
.toc-item.active {
	color: var(--c-link);
}

.toc-level-3 {
	padding-left: 14px;
	font-size: 13px;
}

.not-found {
	text-align: center;
	padding-top: 96px;
}

@media (max-width: 1023px) {
	.toc {
		display: none;
	}
}

@media (max-width: 600px) {
	.book-header {
		gap: 16px;
	}

	.header-cover {
		flex-basis: 96px;
		width: 96px;
	}

	.book-title {
		font-size: 21px;
	}
}
</style>
