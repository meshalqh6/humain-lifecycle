import { describe, it, expect } from "vitest";
import { parseSSE } from "../services/api";
describe("WASL server-sent event transport", () => {
  it("decodes Arabic streaming text", () => {
    expect(parseSSE('event: token\ndata: {"text":"مرحباً"}')).toEqual({
      event: "token",
      data: { text: "مرحباً" },
    });
  });
  it("keeps error outcomes separate from tokens", () => {
    expect(
      parseSSE('event: error\ndata: {"message":"Model unavailable"}')?.event,
    ).toBe("error");
  });
  it("ignores incomplete events", () => {
    expect(parseSSE("event: token")).toBeNull();
  });
});
