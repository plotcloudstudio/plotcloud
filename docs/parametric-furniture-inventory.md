# Parametric library review

Reviewed against `furniture/models.js` on 2026-10-27. The library currently contains 39 parametric model families across 12 groups. This includes people, pets, vehicles, plants and accessories; it is not a count of 39 furniture types.

| Existing group | Families |
| --- | --- |
| Bedroom | Bed, Nightstand, Wardrobe, Dresser |
| Living | Sofa, Sectional sofa, Armchair, Coffee table, Side table, TV stand, Bookshelf |
| Dining & Office | Dining table, Dining chair, Computer desk, Office chair |
| Kitchen | Kitchen cabinets, Kitchen island, Refrigerator, Range, Washer / dryer |
| Bathroom | Toilet, Bathroom vanity, Bathtub, Shower |
| Outdoor & Fence | Balcony railing, Backyard fence |
| People | Adult, Elderly, Child, Wheelchair user |
| Pets | Cat, Dog |
| Vehicles | Car, Bicycle |
| Decor | Picture frame, Mirror |
| Plants | Potted plant, Tree |
| Entry | Shoe cabinet |

## Recommended next additions

Prioritize complete studio, classroom and shared-workspace layouts for architecture/design students and institutional users. These are proposed additions, not shipped models.

| Priority | Proposed family | Useful parameters | Reason |
| --- | --- | --- | --- |
| 1 | Studio / drafting table | Width, depth, working height, top tilt, storage shelf | Existing Computer desk supports only 680–760 mm height and has no tilted top. |
| 1 | Studio / counter stool | Seat height, seat diameter, backrest, footrest height | Current chairs cover ordinary desk/dining heights. Island stools are generated inside the island family and are not independently placeable families. |
| 1 | Modular workstation | Module count, desktop width/depth, arrangement, divider height | Supports repeatable studio and office layouts while keeping each module predictable. |
| 1 | Pin-up / exhibition panel | Width, height, thickness, panel count, base or wheels | Supports critique, exhibition and review-space planning. |
| 2 | Locker bank | Columns, rows, module width/depth/height, base | Adds school and shared-workspace storage without duplicating a domestic wardrobe. |
| 2 | Bench / banquette | Length, seat depth/height, backrest, corner return | Adds circulation, waiting and informal-review seating. |

Extend the existing Dining table with linked chair count and spacing before creating a separate generic meeting-table duplicate. Existing Sofa, Sectional sofa, Bookshelf, Wardrobe, Kitchen island and fences already expose relevant dimension/count options; do not present these as missing capabilities.

Every new family should include a recognizable thumbnail, English names and parameter labels, actual geometry for both Plan and Perspective, consistent units and insertion point, selection/Gumball support, Undo, persistence and export. Geometry must remain tied to its saved parameters. Physical properties such as acoustic absorption, structural resistance or compliance require separate analysis definitions and evidence; visual geometry alone does not establish them.

## Icons fixed in this release

Added the three missing tool-card illustrations: Mass outline, Rectangle mass and Neighbour building. Proposed massing uses the existing warm mass palette; surroundings use grey context buildings. The icons retain the existing tile size and text labels.
