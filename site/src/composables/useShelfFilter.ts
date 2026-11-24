import { ref } from 'vue'

export type ShelfFilter = 'all' | 'finished' | 'reading'

// Module-level state so the search and filter survive a round trip to a book page.
const query = ref('')
const filter = ref<ShelfFilter>('all')

export function useShelfFilter() {
  return { query, filter }
}
