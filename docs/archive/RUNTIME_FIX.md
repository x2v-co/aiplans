# Runtime Error Fix

## Issue
The dev server is trying to load cached Radix UI modules even though we've replaced the Label and Switch components with native HTML implementations.

## Solution

### Option 1: Clear Cache and Restart (Recommended)
```bash
# Stop the dev server if running (Ctrl+C)
rm -rf .next
npm run dev
```

### Option 2: Force Clean Build
```bash
# Stop the dev server
rm -rf .next
rm -rf node_modules/.cache
npm run build
npm run dev
```

### Option 3: If still having issues
The `radix-ui` metapackage in package.json includes @radix-ui/react-label as a transitive dependency. While our components don't use it, Turbopack may still be trying to resolve it.

You can either:
1. Just restart the dev server - HMR cache will eventually clear
2. Hard refresh the browser (Cmd+Shift+R or Ctrl+Shift+R)
3. Wait for the dev server to fully restart

## Verification
After restarting, the comparison pages should work:
- `/compare/plans` - Model selector page
- `/compare/plans/claude-3-5-sonnet` - Example comparison page (won't load data without DB, but should render)

## Note
The production build (`npm run build`) works perfectly fine. This is purely a dev server/HMR caching issue.
