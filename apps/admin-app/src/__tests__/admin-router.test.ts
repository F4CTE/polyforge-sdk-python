import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routerSource = readFileSync(join(process.cwd(), 'src/router.tsx'), 'utf8');

describe('admin router guard configuration', () => {
  it('keeps the cache flush screen behind the SUPER_ADMIN route guard', () => {
    const roleGuardIndex = routerSource.indexOf(
      'element: <RoleGuard allowed={SUPER_ADMIN_ONLY} />'
    );
    const wildcardRouteIndex = routerSource.indexOf("path: '*'", roleGuardIndex);

    expect(roleGuardIndex).toBeGreaterThanOrEqual(0);
    expect(wildcardRouteIndex).toBeGreaterThan(roleGuardIndex);
    expect(routerSource.slice(0, roleGuardIndex)).not.toContain("{ path: 'cache'");
    expect(routerSource.slice(roleGuardIndex, wildcardRouteIndex)).toContain(
      "{ path: 'cache'"
    );
  });
});
