// ============================================================================
// CONG CU GAN NHAN LAN 2 (100 diem, CHAM MU, de tinh Cohen kappa) - chay trong GEE Code Editor
// Nhan: 0 Nuoc, 1 Thuc vat, 2 Xay dung, 3 Dat trong, 9 Khong chac
// Quy tac: nhan theo loai phu chiem uu the (>50%) ben trong o vuong vang 30 m.
// Cong cu khong hien lop ban do, chi hien id va toa do.
// ============================================================================
var REF_ASSET = 'projects/TEN_PROJECT_CUA_BAN/assets/DACN_ref_points_blind_r2';
var ROI_ASSET = 'projects/TEN_PROJECT_CUA_BAN/assets/ranh_gioi_tay_ninh_moi';
var START_DATE = '2026-01-01';
var END_DATE = '2026-05-01';
var STORE = '';   // de cham tiep: dan chuoi da luu dang 'id:nhan,id:nhan,...' vao day

var roi = ee.FeatureCollection(ROI_ASSET).union(1).geometry();
// LAN GAN NHAN 2: chi gan [1, 2, 5, 7, 9, 10, 16, 20, 22, 23, 30, 43, 49, 52, 54, 66, 68, 72, 77, 79, 81, 82, 84, 86, 89, 97, 98, 101, 102, 103, 104, 116, 120, 123, 126, 129, 131, 134, 138, 140, 144, 145, 151, 157, 164, 169, 170, 172, 173, 178, 182, 190, 193, 197, 198, 200, 201, 209, 210, 211, 213, 218, 219, 228, 234, 246, 247, 248, 249, 251, 252, 255, 256, 257, 261, 264, 266, 268, 270, 271, 279, 284, 286, 287, 291, 294, 295, 296, 310, 315, 318, 323, 326, 327, 330, 332, 333, 334, 336, 337] (100 diem chon ngau nhien phan tang, seed 2026). Khong xem nhan lan 1 truoc khi gan xong.
var ONLY_IDS = [1, 2, 5, 7, 9, 10, 16, 20, 22, 23, 30, 43, 49, 52, 54, 66, 68, 72, 77, 79, 81, 82, 84, 86, 89, 97, 98, 101, 102, 103, 104, 116, 120, 123, 126, 129, 131, 134, 138, 140, 144, 145, 151, 157, 164, 169, 170, 172, 173, 178, 182, 190, 193, 197, 198, 200, 201, 209, 210, 211, 213, 218, 219, 228, 234, 246, 247, 248, 249, 251, 252, 255, 256, 257, 261, 264, 266, 268, 270, 271, 279, 284, 286, 287, 291, 294, 295, 296, 310, 315, 318, 323, 326, 327, 330, 332, 333, 334, 336, 337];
var pts = ee.FeatureCollection(REF_ASSET).filter(ee.Filter.inList('id', ONLY_IDS)).sort('id');
var info = pts.map(function (f) {
  var c = f.geometry().coordinates();
  return ee.Feature(null, {id: f.get('id'), lon: c.get(0), lat: c.get(1)});
});
var ids = info.aggregate_array('id').getInfo();
var lons = info.aggregate_array('lon').getInfo();
var lats = info.aggregate_array('lat').getInfo();
var N = ids.length;

var labels = {};
if (STORE !== '') {
  STORE.split(',').forEach(function (s) {
    var p = s.trim().split(':');
    // Chi nhan muc hop le; muc bi cat do dau ... se bi bo qua
    if (p.length === 2 && /^\d+$/.test(p[0]) && /^[01239]$/.test(p[1])) { labels[p[0]] = p[1]; }
  });
}
var idx = 0;
while (idx < N && labels[ids[idx]] !== undefined) { idx++; }

// Anh doi chieu: Sentinel-2 10 m mua kho 2026 (mac dinh tat, bat trong bang Layers)
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(roi).filterDate(START_DATE, END_DATE)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)).median();
Map.setOptions('SATELLITE');
Map.layers().set(0, ui.Map.Layer(s2, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000},
                                 'Sentinel-2 mau tu nhien', false));
Map.layers().set(1, ui.Map.Layer(s2, {bands: ['B8', 'B4', 'B3'], min: 0, max: 4000},
                                 'Sentinel-2 gia mau NIR-R-G', false));

var status = ui.Label('', {fontWeight: 'bold', fontSize: '15px'});

var out = ui.Textbox({placeholder: 'Chuoi nhan se hien o day sau moi diem',
                      style: {stretch: 'horizontal'}});

function labelString() {
  return Object.keys(labels).map(function (k) { return k + ':' + labels[k]; }).join(',');
}

// Console cat bot chuoi dai bang dau ..., nen in thanh nhieu dong ngan (moi dong 15 diem)
function printChunks(keys, header) {
  for (var i = 0; i < keys.length; i += 15) {
    var part = keys.slice(i, i + 15).map(function (k) { return k + ':' + labels[k]; }).join(',');
    print(header + ' ' + (i + 1) + '-' + Math.min(i + 15, keys.length) + ' | ' + part);
  }
}

function dumpLabels() {
  out.setValue(labelString());
  print('Da cham ' + Object.keys(labels).length + ' diem. Cac dong ben duoi gop lai la toan bo nhan:');
  printChunks(Object.keys(labels), 'Nhan');
}

function show() {
  if (idx >= N) {
    status.setValue('Da cham het ' + N + ' diem. Bam "In nhan" de lay ket qua.');
    return;
  }
  status.setValue('Diem ' + (idx + 1) + ' / ' + N + '  (id ' + ids[idx] + ')  Con lai: ' +
                  (N - Object.keys(labels).length));
  var pt = ee.Geometry.Point([lons[idx], lats[idx]]);
  var footprint = ee.FeatureCollection([ee.Feature(pt.buffer(15).bounds())])
    .style({color: 'ffff00', fillColor: '00000000', width: 2});
  Map.layers().set(2, ui.Map.Layer(footprint, {}, 'O 30 m dang cham'));
  Map.setCenter(lons[idx], lats[idx], 18);
}

function rec(code) {
  if (idx >= N) { return; }
  labels[ids[idx]] = code;
  idx++;
  while (idx < N && labels[ids[idx]] !== undefined) { idx++; }   // bo qua diem da co nhan
  out.setValue(labelString());
  var ks = Object.keys(labels);
  if (ks.length % 15 === 0) { printChunks(ks.slice(ks.length - 15), 'Moi'); }   // tu in de khong mat tien do
  show();
}

function mk(text, code) {
  return ui.Button({label: text, onClick: function () { rec(code); }, style: {stretch: 'horizontal'}});
}

var panel = ui.Panel({
  widgets: [
    ui.Label('CHAM NHAN THAM CHIEU', {fontWeight: 'bold'}),
    status,
    mk('0 - Nuoc', 0), mk('1 - Thuc vat', 1), mk('2 - Xay dung', 2),
    mk('3 - Dat trong', 3), mk('9 - Khong chac', 9),
    ui.Button({label: 'Quay lai 1 diem', onClick: function () { if (idx > 0) { idx--; show(); } },
               style: {stretch: 'horizontal'}}),
    ui.Button({label: 'In nhan (de luu)', onClick: dumpLabels, style: {stretch: 'horizontal'}}),
    ui.Label('Chuoi nhan: bam vao o, Ctrl+A roi Ctrl+C de sao chep', {fontSize: '11px'}),
    out
  ],
  style: {position: 'top-right', width: '230px'}
});
Map.add(panel);
show();
