#!/bin/bash
# HomeschoolHub - TestFlight Build Script (macOS/Linux)
# Clears caches, creates fresh production build, and uploads to TestFlight

set -e

SKIP_CACHE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-cache)
            SKIP_CACHE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "========================================"
echo "  TestFlight Build & Upload"
echo "========================================"
echo ""

if [ "$SKIP_CACHE" = false ]; then
    echo "🧹 Step 1: Clearing all caches..."
    
    # Stop any running Metro bundler
    echo "   Stopping any running Metro processes..."
    pkill -f "expo start" 2>/dev/null || true
    
    # Clear Metro bundler cache
    echo "   Clearing Metro bundler cache..."
    rm -rf .expo
    rm -rf node_modules/.cache
    
    # Clear npm cache
    echo "   Clearing npm cache..."
    npm cache clean --force > /dev/null 2>&1
    
    # Clear Watchman cache (if installed)
    if command -v watchman &> /dev/null; then
        echo "   Clearing Watchman cache..."
        watchman watch-del-all > /dev/null 2>&1 || true
    fi
    
    # Clear Expo/Metro temp files
    echo "   Clearing temporary files..."
    rm -rf /tmp/metro-*
    rm -rf /tmp/expo-*
    rm -rf /tmp/haste-map-*
    
    echo "✅ Caches cleared!"
    echo ""
fi

echo "📦 Step 2: Creating fresh production build..."
echo "   Platform: iOS"
echo "   Profile: production"
echo "   Auto-submit to TestFlight: enabled"
echo ""
echo "⏳ This may take 10-20 minutes..."
echo ""

# Build and submit to TestFlight
eas build --platform ios --profile production --auto-submit

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✅ Build completed and uploaded!"
    echo "========================================"
    echo ""
    echo "⏳ Step 3: Wait for App Store processing..."
    echo ""
    echo "📱 Next steps:"
    echo "   1. Wait 10-15 minutes for Apple to process"
    echo "   2. Check email for processing completion notification"
    echo "   3. Or visit: https://appstoreconnect.apple.com"
    echo "      → TestFlight → Builds → Check status"
    echo ""
    echo "💡 Processing Status:"
    echo "   - Processing: Build is being analyzed"
    echo "   - Ready to Submit: Build is ready for testing"
    echo "   - Missing Compliance: May need export compliance info"
    echo ""
    echo "📊 To check build status:"
    echo "   eas build:list --platform ios --limit 1"
    echo ""
else
    echo ""
    echo "❌ Build failed!"
    echo "   Check the error messages above for details."
    echo ""
    exit 1
fi
