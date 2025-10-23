#!/bin/bash

# Setup script for BenSmallApp GitHub repository
echo "Setting up BenSmallApp for GitHub..."

# Add README to git
git add README.md

# Commit the README
git commit -m "Add README and setup instructions"

echo ""
echo "Next steps:"
echo "1. Go to https://github.com/new"
echo "2. Create a new repository named 'BenSmallApp'"
echo "3. Make it public"
echo "4. Don't initialize with README (we already have one)"
echo "5. Run these commands:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/BenSmallApp.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "After pushing, the GitHub Actions workflow will automatically build the Windows executable."
echo "You can download it from the Actions tab once the build completes."
