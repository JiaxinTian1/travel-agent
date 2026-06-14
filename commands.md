# Travel Agent Commands

## FlyAI

```bash
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env search-hotels --dest-name "北京" --check-in-date 2026-07-01 --check-out-date 2026-07-03
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env search-poi --city-name "北京" --category "历史古迹"
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env fliggy-fast-search --query "云南 5天 亲子游"
```

Check FlyAI config and run a flight smoke test:

```bash
/home/snowbolwer/travel-agent/toolkit/fz/fz-status
```

## Xiaohongshu via mcporter

Load `/home/snowbolwer/travel-agent/toolkit/xhs/.env` first.

```bash
mcporter list
mcporter call xiaohongshu.search_notes keyword="弥勒 带娃 亲子游" page_size=10 sort="popularity_descending"
mcporter call xiaohongshu.search_notes_with_comments keyword="弥勒 带娃 亲子游" page_size=5 max_comments_per_note=10 sort="popularity_descending"
mcporter call xiaohongshu.get_note_comments note_id="笔记ID"
```

## Xiaohongshu via xpzouying/xiaohongshu-mcp

Installed at:

```text
/home/snowbolwer/travel-agent/toolkit/xhs/xhs-mcp
```

Start HTTP MCP service:

```bash
/home/snowbolwer/travel-agent/toolkit/xhs/xhs-mcp-start
```

`xhs-mcp-start` runs the visual login helper first. If you are not logged in, a Chromium window appears for QR login. After login succeeds, it starts the HTTP MCP service on port `18060`.

Check whether the service is listening, login is valid, and search can return:

```bash
/home/snowbolwer/travel-agent/toolkit/xhs/xhs-mcp-status
```

Stop the MCP service before restarting, or when browser automation gets stuck:

```bash
/home/snowbolwer/travel-agent/toolkit/xhs/xhs-mcp-stop
```

If you want to skip the visual login check and only start the service:

```bash
XHS_SKIP_LOGIN=1 /home/snowbolwer/travel-agent/toolkit/xhs/xhs-mcp-start
```

Registered in mcporter as:

```bash
mcporter list xiaohongshu-xpz --schema
mcporter call xiaohongshu-xpz.check_login_status
mcporter call xiaohongshu-xpz.list_feeds --timeout 180000
mcporter call xiaohongshu-xpz.search_feeds --timeout 180000 --args '{"keyword":"弥勒 带娃 亲子游","filters":{"sort_by":"最多收藏","note_type":"图文","publish_time":"半年内"}}'
```

Generate a fresh login QR. This deletes old QR images first, so only the latest image remains:

```bash
/home/snowbolwer/travel-agent/toolkit/xhs/xhs-login-qr
```

Generate a fresh login QR and keep polling until login succeeds or the QR expires:

```bash
/home/snowbolwer/travel-agent/toolkit/xhs/xhs-login-watch
```

Current note:

```text
Login works and search returns results. If a search call hangs, stop and restart the MCP service.
```

## Travel Planner Skill

Installed at:

```text
/home/snowbolwer/.codex/skills/travel-planner
```

The WSL copy has been adjusted to use the installed Xiaohongshu MCP tools:

- `xiaohongshu.search_notes`
- `xiaohongshu.get_note_comments`
- `xiaohongshu.search_notes_with_comments`
