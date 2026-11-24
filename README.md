# Personal Librarian

An AI-agent-driven personal librarian that works with [WeChat Reading (微信读书)](https://weread.qq.com/): export your reading notes, write reading reflections, analyze your reading taste, build a personal reading profile, and discover books you'll love.

## Features

- **Export reading notes** — pull your highlights, ideas, and bookmarks from WeChat Reading into Markdown files you own.
- **Write reading reflections** — turn raw notes into structured reading reviews (心得) with the help of an AI agent.
- **Reading profile** — analyze your notes, bookshelf, and reading stats to generate a personal reading taste profile (偏好画像).
- **Personalized recommendations** — discover new books based on your profile and interests.

## How it works

The project is driven by an AI coding agent (e.g., Claude Code) with the [weread-skills](https://github.com/Tencent/WeChatReading) skill installed. You ask for something in natural language — "export my highlights from 三体", "summarize my reading this month", "recommend me a book" — and the agent calls the WeChat Reading API, processes the results, and writes the output into this repository.

## Prerequisites

- An AI coding agent with skill support (e.g., [Claude Code](https://claude.com/claude-code))
- A WeChat Reading API key (`wrk-xxxxxxxx`)

## Setup

1. Install the WeChat Reading skill globally:

   ```bash
   npx skills add Tencent/WeChatReading -g
   ```

2. Install this project's skills globally (`write-reading-reflection` turns your notes and spoken reflections into a 读书心得; `generate-reading-profile` snapshots your WeChat Reading stats and drafts your reading profile 阅读画像; `recommend-books` curates a monthly reading list 好书推荐 verified on WeChat Reading):

   ```bash
   npx skills add cedar-ai-project/personal-librarian -g
   ```

3. Set your WeChat Reading API key:

   ```bash
   export WEREAD_API_KEY=<your_api_key>
   ```

   Add the same line to your shell profile (`~/.zshrc` or `~/.bashrc`) to persist it across sessions.

4. Skills are installed as a snapshot — changes to the source repository are not synced automatically. To update installed skills after the repository changes (make sure your changes are pushed to GitHub first):

   ```bash
   npx skills update -g                    # update all global skills
   npx skills update write-reading-reflection -g # or update a single skill
   ```

## Repository layout

| Directory | Purpose |
| --------- | ------- |
| `notes/` | Exported highlights and ideas. One subdirectory per book, e.g. `notes/投资第1课/` |
| `reflections/` | Reading reflections (心得). One subdirectory per book |
| `profile/` | Reading profile: `reading-stats.json` (WeChat Reading stats snapshot) and `阅读画像.md` (AI-written profile), both produced by `generate-reading-profile` |
| `recommendations/` | Reading lists (好书推荐), one file per issue (e.g. `2026-11.md`), plus `shelf-status.json`; produced by `recommend-books` |
| `skills/` | Agent skills bundled with this project (`write-reading-reflection`, `generate-reading-profile`, `recommend-books`) |
| `site/` | Source of the GitHub Pages website |

## Website

Browse the bookshelf, highlights, ideas, reflections, reading profile, and book recommendations online at <https://cedar-ai-project.github.io/personal-librarian/>.

The site lives in `site/` (Vue 3 + Vite + Vuetify). It is rebuilt from `notes/` and `reflections/` and deployed by `.github/workflows/deploy-site.yml` on every push to `main` that touches them. Each book's `cover.jpg` is shown on the bookshelf. For books that only have a reflection, an optional `reflections/<book>/meta.json` (`{ "author": "...", "link": "...", "readAt": "YYYY-MM-DD" }`) supplies the author, WeChat Reading link, and when the book was finished (for books not read on WeChat Reading; `YYYY-MM` also works). A book counts as finished (读完) when it has a reflection; to mark a book finished before writing one, add `notes/<book>/meta.json` with `{ "finished": true }`. The 阅读画像 page is built from `profile/`, and the 好书推荐 page from `recommendations/`.

To preview locally (Node.js 20+, Python 3 with `pip install fonttools brotli`):

```bash
cd site
npm install
npm run build && npm run preview   # or `npm run font` once, then `npm run dev`
```

## License

[Apache License 2.0](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cedar-ai-project/personal-librarian&type=Timeline)](https://www.star-history.com/#cedar-ai-project/personal-librarian&Timeline)
