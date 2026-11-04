#!/usr/bin/env bash
# ==============================================================================
# AgendaWeb Hostinger Deployment Zip Packager
# ==============================================================================
# Creates a clean, production-ready ZIP archive of Application/ ready to upload
# to Hostinger's public_html/ folder.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_ZIP="${DIR}/agendaweb-hostinger-deploy.zip"

echo "✦ Packaging AgendaWeb for Hostinger deployment..."

# Remove old zip if present
if [ -f "$OUTPUT_ZIP" ]; then
  rm "$OUTPUT_ZIP"
fi

# Create zip of Application contents (including hidden files like .htaccess)
cd "${DIR}/Application"

zip -r "$OUTPUT_ZIP" . \
  -x "data/*.json" \
  -x "tests/*" \
  -x "dev_server.js" \
  -x "config/config.local.php" \
  -x "config/.env" \
  -x "config/.env.*" \
  -x "config/.installed" \
  -x ".DS_Store" \
  -x "*.log"

echo "✓ Deployment bundle created successfully:"
echo "  ${OUTPUT_ZIP}"
echo ""
echo "How to deploy to Hostinger:"
echo "1. Log into Hostinger hPanel ➔ File Manager."
echo "2. Open public_html/ and click 'Upload' ➔ Select agendaweb-hostinger-deploy.zip."
echo "3. Right-click the zip file and click 'Extract' directly into public_html/."
echo "4. Create MySQL database in hPanel ➔ Databases."
echo "5. Navigate to https://yourdomain.com/setup.php to verify and initialize database tables."
