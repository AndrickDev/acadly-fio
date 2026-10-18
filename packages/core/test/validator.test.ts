import { describe, it, expect } from "vitest";
import { validateCheckIn, canTransition, isWindowOpen } from "../src";
import type { CheckInAttempt, ValidationContext, SessionSnapshot } from "../src";

const T0 = 1_000_000;
const session: SessionSnapshot = { id: "s1", classId: "c1", state: "ABERTA", openedAt: T0, windowMs: 120_000 };

const attempt = (over: Partial<CheckInAttempt> = {}): CheckInAttempt => ({
  sessionId: "s1",
  studentId: "a1",
  deviceId: "d1",
  token: "good",
  hops: 0,
  witnesses: [],
  now: T0 + 10_000,
  ...over,
});

const ctx = (over: Partial<ValidationContext> = {}): ValidationContext => ({
  session,
  enrolled: true,
  checkedIn: new Map(),
  recentAttemptsForDevice: 0,
  verifyToken: (t) => (t === "good" ? "ok" : t === "old" ? "stale" : "invalid"),
  ...over,
});

describe("state machine", () => {
  it("allows CRIADA->ABERTA->FINALIZADA only", () => {
    expect(canTransition("CRIADA", "ABERTA")).toBe(true);
    expect(canTransition("ABERTA", "FINALIZADA")).toBe(true);
    expect(canTransition("FINALIZADA", "ABERTA")).toBe(false);
    expect(canTransition("CRIADA", "FINALIZADA")).toBe(false);
  });
  it("window is half-open [open, open+window)", () => {
    expect(isWindowOpen(session, T0)).toBe(true);
    expect(isWindowOpen(session, T0 + 119_999)).toBe(true);
    expect(isWindowOpen(session, T0 + 120_000)).toBe(false);
    expect(isWindowOpen({ ...session, state: "FINALIZADA" }, T0 + 1)).toBe(false);
    expect(isWindowOpen({ ...session, state: "CRIADA", openedAt: null }, T0)).toBe(false);
  });
});

describe("validateCheckIn", () => {
  it("accepts a direct, valid attempt (R10)", () => {
    const d = validateCheckIn(attempt(), ctx());
    expect(d).toMatchObject({ ok: true, rule: "R10", code: "ACCEPT" });
  });
  it("R1 session missing", () => {
    expect(validateCheckIn(attempt(), ctx({ session: null }))).toMatchObject({ ok: false, rule: "R1", code: "REJECT_SESSION_NOT_FOUND" });
  });
  it("R2 after window", () => {
    expect(validateCheckIn(attempt({ now: T0 + 120_000 }), ctx())).toMatchObject({ rule: "R2", code: "REJECT_OUT_OF_WINDOW" });
  });
  it("R2 before open", () => {
    const s = { ...session, state: "CRIADA" as const, openedAt: null };
    expect(validateCheckIn(attempt(), ctx({ session: s }))).toMatchObject({ rule: "R2" });
  });
  it("R3 not enrolled", () => {
    expect(validateCheckIn(attempt(), ctx({ enrolled: false }))).toMatchObject({ rule: "R3", code: "REJECT_NOT_ENROLLED" });
  });
  it("R4 rate limited raises BURST alert", () => {
    const d = validateCheckIn(attempt(), ctx({ recentAttemptsForDevice: 5 }));
    expect(d).toMatchObject({ rule: "R4", code: "REJECT_RATE_LIMITED" });
    expect(d.alert?.kind).toBe("BURST");
  });
  it("R5 same student twice", () => {
    expect(validateCheckIn(attempt(), ctx({ checkedIn: new Map([["a1", "d1"]]) }))).toMatchObject({ rule: "R5", code: "REJECT_ALREADY_CHECKED_IN" });
  });
  it("R5 same student on another device is still R5", () => {
    expect(validateCheckIn(attempt({ deviceId: "d9" }), ctx({ checkedIn: new Map([["a1", "d1"]]) }))).toMatchObject({ rule: "R5" });
  });
  it("R6 device already used by another student raises alert", () => {
    const d = validateCheckIn(attempt(), ctx({ checkedIn: new Map([["a2", "d1"]]) }));
    expect(d).toMatchObject({ rule: "R6", code: "REJECT_DUPLICATE_DEVICE" });
    expect(d.alert?.kind).toBe("DUPLICATE_DEVICE");
  });
  it("R7 invalid token", () => {
    expect(validateCheckIn(attempt({ token: "bad" }), ctx())).toMatchObject({ rule: "R7", code: "REJECT_INVALID_TOKEN" });
  });
  it("R7 stale token raises replay alert", () => {
    const d = validateCheckIn(attempt({ token: "old" }), ctx());
    expect(d).toMatchObject({ rule: "R7" });
    expect(d.alert?.kind).toBe("STALE_TOKEN_REPLAY");
  });
  it("R8 too many hops", () => {
    expect(validateCheckIn(attempt({ hops: 4, witnesses: ["a2"] }), ctx({ checkedIn: new Map([["a2", "dx"]]) }))).toMatchObject({ rule: "R8", code: "REJECT_TOO_MANY_HOPS" });
  });
  it("R9 hops>0 without present witness raises ORPHAN_CLUSTER", () => {
    const d = validateCheckIn(attempt({ hops: 1, witnesses: ["a2", "a3"] }), ctx());
    expect(d).toMatchObject({ rule: "R9", code: "REJECT_NO_ANCHOR" });
    expect(d.alert?.kind).toBe("ORPHAN_CLUSTER");
  });
  it("hops>0 with a present witness is accepted", () => {
    expect(validateCheckIn(attempt({ hops: 1, witnesses: ["a2"] }), ctx({ checkedIn: new Map([["a2", "dx"]]) }))).toMatchObject({ ok: true, rule: "R10" });
  });
  it("a student cannot anchor themselves", () => {
    expect(validateCheckIn(attempt({ hops: 1, witnesses: ["a1"] }), ctx())).toMatchObject({ rule: "R9" });
  });
});
