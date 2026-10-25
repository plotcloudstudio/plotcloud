#!/usr/bin/env bash
# Engine validation: sun position (NREL SPA), Sun hours shadows (exact ray-box), Daylight factor (Radiance + an independent integral),
# Outdoor noise (exact line-source integral, ISO 9613-2 screening).
# Needs: python3 with numpy, pandas, pvlib, pyradiance; node with playwright; the site served on 8765.
set -u; cd "$(dirname "$0")"; fail=0
for t in sun_position sun_shadow daylight_df; do
  echo "== $t"; if python3 "$t.py" > "$t.out.json"; then echo "pass"; else echo "FAIL"; fail=1; fi
done
echo "== noise_engine"; if node noise_engine.cjs; then echo "pass"; else echo "FAIL"; fail=1; fi
exit $fail
