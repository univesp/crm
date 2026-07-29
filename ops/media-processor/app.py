import hmac
import os
import subprocess
import tempfile
from pathlib import Path

from flask import Flask, Response, jsonify, request

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024


@app.get("/health")
def health():
	return jsonify({"status": "ok"})


@app.post("/convert-gif")
def convert_gif():
	expected = os.getenv("MEDIA_PROCESSOR_TOKEN", "")
	supplied = request.headers.get("X-Media-Processor-Token", "")
	if not expected or not hmac.compare_digest(expected, supplied):
		return jsonify({"status": "denied"}), 403
	uploaded = request.files.get("file")
	if not uploaded:
		return jsonify({"status": "invalid"}), 400
	with tempfile.TemporaryDirectory(prefix="univesp-media-") as directory:
		source = Path(directory) / "source.gif"
		target = Path(directory) / "result.mp4"
		uploaded.save(source)
		result = subprocess.run(
			[
				"ffmpeg",
				"-nostdin",
				"-v",
				"error",
				"-i",
				str(source),
				"-t",
				"30",
				"-movflags",
				"+faststart",
				"-pix_fmt",
				"yuv420p",
				"-vf",
				"scale='min(1920,iw)':-2:force_original_aspect_ratio=decrease",
				"-an",
				"-y",
				str(target),
			],
			capture_output=True,
			timeout=25,
			check=False,
		)
		if result.returncode != 0 or not target.exists() or target.stat().st_size > 25 * 1024 * 1024:
			return jsonify({"status": "failed"}), 422
		return Response(target.read_bytes(), mimetype="video/mp4")
