# VoiceNotes

Free, open-source, browser-based speech-to-text note-taking app. No servers, no API keys, no cost — powered by the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).

All your data stays on your device via `localStorage`. Nothing leaves the browser.

## Features

- **Real-time transcription** — record and see text appear as you speak
- **Pause & resume** — pause recording without losing your transcript
- **Live waveform** — real audio visualization on desktop, animated fallback on mobile
- **Projects** — organize notes into named projects
- **Search** — full-text search across all notes
- **Export** — download individual notes as `.txt` or bulk-export everything
- **Share** — native share dialog or clipboard fallback
- **Dark mode** — toggle between light and dark themes
- **Multi-language** — supports Spanish (`es-ES`) and English (`en-US`)
- **Fully responsive** — optimized for mobile, tablet, and desktop
- **Zero dependencies** — vanilla HTML, CSS, and JavaScript (~70 KB total)

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome / Edge | Full support |
| Safari | Supported (varies by version) |
| Firefox | Limited (Web Speech API support varies) |

> **Note:** Speech recognition requires microphone permission. On Android, single-shot mode is used automatically to avoid Chrome-specific limitations.

## Quick Start

### Option 1: Open directly

Just open `index.html` in your browser. That's it.

### Option 2: Docker

```bash
git clone https://github.com/elalo4171/speech-text-free-google.git
cd speech-text-free-google
docker compose up
```

The app will be available at `http://localhost:3000`.

### Option 3: Docker (app only, without analytics)

```bash
docker build -t voicenotes .
docker run -p 3000:80 voicenotes
```

## Project Structure

```
.
├── index.html           # App HTML structure
├── app.js               # All application logic
├── style.css            # All styling (with CSS variables for theming)
├── Dockerfile           # Nginx-based container
├── docker-compose.yaml  # App + optional Umami analytics
└── nginx.conf           # Web server config with security headers
```

## How It Works

VoiceNotes uses the browser's built-in [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) for speech recognition — the same engine behind Google's voice typing. No audio is sent to any third-party server controlled by this project.

Data is stored in `localStorage` under the key `voicenotes_data`:

```json
{
  "notes": [
    {
      "id": "1714000000000_abc123",
      "title": "My note",
      "text": "Transcribed text...",
      "projectId": null,
      "duration": 45,
      "createdAt": 1714000000000
    }
  ],
  "projects": [
    {
      "id": "proj_abc",
      "name": "Work",
      "createdAt": 1714000000000
    }
  ]
}
```

## Self-Hosting

The Docker Compose setup includes optional [Umami](https://umami.is/) analytics. To use it:

1. Set a secure `APP_SECRET` in your environment or `.env` file
2. Run `docker compose up -d`
3. Access the app at port `3000` and Umami dashboard at port `3002`

To deploy without analytics, use the standalone Dockerfile.

The Nginx config includes:
- Security headers (XSS protection, frame options, referrer policy)
- Gzip compression
- Rate limiting (10 req/s per IP)
- Bot blocking
- Static asset caching (7 days)

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test on both desktop and mobile browsers
5. Commit your changes: `git commit -m "Add my feature"`
6. Push to the branch: `git push origin feature/my-feature`
7. Open a Pull Request

### Ideas for Contributions

- Additional language support
- Audio file export alongside text
- Cloud sync (optional, privacy-first)
- PWA / offline support
- Accessibility improvements
- Keyboard shortcuts

## License

[MIT](LICENSE) -- Eduardo Garcia ([@elalo417](https://github.com/elalo4171))
