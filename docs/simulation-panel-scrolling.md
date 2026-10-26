# Simulation panels: continuous scrolling

Settings and Export share the left panel, in document order. Their header buttons jump to a section without switching pages or hiding controls. Wheel, trackpad, touch and keyboard scrolling use the native scroll container. Content is not scaled to fit the viewport. Expanded settings and input values are preserved on resize.

The right panel retains Results and Charts tabs, with native scrolling for long content. Previous/Next pagination and automatic height-based accordion closing are removed. Solar chart canvases retain a usable natural height.

Verification: `tests/simulation-panel-scroll.cjs` checks the 18 simulation routes (including nested Stormwater) at 1280×600, 1440×900 and 1024×650, section jumps, native scrolling, input/disclosure preservation, and absence of pagination. It also runs Sun Hours, saves a result, exports a PNG and checks chart access and unchanged numeric results. Test weather and access grants are isolated fixtures; production data is unchanged.
