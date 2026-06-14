# Feizhu / FlyAI

This directory keeps Feizhu/FlyAI configuration and helper commands for the travel agent.

## Files

- `.env`: FlyAI API key.
- `flyai-env`: loads `.env`, then runs the global FlyAI CLI.
- `fz-status`: checks config and runs a flight smoke test.

## Commands

```bash
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env search-flight --origin "上海" --destination "北京" --dep-date 2026-07-01 --sort-type 3
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env search-hotels --dest-name "北京" --check-in-date 2026-07-01 --check-out-date 2026-07-03
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env search-poi --city-name "北京" --category "历史古迹"
/home/snowbolwer/travel-agent/toolkit/fz/flyai-env fliggy-fast-search --query "云南 5天 亲子游"
```

## MCP/API

FlyAI API is required for real Feizhu data. A dedicated Feizhu MCP is not required right now because the FlyAI CLI already provides the travel-agent operations we need: flights, hotels, POIs, and fast travel product search.

The current key may be in experience mode. Use a formal FlyAI API key when you need more complete results, better quota, or production stability.
