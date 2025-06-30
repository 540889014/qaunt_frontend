/**
 * This file provides the context for Python code autocompletion in the Codemirror editor.
 * It defines the available API functions, data object structures, and enums that can be
 * used within a strategy script. This allows for rich, context-aware suggestions
 * similar to a full-fledged IDE.
 */

export const pythonApiContext = {
    lifeCycleMethods: [
        { label: "initialize(self)", type: "method", detail: "在回测开始时调用一次。用于一次性的初始化设置。", apply: "def initialize(self):\n    pass" },
        { label: "on_receive_marketdata(self, md1, md2, ...)", type: "method", detail: "每个新的市场数据tick到来时调用。", apply: "def on_receive_marketdata(self, md1: MarketData, md2: MarketData):\n    pass" },
        { label: "on_receive_ohlc(self, ohlc1, ohlc2, ...)", type: "method", detail: "当一个新的OHLC K线生成时调用。", apply: "def on_receive_ohlc(self, ohlc1: OHLCData, ohlc2: OHLCData):\n    pass" },
        { label: "on_order_accepted(self, execution)", type: "method", detail: "当您提交的订单被交易所接受时调用。", apply: "def on_order_accepted(self, execution: Execution):\n    pass" },
        { label: "on_order_executed(self, execution)", type: "method", detail: "当您的订单被部分或完全成交时调用。", apply: "def on_order_executed(self, execution: Execution):\n    pass" },
        { label: "on_order_rejected(self, execution)", type: "method", detail: "当您的订单被拒绝时调用。", apply: "def on_order_rejected(self, execution: Execution):\n    pass" },
        { label: "on_order_cancelled(self, execution)", type: "method", detail: "当您的订单确认被撤销时调用。", apply: "def on_order_cancelled(self, execution: Execution):\n    pass" },
        { label: "on_receive_transaction(self, trade)", type: "method", detail: "每次有成交发生时调用。", apply: "def on_receive_transaction(self, trade: Execution):\n    pass" },
    ],
    dataObjects: {
        "MarketData": {
            type: "class",
            detail: "代表订单簿和其他市场信息快照的对象。",
            properties: [
                { label: "timestamp", type: "property", detail: "int: 数据的纳秒级时间戳。" },
                { label: "symbol", type: "property", detail: "str: 品种代码。" },
                { label: "source", type: "property", detail: "str: 数据源 (例如, 'okx', 'XBOND')。" },
                { label: "p_bid_array", type: "property", detail: "List[float]: 买价数组，从最优到最差排序。" },
                { label: "q_bid_array", type: "property", detail: "List[float]: 买量数组，与p_bid_array对应。" },
                { label: "p_ask_array", type: "property", detail: "List[float]: 卖价数组，从最优到最差排序。" },
                { label: "q_ask_array", type: "property", detail: "List[float]: 卖量数组，与p_ask_array对应。" },
                { label: "y_bid_array", type: "property", detail: "List[float]: 买方收益率数组 (用于债券)。" },
                { label: "y_ask_array", type: "property", detail: "List[float]: 卖方收益率数组 (用于债券)。" },
                { label: "last_price", type: "property", detail: "float: 最新成交价。" },
                { label: "volume", type: "property", detail: "float: 当日总成交量。" },
                { label: "turnover", type: "property", detail: "float: 当日总成交额。" },
                { label: "open_price", type: "property", detail: "float: 今日开盘价。" },
                { label: "close_price", type: "property", detail: "float: 今日收盘价。" },
                { label: "pre_close_price", type: "property", detail: "float: 昨日收盘价。" },
                { label: "best_bid_price", type: "property", detail: "便捷属性: p_bid_array[0]" },
                { label: "best_ask_price", type: "property", detail: "便捷属性: p_ask_array[0]" },
                { label: "best_bid_qty", type: "property", detail: "便捷属性: q_bid_array[0]" },
                { label: "best_ask_qty", type: "property", detail: "便捷属性: q_ask_array[0]" },
                { label: "best_mid_price", type: "property", detail: "便捷属性: (best_bid_price + best_ask_price) / 2" },
            ]
        },
        "OHLCData": {
            type: "class",
            detail: "代表单个开-高-低-收 (OHLC) K线的对象。",
            properties: [
                { label: "timestamp", type: "property", detail: "int: K线的开始时间 (纳秒时间戳)。" },
                { label: "symbol", type: "property", detail: "str: 品种代码。" },
                { label: "source", type: "property", detail: "str: 数据源。" },
                { label: "period", type: "property", detail: "OHLCPeriods: K线周期。" },
                { label: "open", type: "property", detail: "float: K线的开盘价。" },
                { label: "high", type: "property", detail: "float: K线内的最高价。" },
                { label: "low", type: "property", detail: "float: K线内的最低价。" },
                { label: "close", type: "property", detail: "float: K线的收盘价。" },
                { label: "volume", type: "property", detail: "float: K线周期内的成交量。" },
                { label: "open_ytm", type: "property", detail: "float: K线的到期收益率值 (用于债券)。" },
                { label: "high_ytm", type: "property", detail: "float: K线的到期收益率值 (用于债券)。" },
                { label: "low_ytm", type: "property", detail: "float: K线的到期收益率值 (用于债券)。" },
                { label: "close_ytm", type: "property", detail: "float: K线的到期收益率值 (用于债券)。" },
            ]
        },
        "Execution": {
            type: "class",
            detail: "代表订单状态更新（如已接受、已成交、已拒绝）的对象。",
            properties: [
                { label: "timestamp", type: "property", detail: "int: 事件的纳秒级时间戳。" },
                { label: "symbol", type: "property", detail: "str: 品种代码。" },
                { label: "order_id", type: "property", detail: "str: 订单的内部唯一ID。" },
                { label: "market_order_id", type: "property", detail: "str: 交易所分配的ID。" },
                { label: "status", type: "property", detail: "str: 订单状态 (例如, ExecutionStatus.FILLED_FULLY)。" },
                { label: "side", type: "property", detail: "OrderSide: 订单方向 (例如, OrderSide.BID)。" },
                { label: "price", type: "property", detail: "float: 成交价格 (对于成交回报)。" },
                { label: "qty", type: "property", detail: "float: 成交数量。" },
                { label: "order_type", type: "property", detail: "OrderType: 订单类型 (例如, OrderType.LIMIT)。" },
                { label: "openclose", type: "property", detail: "OrderOpenClose: 订单的开/平仓标志。" },
            ]
        },
        "Order": {
            type: "class",
            detail: "您使用create_order函数构造并传递给submit_orders的对象。",
            properties: [
                 { label: "symbol", type: "property", detail: "str: **必需.** 品种代码。" },
                 { label: "source", type: "property", detail: "str: **必需.** 交易所/数据源。" },
                 { label: "qty", type: "property", detail: "float: **必需.** 订单数量。" },
                 { label: "order_type", type: "property", detail: "OrderType: **必需.** `OrderType.LIMIT` (限价) 或 `OrderType.MARKET` (市价)。" },
                 { label: "side", type: "property", detail: "OrderSide: **必需.** `OrderSide.BID` (买) 或 `OrderSide.ASK` (卖)。" },
                 { label: "price", type: "property", detail: "float: **限价单必需.** 限价价格。" },
                 { label: "openclose", type: "property", detail: "OrderOpenClose: `OrderOpenClose.OPEN` (开仓) 或 `OrderOpenClose.CLOSE` (平仓)。默认为 `NORMAL`。" },
                 { label: "time_in_force", type: "property", detail: "OrderTimeInForce: 订单有效时间，例如 `FAK`, `FOK`, `GTD`。" },
            ]
        }
    },
    apiFunctions: [
        { label: "create_order", type: "function", detail: "创建一个Order对象。这不会发送订单。", info: "create_order(symbol, source, qty, order_type, side, price=None, time_in_force=None, openclose=OrderOpenClose.NORMAL)" },
        { label: "submit_orders", type: "function", detail: "将一个或多个创建的Order对象提交到交易所。", info: "submit_orders(orders: Union[Order, List[Order]])" },
        { label: "cancel_orders", type: "function", detail: "请求撤销一个或多个活动订单。", info: "cancel_orders(orders: Union[Order, List[Order]])" },
        { label: "get_timestamp", type: "function", detail: "返回当前的回测时间戳。", info: "get_timestamp() -> int" },
        { label: "get_datetime", type: "function", detail: "以datetime对象形式返回当前的回测时间。", info: "get_datetime() -> datetime" },
        { label: "get_long_position", type: "function", detail: "返回指定品种的当前多头持仓数量。", info: "get_long_position(symbol: str) -> float" },
        { label: "get_short_position", type: "function", detail: "返回指定品种的当前空头持仓数量。", info: "get_short_position(symbol: str) -> float" },
        { label: "get_my_pending_orders", type: "function", detail: "返回指定品种的活动（待处理）订单列表。", info: "get_my_pending_orders(symbol: str) -> List[Order]" },
        { label: "get_total_ohlc_by_count", type: "function", detail: "检索指定数量的历史OHLC K线。", info: "get_total_ohlc_by_count(symbol, source, period, price_type, count) -> List[OHLCData]" },
        { label: "get_pnl", type: "function", detail: "获取指定品种的总盈亏。", info: "get_pnl(symbol: str) -> float" },
        { label: "get_floating_pnl", type: "function", detail: "获取未实现的浮动盈亏。", info: "get_floating_pnl(symbol: str) -> float" },
        { label: "get_realized_pnl", type: "function", detail: "获取已实现的盈亏。", info: "get_realized_pnl(symbol: str) -> float" },
    ],
    enums: {
        "OrderSide": {
            type: "enum",
            members: [
                { label: "BID", type: "constant", detail: "(0): 买单。" },
                { label: "ASK", type: "constant", detail: "(1): 卖单。" },
            ]
        },
        "OrderType": {
            type: "enum",
            members: [
                { label: "LIMIT", type: "constant", detail: "(0): 以指定价格或更优价格执行的订单。" },
                { label: "MARKET", type: "constant", detail: "(1): 以当前最优市场价执行的订单。" },
            ]
        },
        "OrderOpenClose": {
            type: "enum",
            members: [
                { label: "NORMAL", type: "constant", detail: "(0): 非保证金交易的默认值。" },
                { label: "OPEN", type: "constant", detail: "(1): 开立新仓位。" },
                { label: "CLOSE", type: "constant", detail: "(3): 平掉现有仓位。" },
            ]
        },
        "OrderTimeInForce": {
            type: "enum",
            members: [
                { label: "FAK", type: "constant", detail: "(1): Fill And Kill (立即成交并取消剩余)。" },
                { label: "FOK", type: "constant", detail: "(0): Fill Or Kill (全部成交或立即取消)。" },
                { label: "GTD", type: "constant", detail: "(2): Good Till Date (指定日期前有效)。" },
            ]
        },
        "OHLCPeriods": {
            type: "enum",
            members: [
                { label: "ONE_MINUTE", type: "constant", detail: "(1)" },
                { label: "FIVE_MINUTE", type: "constant", detail: "(2)" },
                { label: "ONE_HOUR", type: "constant", detail: "(6)" },
                { label: "ONE_DAY", type: "constant", detail: "(9)" },
            ]
        },
        "Source": {
            type: "enum",
            members: [
                { label: "okx", type: "constant", detail: "OKX交易所" },
            ]
        }
    }
}; 