# City Pave Estimator - Cloud-Native Deployment 🚀

This project is configured for Cloud-Native deployment using Google Cloud Build, Firebase, and Capacitor.

## Architecture

- **Web**: Hosted on Firebase Hosting (`dist/` directory).
- **Mobile**: Native wrappers via Capacitor (`android/` and `ios/`).
- **CI/CD**: `cloudbuild.yaml` orchestrates the build process.
- **Logging**: Centralized error and performance logging via `logging.js` -> Firebase.

## Prerequisites

- **Node.js**: v18+
- **Python**: v3.9+ (for build script)
- **CocoaPods** (for iOS build): `sudo gem install cocoapods`

## Building the Project

### Web Build
The build script minifies JS/HTML and outputs to `dist/`.
```bash
npm run build
# OR
python3 build.py
```

### Mobile Sync
After building the web assets, sync them to the native projects:
```bash
npx cap sync
```

## Cloud Build

The `cloudbuild.yaml` file is configured to:
1. Install dependencies.
2. Run the build script.
3. Deploy the web application to Firebase Hosting.

To run this locally (requires `cloud-build-local`):
```bash
cloud-build-local --config=cloudbuild.yaml --dryrun=false .
```

## Remote Testing & QA

- **Crashlytics**: Errors in the web app are logged to Firebase Analytics/Performance.
- **QA Agent**: The on-screen "Ladybug" button allows for manual QA tasks (Chaos Monkey, Crawl) which also log to the cloud.

## Troubleshooting

### iOS Config
If `npx cap add ios` fails on `pod install`, ensure you have the full Xcode installed and CocoaPods setup:
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo gem install cocoapods
cd ios/App && pod install
```
