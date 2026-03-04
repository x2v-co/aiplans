#!/bin/bash

echo "🧪 Testing Mock Data Removal..."
echo ""

# Test 1: Check if API returns real data for gpt-4o
echo "📝 Test 1: API endpoint for gpt-4o"
response=$(curl -s "http://localhost:3000/api/compare/plans?model=gpt-4o")
if echo "$response" | grep -q "\"name\":\"gpt-4o\""; then
  echo "✅ PASS: Returns gpt-4o model"
else
  echo "❌ FAIL: Model name not found"
  echo "Response: $response" | head -c 200
fi

# Test 2: Check for _note field (should be removed)
if echo "$response" | grep -q "_note.*MOCK"; then
  echo "❌ FAIL: Still contains mock data note"
else
  echo "✅ PASS: Mock data note removed"
fi

# Test 3: Check if it returns actual plan data
if echo "$response" | grep -q "officialPlans"; then
  echo "✅ PASS: Contains officialPlans"
else
  echo "❌ FAIL: Missing officialPlans"
fi

echo ""
echo "📊 Summary:"
echo "$response" | jq '.summary' 2>/dev/null || echo "Unable to parse JSON"

echo ""
echo "🎯 To test manually, visit:"
echo "   http://localhost:3000/compare/plans/gpt-4o"
echo "   http://localhost:3000/compare/plans/claude-sonnet-4-6"
