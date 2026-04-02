<div align="center">

<img src="src/assets/mist-logo.png" width="128" />

# MIST Launcher

<p>
  <strong>An open-source game launcher and community platform. Manage your library, connect with friends, and discover new games.</strong>
</p>

<p>
  <a href="https://mistlauncher.com">Website</a> &bull;
  <a href="https://discord.gg/mist">Discord</a> &bull;
  <a href="https://github.com/mestretero/Mist-Launcher/releases">Download</a>
</p>

</div>

## Features

- Scan and organize your installed games automatically
- Customizable profiles with game showcases, stats, and achievements
- Friends, messaging, and group conversations
- Browse 300+ games synced from Steam
- Track achievements across all your games
- Create and join multiplayer rooms
- Share and vote on community download links
- 4 languages — Turkish, English, German, Spanish
- System tray support — stays running in background
- Auto updates with signed builds

## Tech Stack

- **Desktop** — Tauri 2 (Rust) + React + TypeScript
- **Backend** — Fastify + Prisma + PostgreSQL
- **Real-time** — WebSocket

## Building from Source

**Requirements:** Node.js 20+, Rust toolchain, PostgreSQL

```bash
npm install
cd server && npm install
cp server/.env.example server/.env
npx prisma migrate deploy
cd .. && npm run tauri dev
```

## Contributors

<a href="https://github.com/mestretero/Mist-Launcher/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mestretero/Mist-Launcher" />
</a>

## License

[MIT](LICENSE)
