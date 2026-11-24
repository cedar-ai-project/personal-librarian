import type { Book } from '@/types/book'
import list from '@/generated/books.json'

export const WEREAD_ID = 'SSS爱读书'

// Sorted by scripts/build-data.mjs: finished books first, then most recently updated.
export const books = list as Book[]

export function findBook(title: string): Book | undefined {
  return books.find((book) => book.title === title)
}

export function coverUrl(book: Book): string | null {
  return book.cover ? `${import.meta.env.BASE_URL}covers/${book.id}.jpg` : null
}
