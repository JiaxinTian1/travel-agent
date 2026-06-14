# Travel Agent

This folder is a Codex-driven travel planning workspace.

## Layout

```text
/home/snowbolwer/travel-agent/
├── toolkit/       # CLI/MCP/API integrations and credentials
│   ├── fz/        # Feizhu/FlyAI
│   └── xhs/       # Xiaohongshu MCP
├── skills/        # Project copies of travel skills
├── workspace/     # User state and generated work
│   ├── memory.md  # Long-term user preferences/profile
│   ├── query.md   # Current active trip request
│   └── outputs/   # Generated plans and source snapshots
├── README.md
├── commands.md
└── status.md
```

Codex discovers the active travel skills from:

- `/home/snowbolwer/.codex/skills/travel-destination-research`
- `/home/snowbolwer/.codex/skills/travel-itinerary-plan`

The project copies live under `skills/` for organization and future packaging.

## Feizhu/FlyAI

FlyAI config lives in `/home/snowbolwer/travel-agent/toolkit/fz/.env`.

```bash
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
```

To load the environment manually:

```bash
set -a
. /home/snowbolwer/travel-agent/toolkit/fz/.env
set +a
```

## Xiaohongshu Values

Get these from a browser where you are logged into xiaohongshu.com, then put them in `/home/snowbolwer/travel-agent/toolkit/xhs/.env`:

- `XIAOHONGSHU_COOKIE`: request header `Cookie`
- `XIAOHONGSHU_XS`: request header `x-s`
- `XIAOHONGSHU_XS_COMMON`: request header `x-s-common`

Use a request such as the search API request under DevTools -> Network.

Load old Xiaohongshu MCP variables only when needed:

```bash
set -a
. /home/snowbolwer/travel-agent/toolkit/xhs/.env
set +a
mcporter call xiaohongshu.search_notes keyword="成都 亲子游" page_size=3 sort="popularity_descending"
```

## Installed Commands

The WSL wrappers live in `/home/snowbolwer/.local/bin`:

- `flyai`
- `mcporter`
- `xiaohongshu-mcp`

The copied packages live in `/home/snowbolwer/.local/lib/node-global/node_modules`.
