import json
from http.server import BaseHTTPRequestHandler
from backtester import run_backtest

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps({"app": "Testfolio", "paywall": False}).encode("utf-8"))

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(body)
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            for k, v in CORS_HEADERS.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return
        portfolios = data.get("portfolios", [])
        start_date = data.get("start_date", "2020-01-01")
        end_date = data.get("end_date", "2024-01-01")
        starting_value = float(data.get("starting_value", 100000))
        rebalance_freq = data.get("rebalance_freq", "yearly")
        adjust_inflation = bool(data.get("adjust_inflation", False))
        result = run_backtest(
            portfolios=portfolios,
            start_date=start_date,
            end_date=end_date,
            starting_value=starting_value,
            rebalance_freq=rebalance_freq,
            adjust_inflation=adjust_inflation,
        )
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(result).encode("utf-8"))
