# Chrome Extension Smoke Test

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Load unpacked extension from `H:\Work\dsdn\dist`.
5. Open the extension popup.
6. Enter DSM base URL, username, and password.
7. Click connect.
8. Verify the current Download Station task list appears.
9. Add a known test URL or magnet link.
10. Verify the new task appears after refresh.
11. Close and reopen the popup.
12. Verify the session is reused without re-entering credentials.
