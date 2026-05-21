WLJ Logo Assets

Recommended usage:
- logo.png: left sidebar/app logo (512x512, rounded square)
- favicon.ico: browser tab favicon
- apple-touch-icon.png: mobile/apple icon
- web-app-icon.png: PWA/web app icon

Codex task:
Replace the default top-left logo in the website with public/logo.png, keep the title text unchanged unless asked. Also update favicon references to public/favicon.ico and apple-touch-icon.png. Do not change other layout or functionality.

HTML example:
<link rel="icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

React example:
<img src="/logo.png" alt="WLJ Logo" className="h-9 w-9 rounded-xl object-cover" />
