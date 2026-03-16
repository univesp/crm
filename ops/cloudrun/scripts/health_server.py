#!/usr/bin/env python3
import http.server
import socketserver
import sys


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class HealthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ("/", "/health", "/healthz"):
            self.send_response(404)
            self.end_headers()
            return

        body = b"ok\n"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    with ReusableTCPServer(("0.0.0.0", port), HealthHandler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
