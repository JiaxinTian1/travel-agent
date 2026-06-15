# Travel Agent

This repository is a Codex travel-planning workspace centered on two active skills:

- `travel-destination-research`: compare and rank candidate destinations when the destination is still open.
- `travel-itinerary-plan`: build route options and a detailed 2-hour itinerary after the destination is chosen.

The toolkit folders provide live data helpers for those skills, but the skills are the main product of this repo.

## Layout

```text
.
├── skills/
│   ├── travel-destination-research/
│   └── travel-itinerary-plan/
├── toolkit/
│   ├── fz/        # Feizhu/FlyAI CLI wrapper
│   └── xhs/       # Xiaohongshu MCP scripts and login state
├── workspace/
│   ├── memory.md  # long-term travel preferences and visited-place memory
│   ├── query.md   # current editable trip request
│   └── outputs/   # generated plans and source snapshots
├── install.sh
├── commands.md
└── status.md
```

Run commands from the repository root unless a command says otherwise.

## Install

Install or check the optional live-data dependencies:

```bash
./install.sh
./install.sh --doctor
```

The installer handles project wrappers, downloads the Xiaohongshu MCP binary, and installs npm CLIs when `npm` is available:

- `@fly-ai/flyai-cli` for FlyAI/Fliggy flight, hotel, and POI data.
- `mcporter` for calling MCP tools from shell.

It does not log in to Xiaohongshu. It also does not install system packages such as Node.js/npm or Chromium libraries; when those are missing it prints the commands to install them.

## Skills

Use `travel-destination-research` for questions like:

```text
9月底从上海出发，想要自然风光、小众一点，去哪几个地方值得比？
```

Use `travel-itinerary-plan` after the destination is fixed:

```text
就选格鲁吉亚，帮我做 9/25-10/7 的路线和 2 小时日程表。
```

Both skills read `workspace/memory.md` and `workspace/query.md` when present, then merge them with the latest user prompt. Generated artifacts should go under `workspace/outputs/<trip-id>/`.

## Feizhu / FlyAI

FlyAI config lives in `toolkit/fz/.env`.

Example:

```bash
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
```

Smoke test:

```bash
./toolkit/fz/fz-status
```

## Xiaohongshu MCP

The current Xiaohongshu MCP service is the `xiaohongshu-xpz` mcporter registration. Start it from the repository root:

```bash
./toolkit/xhs/xhs-mcp-start
```

By default, the start script runs the visual login helper first. If you are rate-limited or want to test anonymous search without touching login state, skip that login check:

```bash
XHS_SKIP_LOGIN=1 ./toolkit/xhs/xhs-mcp-start
```

Skipping login only avoids the login helper. It does not guarantee anonymous search will work; Xiaohongshu may still require valid cookies or block automated search.

Common commands:

```bash
./toolkit/xhs/xhs-mcp-status
./toolkit/xhs/xhs-mcp-stop
mcporter call xiaohongshu-xpz.search_feeds --timeout 120000 --args '{"keyword":"成都 亲子游"}'
```

If you need QR login later:

```bash
./toolkit/xhs/xhs-login-qr
./toolkit/xhs/xhs-login-watch
```

## More Commands

See `commands.md` for the fuller command notebook and `status.md` for historical integration notes.
