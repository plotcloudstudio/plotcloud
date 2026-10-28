# Resource entry and membership verification

The six native resource generators remain restricted to active resource access. All 17 simulation studies remain free. No pricing, payment policy, membership grant or production account has been changed.

The former UI inventory opened paid native HTML pages as an unverified visitor, followed their intentional redirect to the membership page, then incorrectly asserted that this site page was a tool surface. The six `site !== tool` failures did not demonstrate six broken generators.

UI inventory now exercises each actual embedded generator through its authorized Resources route, with a browser-only mocked account/RPC response. Guest routing is tested independently: each legacy URL must retain the requested tool, display the access page without loading an unauthorized generator, and provide a return to Resources. No test permission switch is included in production code.

The Resources catalog now includes the previously missing Stair generator and Door generator links, keeping all six native tools discoverable.

The access page names the requested tool, correctly states that every simulation is currently free, provides a Resources link and a manual access recheck. Verification-service failure is distinguished from absent membership; retry can recover an existing membership without another payment. Both timed and permanent account access retain their existing server verification.

Checks: `tests/resource-entry.cjs` covers six guest and member entries, revocation, verification outage and recovery. `tests/resources-native.cjs` checks actual exports from all six generators, catalog/legacy routes, utilities and preserved local data. `tests/ui-unification.cjs` covers both themes in the actual authorized tool frames. `tests/resource-access-fixture.cjs` supplies only isolated browser test sessions, mocked RPC responses and cached public CDN dependencies.
