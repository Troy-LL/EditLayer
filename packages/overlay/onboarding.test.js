import test from "node:test";
import assert from "node:assert/strict";
import { COACH_STEPS, ONBOARDING_KEY, advanceCoach, coachBlocksEdit, readCoach } from "./onboarding.js";

test("seven coach steps, storage key v1", () => {
  assert.equal(ONBOARDING_KEY, "editlayer-onboarding:v1");
  assert.equal(COACH_STEPS.length, 7);
  assert.match(COACH_STEPS[0].body, /Press E/);
  assert.match(COACH_STEPS[6].body, /session off/);
});

test("advance stops on the last step as done", () => {
  assert.equal(advanceCoach(0), 1);
  assert.equal(advanceCoach(5), 6);
  assert.equal(advanceCoach(6), "done");
});

test("edit stays locked until the coach is done", () => {
  assert.equal(coachBlocksEdit(null), true);
  assert.equal(coachBlocksEdit("2"), true);
  assert.equal(coachBlocksEdit("done"), false);
});

test("readCoach hides a finished session and clamps a bad index", () => {
  assert.equal(readCoach("done"), null);
  assert.equal(readCoach(null), 0);
  assert.equal(readCoach("3"), 3);
  assert.equal(readCoach("nope"), 0);
  assert.equal(readCoach("9"), 0);
});
