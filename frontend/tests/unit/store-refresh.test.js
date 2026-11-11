import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refreshState } from "../../src/store/utils.js";

describe("store refresh", () => {
    it("adds new rows from a batch", () => {
        const state = { data: {} };

        refreshState(state, [{ id: 1, name: "First" }, { id: 2, name: "Second" }]);

        assert.deepEqual(state.data, {
            1: { id: 1, name: "First" },
            2: { id: 2, name: "Second" },
        });
    });

    it("merges a partial update without losing unchanged fields", () => {
        const state = { data: { 1: { id: 1, name: "Before", userId: 7 } } };

        refreshState(state, { id: 1, name: "After" });

        assert.deepEqual(state.data[1], { id: 1, name: "After", userId: 7 });
    });

    it("removes deleted rows without removing other rows", () => {
        const state = { data: { 1: { id: 1 }, 2: { id: 2 } } };

        refreshState(state, { id: 1, deleted: true });

        assert.deepEqual(state.data, { 2: { id: 2 } });
    });

    it("keeps existing rows when deleted-row removal is disabled", () => {
        const state = { data: { 1: { id: 1, name: "Retained" } } };

        refreshState(state, { id: 1, deleted: true }, false);

        assert.deepEqual(state.data, { 1: { id: 1, name: "Retained" } });
    });
});
