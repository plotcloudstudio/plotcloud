#!/usr/bin/env bash
# Engine validation: sun position (NREL SPA), Sun hours shadows (exact ray-box), Daylight factor (Radiance + an independent integral),
# Outdoor noise (exact line-source integral, ISO 9613-2 screening), Indoor acoustics (ISO 9613-1 air absorption, ray-traced decay),
# climate library (UTCI and SolarCal against pythermalcomfort, irradiation against pvlib's Perez).
# Sun hours against Ladybug (ladybug-core: its sun path and LB Direct Sun Hours step for step).
# Needs: python3 with numpy, pandas, pvlib, pyradiance, pythermalcomfort, ladybug-core; node with playwright; the site served on 8765.
set -u; cd "$(dirname "$0")"; fail=0
for t in sun_position sun_shadow lb_sunhours daylight_df climate_lib; do
  echo "== $t"; if python3 "$t.py" > "$t.out.json"; then echo "pass"; else echo "FAIL"; fail=1; fi
done
echo "== noise_engine"; if node noise_engine.cjs; then echo "pass"; else echo "FAIL"; fail=1; fi
echo "== room_acoustics"; if node room_acoustics.cjs; then echo "pass"; else echo "FAIL"; fail=1; fi
exit $fail
