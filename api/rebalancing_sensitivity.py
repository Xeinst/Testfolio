import json
from http.server import BaseHTTPRequestHandler
from analytics import rebalancing_sensitivity

CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS.items(): self.send_header(k, v)
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(body)
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            for k, v in CORS.items(): self.send_header(k, v)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return
        result = rebalancing_sensitivity(
            data.get("tickers", []),
            data.get("weights") or [],
            data.get("start_date", "2020-01-01"),
            data.get("end_date", "2024-01-01"),
            float(data.get("starting_value", 100000)),
        )
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS.items(): self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(result).encode("utf-8"))
