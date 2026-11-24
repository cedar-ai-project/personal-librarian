<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { findBook } from '@/data/books'
import type { RecommendationIssue, RecommendedBook } from '@/types/book'
import issuesData from '@/generated/recommendations.json'

const issues = issuesData as RecommendationIssue[]
const route = useRoute()
const router = useRouter()

const GROUP_HINTS: Record<string, string> = {
	延续你的兴趣: '在已有的关注主题上读得更深',
	拓展视野: '去很少涉足的领域看看',
	书架上的遗珠: '早就加入书架、却还没读完的好书',
	书中提到的书: '读过的书里推荐或引用的书',
}

const STATUS: Record<NonNullable<RecommendedBook['status']>, { text: string; cls: string }> = {
	read: { text: '已读', cls: 'tag-finished' },
	reading: { text: '在读', cls: 'tag-reading' },
	shelf: { text: '已在书架', cls: 'tag-shelf' },
}

// The issue lives in the query string so a past issue can be linked to.
const issueId = computed({
	get: () => issues.find((i) => i.id === route.query.issue)?.id ?? issues[0]?.id,
	set: (id) => router.replace({ query: id === issues[0]?.id ? {} : { issue: id } }),
})
const issue = computed(() => issues.find((i) => i.id === issueId.value))
const issueOptions = issues.map((i) => ({ title: i.title.replace(/^好书推荐 · /, ''), value: i.id }))
const bookCount = computed(() => issue.value?.groups.reduce((n, g) => n + g.books.length, 0) ?? 0)

// Split a reason into text and 《书名》 segments; titles on the shelf become links.
function segments(text: string) {
	return text.split(/(《[^》]+》)/).filter(Boolean).map((part) => {
		const title = part.match(/^《(.+)》$/)?.[1]
		return { text: part, link: title && findBook(title) ? title : null }
	})
}

const failedCovers = ref(new Set<string>())
</script>

<template>
	<div class="page recommend">
		<template v-if="issue">
			<section class="card header">
				<div class="header-top">
					<div>
						<h1 class="header-title">{{ issue.title }}</h1>
						<p class="text-muted header-meta">
							<template v-if="issue.date">{{ issue.date }} · </template>共 {{ bookCount }} 本
						</p>
					</div>
					<v-select
					v-if="issues.length > 1"
					v-model="issueId"
					:items="issueOptions"
					label="往期"
					density="compact"
					variant="outlined"
					hide-details
					class="issue-select"
					></v-select>
				</div>
				<div class="header-intro" v-html="issue.intro"></div>
			</section>

			<section v-for="group in issue.groups" :key="group.name">
				<h2 class="section-title">
					{{ group.name }}<span v-if="GROUP_HINTS[group.name]" class="section-hint">{{ GROUP_HINTS[group.name] }}</span>
				</h2>
				<div class="books">
					<article v-for="book in group.books" :key="book.bookId ?? book.title" class="card rec">
						<div class="rec-cover">
							<img
							v-if="book.cover && !failedCovers.has(book.cover)"
							:src="book.cover"
							:alt="`《${book.title}》封面`"
							loading="lazy"
							referrerpolicy="no-referrer"
							@error="failedCovers.add(book.cover)"
							/>
							<div v-else class="placeholder">{{ book.title }}</div>
						</div>
						<div class="rec-body">
							<h3 class="rec-title">《{{ book.title }}》</h3>
							<p class="rec-author text-muted">{{ book.author }}</p>
							<p class="rec-meta">
								<span v-if="book.rating !== null" class="rating">
									<v-icon icon="mdi-star" size="14"></v-icon>
									{{ book.rating }}%<template v-if="book.ratingTitle"> · {{ book.ratingTitle }}</template>
								</span>
								<span v-if="book.status" :class="['tag', STATUS[book.status].cls]">{{ STATUS[book.status].text }}</span>
							</p>
							<p class="rec-intro text-muted">{{ book.intro }}</p>
							<p class="rec-reason">
								<template v-for="(seg, i) in segments(book.reason)" :key="i">
									<router-link v-if="seg.link" :to="{ name: 'book', params: { title: seg.link } }">{{ seg.text }}</router-link>
									<template v-else>{{ seg.text }}</template>
								</template>
							</p>
							<div class="rec-actions">
								<v-btn
								v-if="book.localTitle"
								:to="{ name: 'book', params: { title: book.localTitle } }"
								variant="text"
								color="primary"
								size="small"
								prepend-icon="mdi-notebook-outline"
								>
									我的笔记
								</v-btn>
								<v-btn
								v-if="book.link"
								:href="book.link"
								target="_blank"
								rel="noopener"
								variant="tonal"
								color="primary"
								size="small"
								append-icon="mdi-open-in-new"
								>
									在微信读书打开
								</v-btn>
							</div>
						</div>
					</article>
				</div>
			</section>
		</template>

		<div v-else class="empty">
			<v-icon icon="mdi-book-heart-outline" size="72" color="primary"></v-icon>
			<h1>好书推荐</h1>
			<p class="text-muted">还没有推荐：使用 recommend-books skill 生成第一期书单后，这里会展示为我精选的好书。</p>
		</div>
	</div>
</template>

<style scoped>
.recommend section {
	margin-bottom: 24px;
}

.card {
	padding: 20px;
	border: 1px solid var(--c-card-border);
	border-radius: 12px;
	background: var(--c-bg);
}

.header {
	background: linear-gradient(135deg, var(--c-quote-bg), var(--c-bg) 70%);
}

.header-top {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16px;
	flex-wrap: wrap;
}

.header-title {
	font-size: 28px;
	font-weight: bold;
	line-height: 1.3;
}

.header-meta {
	font-size: 14px;
	margin-top: 4px;
}

.issue-select {
	flex: 0 0 200px;
}

.header-intro {
	margin-top: 12px;
	font-size: 16px;
	line-height: 1.85;
}

.section-title {
	font-size: 22px;
	font-weight: bold;
	margin: 36px 0 16px;
	padding-bottom: 6px;
	border-bottom: 1px dashed var(--c-accent);
}

.section-hint {
	margin-left: 12px;
	font-size: 14px;
	font-weight: normal;
	color: var(--c-text-muted);
}

.books {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16px;
}

.rec {
	display: flex;
	gap: 18px;
	align-items: flex-start;
}

.rec-cover {
	flex: 0 0 96px;
	aspect-ratio: 3 / 4;
	border-radius: 4px 8px 8px 4px;
	overflow: hidden;
	background: var(--c-bg-soft);
	box-shadow: 0 2px 8px var(--c-shadow);
}

.rec-cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.placeholder {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 8px;
	text-align: center;
	font-size: 13px;
	line-height: 1.4;
	color: #fff;
	background: linear-gradient(160deg, #66ccff, #2a7fb0);
}

.rec-body {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.rec-title {
	font-size: 17px;
	font-weight: bold;
	line-height: 1.4;
	margin-left: -0.5em;
}

.rec-author {
	font-size: 13px;
}

.rec-meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	font-size: 13px;
}

.rating {
	color: #b7791f;
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

.tag-shelf {
	color: var(--c-link);
	background: var(--c-link-hover-bg);
}

.rec-intro {
	font-size: 14px;
	line-height: 1.7;
}

.rec-reason {
	font-size: 15px;
	line-height: 1.8;
}

.rec-actions {
	display: flex;
	gap: 8px;
	justify-content: flex-end;
	margin-top: 4px;
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

@media (max-width: 900px) {
	.books {
		grid-template-columns: 1fr;
	}
}

@media (max-width: 600px) {
	.rec-cover {
		flex-basis: 72px;
	}
}
</style>
