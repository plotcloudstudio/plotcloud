import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshBVH } from "three-mesh-bvh";
// Geometry sampling retained from the original Sun Hours engine. Z up, metres.
function julian0(y, m, d) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100),
    B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    d +
    B -
    1524.5
  );
}
function sunPos(y, m, d, hourStd, lat, lon, tz) {
  const T = (julian0(y, m, d) + (hourStd - tz) / 24 - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360,
    M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * D2R) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * D2R) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * D2R) * 0.000289;
  const om = 125.04 - 1934.136 * T,
    lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * D2R);
  const eps =
    23 +
    (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 +
    0.00256 * Math.cos(om * D2R);
  const decl = Math.asin(Math.sin(eps * D2R) * Math.sin(lam * D2R)),
    yv = Math.tan((eps * D2R) / 2) ** 2;
  const eot =
    (4 / D2R) *
    (yv * Math.sin(2 * L0 * D2R) -
      2 * e * Math.sin(M * D2R) +
      4 * e * yv * Math.sin(M * D2R) * Math.cos(2 * L0 * D2R) -
      0.5 * yv * yv * Math.sin(4 * L0 * D2R) -
      1.25 * e * e * Math.sin(2 * M * D2R));
  let tst = (hourStd * 60 + eot + 4 * lon - 60 * tz) % 1440;
  if (tst < 0) tst += 1440;
  const ha = (tst / 4 - 180) * D2R,
    la = lat * D2R;
  const cz = Math.min(
    1,
    Math.max(
      -1,
      Math.sin(la) * Math.sin(decl) +
        Math.cos(la) * Math.cos(decl) * Math.cos(ha),
    ),
  );
  return {
    alt: 90 - Math.acos(cz) / D2R,
    az:
      (Math.atan2(
        Math.sin(ha),
        Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la),
      ) /
        D2R +
        540) %
      360,
  };
}
// Daylight saving rules: 1 North America (2nd Sun Mar to 1st Sun Nov), 2 Europe (last Sun Mar to last Sun Oct), 3 Australia south (1st Sun Oct to 1st Sun Apr), 4 New Zealand (last Sun Sep to 1st Sun Apr)
function isDST(y, m, d, mode) {
  const sun = (mm, nth) => {
    const first = new Date(Date.UTC(y, mm - 1, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (nth - 1) * 7;
  };
  const last = (mm) => {
    const n = new Date(Date.UTC(y, mm, 0)).getUTCDate(),
      dow = new Date(Date.UTC(y, mm - 1, n)).getUTCDay();
    return n - dow;
  };
  const v = m * 100 + d;
  if (mode === 1) return v >= 300 + sun(3, 2) && v < 1100 + sun(11, 1);
  if (mode === 2) return v >= 300 + last(3) && v < 1000 + last(10);
  if (mode === 3) return v >= 1000 + sun(10, 1) || v < 400 + sun(4, 1);
  if (mode === 4) return v >= 900 + last(9) || v < 400 + sun(4, 1);
  return false;
}

function readScene(j) {
  if (!j || j.format !== "plotcloud-scene" || !Array.isArray(j.masses))
    throw new Error(
      "This JSON is not a PlotCloud scene. Send the model from Plan Studio or Site Context, or open a 3D file.",
    );
  const geoms = [],
    roles = [],
    refs = [];
  let skipped = 0;
  for (const m of j.masses) {
    if (!Array.isArray(m.outer) || m.outer.length < 3 || !(m.h > m.base)) {
      skipped++;
      continue;
    }
    const sh = new THREE.Shape(
      m.outer.map((p) => new THREE.Vector2(p[0], p[1])),
    );
    for (const hr of m.holes || [])
      sh.holes.push(
        new THREE.Path(hr.map((p) => new THREE.Vector2(p[0], p[1]))),
      );
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: m.h - m.base,
      bevelEnabled: false,
    });
    g.translate(0, 0, m.base);
    geoms.push(g);
    roles.push(m.role === "context" ? "context" : "proposed");
    refs.push(m);
  }
  if (j.terrain && Array.isArray(j.terrain.pts) && j.terrain.nx > 1) {
    const T = j.terrain,
      P = [],
      idx = [];
    for (const p of T.pts) P.push(p[0], p[1], p[2]);
    for (let jj = 0; jj < T.ny - 1; jj++)
      for (let i = 0; i < T.nx - 1; i++) {
        const a = jj * T.nx + i,
          b = a + 1,
          c = a + T.nx + 1,
          d = a + T.nx;
        idx.push(a, b, c, a, c, d);
      }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    tg.setIndex(idx);
    geoms.push(tg);
    roles.push("terrain");
    refs.push(null);
  }
  if (!geoms.length) throw new Error("This scene has no masses with a height.");
  return {
    geoms,
    roles,
    refs,
    up: "z",
    unit: 1,
    unitKnown: true,
    scene: j,
    warn: skipped
      ? `${skipped} mass${skipped > 1 ? "es" : ""} without a valid height were skipped.`
      : "",
  };
}
function buildModel() {
  const parts = S.raw.geoms.map((g) => {
    const c = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(c.attributes))
      if (k !== "position") c.deleteAttribute(k);
    return c;
  });
  const geom = mergeGeometries(parts, false);
  geom.scale(S.unit, S.unit, S.unit);
  if (S.up === "y") geom.rotateX(Math.PI / 2);
  geom.computeBoundingBox();
  const b = geom.boundingBox,
    c = b.getCenter(new THREE.Vector3());
  geom.translate(-c.x, -c.y, -b.min.z);
  geom.computeBoundingBox();
  geom.computeVertexNormals();
  const pos = geom.attributes.position.array.slice(); // keep triangle order before the BVH reindexes
  // roles per triangle (merge keeps the parts in order): 0 measured · 1 shadows only · 2 terrain
  let role = null,
    sbox = null,
    circ = null,
    own = null;
  if (S.raw.roles) {
    role = new Uint8Array(pos.length / 9);
    own = S.raw.refs ? new Int32Array(pos.length / 9) : null;
    let k = 0;
    S.raw.geoms.forEach((g0, gi) => {
      const n = (g0.index ? g0.index.count : g0.attributes.position.count) / 3,
        rr =
          S.raw.roles[gi] === "context"
            ? 1
            : S.raw.roles[gi] === "terrain"
              ? 2
              : 0;
      role.fill(rr, k, k + n);
      if (own) own.fill(gi, k, k + n);
      k += n;
    });
    const sh = [-c.x, -c.y, -b.min.z];
    sbox = new THREE.Box3();
    for (let i = 0; i < role.length; i++)
      if (role[i] === 0)
        for (let v = 0; v < 3; v++)
          sbox.expandByPoint(
            new THREE.Vector3(
              pos[i * 9 + v * 3],
              pos[i * 9 + v * 3 + 1],
              pos[i * 9 + v * 3 + 2],
            ),
          );
    if (sbox.isEmpty()) {
      sbox = null;
      const an = S.raw.scene && S.raw.scene.analysis;
      if (an) circ = { x: an.cx + sh[0], y: an.cy + sh[1], r: an.r };
    }
  }
  const bvh = new MeshBVH(geom);
  S.model = {
    geom,
    pos,
    bvh,
    box: geom.boundingBox.clone(),
    tris: pos.length / 9,
    role,
    sbox,
    circ,
    own,
  };
  S.modelVer++;
  PREP = null;
  modelGroup.clear();
  const mesh = new THREE.Mesh(geom, modelMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  modelGroup.add(mesh);
  modelGroup.add(
    new THREE.LineSegments(new THREE.EdgesGeometry(geom, 25), edgeMat),
  );
  const sz = S.model.box.getSize(new THREE.Vector3());
  S.R = Math.max(sz.x, sz.y) * 0.5 + 20;
  ground.geometry.dispose();
  ground.geometry = new THREE.PlaneGeometry(S.R * 4, S.R * 4);
  ground.position.z = -0.03;
  const span = S.R * 2;
  Object.assign(sun.shadow.camera, {
    left: -span,
    right: span,
    top: span,
    bottom: -span,
    near: 0.1,
    far: S.R * 12,
  });
  sun.shadow.camera.updateProjectionMatrix();
}
function measureBox() {
  const m = S.model;
  if (m.sbox) return m.sbox;
  if (m.circ)
    return new THREE.Box3(
      new THREE.Vector3(m.circ.x - m.circ.r, m.circ.y - m.circ.r, 0),
      new THREE.Vector3(m.circ.x + m.circ.r, m.circ.y + m.circ.r, m.box.max.z),
    );
  return m.box;
}
const sampled = (i, P, mb, margin) => {
  const r = S.model.role;
  if (!r) return true;
  if (r[i] === 1) return false;
  if (r[i] === 2) {
    const x = (P[i * 9] + P[i * 9 + 3] + P[i * 9 + 6]) / 3,
      y = (P[i * 9 + 1] + P[i * 9 + 4] + P[i * 9 + 7]) / 3;
    if (S.model.circ)
      return (
        Math.hypot(x - S.model.circ.x, y - S.model.circ.y) <= S.model.circ.r
      );
    return (
      x > mb.min.x - margin &&
      x < mb.max.x + margin &&
      y > mb.min.y - margin &&
      y < mb.max.y + margin
    );
  }
  return true;
};
async function prepare(token, onProg) {
  const key = [S.modelVer, S.grid, S.ground, S.margin].join("|");
  if (PREP && PREP.key === key) return PREP;
  const { bvh, box: whole, pos: P } = S.model,
    box = measureBox();
  const LIMIT = S.fineOK === S.grid ? HARD_PTS : SAFE_PTS;
  let s = S.grid;
  const nTri = P.length / 9,
    sz = box.getSize(new THREE.Vector3());
  const tri = (i, k, v) =>
    v.set(P[i * 9 + k * 3], P[i * 9 + k * 3 + 1], P[i * 9 + k * 3 + 2]);
  const margin = S.model.circ
    ? 0
    : S.margin === "auto"
      ? Math.min(60, Math.max(10, sz.z * 1.5))
      : +S.margin;
  const gx0 = box.min.x - margin,
    gx1 = box.max.x + margin,
    gy0 = box.min.y - margin,
    gy1 = box.max.y + margin;
  const A = new THREE.Vector3(),
    B = new THREE.Vector3(),
    C = new THREE.Vector3();
  const estimate = (sp) => {
    let n = 0;
    for (let i = 0; i < nTri; i++) {
      if (!sampled(i, P, box, margin)) continue;
      tri(i, 0, A);
      tri(i, 1, B);
      tri(i, 2, C);
      const k = Math.max(
        1,
        Math.ceil(
          Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)) / sp,
        ),
      );
      n += k * k;
    }
    if (S.ground) n += ((gx1 - gx0) / sp) * ((gy1 - gy0) / sp);
    return n;
  };
  let est = estimate(s),
    guard = 0;
  while (est > LIMIT && guard++ < 12) {
    s *= Math.sqrt(est / LIMIT) * 1.05;
    est = estimate(s);
  }
  const ray = new THREE.Ray(),
    eps = 0.02;
  const smpP = [],
    smpN = [],
    smpA = [],
    smpK = [],
    outPos = [],
    outSmp = [];
  const n = new THREE.Vector3(),
    g = new THREE.Vector3(),
    ab = new THREE.Vector3(),
    ac = new THREE.Vector3(),
    o = new THREE.Vector3(),
    nn = new THREE.Vector3();
  const hits = (orig, d) =>
    bvh.raycast(ray.set(orig, d), THREE.DoubleSide).length;
  let flipped = 0,
    last = performance.now();
  for (let i = 0; i < nTri; i++) {
    if (!sampled(i, P, box, margin)) continue;
    tri(i, 0, A);
    tri(i, 1, B);
    tri(i, 2, C);
    ab.subVectors(B, A);
    ac.subVectors(C, A);
    n.crossVectors(ab, ac);
    const area2 = n.length();
    if (area2 < 1e-8) continue;
    n.divideScalar(area2);
    if (n.z < -0.9 && Math.max(A.z, B.z, C.z) < 0.05) continue; // bottom faces resting on the ground
    g.addVectors(A, B).add(C).divideScalar(3);
    // a face whose normal points into a closed volume is turned outward (odd hits one way, even the other)
    const up = hits(o.copy(g).addScaledVector(n, eps), n),
      down = hits(o.copy(g).addScaledVector(n, -eps), nn.copy(n).negate());
    if (up % 2 === 1 && down % 2 === 0) {
      n.negate();
      flipped++;
    }
    const k = Math.max(
        1,
        Math.ceil(Math.max(ab.length(), ac.length(), B.distanceTo(C)) / s),
      ),
      subA = area2 / 2 / (k * k);
    const pt = (u, v) => [
      A.x + (ab.x * u) / k + (ac.x * v) / k,
      A.y + (ab.y * u) / k + (ac.y * v) / k,
      A.z + (ab.z * u) / k + (ac.z * v) / k,
    ];
    const addSub = (p0, p1, p2) => {
      if (S.model.role) {
        o.set(
          (p0[0] + p1[0] + p2[0]) / 3 + n.x * eps,
          (p0[1] + p1[1] + p2[1]) / 3 + n.y * eps,
          (p0[2] + p1[2] + p2[2]) / 3 + n.z * eps,
        );
        if (hits(o, n) % 2 === 1) return;
      } // the sample point lies inside another solid: a face pressed against it
      const idx = smpP.length / 3;
      smpP.push(
        (p0[0] + p1[0] + p2[0]) / 3 + n.x * eps,
        (p0[1] + p1[1] + p2[1]) / 3 + n.y * eps,
        (p0[2] + p1[2] + p2[2]) / 3 + n.z * eps,
      );
      smpN.push(n.x, n.y, n.z);
      smpA.push(subA);
      smpK.push(n.z > 0.7 ? 1 : n.z < -0.7 ? 3 : 2);
      outPos.push(...p0, ...p1, ...p2);
      outSmp.push(idx);
    };
    for (let u = 0; u < k; u++)
      for (let v = 0; v < k - u; v++) {
        addSub(pt(u, v), pt(u + 1, v), pt(u, v + 1));
        if (v < k - u - 1) addSub(pt(u + 1, v), pt(u + 1, v + 1), pt(u, v + 1));
      }
    if (performance.now() - last > 30) {
      onProg((0.75 * i) / nTri);
      await frame();
      if (token !== runToken) return null;
      last = performance.now();
    }
  }
  if (S.ground) {
    const nx = Math.max(1, Math.round((gx1 - gx0) / s)),
      ny = Math.max(1, Math.round((gy1 - gy0) / s)),
      dx = (gx1 - gx0) / nx,
      dy = (gy1 - gy0) / ny;
    const upV = new THREE.Vector3(0, 0, 1);
    for (let a = 0; a < nx; a++) {
      for (let b = 0; b < ny; b++) {
        const x0 = gx0 + a * dx,
          y0 = gy0 + b * dy,
          cx = x0 + dx / 2,
          cy = y0 + dy / 2;
        // skip ground cells under closed volumes
        if (
          S.model.circ &&
          Math.hypot(cx - S.model.circ.x, cy - S.model.circ.y) > S.model.circ.r
        )
          continue;
        if (
          cx > whole.min.x - s &&
          cx < whole.max.x + s &&
          cy > whole.min.y - s &&
          cy < whole.max.y + s &&
          hits(o.set(cx, cy, eps), upV) % 2 === 1
        )
          continue;
        const idx = smpP.length / 3;
        smpP.push(cx, cy, eps);
        smpN.push(0, 0, 1);
        smpA.push(dx * dy);
        smpK.push(0);
        outPos.push(
          x0,
          y0,
          0,
          x0 + dx,
          y0,
          0,
          x0 + dx,
          y0 + dy,
          0,
          x0,
          y0,
          0,
          x0 + dx,
          y0 + dy,
          0,
          x0,
          y0 + dy,
          0,
        );
        outSmp.push(idx, idx);
      }
      if (performance.now() - last > 30) {
        onProg(0.75 + (0.25 * a) / nx);
        await frame();
        if (token !== runToken) return null;
        last = performance.now();
      }
    }
  }
  PREP = {
    key,
    smpP: new Float32Array(smpP),
    smpN: new Float32Array(smpN),
    smpA,
    smpK,
    outPos: new Float32Array(outPos),
    outSmp,
    s,
    flipped,
    margin,
  };
  return PREP;
}

const $ = (s) => document.querySelector(s),
  D2R = Math.PI / 180,
  APP_ORIGIN = new URL(document.baseURI).origin;
const S = {
  raw: null,
  unit: 1,
  up: "z",
  north: 0,
  modelVer: 0,
  model: null,
  grid: 2,
  ground: true,
  margin: 20,
  date: $("#date").value,
  view: "plan",
  R: 50,
  loc: null,
};
const SAFE_PTS = 50000,
  HARD_PTS = 50000;
let PREP = null,
  runToken = 0,
  result = null,
  pending = false,
  project = null,
  signature = "",
  lastScene = null;
const stage = $("#stage"),
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.append(renderer.domElement);
const scene = new THREE.Scene(),
  root = new THREE.Group();
root.rotation.x = -Math.PI / 2;
scene.add(root);
const modelGroup = new THREE.Group(),
  overlay = new THREE.Group(),
  contours = new THREE.Group();
root.add(modelGroup, overlay, contours);
const modelMat = new THREE.MeshStandardMaterial({
    color: 0xe4e2dc,
    roughness: 1,
    side: THREE.DoubleSide,
  }),
  edgeMat = new THREE.LineBasicMaterial({
    color: 0x64666b,
    transparent: true,
    opacity: 0.35,
  });
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0xe9e8e3, roughness: 1 }),
);
ground.receiveShadow = true;
root.add(ground);
const sun = new THREE.DirectionalLight(0xfff3dc, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.00015;
sun.shadow.normalBias = 0.2;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x686868, 1.2);
scene.add(hemi);
const camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 10000),
  controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableRotate = false;
const frame = () => new Promise((r) => setTimeout(r, 0));
const northVec = () =>
  new THREE.Vector3(Math.sin(S.north * D2R), Math.cos(S.north * D2R), 0);
const sunVec = (alt, az) => {
  const n = northVec(),
    e = new THREE.Vector3(n.y, -n.x, 0),
    c = Math.cos(alt * D2R);
  return n
    .multiplyScalar(c * Math.cos(az * D2R))
    .addScaledVector(e, c * Math.sin(az * D2R))
    .add(new THREE.Vector3(0, 0, Math.sin(alt * D2R)))
    .normalize();
};
const toThree = (v) => new THREE.Vector3(v.x, v.z, -v.y);
function sunAt(minutes) {
  const [y, m, d] = S.date.split("-").map(Number);
  return sunPos(
    y,
    m,
    d,
    minutes / 60 - (isDST(y, m, d, S.loc.dst) ? 1 : 0),
    S.loc.lat,
    S.loc.lon,
    S.loc.tz,
  );
}
function theme() {
  scene.background = new THREE.Color(
    getComputedStyle(document.documentElement)
      .getPropertyValue("--view")
      .trim() || "#e9ecef",
  );
}
new MutationObserver(theme).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme", "data-pc-theme"],
});
theme();
function fit() {
  const b = S.model?.box,
    sz = b ? b.getSize(new THREE.Vector3()) : new THREE.Vector3(40, 40, 20),
    target = new THREE.Vector3(0, sz.z * 0.2, 0),
    aspect = stage.clientWidth / Math.max(1, stage.clientHeight),
    half = Math.max(sz.x, sz.y, sz.z) * 0.65 + 20;
  camera.left = -half * Math.max(1, aspect);
  camera.right = -camera.left;
  camera.top = half / Math.min(1, aspect);
  camera.bottom = -camera.top;
  camera.zoom = 1;
  camera.up.set(0, 1, 0);
  let dir;
  if (S.view === "plan") {
    dir = new THREE.Vector3(0, 1, 0);
    camera.up.copy(toThree(northVec()));
  } else if (S.view === "sun" && S.loc) {
    const p = sunAt(+$("#time").value);
    dir = toThree(sunVec(Math.max(0.5, p.alt), p.az));
  } else dir = new THREE.Vector3(-1, 1, 1).normalize();
  camera.position.copy(target).addScaledVector(dir, 3000);
  controls.target.copy(target);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  controls.update();
}
function resize() {
  renderer.setSize(
    Math.max(1, stage.clientWidth),
    Math.max(1, stage.clientHeight),
    false,
  );
  fit();
}
new ResizeObserver(resize).observe(stage);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
const COLORS = [
  [43, 45, 110],
  [52, 112, 184],
  [78, 176, 160],
  [236, 201, 75],
  [233, 106, 54],
];
function color(h) {
  const t = Math.min(4, Math.max(0, h / 2)),
    i = Math.min(3, Math.floor(t)),
    f = t - i;
  // Vertex attributes are linear; the legend's RGB stops are sRGB.
  const rgb = COLORS[i].map((v, k) => (v + (COLORS[i + 1][k] - v) * f) / 255);
  return new THREE.Color(...rgb).convertSRGBToLinear().toArray();
}
function clearGroup(g) {
  for (const c of [...g.children]) {
    c.geometry?.dispose();
    c.material?.dispose();
    g.remove(c);
  }
}
function currentDirection() {
  const p = sunAt(+$("#time").value),
    d = sunVec(Math.max(0.5, p.alt), p.az);
  sun.position.copy(toThree(d).multiplyScalar(S.R * 4));
  sun.intensity = p.alt > 0 ? 2.3 : 0;
  hemi.intensity = S.view === "sun" ? 0.35 : 1.2;
  return { p, d };
}
function litAt(prep, minute) {
  const p = sunAt(minute),
    lit = new Uint8Array(prep.smpA.length);
  if (p.alt <= 0) return lit;
  const d = sunVec(p.alt, p.az),
    ray = new THREE.Ray(),
    o = new THREE.Vector3(),
    n = new THREE.Vector3();
  for (let k = 0; k < lit.length; k++) {
    o.fromArray(prep.smpP, k * 3);
    n.fromArray(prep.smpN, k * 3);
    if (
      n.dot(d) > 0 &&
      !S.model.bvh.raycastFirst(ray.set(o, d), THREE.DoubleSide)
    )
      lit[k] = 1;
  }
  return lit;
}
function included(k, p) {
  return p.smpK[k] !== 3 && ($("#facades").checked || p.smpK[k] !== 2);
}
// Mutually exclusive, true-north spatial ground partitions; not semantic room inference.
function zoneAt(x, y) {
  const n = northVec(),
    east = x * n.y - y * n.x,
    north = x * n.x + y * n.y,
    sz = measureBox().getSize(new THREE.Vector3());
  if (Math.abs(east) < sz.x * 0.22 && Math.abs(north) < sz.y * 0.22) return 0;
  if (north > 0) return 3;
  return east >= 0 ? 1 : 2;
}
function aggregate(R) {
  const p = R.prep,
    groups = Array.from({ length: 4 }, () => ({
      area: 0,
      sum: 0,
      max: 0,
      two: 0,
    }));
  let area = 0,
    sum = 0,
    max = 0,
    two = 0,
    current = 0;
  for (let k = 0; k < R.hours.length; k++) {
    if (!included(k, p)) continue;
    const a = p.smpA[k],
      h = R.hours[k];
    area += a;
    sum += a * h;
    max = Math.max(max, h);
    if (h >= 2) two += a;
    if (R.current[k]) current += a;
    if (p.smpK[k] !== 0) continue;
    const z = groups[zoneAt(p.smpP[k * 3], p.smpP[k * 3 + 1])];
    z.area += a;
    z.sum += a * h;
    z.max = Math.max(z.max, h);
    if (h >= 2) z.two += a;
  }
  return {
    mean: area ? sum / area : 0,
    max,
    two: area ? (100 * two) / area : 0,
    current: area ? (100 * current) / area : 0,
    zones: groups.map((z, i) => ({
      name: ["Courtyard", "SE", "SW", "North strip"][i],
      mean: z.area ? z.sum / z.area : null,
      max: z.area ? z.max : null,
      two: z.area ? (100 * z.two) / z.area : null,
    })),
    hourly: R.hourly.map((L) => {
      let a = 0,
        t = 0;
      for (let k = 0; k < L.length; k++)
        if (included(k, p)) {
          t += p.smpA[k];
          if (L[k]) a += p.smpA[k];
        }
      return t ? a / t : 0;
    }),
  };
}
function fmt(v, unit = "h") {
  return v == null ? "—" : v.toFixed(unit === "%" ? 0 : 1) + unit;
}
function tableRows(data) {
  return data.zones
    .map(
      (z) =>
        `<tr><td>${z.name}</td><td>${fmt(z.mean)}</td><td>${fmt(z.max)}</td><td>${fmt(z.two, "%")}</td></tr>`,
    )
    .join("");
}
function panel() {
  const data = result?.data;
  $("#metrics").innerHTML = [
    ["Mean sunlight", fmt(data?.mean ?? null)],
    ["Maximum", fmt(data?.max ?? null)],
    ["Area ≥2h", fmt(data?.two ?? null, "%")],
    ["Sunlit now", fmt(data?.current ?? null, "%")],
  ]
    .map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`)
    .join("");
  $("#zones").innerHTML = data
    ? tableRows(data)
    : ["Courtyard", "SE", "SW", "North strip"]
        .map((n) => `<tr><td>${n}</td><td>—</td><td>—</td><td>—</td></tr>`)
        .join("");
  $("#hourly").innerHTML = Array.from(
    { length: 15 },
    (_, i) =>
      `<button data-hour="${i + 6}" aria-label="${i + 6}:00 · ${Math.round((data?.hourly[i] || 0) * 100)}% sunlit" aria-pressed="${Math.floor(+$("#time").value / 60) === i + 6}"><i style="height:${Math.max(2, (data?.hourly[i] || 0) * 65)}px"></i><span>${i + 6}</span></button>`,
  ).join("");
  $("#resultPeriod").textContent =
    `${S.date} · accumulated 06:00–${clock(+$("#time").value)}`;
}
const clock = (t) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
function draw() {
  clearGroup(overlay);
  clearGroup(contours);
  if (!result) return;
  const R = result,
    p = R.prep,
    positions = [],
    colors = [],
    linePoints = [];
  const sunView = S.view === "sun";
  currentDirection();
  for (let f = 0; f < p.outSmp.length; f++) {
    const k = p.outSmp[f],
      kind = p.smpK[k];
    if (!included(k, p)) continue;
    let c = sunView
      ? R.current[k]
        ? [0.97, 0.91, 0.73]
        : [0.18, 0.2, 0.25]
      : color(R.hours[k]);
    const tri = Array.from(p.outPos.subarray(f * 9, f * 9 + 9));
    // In plan, project facade samples as thin exterior ribbons, preserving the sampled hours.
    if (S.view === "plan" && kind === 2) {
      const nx = p.smpN[k * 3],
        ny = p.smpN[k * 3 + 1];
      for (let v = 0; v < 3; v++) {
        tri[v * 3] += nx * tri[v * 3 + 2] * 0.065;
        tri[v * 3 + 1] += ny * tri[v * 3 + 2] * 0.065;
        tri[v * 3 + 2] = 0.08;
      }
    }
    positions.push(...tri);
    for (let v = 0; v < 3; v++) colors.push(...c);
    // Isolines are threshold boundaries obtained by interpolation between adjacent ground samples below.
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geom,
    sunView || S.view === "plan"
      ? new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
  );
  mesh.receiveShadow = !sunView;
  overlay.add(mesh);
  modelGroup.visible = true;
  ground.visible = true;
  if ($("#isolines").checked && !sunView) {
    const cells = new Map(),
      coords = [];
    for (let k = 0; k < R.hours.length; k++)
      if (p.smpK[k] === 0) {
        const x = p.smpP[k * 3],
          y = p.smpP[k * 3 + 1];
        cells.set(`${x.toFixed(3)},${y.toFixed(3)}`, k);
        coords.push(k);
      }
    const xs = [...new Set(coords.map((k) => p.smpP[k * 3]))].sort(
        (a, b) => a - b,
      ),
      ys = [...new Set(coords.map((k) => p.smpP[k * 3 + 1]))].sort(
        (a, b) => a - b,
      );
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const P = [
            [xs[i], ys[j]],
            [xs[i + 1], ys[j]],
            [xs[i + 1], ys[j + 1]],
            [xs[i], ys[j + 1]],
          ],
          K = P.map(([x, y]) => cells.get(`${x.toFixed(3)},${y.toFixed(3)}`));
        if (K.some((k) => k == null)) continue;
        for (const level of [1, 2, 3, 4, 5, 6, 7, 8]) {
          const hits = [];
          for (let a = 0; a < 4; a++) {
            const b = (a + 1) % 4,
              h0 = R.hours[K[a]],
              h1 = R.hours[K[b]];
            if (h0 < level !== h1 < level) {
              const t = (level - h0) / (h1 - h0);
              hits.push([
                P[a][0] + (P[b][0] - P[a][0]) * t,
                P[a][1] + (P[b][1] - P[a][1]) * t,
                0.06,
              ]);
            }
          }
          for (let a = 0; a + 1 < hits.length; a += 2)
            linePoints.push(...hits[a], ...hits[a + 1]);
        }
      }
    if (linePoints.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePoints, 3),
      );
      contours.add(
        new THREE.LineSegments(
          g,
          new THREE.LineBasicMaterial({
            color: 0x252b40,
            transparent: true,
            opacity: 0.6,
          }),
        ),
      );
    }
  }
  renderer.render(scene, camera);
}
async function calculate() {
  if (!S.model || !S.loc) return;
  const token = ++runToken;
  pending = true;
  $("#export").disabled = true;
  $("#status").textContent = "Calculating geometric visibility…";
  try {
    const prep = await prepare(token, () => {});
    if (!prep || token !== runToken) return;
    const key = [
      S.date,
      S.modelVer,
      prep.key,
      S.north,
      JSON.stringify(S.loc),
    ].join("|");
    if (!result || result.key !== key) {
      const hourly = [],
        steps = [];
      for (let t = 360; t <= 1200; t += 15) {
        steps.push(litAt(prep, t + 7.5));
        if ((t - 360) % 60 === 0) hourly.push(litAt(prep, t));
        if (t % 60 === 0) {
          await frame();
          if (token !== runToken) return;
        }
      }
      result = { key, prep, steps, hourly };
    }
    const hours = new Float32Array(prep.smpA.length),
      end = (+$("#time").value - 360) / 15;
    for (let j = 0; j < end; j++)
      for (let k = 0; k < hours.length; k++)
        hours[k] += result.steps[j][k] * 0.25;
    result.hours = hours;
    result.current = litAt(prep, +$("#time").value);
    result.data = aggregate(result);
    result.date = S.date;
    result.minute = +$("#time").value;
    draw();
    panel();
    $("#status").textContent =
      `${prep.s.toFixed(1)} m grid · ${hours.length.toLocaleString()} samples · 06:00–${clock(result.minute)}${prep.s > S.grid * 1.01 ? " · grid widened for browser capacity" : ""}`;
    $("#export").disabled = false;
  } catch (e) {
    result = null;
    clearGroup(overlay);
    clearGroup(contours);
    panel();
    $("#status").textContent = "Analysis unavailable: " + e.message;
  } finally {
    if (token === runToken) pending = false;
  }
}
function update() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test($("#date").value)) return;
  S.date = $("#date").value;
  S.grid = +$("#grid").value;
  $("#clock").textContent = clock(+$("#time").value);
  document
    .querySelectorAll("[data-date]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.date === S.date.slice(5)),
      ),
    );
  if (S.view === "sun") fit();
  calculate();
}
for (const id of ["date", "grid", "facades", "isolines"])
  $("#" + id).addEventListener("change", update);
$("#time").addEventListener("input", update);
$("#calculate").onclick = update;
document.querySelectorAll("[data-date]").forEach(
  (b) =>
    (b.onclick = () => {
      $("#date").value = S.date.slice(0, 4) + "-" + b.dataset.date;
      update();
    }),
);
$("#hourly").onclick = (e) => {
  const b = e.target.closest("[data-hour]");
  if (b) {
    $("#time").value = +b.dataset.hour * 60;
    update();
  }
};
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      S.view = b.dataset.view;
      document
        .querySelectorAll("[data-view]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      fit();
      draw();
    }),
);
function collapse(on) {
  $(".study-grid").classList.toggle("collapsed", on);
  $("#toggleParameters").textContent = on
    ? "Show parameters"
    : "Hide parameters";
  $("#toggleParameters").setAttribute("aria-expanded", String(!on));
  $("#expandParameters").hidden = !on;
  resize();
}
$("#toggleParameters").onclick = () =>
  collapse(!$(".study-grid").classList.contains("collapsed"));
$("#expandParameters").onclick = () => collapse(false);
$("#reset").onclick = () => {
  $("#date").value = "2026-06-21";
  $("#time").value = 720;
  $("#grid").value = "2";
  $("#facades").checked = true;
  $("#isolines").checked = false;
  $("#exportLegend").checked = true;
  $("#exportTable").checked = true;
  $("#format").value = "PNG";
  $("#sheetSize").selectedIndex = 0;
  update();
};
function contextLine() {
  $("#context").textContent =
    `${project?.name || "No project"} · ${lastScene?.name || (project?.name && "Project model") || "No model"} · model, site & north from Account`;
}
function clearAccount(reason) {
  ++runToken;
  pending = false;
  result = null;
  signature = "";
  PREP = null;
  clearGroup(overlay);
  clearGroup(contours);
  if (S.model) S.model.geom.dispose();
  for (const c of modelGroup.children)
    if (c.isLineSegments) c.geometry.dispose();
  modelGroup.clear();
  if (S.raw) for (const g of S.raw.geoms) g.dispose();
  S.model = null;
  S.raw = null;
  S.loc = null;
  lastScene = null;
  $("#export").disabled = true;
  $("#empty").hidden = false;
  contextLine();
  panel();
  $("#status").textContent = reason;
}
async function accept(p, sceneData) {
  try {
    const sc =
      typeof sceneData === "string" ? JSON.parse(sceneData) : sceneData;
    const loc = p?.settings?.location || sc?.loc,
      north = p?.settings ? -(p.settings.north || 0) : sc?.north || 0;
    if (!sc || !loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) {
      project = p || null;
      clearAccount("Account model or site is missing.");
      return;
    }
    const sig = JSON.stringify([p?.id, p?.settings, sc]);
    if (sig === signature) return;
    signature = sig;
    ++runToken;
    result = null;
    clearGroup(overlay);
    clearGroup(contours);
    if (S.model) {
      S.model.geom.dispose();
      for (const c of modelGroup.children)
        if (c.isLineSegments) c.geometry.dispose();
    }
    if (S.raw) for (const g of S.raw.geoms) g.dispose();
    project = p || project;
    lastScene = sc;
    S.loc = {
      ...loc,
      tz: Number.isFinite(loc.tz) ? loc.tz : Math.round(loc.lon / 15),
      dst: loc.dst || 0,
    };
    S.north = north;
    S.raw = { ...readScene(sc), name: sc.name || p?.name || "Project model" };
    S.ground = !sc.terrain;
    S.unit = 1;
    S.up = "z";
    buildModel();
    contextLine();
    $("#empty").hidden = true;
    fit();
    await calculate();
  } catch (e) {
    clearAccount("Account model unavailable: " + e.message);
  }
}
function post(d) {
  if (parent !== window) parent.postMessage({ pc: 1, ...d }, APP_ORIGIN);
}
window.addEventListener("message", (e) => {
  if (e.source !== parent || e.origin !== APP_ORIGIN || !e.data?.pc) return;
  const d = e.data;
  if (d.t === "project-context") {
    project = d.project;
    contextLine();
    if (project?.scene) accept(project, project.scene);
    else clearAccount("No model saved in Account.");
  }
  if (d.t === "project" && d.scene) accept(project, d.scene);
});
async function loadAccount() {
  try {
    const db = await new Promise((resolve, reject) => {
      const q = indexedDB.open("pc-project", 1);
      q.onupgradeneeded = () => q.result.createObjectStore("kv");
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    const p = await new Promise((resolve, reject) => {
      const q = db.transaction("kv").objectStore("kv").get("cur");
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    db.close();
    if (p) await accept(p, p.sunScene || p.scene);
    else if (!S.model) {
      $("#empty").hidden = false;
      $("#status").textContent = "No project model saved in Account.";
    }
  } catch (e) {
    $("#status").textContent = "Account storage unavailable.";
  }
}
window.addEventListener("focus", () => {
  post({ t: "project-context-request" });
  loadAccount();
});
post({ t: "project-context-request" });
post({ t: "hello", tool: "Sun Hours", scene: true });
loadAccount();
$("#export").disabled = true;
panel();
resize();
// Export captures exactly the current result revision, view and selected sheet annotations.
$("#export").onclick = async () => {
  if ($("#format").value !== "PNG") {
    $("#exportStatus").textContent =
      `${$("#format").value} sheets are produced via Boards. This prototype downloads PNG only.`;
    return;
  }
  if (!result || pending) return;
  const R = result,
    data = structuredClone(R.data),
    [w, h] = $("#sheetSize").value.split("x").map(Number),
    withLegend = $("#exportLegend").checked,
    withTable = $("#exportTable").checked;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#20242b";
  ctx.font = "26px sans-serif";
  ctx.fillText("PlotCloud / Sunlight study", 40, 48);
  ctx.font = "13px sans-serif";
  ctx.fillText($("#context").textContent, 40, 75);
  ctx.fillText(
    `${R.date} · accumulated 06:00–${clock(R.minute)} · ${S.view} · ${R.prep.s.toFixed(1)} m grid`,
    40,
    99,
  );
  renderer.render(scene, camera);
  const right = withTable ? 340 : 0,
    availableW = w - 80 - right,
    availableH = h - 190,
    k = Math.min(
      availableW / renderer.domElement.width,
      availableH / renderer.domElement.height,
    ),
    dw = renderer.domElement.width * k,
    dh = renderer.domElement.height * k;
  ctx.drawImage(
    renderer.domElement,
    40 + (availableW - dw) / 2,
    120 + (availableH - dh) / 2,
    dw,
    dh,
  );
  if (withTable) {
    const x = w - 330;
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("Study data", x, 145);
    ctx.font = "13px sans-serif";
    [
      ["Mean sunlight", fmt(data.mean)],
      ["Maximum", fmt(data.max)],
      ["Area ≥2h", fmt(data.two, "%")],
      ["Sunlit now", fmt(data.current, "%")],
    ].forEach(([a, b], i) => ctx.fillText(a + "  " + b, x, 180 + i * 28));
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("Zone                 Mean      Max       ≥2h", x, 325);
    ctx.font = "12px monospace";
    data.zones.forEach((z, i) =>
      ctx.fillText(
        z.name.padEnd(13) +
          fmt(z.mean).padStart(6) +
          fmt(z.max).padStart(8) +
          fmt(z.two, "%").padStart(8),
        x,
        355 + i * 30,
      ),
    );
    ctx.font = "13px sans-serif";
    ctx.fillText("Hourly sunlit share · 06–20", x, 515);
    data.hourly.forEach((v, i) => {
      ctx.fillStyle =
        Math.floor(R.minute / 60) === i + 6 ? "#c7362c" : "#7f8a99";
      ctx.fillRect(x + i * 18, 600 - v * 65, 12, Math.max(1, v * 65));
      ctx.font = "9px monospace";
      ctx.fillText(String(i + 6), x + i * 18, 615);
    });
  }
  if (withLegend) {
    const x = 40,
      y = h - 75,
      len = Math.min(400, w - 80);
    const grad = ctx.createLinearGradient(x, 0, x + len, 0);
    COLORS.forEach((c, i) => grad.addColorStop(i / 4, `rgb(${c.join(",")})`));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, len, 12);
    ctx.fillStyle = "#404650";
    ctx.font = "12px sans-serif";
    for (let i = 0; i < 5; i++)
      ctx.fillText(i === 4 ? "8h+" : i * 2 + "h", x + (i * len) / 4, y + 30);
  }
  ctx.fillStyle = "#626c78";
  ctx.font = "11px sans-serif";
  ctx.fillText(
    "Geometry-based direct sun · Opaque surfaces · Early design screening",
    40,
    h - 12,
  );
  const filename = `plotcloud-sunhours-${R.date}-${clock(R.minute).replace(":", "")}.png`;
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  if (!blob) {
    $("#exportStatus").textContent =
      "PNG could not be created. Please try again.";
    return;
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  $("#exportStatus").textContent =
    "PNG downloaded with the selected sheet data.";
  post({ t: "evt", name: "tool_export", props: { format: "PNG" } });
};
window.SunHoursStudy = {
  getResult: () => result,
  getContext: () => ({ project: project?.name, north: S.north, loc: S.loc }),
  getView: () => S.view,
  getGeometry: () => ({
    triangles: overlay.children[0]?.geometry.attributes.position.count / 3 || 0,
    contourVertices:
      contours.children[0]?.geometry.attributes.position.count || 0,
  }),
  accept,
};
