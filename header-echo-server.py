from flask import Flask, request, jsonify, abort, make_response
import os

app = Flask(__name__)

@app.before_request
def enforce_https():
    """Enforce HTTPS-only access"""
    # Check X-Forwarded-Proto header set by Cloud Run / Load Balancer
    forwarded_proto = request.headers.get('X-Forwarded-Proto', 'https')

    # Block non-HTTPS requests (except for local development)
    if forwarded_proto != 'https' and not request.host.startswith('localhost'):
        abort(403, description='HTTPS required')

@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    # HSTS: Force HTTPS for 1 year, include subdomains
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
def echo_headers(path):
    """Return all HTTP request headers in the response body"""
    headers_dict = dict(request.headers)
    return jsonify({
        'headers': headers_dict,
        'method': request.method,
        'path': f'/{path}' if path else '/',
        'remote_addr': request.remote_addr
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8777))
    app.run(host='0.0.0.0', port=port, debug=False)
