import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8000

class CustomHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        print(f"Request received: {self.path}")
        if self.path == '/':
            self.path = '/index.html'

        try:
            # Get file path and check existence
            file_path = self.translate_path(self.path)
            if not os.path.isfile(file_path):
                print(f"File not found: {file_path}")
                self.send_error(404, f"File not found: {self.path}")
                return

            # Read file content
            with open(file_path, 'rb') as f:
                content = f.read()
                content_length = len(content)

            # Send response
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(file_path))
            self.send_header('Content-Length', str(content_length))
            self.send_header('Connection', 'close')  # Ensure connection closes cleanly
            self.end_headers()
            self.wfile.write(content)
            self.wfile.flush()  # Force send
            print(f"Served: {self.path} - {content_length} bytes")

        except Exception as e:
            print(f"Error serving {self.path}: {e}")
            self.send_error(500, f"Internal server error: {str(e)}")

if __name__ == '__main__':
    script_dir = os.path.dirname(__file__)
    os.chdir(script_dir)
    print(f"Working directory set to: {os.getcwd()}")
    print("Available files:", os.listdir(script_dir))

    server_address = ('', PORT)
    httpd = HTTPServer(server_address, CustomHandler)
    print(f"Serving HTTP on port {PORT} ...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped by user.")
        httpd.server_close()