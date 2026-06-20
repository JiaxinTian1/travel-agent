# Booking.com MCP Toolkit

这个目录把 `markswendsen-code/mcp-booking` 包装成 travel research 可调用的本地命令。npm 包名是 `@striderlabs/mcp-booking`。

MCP server 不会 vendored 到仓库里。wrapper 会通过下面的命令运行它：

```bash
npx -y @striderlabs/mcp-booking
```

海外酒店、酒店式公寓、房型可订、取消政策、价格和评论调研，优先用 Booking。用户偏好民宿、公寓、villa、厨房/洗衣、家庭住宿、长住或本地街区住宿时，优先用 Airbnb。

## 命令

```bash
./toolkit/booking/booking-mcp-list
./toolkit/booking/booking-search destination="Tbilisi, Georgia" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-property propertyUrl="<booking-search 返回的 propertyId 或 url>"
./toolkit/booking/booking-availability propertyUrl="<booking-search 返回的 propertyId 或 url>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-prices propertyUrl="<booking-search 返回的 propertyId 或 url>" checkIn=2026-09-25 checkOut=2026-10-07 adults=2 rooms=1
./toolkit/booking/booking-reviews propertyUrl="<booking-search 返回的 propertyId 或 url>"
```

## 安全边界

本地 wrapper 只暴露只读调研工具。

不要在 travel research 流程中自动调用这些交易/账号工具：

- `booking_book`
- `booking_cancel_reservation`
- `booking_get_reservations`
- `booking_save_property`

匿名酒店调研不需要 Booking.com 登录。预订、订单或收藏流程才需要账号 cookie。
