<script setup lang="ts">
import { computed } from 'vue'
import type { Book } from '@/types/book'
import { coverUrl } from '@/data/books'

const props = defineProps<{ book: Book }>()
const src = computed(() => coverUrl(props.book))
</script>

<template>
	<div class="book-cover">
		<img v-if="src" :src="src" :alt="`《${book.title}》封面`" loading="lazy" />
		<!-- Placeholder until a cover.jpg is added for the book. -->
		<div v-else class="placeholder">
			<span>{{ book.title }}</span>
		</div>
	</div>
</template>

<style scoped>
.book-cover {
	aspect-ratio: 3 / 4;
	width: 100%;
	border-radius: 4px 8px 8px 4px;
	overflow: hidden;
	background: var(--c-bg-soft);
	box-shadow: 0 2px 8px var(--c-shadow);
}

.book-cover img {
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
	padding: 12px;
	text-align: center;
	font-size: 15px;
	line-height: 1.5;
	color: #fff;
	background: linear-gradient(160deg, #66ccff, #2a7fb0);
}
</style>
