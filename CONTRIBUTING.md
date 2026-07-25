# Contributing to YouCord

Thanks for considering contributing to YouCord!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies with `pnpm install`
4. Create a new branch for your changes

## Development

```bash
pnpm dev          # Watch for changes
pnpm lint         # Check lint
pnpm testTsc      # Type-check
pnpm lint:fix     # Auto-fix lint issues
```

## Building

```bash
pnpm buildDesktop      # Desktop builds
pnpm buildStandalone   # Standalone build
pnpm buildWeb          # Web build
pnpm buildWebStandalone # Browser extension
```

## Pull Request Process

1. Ensure your code passes `pnpm lint` and `pnpm testTsc`
2. Update documentation if needed
3. Link any related issues in your PR description
4. A maintainer will review your changes

## Commit Guidelines

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues after the first line

## Code Style

- Follow the existing code conventions in the project
- Let ESLint handle formatting — run `pnpm lint:fix` before committing
- Avoid adding comments unless the logic is non-obvious

## Need Help?

Join our Telegram: https://t.me/youcord
