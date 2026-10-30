# Timewise Linux Desktop — Beginner Guide (Sinhala / සිංහල)

**මේ project එකට Spring Boot, MySQL, Java install කරන්න අවශ්‍ය නැහැ.**
React + TypeScript frontend එක Tauri මගින් Linux desktop window එකක් විදිහට run කරනවා.

## Step 1 — Terminal එක open කරන්න

Ubuntu / Linux Mint / Debian වල `Ctrl + Alt + T`.

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev unzip pkg-config
```

මෙයින් native desktop app build කිරීමට අවශ්‍ය Linux system libraries install වෙනවා.

## Step 2 — Node/npm versions බලන්න

```bash
node -v
npm -v
```

Node version එක 20.19+ හෝ 22.12+ නම් හොඳයි. නැත්නම් Node.js LTS install කරන්න.

## Step 3 — Rust install කරන්න (Tauri සඳහා)

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env"
rustc --version
```

## Step 4 — ZIP extract කරන්න

`time-block-planner-linux.zip` එක Downloads එකේ තියෙනවා කියලා හිතමු.

```bash
cd ~/Downloads
unzip time-block-planner-linux.zip
cd time-block-planner-linux
code .
```

`code .` command එක VS Code installed නම් භාවිත කරන්න. එය optional.

## Step 5 — Dependencies install කරන්න

```bash
npm install
```

පළමු වතාවට internet ඕන. Libraries download වෙනවා.

## Step 6 — Browser preview (වෙනම desktop window නැතුව UI check කරන්න)

```bash
npm run dev
```

Browser එකෙන් `http://127.0.0.1:5173` open කරන්න. Stop කරන්න `Ctrl + C`.

## Step 7 — Linux Desktop App run කරන්න

```bash
npm run tauri dev
```

Rust compiler එක first run එකේ dependencies compile කරලා desktop window එක open කරනවා.

## Step 8 — `.deb` installer build කරන්න

```bash
npm run tauri build
```

Output එක `src-tauri/target/release/bundle/deb/` folder එකේ.

## App භාවිතය

- **My day** → `New time block` → Title, Category, Date, Start, End දාලා `Create block`.
- Block එකේ `Focus` click කරන්න → timer start වෙනවා.
- `Pause session` / `Start focusing` මගින් timer pause / resume.
- Block එකේ ✓ button එකෙන් complete / unfinished කරන්න.
- **Weekly planner** එකෙන් සතිය බලන්න.
- **Insights** එකෙන් complete වෙච්ච minutes සහ sessions බලන්න.
- **Settings** → daily target, Linux notification, backup/restore.

**Note:** Application එක මුලින් open කරන විට sample time blocks 4ක් තියෙනවා. ඒවා edit/delete කරන්න පුළුවන්. මේ application එක websites/applications block කරන software එකක් නෙවෙයි; schedule plan කරලා countdown timer run කරන software එකක්.

වැදගත්: Browser preview එකේ data සහ Tauri desktop app data automatically share වෙන්නේ නැහැ. JSON export/import මගින් transfer කරන්න.

## Files මොනවද?

- `src/App.tsx` — screen buttons, time blocks, timer operations
- `src/styles.css` — UI design
- `src/lib.ts` — dates, timer calculations, localStorage
- `src/types.ts` — data structures
- `src/notifications.ts` — native Linux notifications
- `src-tauri/tauri.conf.json` — window title, size, `.deb` build settings
- `src-tauri/src/lib.rs` — Rust Tauri plugins setup
