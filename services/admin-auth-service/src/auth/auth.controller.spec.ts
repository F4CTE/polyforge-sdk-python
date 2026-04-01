import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

function makeReply() {
  return { setCookie: vi.fn(), clearCookie: vi.fn() } as any;
}

function makeReq(cookie?: string) {
  return {
    cookies: cookie ? { pf_admin_token: cookie } : {},
    headers: {},
  } as any;
}

describe("AdminAuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(() => {
    authService = {
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      getMe: vi.fn(),
      setupTotp: vi
        .fn()
        .mockResolvedValue({ secret: "s", uri: "u", qrCode: "q" }),
      confirmTotp: vi.fn().mockResolvedValue({ enabled: true }),
      disableTotp: vi.fn().mockResolvedValue(undefined),
      verifyToken: vi.fn().mockReturnValue({ sub: "admin-1" }),
    } as unknown as AuthService;
    controller = new AuthController(authService);
  });

  describe("POST login", () => {
    it("delegates to authService.login, sets cookie, and returns admin profile", async () => {
      const serviceResult = {
        token: "admin-jwt",
        admin: { id: "1", role: "SUPER_ADMIN" },
      };
      vi.mocked(authService.login).mockResolvedValue(serviceResult as any);
      const dto = { email: "admin@polyforge.app", password: "AdminPass1!" };
      const reply = makeReply();

      const result = await controller.login(dto, reply);
      expect(result).toBe(serviceResult.admin);
      expect(reply.setCookie).toHaveBeenCalledWith(
        "pf_admin_token",
        "admin-jwt",
        expect.any(Object),
      );
      expect(authService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe("GET me", () => {
    it("delegates to authService.getMe with the cookie token", async () => {
      const admin = {
        id: "1",
        email: "admin@polyforge.app",
        role: "SUPER_ADMIN",
        displayName: "Super Admin",
      };
      vi.mocked(authService.getMe).mockResolvedValue(admin as any);
      const req = makeReq("admin-jwt");

      const result = await controller.me(req);
      expect(result).toBe(admin);
      expect(authService.getMe).toHaveBeenCalledWith("admin-jwt");
    });

    it("throws UnauthorizedException when no cookie present", async () => {
      const req = makeReq();
      await expect(controller.me(req)).rejects.toThrow("Not authenticated");
    });
  });

  describe("POST logout", () => {
    it("calls authService.logout and clears the cookie", async () => {
      const req = makeReq("admin-jwt");
      const reply = makeReply();

      await controller.logout(req, reply);
      expect(authService.logout).toHaveBeenCalledWith("Bearer admin-jwt");
      expect(reply.clearCookie).toHaveBeenCalledWith("pf_admin_token", {
        path: "/",
      });
    });

    it("falls back to Authorization header when no cookie is present", async () => {
      const req = {
        cookies: {},
        headers: { authorization: "Bearer header-jwt" },
      } as any;
      const reply = makeReply();

      await controller.logout(req, reply);
      expect(authService.logout).toHaveBeenCalledWith("Bearer header-jwt");
      expect(reply.clearCookie).toHaveBeenCalledWith("pf_admin_token", {
        path: "/",
      });
    });
  });

  describe("POST totp/setup", () => {
    it("delegates to authService.setupTotp with adminId from cookie", async () => {
      const req = makeReq("admin-jwt");

      const result = await controller.setupTotp(req);

      expect(result).toEqual({ secret: "s", uri: "u", qrCode: "q" });
      expect(authService.setupTotp).toHaveBeenCalledWith("admin-1");
    });
  });

  describe("POST totp/confirm", () => {
    it("delegates to authService.confirmTotp with adminId and code", async () => {
      const req = makeReq("admin-jwt");

      const result = await controller.confirmTotp(req, { code: "123456" });

      expect(result).toEqual({ enabled: true });
      expect(authService.confirmTotp).toHaveBeenCalledWith("admin-1", "123456");
    });
  });

  describe("DELETE totp", () => {
    it("delegates to authService.disableTotp with adminId, password, and code", async () => {
      const req = makeReq("admin-jwt");

      await controller.disableTotp(req, { password: "Passw0rd!", totpCode: "123456" });

      expect(authService.disableTotp).toHaveBeenCalledWith("admin-1", "Passw0rd!", "123456");
    });
  });
});
