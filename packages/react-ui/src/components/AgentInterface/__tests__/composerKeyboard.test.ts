import { describe, expect, it } from "vitest";
import {
  ComposerKeyDownEvent,
  shouldSubmitOnEnter,
  shouldSubmitOnSend,
} from "../_shared/utils/composerKeyboard";

const keyDown = (overrides: Partial<ComposerKeyDownEvent> = {}): ComposerKeyDownEvent => ({
  key: "Enter",
  shiftKey: false,
  keyCode: 13,
  nativeEvent: { isComposing: false },
  ...overrides,
});

describe("shouldSubmitOnEnter", () => {
  it("submits on a plain Enter", () => {
    expect(shouldSubmitOnEnter(keyDown())).toBe(true);
  });

  it("does not submit on Shift+Enter — that inserts a newline", () => {
    expect(shouldSubmitOnEnter(keyDown({ shiftKey: true }))).toBe(false);
  });

  it("ignores keys other than Enter", () => {
    expect(shouldSubmitOnEnter(keyDown({ key: "a", keyCode: 65 }))).toBe(false);
  });

  it("does not submit while an IME composition is open (isComposing)", () => {
    expect(shouldSubmitOnEnter(keyDown({ nativeEvent: { isComposing: true } }))).toBe(false);
  });

  it("does not submit when the browser reports the IME sentinel keyCode 229", () => {
    // Safari and older Chromium leave isComposing unset on this keydown.
    expect(shouldSubmitOnEnter(keyDown({ keyCode: 229 }))).toBe(false);
  });

  it("submits on the Enter that follows a finished composition", () => {
    expect(shouldSubmitOnEnter(keyDown({ nativeEvent: { isComposing: false } }))).toBe(true);
  });

  it("blocks a fast Enter mid-dictation when the tracked composition ref is set", () => {
    // Windows Voice Typing (Win+H) can report isComposing: false and keyCode 13
    // on the fast Enter even though dictation is still composing. The
    // onCompositionStart/End ref stays true across that window, so it must win.
    expect(shouldSubmitOnEnter(keyDown(), true)).toBe(false);
  });

  it("allows Enter once the tracked composition ends", () => {
    expect(shouldSubmitOnEnter(keyDown(), false)).toBe(true);
  });
});

describe("shouldSubmitOnSend", () => {
  it("allows Send when no composition is tracked", () => {
    expect(shouldSubmitOnSend(false)).toBe(true);
    expect(shouldSubmitOnSend()).toBe(true);
  });

  it("blocks Send while a Voice Typing composition is tracked", () => {
    // Prevents submit + clear mid-dictation followed by a late
    // compositionend/onChange restoring the dictated text.
    expect(shouldSubmitOnSend(true)).toBe(false);
  });

  it("covers the dictation event sequence with a single submit", () => {
    // compositionstart -> fast Enter (blocked) -> Send click (blocked) ->
    // compositionend -> Enter (sends once) / Send (sends once).
    let trackedIsComposing = true;
    expect(shouldSubmitOnEnter(keyDown(), trackedIsComposing)).toBe(false);
    expect(shouldSubmitOnSend(trackedIsComposing)).toBe(false);

    trackedIsComposing = false;
    expect(shouldSubmitOnEnter(keyDown(), trackedIsComposing)).toBe(true);
    expect(shouldSubmitOnSend(trackedIsComposing)).toBe(true);
  });
});
