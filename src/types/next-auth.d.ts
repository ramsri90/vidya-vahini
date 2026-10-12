import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    mustChangePassword: boolean;
    sessionVersion: number;
    sectionId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      sessionVersion: number;
      sectionId?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
    mustChangePassword: boolean;
    sessionVersion: number;
    sectionId?: string | null;
  }
}
