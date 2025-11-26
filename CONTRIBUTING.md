# Contributing to Screensaver

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/AgentBurgundy/screensaver.git
   cd screensaver
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up your environment**:
   ```bash
   npm run setup
   ```
   Or manually copy `.env.example` to `.env` and add your API key.

5. **Build the project**:
   ```bash
   npm run build
   ```

## Development Workflow

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test them:
   ```bash
   npm run build
   npm run dev
   ```

3. Commit your changes with clear messages:
   ```bash
   git commit -m "Add: description of your change"
   ```

4. Push to your fork and create a Pull Request

## Code Style

- Use TypeScript with strict mode
- Follow existing code patterns
- Add comments for complex logic
- Keep functions focused and small
- Handle errors appropriately

## Testing

Before submitting a PR, please:
- Test your changes locally
- Ensure the build succeeds (`npm run build`)
- Test both `once` and `schedule` modes if applicable

## Pull Request Guidelines

- Provide a clear description of your changes
- Reference any related issues
- Ensure your code builds without errors
- Update documentation if needed

## Reporting Issues

When reporting bugs, please include:
- Your operating system and version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Any error messages or logs

## Feature Requests

We welcome feature requests! Please:
- Check if the feature already exists or is planned
- Provide a clear description of the feature
- Explain the use case
- Consider implementation complexity

## Questions?

Feel free to open an issue for questions or discussions!

Thank you for contributing! 🙏

