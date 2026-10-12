import { mock } from "node:test";

let currentMockUser: any = null;

export function setTestUser(user: any) {
  currentMockUser = user;
}

mock.module("../src/auth.ts", {
  namedExports: {
    auth: async () => (currentMockUser ? { user: currentMockUser } : null),
  },
});
