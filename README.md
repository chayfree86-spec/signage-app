# Digital Signage Controller

React + Vite admin panel and TV screen player for a single-screen digital signage setup.

## Scripts

```bash
npm run dev
npm run build
npm run build:tv-apk
npm run start
npm run lint
```

## Routes

- `/` opens the admin controller.
- `/screen` opens the TV/player screen.

## Deployment

Run `npm run build` and upload the contents of `dist/` to the web server. The build is static and uses Supabase from the browser.

## TV App

Run `npm run build:tv-apk` to create the installable Android TV app. The APK opens `https://tv.chaychaupal.com/screen/` in fullscreen mode and is written to `tv-app/output/chay-signage-tv.apk`.
