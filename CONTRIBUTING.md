# Contributing to Relay

Thanks for your interest in contributing to Relay! This document outlines how to set up your development environment and submit changes.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/EdgeIQ-Labs/edgeiq-affiliate.git relay
   cd relay
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start infrastructure**
   ```bash
   docker compose up -d db
   ```

4. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

5. **Start development servers**
   ```bash
   pnpm dev:api
   # In another terminal:
   pnpm dev:web
   ```

## Running Tests

Relay uses Vitest for testing. Run the full test suite across all packages:

```bash
pnpm -r test
```

Ensure all tests pass before submitting a pull request.

## Code Style

- **TypeScript Strict**: All code must compile under `strict` mode.
- **No `any`**: Avoid the `any` type. Use `unknown` and narrow types appropriately.
- **Naming**: Use meaningful variable and function names. Avoid single-letter variables outside of loops.
- **Formatting**: We rely on standard TypeScript formatting. Ensure your editor respects `.editorconfig` if present.

## Pull Request Process

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/my-feature`).
3. Commit your changes with clear, descriptive messages.
4. Push to your fork (`git push origin feat/my-feature`).
5. Open a Pull Request against the `master` branch.

Please ensure your PR includes relevant tests and updates documentation if behavior changes.

## Future Work

Issue templates and automated CI checks are planned for future releases. For now, please provide clear descriptions in your PRs and issues.
