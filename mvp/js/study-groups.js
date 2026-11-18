// The studies grouped by the design question they answer (2026-11-17). The menus list every study by its own name under its
// group, a search finds it by its name or the words people use for it (English and Chinese, method names such as UTCI or sDA),
// and an open study offers the others in its group. Study ids, saved results and links are unchanged.
export const GROUPS = [
  { id: 'sun', scope: 'building', label: 'Sun & solar', ids: ['sunhours', 'radiation', 'skyview', 'shadebenefit', 'solarenvelope'] },
  { id: 'wind', scope: 'building', label: 'Wind & outdoor comfort', ids: ['wind', 'utci', 'snow'] },
  { id: 'water', scope: 'building', label: 'Site water & sound', ids: ['stormwater', 'watersound'] },
  { id: 'structure', scope: 'building', label: 'Structure & materials', ids: ['structure'] },
  { id: 'rooms', scope: 'interior', label: 'Light, air & sound', ids: ['daylight', 'vent', 'acoustics'] },
  { id: 'safety', scope: 'interior', label: 'Safety', ids: ['fire-evacuation'] },
  { id: 'movement', scope: 'interior', label: 'Movement', ids: ['evac', 'spacesyntax', 'wayfinding'] },
  { id: 'visibility', scope: 'interior', label: 'Visibility', ids: ['views', 'privacy', 'isovist', 'cameras'] },
];
// the words people search with, besides the study's own name
export const ALIASES = {
  sunhours: 'sunlight shadow shade hours direct sun 日照 阴影 光照',
  radiation: 'solar radiation pv photovoltaic kwh energy irradiance 辐射 太阳能 光伏',
  skyview: 'sky view factor svf solar mask obstruction 天空 可见度',
  shadebenefit: 'shade shading device canopy overhang 遮阳',
  solarenvelope: 'solar envelope solar rights height limit 日照包络 体量',
  wind: 'wind cfd lawson pedestrian wind comfort gust 风 风环境',
  utci: 'thermal comfort utci heat stress cold stress outdoor comfort 热舒适 室外舒适 舒适 温度',
  snow: 'snow drift snow load 雪 积雪',
  stormwater: 'rain flood flooding drainage runoff ponding 雨水 积水 排水',
  watersound: 'water noise waterfall stream sound 水声 噪声 声音',
  structure: 'structure column beam grid load slab wall bearing frame 结构 柱 梁 承重',
  daylight: 'daylight sda ase daylight factor df lux illuminance 采光 日光',
  vent: 'natural ventilation ach airflow stack window opening 通风 自然通风',
  acoustics: 'acoustics reverberation rt60 rt echo noise 声学 混响 噪声',
  'fire-evacuation': 'fire egress evacuation exit rset aset obc code 消防 疏散 火灾',
  evac: 'circulation walking routes footfall corridor 动线 流线 日常',
  spacesyntax: 'space syntax integration connectivity vga 空间句法',
  wayfinding: 'wayfinding signage signs decision points orientation 寻路 标识',
  views: 'views outlook view quality window views 视野 景观',
  privacy: 'privacy overlooking street visibility 隐私',
  isovist: 'isovist sightlines supervision visibility safety child wheelchair 视线 可视',
  cameras: 'cctv security cameras surveillance coverage 摄像头 监控 安防',
};
export const groupOf = (id) => GROUPS.find((g) => g.ids.includes(id)) || null;
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
// does the study match what was typed? every word typed must appear in its name, group or search words
export function matches(id, name, q) { const hay = norm([name, groupOf(id)?.label, ALIASES[id], id].join(' ')), words = norm(q).trim().split(/\s+/).filter(Boolean);
  return words.every((w) => hay.includes(w)); }
