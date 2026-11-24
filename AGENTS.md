# AGENTS.md

Instructions for AI agents working in this repository.

## Project context

Personal Librarian is an AI-agent-driven project that integrates with WeChat Reading (微信读书): export reading notes, write reading reflections, analyze reading taste, build a reading profile, and recommend books. Most tasks are triggered by natural-language requests and rely on the `weread-skills` skill (installed via `npx skills add Tencent/WeChatReading -g`) and the `WEREAD_API_KEY` environment variable.

## Rules

- **Keep the READMEs in sync.** Every time `README.md` is updated, update `README.zh-CN.md` (the Chinese version) with the equivalent changes in the same commit. `README.md` is the primary version and defaults to English.
- **One directory per book.** Under `notes/` and `reflections/`, create one subdirectory per book (named after the book, e.g. `notes/投资第1课/`) and keep all files for that book inside it. Book notes and reflections are written in Chinese Markdown.
- **No dates on exported highlights and ideas.** When exporting highlights (划线) and ideas (想法) from WeChat Reading, do not append dates to individual items. Only the file header may carry the export date.
- **Download the cover with the notes.** When exporting a book's highlights and ideas, also save its cover (the `cover` URL from WeChat Reading) as `cover.jpg` in the same directory, e.g. `notes/投资第1课/cover.jpg`. The website (`site/`) shows it on the bookshelf.
