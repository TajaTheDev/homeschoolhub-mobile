# HomeschoolHub - TestFlight Build Script
# Clears caches, creates fresh production build, and uploads to TestFlight

param(
    [switch]$SkipCache
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TestFlight Build & Upload" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipCache) {
    Write-Host "🧹 Step 1: Clearing all caches..." -ForegroundColor Cyan
    
    # Stop any running Metro bundler
    Write-Host "   Stopping any running Metro processes..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*expo*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Clear Metro bundler cache
    Write-Host "   Clearing Metro bundler cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .\.expo
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .\node_modules\.cache
    
    # Clear npm cache
    Write-Host "   Clearing npm cache..." -ForegroundColor Yellow
    npm cache clean --force 2>&1 | Out-Null
    
    # Clear Expo/Metro temp files
    Write-Host "   Clearing temporary files..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $env:TEMP\metro-*
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $env:TEMP\expo-*
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $env:TEMP\haste-map-*
    
    Write-Host "✅ Caches cleared!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "📦 Step 2: Creating fresh production build..." -ForegroundColor Cyan
Write-Host "   Platform: iOS" -ForegroundColor Yellow
Write-Host "   Profile: production" -ForegroundColor Yellow
Write-Host "   Auto-submit to TestFlight: enabled" -ForegroundColor Yellow
Write-Host ""
Write-Host "⏳ This may take 10-20 minutes..." -ForegroundColor Yellow
Write-Host ""

# Build and submit to TestFlight
eas build --platform ios --profile production --auto-submit

$buildExitCode = $LASTEXITCODE

if ($buildExitCode -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Build completed and uploaded!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "⏳ Step 3: Wait for App Store processing..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📱 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Wait 10-15 minutes for Apple to process" -ForegroundColor White
    Write-Host "   2. Check email for processing completion notification" -ForegroundColor White
    Write-Host "   3. Or visit: https://appstoreconnect.apple.com" -ForegroundColor White
    Write-Host "      → TestFlight → Builds → Check status" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Processing Status:" -ForegroundColor Yellow
    Write-Host "   - Processing: Build is being analyzed" -ForegroundColor White
    Write-Host "   - Ready to Submit: Build is ready for testing" -ForegroundColor White
    Write-Host "   - Missing Compliance: May need export compliance info" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 To check build status:" -ForegroundColor Yellow
    Write-Host "   eas build:list --platform ios --limit 1" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Build failed! Exit code: $buildExitCode" -ForegroundColor Red
    Write-Host "   Check the error messages above for details." -ForegroundColor Yellow
    Write-Host ""
}
