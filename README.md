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

2. Set your WeChat Reading API key:

   ```bash
   export WEREAD_API_KEY=<你的apikey>
   ```

   Add the same line to your shell profile (`~/.zshrc` or `~/.bashrc`) to persist it across sessions.

## Repository layout

| Directory | Purpose |
| --------- | ------- |
| `notes/` | Exported highlights and ideas. One subdirectory per book, e.g. `notes/投资第1课/` |
| `reflections/` | Reading reflections (心得). One subdirectory per book |
| `profile/` | Personal reading taste profile and analysis |
| `recommendations/` | Book recommendations for you |

## License

[Apache License 2.0](LICENSE)
