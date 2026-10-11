import { describe, expect, it } from "vitest";
import {
  hasTransparency,
  usableMatte,
} from "../src/modules/media/portrait-alpha";

describe("portrait transparency", () => {
  it("distinguishes opaque RGBA files from existing transparency", () => {
    expect(
      hasTransparency(new Uint8Array([10, 20, 30, 255, 255, 255, 255, 255])),
    ).toBe(false);
    expect(
      hasTransparency(
        new Uint8ClampedArray([10, 20, 30, 255, 255, 255, 255, 0]),
      ),
    ).toBe(true);
    expect(hasTransparency(new Uint8Array([10, 20, 30, 240]))).toBe(true);
  });
  it("rejects unusable all-background, all-foreground, and empty masks", () => {
    expect(usableMatte(new Uint8Array([10, 20, 30, 255, 10, 20, 30, 0]))).toBe(
      true,
    );
    expect(usableMatte(new Uint8Array([10, 20, 30, 255]))).toBe(false);
    expect(usableMatte(new Uint8Array([10, 20, 30, 0]))).toBe(false);
    expect(usableMatte(new Uint8Array())).toBe(false);
  });
});
