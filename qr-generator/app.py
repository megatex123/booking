from flask import Flask, request, send_file, render_template, jsonify
import qrcode
from io import BytesIO

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate():
    text = (request.json or {}).get('text', '').strip()
    if not text:
        return jsonify({'error': 'Tiada teks diberikan'}), 400
    img = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    img.add_data(text)
    img.make(fit=True)
    qr_img = img.make_image(fill_color='black', back_color='white')
    buf = BytesIO()
    qr_img.save(buf, format='PNG')
    buf.seek(0)
    return send_file(buf, mimetype='image/png')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=False)
