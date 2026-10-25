# Parameter types and the new Indoor acoustics (2026-10-25)

## Three new kinds of parameter in Plan Studio

| Kind | Where | What it carries | Who reads it |
|---|---|---|---|
| **Finishes with physical properties** | A wall's panel (*Finish*, both faces), a window's panel (*Glazing*), a floor slab's panel (*Floor finish*), Level properties › *Finishes* (the level's floor and ceiling) | Sound absorption α in six octave bands (125 Hz–4 kHz), light reflectance; glazing: α and visible transmittance. 13 finishes and 4 glazings, typical published values (`MATLIB`, `GLAZING` in `emb/modeler.html`) | Indoor acoustics (per room and surface); Daylight (area-weighted wall, floor and ceiling reflectances and glass transmittance, only from finishes that were set; unset surfaces keep Daylight's defaults, so nothing changes until a finish is chosen) |
| **Arrays** | A furniture piece's or an imported piece's panel › *Array* | Count, spacing (centre to centre), along its width or depth | The model: copies `<first>~1…` follow the first piece on every change; they are locked (move the first piece) |
| **Linked values** | *Array* › *Fill a length*; a mass's panel › *Storeys from* | An array's count from a length to fill; a mass's storeys from a height limit (⌊limit ÷ floor height⌋) or a target FAR on the plot (with the other masses' floor area as they are) | The model, recomputed on every change; the typed value is locked while the rule holds |

The finishes are model data (`wall.mat`, `op.glaz`, `floor.mat`, `level.floorMat` / `ceilMat`), saved with versions, undoable, and kept in step between the Workspace panes. Test: `tests/mvp-parameters.cjs`.

## Indoor acoustics, rebuilt like the other simulations

Before: one closed room picked in the bar, sent as a wall loop to `emb/acoustics.html` (a ray-accumulation tool with its own materials).
Now: `emb/roomacoustics.html`, on the plan engines' shell (`emb/lib/plansim.js`), like Wayfinding, Privacy and Outdoor noise.

- **Input:** every room of the version's level from Plan Studio (`toolScene('acoustics', level)`): volume, each surface's area and finish (wall faces sampled on both sides, less doors, windows and openings), furniture, openings.
- **Calculation:** reverberation time in six octave bands, Eyring (default) or Sabine, from the surfaces, upholstered furniture and people (typical absorption areas), and air (ISO 9613-1 at the temperature and humidity set). Target from DIN 18041 by the room's use (picked from its name, changeable per room and kept for the project) or 0.4–0.6 s for homes and offices (rule of thumb); ±20 %.
- **Results:** a plan coloured against the target (or by T at one band), a room table, the picked room by band (Eyring and Sabine with the target band), what absorbs its sound and its share, and how much acoustic panel would bring it to target. Figures: rooms on target, longest and mean T at 500 Hz–1 kHz, lowest speech transmission index (from reverberation only, an estimate). Save, field (T at 500–1k per point) and Results batch work as for the other engines.
- **3D sound particles:** a 3D view of one room on a dark stage, walls tinted by how much they absorb, with a burst of sound particles from a source (double-click the floor to move it). They fly at the speed of sound, slowed down (slow at first to show the wave leaving and the first reflections, then faster so the whole decay plays in about ten seconds), bounce off walls, floor and ceiling (mirror-like with some scattering), lose at each bounce what the surface absorbs in the chosen band, and fade from white-hot to deep blue; flashes mark the bounces (teal where a surface soaks the sound up). The room's energy over the particles is drawn live against the formula's decay. It is a picture of what the figures mean; the figures come from the formulas (`emb/lib/roomacoustics3d.js`, Three.js from `furniture/`).
- **Validation:** `tests/validation/room_acoustics.cjs`, see `VALIDATION.md` §7 (air absorption within 3 % of ISO 9613-1; Eyring within 1–7 % of an independent ray-traced decay in diffuse rooms; uneven absorption reported).
- **Kept:** `emb/acoustics.html` stays for the classic site (`index.html#/tool/acoustics`) and its test; only the Simulations page moved.

Limits (in the engine's footer): statistical room acoustics for early design; no sound insulation between rooms, no echoes, focusing or room modes, typical absorption values rather than products, no measured data. A room "on target" with all its absorption on the ceiling and hard parallel walls should be checked by an acoustician.

Test: `tests/mvp-room-acoustics.cjs`.
