import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";

// Mock user types
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Helper to create a mock admin context
function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// Helper to create a mock regular user context
function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// Helper to create anonymous context
function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Blog API", () => {
  describe("auth.me", () => {
    it("returns null for anonymous users", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("returns user data for authenticated users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).not.toBeNull();
      expect(result?.email).toBe("user@example.com");
      expect(result?.role).toBe("user");
    });

    it("returns admin data for admin users", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).not.toBeNull();
      expect(result?.role).toBe("admin");
    });
  });

  describe("series API", () => {
    it("list returns array (public)", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.series.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("listWithCount returns array (public)", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.series.listWithCount();
      expect(Array.isArray(result)).toBe(true);
    });

    it("create requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.series.create({
          slug: "test-series",
          title: "Test Series",
        })
      ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });
  });

  describe("tags API", () => {
    it("list returns array (public)", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tags.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("listWithCount returns array (public)", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tags.listWithCount();
      expect(Array.isArray(result)).toBe(true);
    });

    it("create requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.tags.create({
          slug: "test-tag",
          name: "Test Tag",
        })
      ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });
  });

  describe("articles API", () => {
    it("list returns articles and total (public)", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.articles.list({
        limit: 10,
        offset: 0,
        orderBy: "newest",
      });
      expect(result).toHaveProperty("articles");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.articles)).toBe(true);
    });

    it("featured returns array (public)", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.articles.featured({ limit: 5 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("listAll requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.articles.listAll({ limit: 10 })
      ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });

    it("create requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.articles.create({
          slug: "test-article",
          title: "Test Article",
          content: "Test content",
        })
      ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });

    it("delete requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.articles.delete({ id: 1 })
      ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });
  });

  describe("comments API", () => {
    it("listByArticle returns array (public)", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.comments.listByArticle({ articleId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("create requires authentication", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.comments.create({
          articleId: 1,
          content: "Test comment",
        })
      ).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("listPending requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.comments.listPending()).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });

    it("approve requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.comments.approve({ id: 1 })
      ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });

    it("reject requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.comments.reject({ id: 1 })
      ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });

    it("delete requires admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.comments.delete({ id: 1 })
      ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });
  });

  describe("archive API", () => {
    it("years returns array (public)", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.archive.years();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
