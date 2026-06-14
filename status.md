# Travel Agent Status

## 2026-06-14 Xiaohongshu Test

Environment values loaded:

- `XIAOHONGSHU_COOKIE`: present
- `XIAOHONGSHU_XS`: present
- `XIAOHONGSHU_XS_COMMON`: present

Direct client call reached `edith.xiaohongshu.com` and returned HTTP 200 with API `code: 0`.

Observed result:

```text
{"code":0,"success":true,"msg":"成功","data":{"has_more":false}}
```

Tested keywords:

- `成都 亲子游`
- `成都`
- `成都亲子游`
- `北京旅游`

All returned `code: 0` but `items` was empty.

Likely cause: the installed `xiaohongshu-mcp-steve` package forwards static `x-s` and `x-s-common` headers but does not generate fresh request signatures for each request body/search id. Xiaohongshu's web search API appears to require request-specific signing. The current cookie/header values prove authentication can reach the API, but this MCP package is not enough to retrieve search notes reliably.

Current practical status:

- FlyAI: working via `/home/snowbolwer/travel-agent/toolkit/fz/flyai-env`.
- Xiaohongshu cookie loading: working.
- Xiaohongshu direct API auth: partially working.
- Xiaohongshu note retrieval through current package: not working, returns empty result.
- `mcporter` stdio integration for this package: still offline.

## 2026-06-14 xpzouying/xiaohongshu-mcp Test

Downloaded release:

- tag: `v2026.06.12.1403-5c43e3d`
- asset: `xiaohongshu-mcp-linux-amd64.tar.gz`
- sha256: `6467e0179b755508fb1d71405d4da8234472f7a43464ce2253d6682da6306322`

Installed under:

```text
/home/snowbolwer/travel-agent/toolkit/xhs/xhs-mcp/
```

Binaries:

- `xiaohongshu-mcp-linux-amd64`
- `xiaohongshu-login-linux-amd64`

MCP HTTP service starts and initializes successfully on:

```text
http://localhost:18060/mcp
```

`mcporter list xiaohongshu-xpz --schema` successfully detects 13 tools, including:

- `check_login_status`
- `get_login_qrcode`
- `search_feeds`
- `get_feed_detail`
- `list_feeds`

Current blocker:

```text
Failed to launch the browser:
.../rod/browser/chromium-1321438/chrome: error while loading shared libraries: libnss3.so: cannot open shared object file
```

Conclusion: this repository is structurally usable and matches the travel-planner tool names, but WSL is missing Linux Chromium runtime libraries. Install Chromium dependencies before login/search can work.

## 2026-06-14 xpzouying Login Success

Login is confirmed through the visual browser flow. The QR-only MCP flow can show a QR image, but did not reliably persist cookies in this WSL setup. The reliable path was:

1. Install Chromium runtime libraries.
2. Run `/home/snowbolwer/travel-agent/toolkit/xhs/xhs-mcp-start`.
3. Generate/login through the browser flow and confirm the second security QR in REDNote.

Cookies now exist:

```text
/home/snowbolwer/travel-agent/toolkit/xhs/xhs-mcp/data/cookies.json
```

Verified:

- `check_login_status`: returns logged in.
- `list_feeds`: returns feed data successfully.

Pending:

- `search_feeds` with filters timed out in a 180s test. The MCP/browser/login stack works, but search automation may need separate debugging or a visible browser session.
