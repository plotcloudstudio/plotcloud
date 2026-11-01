// A shared apartment footprint with explicit design changes, for the Home demo.
// This drawing and its colour field are schematic, never exported as engine evidence.
export function comparisonPlan(variant) {
  const open = variant === 'B', id = `lpPlan${variant}`;
  const rect = (x,y,w,h,r=2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  const bed = (x,y,w) => `<g>${rect(x,y,w,66,3)}${rect(x+4,y+4,w-8,16,2)}<path d="M${x} ${y+25}h${w}"/>${rect(x-15,y+3,11,14)}${rect(x+w+4,y+3,11,14)}</g>`;
  const plant = (x,y) => `<g transform="translate(${x} ${y})"><circle r="8"/><path d="M-5 0H5M0-5V5M-4-4L4 4M-4 4L4-4"/></g>`;
  const door = (x,y,flip=1) => `<path d="M${x} ${y}v-26m0 26a26 26 0 0 ${flip===1?1:0} ${26*flip}-26"/>`;
  const fixedWalls = 'M50 169V40H550V350H50V195 M235 40V155 M385 40V155 M50 155H175 M205 155H300 M330 155H455 M485 155H550 M410 288H550 M410 288V308 M410 337V350';
  const changedWalls = open ? '' : 'M280 198V241 M280 273V350 M410 198V226 M410 256V288';
  const windows = `M50 212V${open?328:265} M78 40H195 M265 40H353 M420 40H${open?524:484} M550 211V266`;
  return `<svg viewBox="0 0 600 400" aria-hidden="true">
    <defs>
      <linearGradient id="${id}Light" x2="1" y2=".45"><stop stop-color="#fff0ad"/><stop offset="${open?'.65':'.32'}" stop-color="#87d7dc"/><stop offset="1" stop-color="#2862b7"/></linearGradient>
      <pattern id="${id}Grid" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="white" stroke-opacity=".3" stroke-width=".6"/></pattern>
    </defs>
    <path d="M50 40H550V350H50Z" fill="url(#${id}Light)"/>
    <path d="M50 40H550V350H50Z" fill="url(#${id}Grid)"/>
    <g fill="#ffffffed" stroke="#a2b2c2" stroke-width=".85">
      ${bed(106,61,65)}${bed(285,61,47)}${bed(439,61,47)}
      ${rect(57,48,24,91)}${rect(358,48,20,89)}${rect(519,48,24,89)}
      ${rect(190,58,34,18)}${rect(244,113,30,18)}${rect(393,112,29,18)}
      ${rect(210,81,12,14)}${rect(254,98,12,14)}${rect(402,97,12,14)}
      <g fill="#f4f7fa88">${rect(92,226,125,90,5)}</g>
      ${rect(78,219,93,25,4)}${rect(78,244,27,58,4)}${rect(125,264,50,27,5)}
      ${rect(197,241,24,30,4)}${rect(249,230,12,77)}
      <path d="M85 226H165M85 237H165M85 251V292"/>
      <g transform="translate(${open?308:329} 280)">
        ${rect(-21,-35,42,70,12)}
        ${[-23,0,23].map(y=>rect(-33,y-8,11,16,3)+rect(22,y-8,11,16,3)).join('')}
      </g>
      ${rect(417,203,126,22)}${rect(521,225,22,57)}
      ${rect(424,207,24,14)}<circle cx="475" cy="210" r="3"/><circle cx="486" cy="210" r="3"/><circle cx="475" cy="218" r="3"/><circle cx="486" cy="218" r="3"/>
      ${open?rect(372,240,29,72,3)+[251,274,297].map(y=>rect(354,y,13,14,3)).join(''):rect(418,253,55,23)}
      ${rect(507,296,35,45)}<path d="M507 296L542 341M542 296L507 341"/>
      ${rect(424,297,29,15)}<ellipse cx="438" cy="304" rx="8" ry="4"/>
      ${rect(469,296,20,12)}<ellipse cx="479" cy="319" rx="9" ry="13"/>
      ${plant(70,328)}${plant(530,177)}${plant(216,135)}
    </g>
    <g fill="none" stroke="white" stroke-width="9" stroke-linejoin="miter"><path d="${fixedWalls} ${changedWalls}"/></g>
    <g fill="none" stroke="#8e9faf" stroke-width="1"><path d="${fixedWalls} ${changedWalls}"/></g>
    <g fill="none" stroke="#91a7bc" stroke-width=".8">
      <path d="M50 195h26a26 26 0 0 0-26-26"/>${door(175,155)}${door(300,155)}${door(455,155)}
      <path d="M410 337h29a29 29 0 0 0-29-29"/>
      ${open?'': '<path d="M280 273h32a32 32 0 0 0-32-32 M410 256h30a30 30 0 0 0-30-30"/>'}
    </g>
    <path d="${windows}" fill="none" stroke="#2f77bd" stroke-width="5"/><path d="${windows}" fill="none" stroke="#def7ff" stroke-width="2"/>
    ${open?'<path d="M280 202V338M406 202V279" fill="none" stroke="#245ba0" stroke-width="1.4" stroke-dasharray="4 4"/>':''}
    <g fill="#244360" font-family="Inter,system-ui,sans-serif" font-size="8" letter-spacing=".7">
      <text x="91" y="144">BEDROOM 01</text><text x="267" y="144">BEDROOM 02</text><text x="418" y="144">BEDROOM 03</text>
      <text x="255" y="181">HALL / ENTRY</text><text x="117" y="337">LIVING</text><text x="${open?286:307}" y="337">DINING</text><text x="449" y="246">KITCHEN</text>
      <text x="448" y="344">BATH</text>
    </g>
    <g fill="none" stroke="#99adbf" stroke-width=".7"><path d="M50 371H550M50 366V376M235 367V375M385 367V375M550 366V376"/></g>
    <text x="300" y="390" text-anchor="middle" fill="#71879b" font-family="ui-monospace,monospace" font-size="7" letter-spacing="1.5">SAME FOOTPRINT · THREE-BEDROOM APARTMENT</text>
  </svg>`;
}
