import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LoadingAnnouncer } from "@polyforge/ui";

describe("LoadingAnnouncer", () => {
  it("renders a polite live region while loading", () => {
    const { container } = render(
      <LoadingAnnouncer loading={true} label="markets" />,
    );
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toContain("Loading markets");
  });

  it("announces the loaded message after loading completes", () => {
    const { container, rerender } = render(
      <LoadingAnnouncer loading={true} label="markets" />,
    );
    rerender(<LoadingAnnouncer loading={false} label="markets" />);
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent?.toLowerCase()).toContain("loaded");
  });

  it("uses sr-only class so it is invisible to sighted users", () => {
    const { container } = render(<LoadingAnnouncer loading={true} />);
    const status = container.querySelector('[role="status"]');
    expect(status?.className).toContain("sr-only");
  });
});
