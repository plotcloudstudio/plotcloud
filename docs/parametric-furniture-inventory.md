# Parametric library review

Updated 2026-10-27: **45 generated families across 13 groups**. This includes 31 furniture/fixture families and 14 reference/accessory families (people, pets, vehicles, plants, decor and fences); it is not 45 furniture types.

| Group | Families |
| --- | --- |
| Bedroom | Bed, Nightstand, Wardrobe, Dresser |
| Living | Sofa, Sectional sofa, Armchair, Coffee table, Side table, TV stand, Bookshelf, Bench / banquette |
| Dining & Office | Dining table, Dining chair, Computer desk, Office chair, Drafting table, Studio stool, Modular workstation |
| Kitchen | Kitchen cabinets, Kitchen island, Refrigerator, Range, Washer / dryer |
| Bathroom | Toilet, Bathroom vanity, Bathtub, Shower |
| Outdoor & Fence | Balcony railing, Backyard fence |
| People | Adult, Elderly, Child, Wheelchair user |
| Pets | Cat, Dog |
| Vehicles | Car, Bicycle |
| Decor | Picture frame, Mirror |
| Plants | Potted plant, Tree |
| Entry | Shoe cabinet |
| Studio & Education | Pin-up panel, Locker bank |

## Existing furniture refinement

The 25 existing furniture/fixture families now share regenerated construction detail geometry. Storage bodies are panel assemblies rather than solid blocks; Show cabinet interior exposes shelves. Upholstery has parameter-linked piping, tables have under-top rails, legs have glides, handles have mounts, screens have bezels, appliances have vents and fittings, and bathroom fixtures have additional fittings. Construction details toggles finish detail, while the real basin cavities and cabinet structure remain functional geometry.

Bed pillows use centered slot spacing independent of the width cap, with equal widths and mirrored positions at every supported count. Width, depth and thickness scale together; pillows cannot overlap or extend beyond the mattress at supported bounds. Bathroom vanities honor one or two basins even at narrow widths, resizing each bowl symmetrically. Basin depth is editable. Kitchen/island countertops have actual openings and recessed shells; sink and faucet positions follow cabinet depth and overhang. Toilet bowls and seats are hollow. Shower trays have recessed floors.

All parts rebuild from saved parameters. Shared parameter normalization fills missing legacy values, clamps numeric/count inputs and rejects invalid select values. Existing dimensions, rotations and colors remain editable. Plan symbols, Perspective meshes, library thumbnails and geometry exports use the same definitions. New curved shells and holed parts export as meshes in Rhino, preserving cavities; they are not advertised as editable native NURBS solids.

## Six added families

| Family | Parameters and structure |
| --- | --- |
| Drafting table | Width, depth, working height, tilt, shelf; sloping top, paper stop, frame and tilt supports |
| Studio stool | Seat height/diameter, footrest height, backrest; four legs and ring footrest |
| Modular workstation | Module count/width/depth, desk height, single/back-to-back rows, divider height; legs, cable trays and grommets |
| Pin-up panel | Width, height, panel count, casters; frame, feet and marker tray |
| Locker bank | Columns, compartment rows, width/depth/height, open view; partitions, shelves, handles, labels and vents |
| Bench / banquette | Length, depth, seat height, cushion count, optional back and back height; frame and split cushions |

All six are available through existing furniture categories, with English labels and rendered thumbnails. Their placement, selection, native parameter edits, Undo and persistence follow the same Workbench flow. Existing Mass outline, Rectangle mass and Neighbour building illustrations are preserved.

## Validation

`tests/furniture-parameters.mjs` checks all 45 families across 623 boundary/option combinations, visible parameter effects, exact counts, bed symmetry, basin layout, serialization and invalid inputs. `tests/furniture-geometry.cjs` builds 135 default/min/max Three.js meshes, checks finite coordinates/normals/indices and bounds, raycasts into cavities, and verifies OBJ/DAE/DXF/STL plus Rhino export/reopen. `tests/furniture-workbench.cjs` exercises the six library additions in Plan and Perspective, native bed width editing, shared geometry, Undo and reload. `tools/render-furniture-thumbnails.cjs` reproduces all 45 library images from default parameters.

People, pets and other scale-reference families remain schematic; their parameter boundaries are checked, but this release does not turn them into realistic character or vehicle assets. Construction details are design geometry, not manufacturer specifications, acoustic properties, structural engineering or compliance claims. Further candidates include independent task lights, teaching lecterns and accessible washroom accessories.
