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
  extras: { key: string; title: string }[]
  cover: boolean
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
