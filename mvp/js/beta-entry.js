// Prevent ordinary direct/legacy engine entry from skipping the beta access page.
(function () {
  'use strict';
  const script = document.currentScript, feature = script.dataset.feature, shell = new URL('../index.html', script.src);
  const free = id => ["sunhours", "radiation", "utci", "daylight", "wind", "vent", "stormwater", "acoustics", "spacesyntax", "movementdepth", "evac", "isovist", "views", "wayfinding", "privacy", "cameras", "structure", "climate", "passive", "skyview", "shadebenefit", "solarenvelope"].includes(id);
  function allowed(id) { if (free(id)) return true; try { return window.parent !== window && window.parent.location.origin === location.origin && window.parent.PlotCloudBetaAccess?.allows(id) === true; } catch { return false; } }
  function open(id) { const route = id.startsWith('resource:') ? '#/resources/tool/' + encodeURIComponent(id.slice(9)) : '#/simulations/' + encodeURIComponent(id); const target = shell.href + route; try { window.top.location.href = target; } catch { location.replace(target); } }
  window.PlotCloudEntryAccess = Object.freeze({ allows: allowed, open });
  if (!allowed(feature)) { document.documentElement.style.visibility = 'hidden'; open(feature); }
  else if (!free(feature)) { const timer = setInterval(() => { if (!allowed(feature)) { clearInterval(timer); document.documentElement.style.visibility = 'hidden'; open(feature); } }, 15000); }
})();
