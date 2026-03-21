#!/bin/bash
# Generate self-signed certificates for local HTTPS development
CERT_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERT_DIR"

# Generate CA
openssl genrsa -out "$CERT_DIR/ca.key" 2048
openssl req -new -x509 -days 3650 -key "$CERT_DIR/ca.key" -out "$CERT_DIR/ca.crt" \
  -subj "/C=US/ST=Dev/L=Dev/O=Polyforge/CN=Polyforge Dev CA"

# Generate server cert with SAN for localhost
cat > "$CERT_DIR/san.cnf" << EOF
[req]
default_bits = 2048
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
EOF

openssl genrsa -out "$CERT_DIR/server.key" 2048
openssl req -new -key "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" -config "$CERT_DIR/san.cnf"
openssl x509 -req -days 3650 -in "$CERT_DIR/server.csr" \
  -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
  -out "$CERT_DIR/server.crt" -extensions v3_req -extfile "$CERT_DIR/san.cnf"

# Cleanup
rm -f "$CERT_DIR/server.csr" "$CERT_DIR/ca.srl" "$CERT_DIR/san.cnf"

echo "Certificates generated in $CERT_DIR"
echo "  - ca.crt (add to your browser's trusted CAs to avoid warnings)"
echo "  - server.crt + server.key (used by nginx)"
