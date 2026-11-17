// ============================================================================
// PHAN BO SUNG: MAU THAM CHIEU NGAU NHIEN PHAN TANG (DAN VAO CUOI SCRIPT CHINH)
// Muc dich: lay 4 x 100 diem ngau nhien trong tung lop CUA BAN DO CUOI de cham
// nhan doc lap (cham mu), tu do tinh do chinh xac va dien tich hieu chinh
// (Olofsson va cong su, 2014). Chi chay khi ban do cuoi da chot.
// Yeu cau: da co bien FINAL_MAP, roi, DRIVE_FOLDER tu script chinh.
// ============================================================================
var RUN_REF = false;                        // true = lay mau tham chieu MOI tu ban do hien tai (tao lai asset)
var RUN_REBUILD = true;                     // true = dung lai bang doi chieu cho asset da co (xem huong dan)
var RUN_KEY = false;                        // true = xuat bang doi chieu tu chinh asset (sau khi tac vu asset da xong)
var REF_SEED = 2026;                        // vong 1 dung 2026; vong kiem dinh cuoi dung seed khac (vi du 777)
var REF_PER_CLASS = [100, 100, 150, 100];   // so diem moi lop tren ban do: Nuoc, Thuc vat, Xay dung, Dat trong
var REF_ASSET_ID = 'projects/TEN_PROJECT_CUA_BAN/assets/DACN_ref_points_blind_r2';

if (RUN_REF) {
  var refRaw = FINAL_MAP.select('classification').rename('map_class').stratifiedSample({
    numPoints: 0, classBand: 'map_class', region: roi, scale: 30,
    classValues: [0, 1, 2, 3], classPoints: REF_PER_CLASS,
    seed: REF_SEED, geometries: true, tileScale: 4
  }).randomColumn('rnd', 7).sort('rnd');   // xao tron de thu tu cham khong lo lop ban do

  var nRef = refRaw.size();
  var refList = refRaw.toList(nRef);
  var refAll = ee.FeatureCollection(ee.List.sequence(0, nRef.subtract(1)).map(function (i) {
    var f = ee.Feature(refList.get(i));
    var c = f.geometry().coordinates();
    return f.select(['map_class']).set({id: ee.Number(i).int(), lon: c.get(0), lat: c.get(1)});
  }));

  // Lop ban do duoc luu trong cung asset (thuoc tinh mc) de bang doi chieu luon khop id.
  // Cong cu cham nhan chi doc id va toa do, khong hien mc.
  var refBlind = refAll.select(['id', 'map_class'], ['id', 'mc']);

  print('So diem tham chieu theo lop ban do:', refAll.aggregate_histogram('map_class'));
  Map.addLayer(refBlind, {color: 'ffffff'}, 'Diem tham chieu (da an lop)', false);

  Export.table.toAsset({collection: refBlind, description: 'DACN_RefPoints_Blind_Asset',
                        assetId: REF_ASSET_ID});
}

// Xuat bang doi chieu TU CHINH ASSET (chay sau khi tac vu asset hoan tat): id, mc, lon, lat
if (RUN_KEY) {
  var keyFC = ee.FeatureCollection(REF_ASSET_ID).map(function (f) {
    var c = f.geometry().coordinates();
    return ee.Feature(null, {id: f.get('id'), mc: f.get('mc'), lon: c.get(0), lat: c.get(1)});
  });
  Export.table.toDrive({collection: keyFC, description: 'DACN_RefPoints_Key_FromAsset',
                        folder: DRIVE_FOLDER, fileFormat: 'CSV', selectors: ['id', 'mc', 'lon', 'lat']});
}

// Khoi phuc bang doi chieu cho asset DA CO (chi co id): lay lop ban do hien tai tai dung cac diem do
if (RUN_REBUILD) {
  var refOld = ee.FeatureCollection(REF_ASSET_ID);
  var rebuilt = FINAL_MAP.select('classification').rename('mc').sampleRegions({
    collection: refOld, properties: ['id'], scale: 30, tileScale: 4, geometries: true
  }).map(function (f) {
    var c = f.geometry().coordinates();
    return ee.Feature(null, {id: f.get('id'), mc: f.get('mc'), lon: c.get(0), lat: c.get(1)});
  });
  print('So diem khoi phuc duoc (mong doi 450):', rebuilt.size());
  print('Phan bo theo lop ban do (dung neu = 100/100/150/100):', rebuilt.aggregate_histogram('mc'));
  Export.table.toDrive({collection: rebuilt, description: 'DACN_RefPoints_Key_Rebuilt',
                        folder: DRIVE_FOLDER, fileFormat: 'CSV', selectors: ['id', 'mc', 'lon', 'lat']});
}
