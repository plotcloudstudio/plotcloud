# Rhino selection and current-model handoff

The task is to select whole design objects, move or delete a selected set, and open that exact Workspace version in Simulation without first waiting for an unrelated example.

## Standard interaction

- Left drag from empty viewport space, left to right: select objects completely enclosed by the rectangle.
- Left drag right to left: select objects whose actual projected geometry touches the rectangle. Empty corners of an object's bounding box do not count as geometry.
- Alt-left-drag forces window/crossing selection when starting over an object, following Rhino's Combo behavior.
- Shift adds objects; Ctrl/Cmd removes them. Clicking empty space or Escape clears selection.
- Dragging a selected object preserves the selected set and translates whole objects together. A hosted opening follows its moved wall; an opening moved independently stays constrained to its host.
- Selected surface geometry is red in Plan and Perspective. Red is the owner's requested selection color. The selection does not add a blue bounding box or change export materials.
- Perspective right drag orbits. Shift-right drag pans. Selection survives camera navigation.
- Group moves and group deletion each have one Undo step. Escape cancels a group drag and restores the shared model in every pane.

Reference: [Rhino 8 selection](https://docs.mcneel.com/rhino/8/help/en-us/commands/selection_commands.htm) and [Rhino 8 mouse options](https://docs.mcneel.com/rhino/8/help/en-us/options/mouse.htm). This change implements these selection interactions, not the complete Rhino command set.

## Handoff behavior

Hosted analysis frames receive a `workspace` input flag. Sun and Wind do not build their startup sample; hosted Daylight and the related plan engines skip their example calculation/preset startup. Standalone tools keep their existing sample behavior. The hidden model-conversion helper starts empty and does not reopen the last independently saved Plan Studio project.

The analysis frame stays transparent and noninteractive until its actual input acknowledges the selected version, current settings and required weather. Scene-based plan adapters acknowledge completion of their real import operation. Errors remain behind the preparation screen with a recovery message. Preparing an input no longer waits an arbitrary 900 ms before applying settings.

## Validation

`tests/rhino-selection.cjs` exercises real mouse window/crossing selection, red Plan pixels and 3D materials, rigid group movement in both views, Shift-add, right-drag orbit, deletion/Undo and a deliberately delayed conversion. The delayed test confirms that no sample geometry or sample calculation starts while waiting and that the first revealed scene belongs to the selected version.

Existing Gumball, Workbench layout, native study execution/save/stale-state and all-study input/layout checks cover the surrounding workflows. The private uploaded Rhino fixture is checked again with `tests/imported-model-audit.cjs`; its geometry is not published with the source.
