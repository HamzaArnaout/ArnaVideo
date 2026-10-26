# ArnaVideo

ArnaVideo is a local-first desktop and web workspace for generating images and videos with Google Gemini and Veo. Generated media, prompts, settings, and API credentials stay on your machine.

## Features

- Gemini image generation and editing
- Veo text-to-video and image-to-video generation
- Local, disk-backed gallery with favorites and reusable prompts
- Configurable output folders
- Optional Electron desktop build for Windows
- No accounts, sign-in, analytics, or hosted backend

## Requirements

- Node.js 20 or newer
- npm
- A Google AI Studio API key with access to the models you select

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env`.

3. Open `.env` and set your own key:

   ```dotenv
   GEMINI_API_KEY=your_google_ai_studio_key
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3001](http://localhost:3001).

The API key is read only from the local `.env` file. It cannot be entered through the app interface. Restart the app after changing it.

## Local data

By default, ArnaVideo writes generated images to `media/images`, videos to `media/videos`, and gallery metadata and saved prompts to `data`. These paths and all `.env` files are ignored by Git.

The settings screen can change output folders and local cost-tracking values. It never exposes or edits the API key.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server on port 3001 |
| `npm run build` | Create a production Next.js build |
| `npm start` | Run the production server on port 3001 |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run electron:dev` | Build and launch the Electron app |
| `npm run dist:win` | Build the unpacked Windows desktop app |

## Security and privacy

- Never commit `.env` or paste real keys into issues, logs, screenshots, or source files.
- Revoke and replace any key that may have been exposed.
- Review the provider's pricing and model availability before generating media.
- Generated content and prompts are local user data and are intentionally excluded from the repository.

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE)
