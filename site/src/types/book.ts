export interface Book {
  id: string
  title: string
  author: string | null
  link: string | null
  highlights: number | null
  ideas: number | null
  subtitle: string | null
  intro: string | null
  hasNotes: boolean
  hasReflection: boolean
  finished: boolean
  extras: { key: string; title: string }[]
  cover: boolean
  readAt: string | null
  startedAt: string | null
  finishedAt: string | null
  updatedAt: number
}

export interface TocItem {
  id: string
  level: number
  text: string
}

export interface RenderedDoc {
  html: string
  toc: TocItem[]
}

// Content of public/data/<id>.json, keyed by tab: reflection / notes / extras.
export type BookContent = Record<string, RenderedDoc>

// src/generated/profile.json, built from ../profile by scripts/build-data.mjs.
export interface ReadingStats {
  snapshotDate: string
  registTime: number
  overview: { totalReadTime: number; readDays: number; readCount: number; finishCount: number; noteCount: number }
  yearly: { year: number; readTime: number }[]
  categories: { title: string; parent: string; readTime: number; count: number }[]
  preferCategoryWord: string | null
  hourly: number[]
  preferTimeWord: string | null
  topBooks: { title: string; readTime: number; tags: string[] }[]
}

export interface Quote {
  text: string
  book: string | null
}

export interface Persona {
  updated: string | null
  title: string | null
  summary: string
  keywords: { text: string; weight: number }[]
  themes: { name: string; html: string; books: string[] }[]
  timeline: { year: number; html: string }[]
  quotes: { book: Quote[]; mine: Quote[] }
}

export interface Profile {
  stats: ReadingStats | null
  persona: Persona | null
}

// src/generated/recommendations.json, built from ../recommendations by scripts/build-data.mjs.
export interface RecommendedBook {
  title: string
  author: string | null
  bookId: string | null
  rating: number | null
  ratingTitle: string | null
  ratingCount: number | null
  cover: string | null
  link: string | null
  related: string[]
  intro: string
  reason: string
  // Book directory in this repository, when the recommendation has since been read here.
  localTitle: string | null
  status: 'read' | 'reading' | 'shelf' | null
}

export interface RecommendationIssue {
  id: string
  title: string
  date: string | null
  intro: string
  groups: { name: string; books: RecommendedBook[] }[]
}
