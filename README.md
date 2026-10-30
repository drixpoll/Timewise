# Timewise — Time Block Planner (Linux Desktop)

An offline-first **daily time-block planner + focus countdown timer**, built with React 19, TypeScript, Vite 7 and Tauri 2.

## Features

- My day: plan work, study, breaks and personal time blocks.
- Add, edit, complete, reopen and delete blocks; prevent overlapping time slots on the same date.
- Focus timer: start, pause, resume, reset; countdown uses elapsed wall-clock time so sleep/minimize does not silently freeze it.
- Timer state and daily schedules persist locally through WebView `localStorage`.
- Weekly calendar; 7-day statistics and completion progress.
- Adjustable daily goal and optional Linux desktop notifications (on timer completion while app is running).
- JSON backup and restore. Linux desktop uses a native save/open dialog; browser preview uses ordinary download/file upload.
- Runs without an online account, external server, MySQL, or Java.

**Important:** This is a *time-block planning and countdown* app, not a system-wide website blocker. It does not stop you from opening other websites or applications.

## 1 — Install prerequisites (Ubuntu / Debian / Linux Mint)

Open **Terminal** (`Ctrl + Alt + T`), then enter:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  unzip pkg-config
```

The packages are from the official Tauri v2 Linux prerequisite guide. On Fedora/Arch, use your distribution's Tauri prerequisites instead.

### Node.js + npm

Check:

```bash
node -v
npm -v
```

Use **Node.js 20.19+ or 22.12+** (the Vite 7 requirement). If `node` isn't installed, install a current Node LTS release using the official Node.js instructions (or `nvm`) and reopen Terminal. You do not need MySQL or Java.

### Rust (required for native desktop, not browser preview)

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Select the default option `1`; open a new terminal or run:

```bash
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

The notification, dialog and file-system plugins require a modern stable Rust compiler; `rustup update stable` can update it.

## 2 — Extract and open the source

Copy `time-block-planner-linux.zip` into your Downloads folder, then:

```bash
cd ~/Downloads
unzip time-block-planner-linux.zip
cd time-block-planner-linux
code .
```

`code .` is optional and opens the project in VS Code. If you extracted with the File Manager, open the extracted folder in Terminal instead.

## 3 — Install project dependencies

In the project folder:

```bash
npm install
```

The first installation **needs internet** to download npm packages and (later) Rust crates. After installation and build, the app runs offline.

## 4 — Preview in your browser (no Rust compilation)

```bash
npm run dev
```

Open **http://127.0.0.1:5173** in Firefox/Chrome. Changes to `.tsx` and `.css` files will hot-reload.

Stop with `Ctrl + C`.

## 5 — Run as a native Linux desktop window

```bash
npm run tauri dev
```

The first run downloads and compiles Rust crates; it can take longer than later runs. A **Time Block Planner** desktop window opens. The native Linux file picker works for JSON backups, and notification permissions are requested when you enable them in Settings.

Stop the development process with `Ctrl + C`.

## 6 — Create a Linux .deb installer

```bash
npm run tauri build
```

By default, this project bundles a **Debian .deb** package. Look under:

```text
src-tauri/target/release/bundle/deb/
```

Install a generated `.deb` file with (replace the name with your generated filename):

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

The exact generated file name depends on version and CPU architecture.

## 7 — How to use

1. **My day → New time block**: enter title, category, date, start/end and optional notes.
2. Choose **Focus** on a block: the timer begins counting down.
3. **Pause**, **resume**, **reset** or mark a session complete. The planner calculates progress based on blocks marked complete.
4. **Weekly planner**: click a weekday to edit that day's schedule.
5. **Insights**: see planned vs completed focus time over the last seven days.
6. **Settings**: customize goal, allow notifications, and export a backup before resetting.

On your first start, four *editable demo blocks* are included for **today**. Delete or change them to fit your schedule. Other days begin empty.

## Project structure

```text
time-block-planner-linux/
├── index.html                 # Frontend HTML
├── package.json               # npm dependencies and scripts
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Screens + interactions
│   ├── styles.css             # Complete UI styling
│   ├── lib.ts                 # Date, persistence, timer calculations
│   ├── types.ts               # TypeScript types
│   └── notifications.ts       # Linux/browser notifications
├── src-tauri/
│   ├── tauri.conf.json        # Window, Linux bundle
│   ├── Cargo.toml             # Rust / Tauri dependencies
│   ├── capabilities/default.json # Granted app permissions
│   ├── icons/                 # Native icons
│   └── src/                   # Small Rust bootstrap
└── README.md
```

## Data privacy and persistence

The planner stores blocks, settings and countdown state locally in the application's WebView storage, not in a cloud service. Browser preview and packaged Tauri app use **different storage profiles**: the browser's data is not automatically imported into the desktop build. Use **Settings → Export JSON backup** and **Import backup** to move data between them.

The timer uses the current device clock; it adjusts after minimize/sleep and checks for elapsed time on reopening. Native notifications require the app process to be running; the app is **not** a background daemon that triggers notifications after it has been fully closed. Only session completions are counted as progress; this is not a stopwatch measuring actual time worked.

## Troubleshooting

- `npm: command not found` → install Node.js/npm and reopen Terminal.
- `cargo: command not found` → run `source "$HOME/.cargo/env"` or restart Terminal after installing Rust.
- `failed to run custom build command ... javascriptcoregtk ... webkit2gtk` → recheck `libwebkit2gtk-4.1-dev` and Linux development dependencies.
- `Address already in use 5173` → stop any other Vite process using port 5173.
- `npm install` network error → verify you can reach npmjs.com; app installation requires internet once.
- Notifications missing → enable them in Settings and check Linux desktop notification permissions and "Do not disturb".
- Build error requesting newer Rust → `rustup update stable`.

## Notes for developers

- UI contains all MVP source code and no external backend.
- Inputs are validated in the editor. Start/end must be within one day and cannot overlap another block on that day.
- Main screen is optimized for desktop, with responsive behavior on smaller window widths.
- This source has passed TypeScript **transpilation syntax checks** and configuration JSON parsing in the preparation environment, but was **not** npm-/Cargo-compiled here due to unavailable registry access and absent Rust tooling. Run `npm install`, `npm run build` and `npm run tauri dev` on your Linux machine for full end-to-end verification.

## Official references

- Tauri Linux prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri projects: https://v2.tauri.app/start/create-project/
- Tauri notification plugin: https://v2.tauri.app/plugin/notification/
- Tauri file system: https://v2.tauri.app/plugin/file-system/
- Tauri dialog: https://v2.tauri.app/plugin/dialog/
