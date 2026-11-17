// ============================================================================
// DACN - DANH SACH CANH ANH LANDSAT DA DUNG + KIEM TRA CHENH LECH DIEN TICH
// Chay trong GEE Code Editor, sau do bam Run o tab Tasks de xuat CSV ve Drive.
// Muc dich:
//   (1) Xuat danh sach canh (ma canh, ngay chup, ty le may, path/row) de dua vao Phu luc 7 cua bao cao.
//   (2) In ra cac phep tinh dien tich de doi chieu voi bao cao (mat cau so voi pixelArea).
// Bo loc giong het dacn_landcover_v4.js. Chi sua dong ROI_ASSET neu duong dan cua ban khac.
// ============================================================================
var ROI_ASSET = 'projects/TEN_PROJECT_CUA_BAN/assets/ranh_gioi_tay_ninh_moi';
var roi = ee.FeatureCollection(ROI_ASSET).geometry();

var START_DATE = '2026-01-01', END_DATE = '2026-05-01';       // mua kho (END_DATE bi loai tru: het 30/04/2026)
var ANNUAL_START = '2025-11-01', ANNUAL_END = '2026-10-22';   // chuoi 12 thang (het 21/10/2026)
var MAX_SCENE_CLOUD = 70;

function scenes(s, e) {
  var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
  var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');
  return l8.merge(l9).filterBounds(roi).filterDate(s, e)
           .filter(ee.Filter.lt('CLOUD_COVER', MAX_SCENE_CLOUD));
}

var dry = scenes(START_DATE, END_DATE);
var yr  = scenes(ANNUAL_START, ANNUAL_END);

function toFeat(tag) {
  return function (img) {
    return ee.Feature(null, {
      tap: tag,
      ma_canh: img.get('system:index'),
      ve_tinh: img.get('SPACECRAFT_ID'),
      ngay_chup: img.get('DATE_ACQUIRED'),
      gio_chup: img.get('SCENE_CENTER_TIME'),
      path: img.get('WRS_PATH'),
      row: img.get('WRS_ROW'),
      may_canh_pct: img.get('CLOUD_COVER'),
      may_dat_pct: img.get('CLOUD_COVER_LAND')
    });
  };
}

var listDry = dry.map(toFeat('mua_kho'));
var listYr  = yr.map(toFeat('chuoi_12_thang'));
var all = listDry.merge(listYr).sort('ngay_chup');

print('So canh mua kho:', dry.size(), '| Landsat 8:', dry.filter(ee.Filter.eq('SPACECRAFT_ID', 'LANDSAT_8')).size(),
      '| Landsat 9:', dry.filter(ee.Filter.eq('SPACECRAFT_ID', 'LANDSAT_9')).size());
print('So canh chuoi 12 thang:', yr.size());
print('Cac cap path/row (mua kho):', dry.aggregate_array('WRS_PATH').zip(dry.aggregate_array('WRS_ROW')).distinct());
print('May canh trung binh (%):', dry.aggregate_mean('CLOUD_COVER'));

Export.table.toDrive({
  collection: all,
  description: 'DACN_DanhSachAnh_Landsat',
  fileFormat: 'CSV',
  selectors: ['tap', 'ma_canh', 've_tinh', 'ngay_chup', 'gio_chup', 'path', 'row', 'may_canh_pct', 'may_dat_pct']
});

// ---------------------------------------------------------------------------
// (2) Kiem tra chenh lech dien tich (bao cao: 858.912,63 ha so voi 855.492,11 ha, chenh 3.420,52 ha)
// ---------------------------------------------------------------------------
print('--- DIEN TICH ---');
print('ROI.area(1) theo mat cau (ha):', roi.area(1).divide(10000));
// Tong dien tich pixel (pixelArea, ellipsoid) trong ROI, scale 30 m
var pa = ee.Image.pixelArea().divide(10000).clip(roi);
print('Tong pixelArea trong ROI, scale 30 (ha):',
      pa.reduceRegion({reducer: ee.Reducer.sum(), geometry: roi, scale: 30, maxPixels: 1e10, tileScale: 4}).get('area'));
// Dien tich dung hinh hoc ellipsoid cua da giac: dung 'transform' sang UTM 48N de tinh phang, doi chieu
var utm = ee.Projection('EPSG:3405');
print('Dien tich phang tren UTM 48N, EPSG:3405 (ha):', roi.transform(utm, 1).area(1).divide(10000));
print('Gia tri ky vong (tinh tu shapefile): mat cau 858912,5 | ellipsoid 855494,4 | phang UTM 855165,1 | tong pixelArea ~855492');
