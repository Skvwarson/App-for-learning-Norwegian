#!/usr/bin/env bash
# Re-creates the vendored third-party files in vendor/ (no build step is needed to run the app).
#   vendor/pdfjs/pdf.min.mjs, pdf.worker.min.mjs  – Mozilla pdf.js (Apache-2.0), for PDF import
#   vendor/anthropic-sdk.min.mjs                   – Anthropic TypeScript SDK bundled for the browser (Apache-2.0), for the optional AI partner
# Usage: scripts/vendor.sh [pdfjs-version] [sdk-version]
set -euo pipefail

PDFJS_VERSION="${1:-6.4.299}"
SDK_VERSION="${2:-1.1.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"

cd "$WORK"
npm init -y >/dev/null
npm install --silent "pdfjs-dist@${PDFJS_VERSION}" "@anthropic-ai/sdk@${SDK_VERSION}" esbuild@0.28.2

mkdir -p "$ROOT/vendor/pdfjs"
cp node_modules/pdfjs-dist/build/pdf.min.mjs node_modules/pdfjs-dist/build/pdf.worker.min.mjs "$ROOT/vendor/pdfjs/"
cp node_modules/pdfjs-dist/LICENSE "$ROOT/vendor/pdfjs/LICENSE"

echo 'export { default, default as Anthropic } from "@anthropic-ai/sdk";' > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --target=es2020 --minify --legal-comments=eof \
  --outfile="$ROOT/vendor/anthropic-sdk.min.mjs"
cp node_modules/@anthropic-ai/sdk/LICENSE "$ROOT/vendor/anthropic-sdk.LICENSE"

echo "Vendored pdf.js ${PDFJS_VERSION} and @anthropic-ai/sdk ${SDK_VERSION} into $ROOT/vendor (temp dir: $WORK)"
