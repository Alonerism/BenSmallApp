#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Payroll Master"
APP_PATH="${APP_PATH:-dist/$APP_NAME.app}"      # override by: APP_PATH="/Applications/Payroll Master.app" ./build_dmg.sh
DMG_NAME="${DMG_NAME:-PayrollMaster.dmg}"
VOL_NAME="${VOL_NAME:-$APP_NAME}"

# 1) Ad-hoc sign the app bundle (recursive)
echo "→ Codesigning: $APP_PATH"
codesign --force --deep --sign - "$APP_PATH"

# Optional verify (nice to have)
echo "→ Verifying signature…"
codesign --verify --deep --strict --verbose=2 "$APP_PATH" || true

# 2) Stage DMG contents with Applications link
echo "→ Staging DMG contents…"
rm -rf dmgroot
mkdir -p dmgroot
cp -R "$APP_PATH" dmgroot/
ln -s /Applications dmgroot/Applications

# 3) Build compressed DMG
echo "→ Creating DMG: $DMG_NAME"
hdiutil create -volname "$VOL_NAME" \
  -srcfolder dmgroot \
  -ov -format UDZO "$DMG_NAME"

# 4) Cleanup
rm -rf dmgroot

echo "✅ Done. DMG at: $DMG_NAME"

