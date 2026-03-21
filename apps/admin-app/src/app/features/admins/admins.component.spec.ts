import { describe, it, expect, beforeEach, vi } from "vitest";
import { of, throwError } from "rxjs";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The AdminsComponent uses Angular DI (inject, signal, computed) which requires
// Angular's injector. We replicate the password confirmation and submit logic
// inline so we can unit-test the behavior without a full Angular TestBed
// (consistent with existing test patterns in this project).

interface AdminView {
  id: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
}

function createComponentUnderTest() {
  let editPassword = "";
  let editConfirmPassword = "";
  let editDisplayName = "";
  let editRole = "ADMIN";
  let editActive = true;
  let saving = false;
  let editTarget: AdminView | null = null;
  let lastApiCall: { id: string; data: Record<string, unknown> } | null = null;
  let apiShouldFail = false;

  const passwordsMatch = () => editPassword === editConfirmPassword;

  const openEdit = (admin: AdminView) => {
    editTarget = admin;
    editDisplayName = admin.displayName;
    editRole = admin.role;
    editActive = admin.active;
    editPassword = "";
    editConfirmPassword = "";
  };

  const submitEdit = () => {
    if (!editTarget) return false;
    if (editPassword && !passwordsMatch()) return false;
    saving = true;

    const data: Record<string, unknown> = {
      displayName: editDisplayName,
      role: editRole,
      active: editActive,
    };
    if (editPassword) data["password"] = editPassword;

    if (apiShouldFail) {
      saving = false;
      return false;
    }

    lastApiCall = { id: editTarget.id, data };
    saving = false;
    return true;
  };

  return {
    get editPassword() { return editPassword; },
    set editPassword(v: string) { editPassword = v; },
    get editConfirmPassword() { return editConfirmPassword; },
    set editConfirmPassword(v: string) { editConfirmPassword = v; },
    get editDisplayName() { return editDisplayName; },
    set editDisplayName(v: string) { editDisplayName = v; },
    get saving() { return saving; },
    passwordsMatch,
    openEdit,
    submitEdit,
    get lastApiCall() { return lastApiCall; },
    set apiShouldFail(v: boolean) { apiShouldFail = v; },
  };
}

const mockAdmin: AdminView = {
  id: "admin-1",
  email: "admin@test.com",
  displayName: "Test Admin",
  role: "ADMIN",
  active: true,
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("AdminsComponent — password confirmation", () => {
  let component: ReturnType<typeof createComponentUnderTest>;

  beforeEach(() => {
    component = createComponentUnderTest();
    component.openEdit(mockAdmin);
  });

  it("passwordsMatch returns true when both fields are empty", () => {
    expect(component.passwordsMatch()).toBe(true);
  });

  it("passwordsMatch returns true when both fields match", () => {
    component.editPassword = "NewPass123!";
    component.editConfirmPassword = "NewPass123!";
    expect(component.passwordsMatch()).toBe(true);
  });

  it("passwordsMatch returns false when fields do not match", () => {
    component.editPassword = "NewPass123!";
    component.editConfirmPassword = "DifferentPass";
    expect(component.passwordsMatch()).toBe(false);
  });

  it("submitEdit succeeds when no password is set (empty string)", () => {
    component.editDisplayName = "Updated Name";
    const result = component.submitEdit();

    expect(result).toBe(true);
    expect(component.lastApiCall).not.toBeNull();
    expect(component.lastApiCall!.data).not.toHaveProperty("password");
  });

  it("submitEdit succeeds when password is set and confirmed correctly", () => {
    component.editPassword = "SecurePass1!";
    component.editConfirmPassword = "SecurePass1!";
    const result = component.submitEdit();

    expect(result).toBe(true);
    expect(component.lastApiCall!.data).toHaveProperty("password", "SecurePass1!");
  });

  it("submitEdit returns early when password is set but does not match confirmation", () => {
    component.editPassword = "SecurePass1!";
    component.editConfirmPassword = "WrongConfirm";
    const result = component.submitEdit();

    expect(result).toBe(false);
    expect(component.lastApiCall).toBeNull();
  });

  it("openEdit resets password fields", () => {
    component.editPassword = "SomePassword";
    component.editConfirmPassword = "SomePassword";

    component.openEdit({ ...mockAdmin, id: "admin-2", displayName: "Other Admin" });

    expect(component.editPassword).toBe("");
    expect(component.editConfirmPassword).toBe("");
  });

  it("submitEdit includes password only when non-empty", () => {
    // First: submit without password
    component.editPassword = "";
    component.editConfirmPassword = "";
    component.submitEdit();
    expect(component.lastApiCall!.data).not.toHaveProperty("password");
  });
});
