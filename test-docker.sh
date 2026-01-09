#!/bin/bash

# Test script to verify Docker setup for klmToVideo
# ==================================================

set -e

echo "🧪 Testing klmToVideo Docker Setup"
echo "==================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: Check if container is running
echo "Test 1: Container Status"
if docker ps | grep -q klmtovideo-app; then
    pass "Container is running"
else
    fail "Container is not running"
    echo "   Run: docker-compose up -d"
fi
echo ""

# Test 2: Check health status
echo "Test 2: Health Check"
if docker ps | grep -q "klmtovideo-app.*healthy"; then
    pass "Container is healthy"
elif docker ps | grep -q "klmtovideo-app.*starting"; then
    warn "Container is still starting (wait a moment)"
elif docker ps | grep -q "klmtovideo-app.*unhealthy"; then
    fail "Container is unhealthy"
    echo "   Check logs: docker-compose logs"
else
    warn "Health status unknown"
fi
echo ""

# Test 3: Check API endpoint
echo "Test 3: API Health Endpoint"
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    pass "API health endpoint responding"
else
    fail "API health endpoint not responding"
    echo "   URL: http://localhost:3001/api/health"
fi
echo ""

# Test 4: Check workspace volume mount
echo "Test 4: Workspace Volume"
if [ -d "./guiv2/workspace" ]; then
    pass "Workspace directory exists"

    # Check if it's writable
    if touch ./guiv2/workspace/.test 2>/dev/null; then
        rm ./guiv2/workspace/.test
        pass "Workspace directory is writable"
    else
        fail "Workspace directory is not writable"
    fi
else
    fail "Workspace directory does not exist"
    echo "   Run: mkdir -p guiv2/workspace"
fi
echo ""

# Test 5: Check uploads volume mount
echo "Test 5: Uploads Volume"
if [ -d "./guiv2/server/uploads" ]; then
    pass "Uploads directory exists"
else
    fail "Uploads directory does not exist"
    echo "   Run: mkdir -p guiv2/server/uploads"
fi
echo ""

# Test 6: Check if FFmpeg is available in container
echo "Test 6: FFmpeg in Container"
if docker exec klmtovideo-app ffmpeg -version > /dev/null 2>&1; then
    pass "FFmpeg is installed in container"
    FFMPEG_VERSION=$(docker exec klmtovideo-app ffmpeg -version 2>&1 | head -n1)
    echo "   $FFMPEG_VERSION"
else
    fail "FFmpeg not found in container"
fi
echo ""

# Test 7: Check if Node.js app is running
echo "Test 7: Node.js Application"
if docker exec klmtovideo-app ps aux | grep -q "node.*dist/index.js"; then
    pass "Node.js application is running"
else
    fail "Node.js application is not running"
fi
echo ""

# Test 8: Check API workspaces endpoint
echo "Test 8: API Workspaces Endpoint"
if curl -s http://localhost:3001/api/workspaces > /dev/null 2>&1; then
    WORKSPACE_COUNT=$(curl -s http://localhost:3001/api/workspaces | grep -o "projectName" | wc -l)
    pass "Workspaces API responding"
    echo "   Found $WORKSPACE_COUNT workspace(s)"
else
    fail "Workspaces API not responding"
fi
echo ""

# Test 9: Check frontend serving
echo "Test 9: Frontend Serving"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>&1)
if [ "$RESPONSE" = "200" ]; then
    pass "Frontend is being served"
else
    fail "Frontend not accessible (HTTP $RESPONSE)"
fi
echo ""

# Test 10: Check container logs for errors
echo "Test 10: Container Logs"
ERROR_COUNT=$(docker logs klmtovideo-app 2>&1 | grep -i "error\|fatal" | grep -v "errorlevel\|error_event" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    pass "No errors in container logs"
else
    warn "Found $ERROR_COUNT potential error(s) in logs"
    echo "   Review logs: docker-compose logs"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Your klmToVideo Docker setup is ready to use!"
    echo "Access the application at: http://localhost:3001"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Troubleshooting tips:"
    echo "  1. Check logs: docker-compose logs -f"
    echo "  2. Restart: docker-compose restart"
    echo "  3. Rebuild: docker-compose down && docker-compose up -d --build"
    exit 1
fi
