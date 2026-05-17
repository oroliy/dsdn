# Security Notes

This extension stores the configured DSM URL, username, and password in Chrome extension local storage. The Download Station session ID is stored in Chrome session storage and is cleared when the user disconnects or when a new connection profile is saved.

Use HTTPS for DSM whenever possible. HTTP is supported for LAN-only deployments, but it exposes credentials and session data to anyone who can observe that network traffic.

The extension does not use a third-party backend, proxy, telemetry service, or analytics service. Network requests are sent only to the DSM base URL configured by the user.

For safer operation, create a dedicated DSM account with only the permissions needed for Download Station.
