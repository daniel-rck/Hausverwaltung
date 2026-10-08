import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// Guards src/test/setup.ts: if one of these fails, every test that relies on
// that piece of the environment fails with a far less obvious message.
describe("test environment", () => {
  it("provides IndexedDB", async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("web-base-environment-test", 1);
      request.addEventListener("upgradeneeded", () => {
        request.result.createObjectStore("probe");
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });
    expect(db.objectStoreNames.contains("probe")).toBe(true);
    db.close();
  });

  it("delivers BroadcastChannel messages between instances", async () => {
    const sender = new BroadcastChannel("web-base-environment-test");
    const receiver = new BroadcastChannel("web-base-environment-test");
    const received = new Promise<unknown>((resolve) => {
      receiver.addEventListener("message", (event) => resolve(event.data), { once: true });
    });
    sender.postMessage("ping");
    await expect(received).resolves.toBe("ping");
    sender.close();
    receiver.close();
  });

  it("provides matchMedia", () => {
    expect(window.matchMedia("(prefers-color-scheme: dark)").matches).toBe(false);
  });

  it("provides the jest-dom matchers", () => {
    render(<p>Hallo</p>);
    expect(screen.getByText("Hallo")).toBeInTheDocument();
  });
});
