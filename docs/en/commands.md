# Travel Agent Commands

## Install / Doctor

```bash
./install.sh
./install.sh --doctor
```

## Login / Config Status

Check all toolkit auth/config surfaces:

```bash
./toolkit/login/login-status
```

Run the interactive login/config flow. At the moment, only Xiaohongshu normally needs QR login; FlyAI uses `.env`, and Airbnb does not require an account login.

```bash
./toolkit/login/login-all
```

## FlyAI

```bash
./toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
./toolkit/fz/flyai-env search-hotel --dest-name "北京" --check-in-date 2026-07-01 --check-out-date 2026-07-03
./toolkit/fz/flyai-env search-poi --city-name "北京" --category "历史古迹"
./toolkit/fz/flyai-env fliggy-fast-search --query "云南 5天 亲子游"
```

Check FlyAI config and run a flight smoke test:

```bash
./toolkit/fz/fz-status
```

## Xiaohongshu via mcporter

Load `toolkit/xhs/.env` first.

```bash
mcporter list
mcporter call xiaohongshu.search_notes keyword="弥勒 带娃 亲子游" page_size=10 sort="popularity_descending"
mcporter call xiaohongshu.search_notes_with_comments keyword="弥勒 带娃 亲子游" page_size=5 max_comments_per_note=10 sort="popularity_descending"
mcporter call xiaohongshu.get_note_comments note_id="笔记ID"
```

## Xiaohongshu via xpzouying/xiaohongshu-mcp

Installed at:

```text
toolkit/xhs/xhs-mcp
```

Start HTTP MCP service:

```bash
./toolkit/xhs/xhs-mcp-start
```

`xhs-mcp-start` runs the visual login helper first. If you are not logged in, a Chromium window appears for QR login. After login succeeds, it starts the HTTP MCP service on port `18060`.

Check whether the service is listening, login is valid, and search can return:

```bash
./toolkit/xhs/xhs-mcp-status
```

Stop the MCP service before restarting, or when browser automation gets stuck:

```bash
./toolkit/xhs/xhs-mcp-stop
```

If you want to skip the visual login check and only start the service:

```bash
XHS_SKIP_LOGIN=1 ./toolkit/xhs/xhs-mcp-start
```

This is useful when an account is under risk control and you want to try anonymous search first. It only skips the login helper; search may still require a valid Xiaohongshu session.

Registered in mcporter as:

```bash
mcporter list xiaohongshu-xpz --schema
mcporter call xiaohongshu-xpz.check_login_status
mcporter call xiaohongshu-xpz.list_feeds --timeout 180000
mcporter call xiaohongshu-xpz.search_feeds --timeout 180000 --args '{"keyword":"弥勒 带娃 亲子游","filters":{"sort_by":"最多收藏","note_type":"图文","publish_time":"半年内"}}'
```

Generate a fresh login QR. This deletes old QR images first, so only the latest image remains:

```bash
./toolkit/xhs/xhs-login-qr
```

Generate a fresh login QR and keep polling until login succeeds or the QR expires:

```bash
./toolkit/xhs/xhs-login-watch
```

Current note:

```text
Login works and search returns results. If a search call hangs, stop and restart the MCP service.
```

## Airbnb MCP

Airbnb search uses `openbnb-org/mcp-server-airbnb` through local wrappers and `npx`.

Use it when the user prefers homestays, apartments, villas, kitchens/laundry, family stays, long stays, or local-neighborhood lodging. For normal hotel preference, use FlyAI/Feizhu hotel search first.

```bash
./toolkit/airbnb/airbnb-mcp-list
./toolkit/airbnb/airbnb-search location="Tbilisi, Georgia" checkin=2026-09-25 checkout=2026-10-07 adults=2 propertyType=entire_home
./toolkit/airbnb/airbnb-details id=12345678 checkin=2026-09-25 checkout=2026-10-07 adults=2
```

Defaults:

```text
AIRBNB_IGNORE_ROBOTS=true
DISABLE_GEOCODING=false
```

Copy `toolkit/airbnb/.env.example` to `toolkit/airbnb/.env` only if you need local overrides.

## Travel Skills

Active project copies live under:

```text
skills/travel-destination-research
skills/travel-itinerary-plan
```

The active Xiaohongshu MCP registration for these skills is `xiaohongshu-xpz`. Use `search_feeds` for community evidence when available.
