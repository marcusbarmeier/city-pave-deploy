---
description: Build Native iOS/Android Apps with Capacitor
---

This workflow describes how to build the native application artifacts.

1.  **Prerequisites**: Ensure you have Node.js installed.
2.  **Install Dependencies**:
    ```bash
    npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
    ```
3.  **Initialize Capacitor** (First time only):
    ```bash
    npx cap init "City Pave Estimator" com.citypave.estimator --web-dir .
    ```
4.  **Add Platforms**:
    ```bash
    npx cap add ios
    npx cap add android
    ```
5.  **Sync Web Assets**:
    ```bash
    npx cap sync
    ```
6.  **Open Native IDE**:
    *   **iOS**: `npx cap open ios` (Requires Xcode)
    *   **Android**: `npx cap open android` (Requires Android Studio)

// turbo
7.  **Build**: Use the native IDE to build and run the application on a simulator or device.
