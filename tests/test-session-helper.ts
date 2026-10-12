import { mock } from "node:test";

let currentMockUser: unknown = null;

export function setTestUser(user: unknown) {
  currentMockUser = user;
}

mock.module("../src/auth.ts", {
  namedExports: {
    auth: async () => (currentMockUser ? { user: currentMockUser } : null),
  },
});
