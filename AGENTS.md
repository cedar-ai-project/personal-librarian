# AGENTS.md

Instructions for AI agents working in this repository.

## Project context

Personal Librarian is an AI-agent-driven project that integrates with WeChat Reading (微信读书): export reading notes, write reading reflections, analyze reading taste, build a reading profile, and recommend books. Most tasks are triggered by natural-language requests and rely on the `weread-skills` skill (installed via `npx skills add Tencent/WeChatReading -g`) and the `WEREAD_API_KEY` environment variable.

## Rules

- **Keep the READMEs in sync.** Every time `README.md` is updated, update `README.zh-CN.md` (the Chinese version) with the equivalent changes in the same commit. `README.md` is the primary version and defaults to English.
- **One directory per book.** Under `notes/` and `reflections/`, create one subdirectory per book (named after the book, e.g. `notes/投资第1课/`) and keep all files for that book inside it. Book notes and reflections are written in Chinese Markdown.
- **No dates on exported highlights and ideas.** When exporting highlights (划线) and ideas (想法) from WeChat Reading, do not append dates to individual items. Only the file header may carry the export date.
- **Download the cover with the notes.** When exporting a book's highlights and ideas, also save its cover (the `cover` URL from WeChat Reading) as `cover.jpg` in the same directory, e.g. `notes/投资第1课/cover.jpg`. The website (`site/`) shows it on the bookshelf.
- **Grow the knowledge tree with every new book.** Whenever a new book is pulled from WeChat Reading into `notes/` (or a new reflection adds a book under `reflections/`), run the `build-knowledge-tree` skill in incremental mode before finishing: sort the new book into an existing domain and subdomain (or propose a new one if none fits), extract its knowledge points, confirm them with the user, and update `knowledge/知识树.md`. Keep the domains and points the user already confirmed unchanged. Then run `cd site && npm run data` and make sure it prints no `knowledge:` warnings. The 知识树 page orders the domain branches by their current book counts (most books nearest the root, ties broken by number of knowledge points), so adding the book to the right domain is enough to re-balance the tree; do not reorder domains in the Markdown by hand for this.
