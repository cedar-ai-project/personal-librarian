// Collect every book under ../notes and ../reflections into data the site can load:
//   src/generated/books.json        book list (bundled, used by the bookshelf)
//   public/data/<id>.json           rendered Markdown + table of contents per book (fetched on demand)
//   public/covers/<id>.jpg          cover images
//   src/generated/profile.json      reading stats + parsed persona from ../profile (bundled, used by 阅读画像)
// Run automatically by `npm run dev` / `npm run build`.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(SITE, '..')
const NOTES_DIR = path.join(ROOT, 'notes')
const REFLECTIONS_DIR = path.join(ROOT, 'reflections')
const OUT_LIST = path.join(SITE, 'src', 'generated', 'books.json')
const OUT_DATA = path.join(SITE, 'public', 'data')
const OUT_COVERS = path.join(SITE, 'public', 'covers')
const PROFILE_DIR = path.join(ROOT, 'profile')
const OUT_PROFILE = path.join(SITE, 'src', 'generated', 'profile.json')

const NOTES_FILE = '划线与想法.md'
const REFLECTION_FILE = '读书心得.md'
const EXTRA_FILES = { '阅读推荐.md': 'recommend' }

function listBooks(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
}

function bookId(name) {
  return createHash('sha1').update(name).digest('hex').slice(0, 10)
}

// Last commit time touching the book; uncommitted books count as "now".
function updatedAt(name) {
  const paths = [path.join('notes', name), path.join('reflections', name)]
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', ...paths], { cwd: ROOT, encoding: 'utf8' }).trim()
    if (out) return Number(out)
  } catch {
    // Not a git checkout; fall through.
  }
  return Math.floor(Date.now() / 1000)
}

// Header of an exported notes file:
//   - 作者：xxx / - 来源：[打开阅读](url) / - 划线数：118，想法数：9
function parseNotesHeader(md) {
  const author = md.match(/^- 作者：(.+)$/m)?.[1].trim()
  const link = md.match(/^- 来源：\[[^\]]*\]\(([^)]+)\)/m)?.[1]
  const counts = md.match(/^- 划线数：(\d+)，想法数：(\d+)/m)
  return {
    author,
    link,
    highlights: counts ? Number(counts[1]) : undefined,
    ideas: counts ? Number(counts[2]) : undefined,
  }
}

// "# 《悉达多》读书笔记｜找寻自我之路" -> "找寻自我之路"
function parseReflectionHeader(md) {
  const subtitle = md.match(/^# .*?｜(.+)$/m)?.[1].trim()
  const intro = md.match(/^简介：(.+)$/m)?.[1].trim()
  return { subtitle, intro }
}

// Drop the title (and, for notes, the metadata list): the book page header shows them.
function stripHeader(md) {
  const firstSection = md.search(/^## /m)
  return firstSection >= 0 ? md.slice(firstSection) : md.replace(/^# .*$/m, '')
}

function createRenderer(prefix, tocLevels) {
  const md = new MarkdownIt({ html: true, linkify: true })
  const toc = []

  md.core.ruler.push('heading_ids', (state) => {
    state.tokens.forEach((token, i) => {
      if (token.type !== 'heading_open') return
      const id = `${prefix}-${toc.length + 1}`
      const level = Number(token.tag.slice(1))
      token.attrSet('id', id)
      toc.push({ id, level, text: state.tokens[i + 1].content.replace(/[*_`]/g, '') })
    })
  })

  const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener')
    return defaultLinkOpen(tokens, idx, options, env, self)
  }

  return (source) => {
    const html = md
      .render(source)
      // Reflections repeat the cover inline; the page header already shows it.
      .replace(/<img src="\.\/cover\.jpg"[^>]*>/g, '')
      // Highlight personal ideas inside exported notes.
      .replace(/<p><strong>想法<\/strong>：/g, '<p class="idea"><strong>想法</strong>：')
      // Task lists such as "- [ ] 《书名》" in 阅读推荐.md.
      .replace(/<li>\[([ xX])\] /g, (_, mark) => `<li class="task"><input type="checkbox" disabled${mark === ' ' ? '' : ' checked'}> `)
    return { html, toc: toc.filter((item) => tocLevels.includes(item.level)) }
  }
}

function render(file, prefix, tocLevels) {
  const source = fs.readFileSync(file, 'utf8')
  return createRenderer(prefix, tocLevels)(stripHeader(source))
}

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
}

// Split Markdown into { heading: body } for one heading level ("## " or "### ").
function splitSections(md, marker) {
  const sections = {}
  const parts = md.split(new RegExp(`^${marker}(.+)$`, 'm'))
  for (let i = 1; i < parts.length; i += 2) sections[parts[i].trim()] = parts[i + 1].trim()
  return sections
}

function bookTitles(text) {
  return [...text.matchAll(/《(.+?)》/g)].map((m) => m[1])
}

// One "> text\n>\n> ——《书名》" block per quote.
function parseQuotes(body) {
  return body
    .split(/\n\s*\n(?=>)/)
    .map((block) => block.split('\n').map((line) => line.replace(/^>\s?/, '').trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines) => {
      const source = lines.at(-1).startsWith('——') ? lines.pop() : ''
      return { text: lines.join('\n'), book: bookTitles(source)[0] ?? null }
    })
}

// Parse profile/阅读画像.md, whose structure is fixed by skills/generate-reading-profile.
function parsePersona(source) {
  const md = new MarkdownIt({ linkify: true })
  const body = source.split(/^---$/m)[0]
  const sections = splitSections(body, '## ')
  const personality = sections['阅读人格'] ?? ''
  const themes = splitSections(sections['核心关注主题'] ?? '', '### ')
  const timeline = splitSections(sections['思想变化轨迹'] ?? '', '### ')
  const quotes = splitSections(sections['金句'] ?? '', '### ')
  return {
    updated: body.match(/更新日期：(\S+)/)?.[1] ?? null,
    title: personality.match(/^\*\*称号\*\*：(.+)$/m)?.[1].trim() ?? null,
    summary: md.render(personality.replace(/^\*\*称号\*\*：.*$/m, '')),
    keywords: [...(sections['关键词'] ?? '').matchAll(/^- (.+?)（(\d)）\s*$/gm)].map((m) => ({ text: m[1], weight: Number(m[2]) })),
    themes: Object.entries(themes).map(([name, text]) => {
      const booksLine = text.match(/^代表书籍：(.+)$/m)?.[1] ?? ''
      return { name, html: md.render(text.replace(/^代表书籍：.*$/m, '')), books: bookTitles(booksLine) }
    }),
    timeline: Object.entries(timeline).map(([heading, text]) => ({ year: Number.parseInt(heading), html: md.render(text) })),
    quotes: { book: parseQuotes(quotes['书中原文'] ?? ''), mine: parseQuotes(quotes['我的感悟'] ?? '') },
  }
}

function buildProfile() {
  const stats = readJson(path.join(PROFILE_DIR, 'reading-stats.json'))
  const personaFile = path.join(PROFILE_DIR, '阅读画像.md')
  const persona = fs.existsSync(personaFile) ? parsePersona(fs.readFileSync(personaFile, 'utf8')) : null
  const profile = { stats: Object.keys(stats).length ? stats : null, persona }
  fs.writeFileSync(OUT_PROFILE, JSON.stringify(profile, null, 2) + '\n')
  return stats
}

function formatDate(seconds) {
  // Dates are shown in China time, like WeChat Reading.
  return new Date((seconds + 8 * 3600) * 1000).toISOString().slice(0, 10)
}

function main() {
  fs.rmSync(OUT_DATA, { recursive: true, force: true })
  fs.rmSync(OUT_COVERS, { recursive: true, force: true })
  fs.mkdirSync(OUT_DATA, { recursive: true })
  fs.mkdirSync(OUT_COVERS, { recursive: true })
  fs.mkdirSync(path.dirname(OUT_LIST), { recursive: true })
  const stats = buildProfile()

  const names = [...new Set([...listBooks(NOTES_DIR), ...listBooks(REFLECTIONS_DIR)])]
  const books = names.map((name) => {
    const id = bookId(name)
    const notesDir = path.join(NOTES_DIR, name)
    const reflectionDir = path.join(REFLECTIONS_DIR, name)
    const notesFile = path.join(notesDir, NOTES_FILE)
    const reflectionFile = path.join(reflectionDir, REFLECTION_FILE)
    const hasNotes = fs.existsSync(notesFile)
    const hasReflection = fs.existsSync(reflectionFile)

    const meta = {
      ...readJson(path.join(notesDir, 'meta.json')),
      ...readJson(path.join(reflectionDir, 'meta.json')),
      ...(hasNotes ? parseNotesHeader(fs.readFileSync(notesFile, 'utf8')) : {}),
    }
    const times = stats.books?.[name] ?? {}
    const day = (seconds) => (seconds ? formatDate(seconds) : null)
    const reflectionMeta = hasReflection ? parseReflectionHeader(fs.readFileSync(reflectionFile, 'utf8')) : {}

    const data = {}
    if (hasReflection) data.reflection = render(reflectionFile, 'r', [2, 3])
    if (hasNotes) data.notes = render(notesFile, 'n', [2])
    const extras = []
    for (const [file, key] of Object.entries(EXTRA_FILES)) {
      const extraFile = path.join(notesDir, file)
      if (!fs.existsSync(extraFile)) continue
      data[key] = render(extraFile, key[0], [2])
      extras.push({ key, title: path.basename(file, '.md') })
    }
    fs.writeFileSync(path.join(OUT_DATA, `${id}.json`), JSON.stringify(data))

    const cover = [path.join(reflectionDir, 'cover.jpg'), path.join(notesDir, 'cover.jpg')].find((f) => fs.existsSync(f))
    if (cover) fs.copyFileSync(cover, path.join(OUT_COVERS, `${id}.jpg`))

    return {
      id,
      title: name,
      author: meta.author ?? null,
      link: meta.link ?? null,
      highlights: meta.highlights ?? null,
      ideas: meta.ideas ?? null,
      subtitle: reflectionMeta.subtitle ?? null,
      intro: reflectionMeta.intro ?? null,
      hasNotes,
      hasReflection,
      // Finished: has a reflection, or marked with "finished": true in meta.json.
      finished: hasReflection || meta.finished === true,
      extras,
      cover: Boolean(cover),
      // Last read on WeChat Reading ("YYYY-MM-DD"), or "YYYY-MM" from meta.json for books read elsewhere.
      readAt: meta.readAt ?? day(times.lastReadAt),
      startedAt: day(times.startedAt) ?? meta.readAt ?? null,
      finishedAt: day(times.finishedAt) ?? meta.readAt ?? null,
      updatedAt: updatedAt(name),
    }
  })

  // Finished books first, most recently finished first; books still being read by when they were started.
  // Dates are "YYYY-MM-DD" or "YYYY-MM", so they compare as strings.
  const shelfDate = (book) => (book.finished ? book.finishedAt : book.startedAt) ?? book.readAt ?? ''
  books.sort((a, b) => Number(b.finished) - Number(a.finished) || shelfDate(b).localeCompare(shelfDate(a)) || b.updatedAt - a.updatedAt)
  fs.writeFileSync(OUT_LIST, JSON.stringify(books, null, 2) + '\n')
  console.log(`${books.length} books -> ${path.relative(SITE, OUT_LIST)}, ${path.relative(SITE, OUT_DATA)}/`)
}

main()
