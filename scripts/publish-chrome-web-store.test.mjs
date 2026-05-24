import { describe, expect, it } from "vitest";
import { DEFAULT_EXTENSION_ID, endpoints, requiredConfig } from "./publish-chrome-web-store.mjs";

describe("publish-chrome-web-store", () => {
  it("reports missing required secrets without printing secret values", () => {
    expect(() => requiredConfig({ CWS_CLIENT_ID: "client-id" })).toThrow(
      "Missing Chrome Web Store auth. Configure either CWS_SERVICE_ACCOUNT_JSON or CWS_CLIENT_ID, CWS_CLIENT_SECRET, and CWS_REFRESH_TOKEN. Also configure CWS_PUBLISHER_ID."
    );
  });

  it("uses service account auth when a service account JSON secret is configured", () => {
    expect(
      requiredConfig({
        CWS_SERVICE_ACCOUNT_JSON: JSON.stringify({
          client_email: "publisher@project.iam.gserviceaccount.com",
          private_key: "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----\n"
        }),
        CWS_CLIENT_ID: "client-id",
        CWS_CLIENT_SECRET: "client-secret",
        CWS_REFRESH_TOKEN: "refresh-token",
        CWS_PUBLISHER_ID: "publisher-id"
      })
    ).toMatchObject({
      authType: "serviceAccount",
      serviceAccount: {
        client_email: "publisher@project.iam.gserviceaccount.com"
      }
    });
  });

  it("rejects invalid service account JSON without printing the value", () => {
    expect(() =>
      requiredConfig({
        CWS_SERVICE_ACCOUNT_JSON: "{",
        CWS_PUBLISHER_ID: "publisher-id"
      })
    ).toThrow("CWS_SERVICE_ACCOUNT_JSON must be a valid Google service account JSON value.");
  });

  it("builds Chrome Web Store API v2 endpoints", () => {
    expect(endpoints({ publisherId: "pub", extensionId: "ext" })).toEqual({
      upload: "https://chromewebstore.googleapis.com/upload/v2/publishers/pub/items/ext:upload",
      publish: "https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext:publish"
    });
  });

  it("defaults to the published Chrome Web Store extension ID", () => {
    expect(
      requiredConfig({
        CWS_CLIENT_ID: "client-id",
        CWS_CLIENT_SECRET: "client-secret",
        CWS_REFRESH_TOKEN: "refresh-token",
        CWS_PUBLISHER_ID: "publisher-id"
      })
    ).toMatchObject({
      extensionId: DEFAULT_EXTENSION_ID
    });
  });
});
