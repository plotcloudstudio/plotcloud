// UI language. The standalone page is Chinese; the copy embedded in the PlotCloud site sets window.PC_EMBED = { lang: 'en' }.
export const LANG = (typeof window !== 'undefined' && window.PC_EMBED && window.PC_EMBED.lang) || 'zh';

const EN = {
  // categories
  '卧室': 'Bedroom', '客厅': 'Living room', '餐厅与书房': 'Dining & study', '厨房与家电': 'Kitchen & appliances', '卫浴': 'Bathroom',
  // models
  '床': 'Bed', '床头柜': 'Nightstand', '衣柜': 'Wardrobe', '沙发': 'Sofa', '茶几': 'Coffee table', '电视柜': 'TV stand', '书架': 'Bookshelf',
  '餐桌': 'Dining table', '餐椅': 'Dining chair', '电脑桌': 'Computer desk', '办公椅': 'Office chair', '橱柜': 'Kitchen cabinets',
  '冰箱': 'Refrigerator', '灶台烤箱': 'Range', '洗衣机': 'Washing machine', '马桶': 'Toilet', '浴室柜': 'Bathroom vanity', '浴缸': 'Bathtub',
  // params
  '床垫宽': 'Mattress width', '床垫长': 'Mattress length', '床架高': 'Frame height', '床垫厚': 'Mattress thickness', '床脚高': 'Leg height',
  '床头板': 'Headboard', '床头板高': 'Headboard height', '枕头': 'Pillows', '被子': 'Duvet',
  '宽': 'Width', '深': 'Depth', '高': 'Height', '长': 'Length', '长 / 直径': 'Length / diameter', '抽屉数': 'Drawers', '脚高': 'Leg height',
  '门数': 'Doors', '踢脚高': 'Plinth height', '座位数': 'Seats', '单座宽': 'Seat width (each)', '座高': 'Seat height', '靠背高': 'Back height',
  '扶手宽': 'Arm width', '扶手高': 'Arm height', '分座垫和靠枕': 'Separate cushions', '形状': 'Shape', '矩形': 'Rectangle', '圆形': 'Round',
  '下层隔板': 'Lower shelf', '电视': 'TV', '电视尺寸': 'TV size', '中间层板': 'Shelves', '板厚': 'Board thickness', '背板': 'Back panel',
  '示意书本': 'Books', '桌面厚': 'Top thickness', '桌腿': 'Base', '四腿': 'Four legs', '中心底座': 'Pedestal', '腿粗': 'Leg size',
  '座宽': 'Seat width', '座深': 'Seat depth', '总高': 'Overall height', '座面': 'Seat', '软包': 'Upholstered', '实木': 'Wood',
  '抽屉柜': 'Drawer unit', '显示器和键盘': 'Monitor & keyboard', '显示器': 'Monitor', '扶手': 'Armrests', '总长': 'Run length',
  '台面深': 'Counter depth', '台面高': 'Counter height', '水槽': 'Sink', '灶台': 'Cooktop', '吊柜': 'Wall cabinets', '类型': 'Type',
  '上冷藏下冷冻': 'Bottom freezer', '法式对开门': 'French door', '单门': 'Single door', '后挡板': 'Backguard', '总深': 'Overall depth',
  '水箱宽': 'Tank width', '台盆数': 'Basins', '镜子': 'Mirror', '龙头': 'Faucet',
  '24 寸': '24″', '27 寸': '27″', '32 寸': '32″', '55 寸': '55″', '65 寸': '65″', '75 寸': '75″',
  'Twin 单人': 'Twin', '单人': '1 seat', '双人': '2 seats', '三人': '3 seats', '四人': '4 seats',
  // colors
  '燕麦': 'Oatmeal', '石墨灰': 'Graphite', '雾蓝': 'Mist blue', '橄榄绿': 'Olive', '砖红': 'Brick', '白橡': 'White oak', '胡桃': 'Walnut',
  '白色烤漆': 'White lacquer', '黑色': 'Black',
  '转角沙发': 'Sectional sofa', '扶手椅': 'Armchair', '边几': 'Side table', '斗柜': 'Dresser', '中岛 + 吧凳': 'Kitchen island', '淋浴房': 'Shower',
  '洗衣机 / 烘干机': 'Washer / dryer', '洗碗机': 'Dishwasher', '烘干机': 'Dryer', '并排一对': 'Side by side', '叠放': 'Stacked', '单台高': 'Unit height',
  '转角方向': 'Corner side', '右转': 'Right', '左转': 'Left', '主段长': 'Main length', '转角段长': 'Return length',
  '宽 / 直径': 'Width / diameter', '抽屉列数': 'Drawer columns', '抽屉层数': 'Drawer rows', '宽矮': 'Wide & low', '高窄': 'Tall & narrow',
  '吧台悬挑': 'Seating overhang', '吧凳数': 'Stools', '转角（两面玻璃）': 'Corner (2 glass sides)', '一字（正面玻璃）': 'Alcove (front glass)',
  '玻璃高': 'Glass height', '底盘高': 'Tray height',
  // UI
  '家具生成器': 'Furniture generator', '拖动旋转 · 右键平移 · 滚轮缩放': 'Drag to orbit · right-drag to pan · scroll to zoom',
  '透视': 'Perspective', '平面': 'Plan', '正立面': 'Front', '侧立面': 'Side', '尺寸标注': 'Dimensions', '适配视图': 'Fit view',
  '外形尺寸 W × D × H（mm）': 'Overall W × D × H (mm)', '原点：底面中心 · Z 轴向上 · 网格 500 mm': 'Origin: bottom center · Z up · grid 500 mm',
  '参数': 'Parameters', '恢复默认': 'Reset', '材质颜色': 'Colors', '布艺': 'Fabric', '木作 / 柜体': 'Wood / casework', '导出模型': 'Export',
  '导出 .zip': 'Export .zip', '减少': 'Decrease', '增加': 'Increase', '正在载入三维视图…': 'Loading 3D view…', '基础模型': 'Base models', '三维预览': '3D preview', '视图': 'View',
  '原生文件，按部件分图层': 'Native file, one layer per part', '文件 › 导入 › COLLADA': 'File › Import › COLLADA', '附 .mtl 材质颜色': 'With .mtl colors',
  '3D 面，毫米': '3D faces, millimeters', '实体网格': 'Solid mesh', '3D 打印 / 激光模型': '3D printing / laser models',
  '正在生成文件…': 'Building files…', '请在弹出的确认框里保存文件。': 'Confirm the save in the dialog.', '已取消保存。': 'Save canceled.',
  '已有一个保存确认框没关闭，请先处理它。': 'A save dialog is already open. Close it first.',
};

export function t(s) { return LANG === 'en' ? (EN[s] ?? s) : s; }

// Messages with values
export const M = {
  noDownload: (kb) => LANG === 'en'
    ? `Files built (${kb} KB), but the browser download service is unavailable. Reload PlotCloud and retry.`
    : `文件已生成（${kb} KB），但浏览器下载服务不可用。请刷新 PlotCloud 后重试。`,
  saved: (name, kb, r) => LANG === 'en'
    ? `Saved ${name} (${kb} KB)${r ? `. Rhino file: ${r.nurbs} NURBS solids, ${r.meshes} meshes` : ''}.`
    : `已保存 ${name}（${kb} KB）${r ? `，Rhino 文件含 ${r.nurbs} 个 NURBS 实体、${r.meshes} 个网格` : ''}。`,
  savedNo3dm: (name, kb) => LANG === 'en'
    ? `Saved ${name} (${kb} KB). The Rhino component didn't load, so there's no .3dm this time. All other formats are included.`
    : `已保存 ${name}（${kb} KB）。Rhino 组件没能载入，这次没有 .3dm，其余格式都在。`,
  failed: (msg) => LANG === 'en' ? `Export failed: ${msg}` : `导出失败：${msg}`,
  note: () => LANG === 'en'
    ? 'Everything comes in one .zip, in millimeters, with the origin at the bottom center. <b>.skp, .max and .dwg</b> are closed formats a browser can\'t write: import the .dae into SketchUp, the .obj into 3ds Max and the .dxf into AutoCAD.'
    : '所有格式打包成一个 .zip，单位毫米，原点在底面中心。<b>.skp / .max / .dwg</b> 是私有格式，浏览器写不出来：SketchUp 用 .dae 导入，3ds Max 用 .obj，AutoCAD 用 .dxf。',
};
