# DrJava Insights - Setup Guide

## Building the CLI

```bash
cd drjava-insights
npm install
npm run build-cli
```

## Testing Locally

```bash
npm link
drjava-insights /path/to/logs
npm unlink -g drjava-insights  # When done
```

## Publishing to NPM

```bash
npm login
npm publish
```

## For End Users

```bash
# Install globally
npm install -g drjava-insights

# Use anywhere
drjava-insights /path/to/logs
```

## Files Included in Package

- `dist/` - Built React app
- `cli/` - CLI scripts
- `src/utils/logReader.js` - Log parsing utility

## Common Issues

- **Permission errors**: `chmod +x cli/drjava-insights-cli.js`
- **Port conflicts**: CLI automatically finds available ports
- **Command not found**: Check `npm bin -g` is in PATH
