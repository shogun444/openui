import { describe, expect, it } from "vitest";
import {
  ComposerKeyDownEvent,
  isStaleComposition,
  shouldSubmitOnEnter,
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

  it("does not submit while a true IME composition is open (isComposing)", () => {
    expect(shouldSubmitOnEnter(keyDown({ nativeEvent: { isComposing: true } }))).toBe(false);
  });

  it("does not submit when the browser reports the IME sentinel keyCode 229", () => {
    // Safari and older Chromium leave isComposing unset on this keydown.
    // CJK keeps double-Enter: first commits, second sends.
    expect(shouldSubmitOnEnter(keyDown({ keyCode: 229 }))).toBe(false);
  });

  it("submits on the Enter that follows a finished composition", () => {
    expect(shouldSubmitOnEnter(keyDown({ nativeEvent: { isComposing: false } }))).toBe(true);
  });

  it("sends voice dictation in a single Enter (isComposing false + keyCode 13)", () => {
    // Windows Voice Typing (Win+H, Chrome 153 / Edge 154 on Windows 11 25H2)
    // reports a fast mid-dictation Enter as not-composing. It must snapshot
    // and send once; the late pre-submit composition echo is swallowed by epoch.
    expect(shouldSubmitOnEnter(keyDown())).toBe(true);
  });
});

describe("isStaleComposition", () => {
  it("keeps new typing with no active composition", () => {
    expect(isStaleComposition(null, 0)).toBe(false);
  });

  it("keeps a composition started after the last submit", () => {
    expect(isStaleComposition(2, 2)).toBe(false);
  });

  it("swallows a late echo from a pre-submit dictation session", () => {
    expect(isStaleComposition(0, 1)).toBe(true);
  });

  it("stays clear across successive dictation rounds", () => {
    let submitGen = 0;
    for (let round = 0; round < 5; round += 1) {
      const startSubmitGen = submitGen;
      expect(isStaleComposition(startSubmitGen, submitGen)).toBe(false);
      submitGen += 1;
      expect(isStaleComposition(startSubmitGen, submitGen)).toBe(true);
    }
  });
});
