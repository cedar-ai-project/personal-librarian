# Personal Librarian（个人图书管理员）

一个 AI agent 驱动的个人图书管理员，与[微信读书](https://weread.qq.com/)深度集成：导出读书笔记、写读书心得、分析个人读书喜好、生成阅读画像，并根据个人兴趣推荐好书。

## 功能

- **导出读书笔记** —— 把微信读书中的划线、想法和书签导出为你自己拥有的 Markdown 文件。
- **写读书心得** —— 在 AI agent 的帮助下，把原始笔记整理成结构化的读书心得。
- **阅读画像** —— 分析笔记、书架和阅读统计数据，生成个人读书喜好画像。
- **个性化推荐** —— 根据你的画像和兴趣发现新书。

## 工作原理

项目由 AI 编码 agent（如 Claude Code）驱动，依赖 [weread-skills](https://github.com/Tencent/WeChatReading) skill。你用自然语言提出需求——"导出我在三体里的划线"、"总结一下我这个月的阅读"、"给我推荐一本书"——agent 就会调用微信读书 API、处理结果，并把产出写入本仓库。

## 前置条件

- 支持 skill 的 AI 编码 agent（如 [Claude Code](https://claude.com/claude-code)）
- 微信读书 API Key（`wrk-xxxxxxxx`）

## 配置方法

1. 全局安装微信读书 skill：

   ```bash
   npx skills add Tencent/WeChatReading -g
   ```

2. 设置微信读书 API Key：

   ```bash
   export WEREAD_API_KEY=<你的apikey>
   ```

   把同一行加入你的 shell 配置文件（`~/.zshrc` 或 `~/.bashrc`），以便跨会话持久生效。

## 仓库结构

| 目录 | 用途 |
| ---- | ---- |
| `notes/` | 导出的划线和想法。每本书一个子目录，如 `notes/投资第1课/` |
| `reflections/` | 读书心得。每本书一个子目录 |
| `profile/` | 个人读书喜好画像与分析 |
| `recommendations/` | 为你推荐的书单 |

## 许可证

[Apache License 2.0](LICENSE)
