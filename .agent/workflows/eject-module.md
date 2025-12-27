---
description: Eject a Mini-App Module into a Standalone Application
---

This workflow describes how to take a module from `/modules/` and package it as a standalone web application.

1.  **Select Module**: Identify the module ID (e.g., `time_kiosk`, `dispatch_command`).
2.  **Create Directory**: Create a new directory for the standalone app.
    ```bash
    mkdir -p standalone-apps/[module_id]
    ```
3.  **Copy Files**: Copy the module's source code.
    ```bash
    cp -r modules/[module_id]/* standalone-apps/[module_id]/
    ```
4.  **Create Wrapper**: Create an `index.html` in the new directory.
    ```html
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Standalone App</title>
        <script type="module">
            import config from './config.js';
            import * as App from './index.js';
            document.title = config.name;
            // Initialize App
            console.log("Starting " + config.name);
        </script>
    </head>
    <body>
        <div id="app-root"></div>
    </body>
    </html>
    ```
5.  **Install Dependencies**: If the module relies on shared libraries (like Firebase), ensure they are included or installed via `npm`.

// turbo
6.  **Verify**: Open the new `index.html` to verify the app loads.
