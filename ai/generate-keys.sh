#!/usr/bin/env bash
set -euo pipefail

KEY="./id_ed25519"

if [[ -e "$KEY" || -e "$KEY.pub" ]]; then
    echo "Refusing to overwrite existing key files: $KEY[.pub]" >&2
    echo "Delete them manually first if you want to regenerate." >&2
    exit 1
fi

ssh-keygen -t ed25519 -f "$KEY" -N "" -C "mmmai-ollama-cloud" >/dev/null

chmod 600 "$KEY"
chmod 644 "$KEY.pub"

echo "Generated ed25519 keypair:"
echo "  $KEY (private, mode 600)"
echo "  $KEY.pub (public, mode 644)"
echo
echo "Register the public key at https://ollama.com/settings/keys"
echo "(without that step, the key is unrecognised and cloud auth will fail):"
echo
cat "$KEY.pub"
