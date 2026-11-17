// ============================================================================
// DACN - PHAN LOAI LOP PHU TAY NINH (SAU SAP NHAP) - PHIEN BAN 4 (them dac trung theo mua + mau ngau nhien da cham vong 1)
// Landsat 8 + 9 Collection 2 Level 2, mua kho 2026
// Dac trung: 7 bang SR (B1-B7) + NDVI, NDWI, NDBI = 10 dac trung
// Tach train/test theo khoi o luoi (spatial block split)
// So sanh 4 mo hinh (RF, CART, SVM, GTB) x 2 bo dac trung (Bands, Bands+Indices)
// Ket qua: bang metric, dien tich (ha), ban do GeoTIFF
// Ma lop khi huan luyen: 0 Nuoc, 1 Thuc vat, 2 Xay dung, 3 Dat trong
// Ma lop trong file GeoTIFF xuat ra: 1 Nuoc, 2 Thuc vat, 3 Xay dung, 4 Dat trong,
//   255 = khong co du lieu (may), 0 = ngoai ranh gioi (NoData)
// ============================================================================

// ---------------------------------------------------------------------------
// 0. THAM SO - CHI SUA PHAN NAY
// ---------------------------------------------------------------------------
// Asset shapefile ranh gioi (chi gom 2 polygon: Tay Ninh cu + Long An cu, da chuyen ve WGS84)
var ROI_ASSET = 'projects/TEN_PROJECT_CUA_BAN/assets/ranh_gioi_tay_ninh_moi'; // DOI THANH DUONG DAN CUA BAN

var START_DATE = '2026-01-01';
var END_DATE   = '2026-05-01';   // filterDate loai tru ngay cuoi, nen 05-01 = het 30/04
var MAX_SCENE_CLOUD = 70;        // loc canh co CLOUD_COVER > 70%
var ANNUAL_START = '2025-11-01'; // chuoi anh 12 thang de tinh dac trung theo mua (phan vi 10, 50, 90)
var ANNUAL_END   = '2026-10-22';

// Loc do thuan nhat (purity): bo diem nam o vung hon hop (duong hep, nha lan cay, ao nho).
// Chi so PUR = trung binh do lech chuan 3x3 pixel cua NDVI, NDBI, MNDWI (mua kho). PUR cang cao cang hon hop.
// Ap dung dong deu cho ca 4 lop, KHONG phu thuoc ket qua mo hinh. Doc phan bo PUR theo lop o Console
// roi moi chon PUR_MAX, sau do doi APPLY_PURITY thanh true.
var APPLY_PURITY = false;
var PUR_MAX = 0.08;

// Mau ngau nhien da cham nhan vong 1 (449 diem, nhan 0 den 3). Dua vao huan luyen de mo hinh
// hoc ca cac pixel trung gian (vuon lan nha, cao su rung la, ruong sau thu hoach).
var USE_EXTRA = true;
var EXTRA_DATA = [   // [kinh do, vi do, nhan 0 Nuoc, 1 Thuc vat, 2 Xay dung, 3 Dat trong]
  [106.462623, 10.558663, 1], [106.321947, 11.089028, 1], [106.358868, 11.595678, 1], [106.315479, 10.584535, 3], [106.300926, 11.381430, 0],
  [106.151087, 11.191706, 3], [106.190434, 10.694219, 3], [105.865693, 11.657393, 1], [106.341081, 10.576989, 1], [106.432440, 10.740033, 3],
  [106.296076, 11.010067, 3], [106.098536, 11.500008, 3], [106.651539, 10.505034, 3], [106.013645, 11.652003, 3], [105.922017, 10.840554, 1],
  [106.244333, 11.472519, 1], [106.330571, 10.741380, 1], [106.421121, 10.911432, 2], [105.861920, 10.643284, 1], [106.158094, 11.112744, 1],
  [105.981575, 11.570346, 3], [106.562875, 10.416639, 0], [106.175342, 10.597470, 1], [106.271552, 11.106546, 2], [105.909890, 11.242101, 1],
  [106.159442, 10.959402, 1], [106.075359, 11.391132, 1], [106.308742, 11.466590, 3], [106.089912, 11.762495, 1], [106.457772, 10.901999, 2],
  [106.493615, 10.804981, 2], [105.946272, 10.566478, 3], [106.235170, 10.885560, 1], [106.659624, 10.539798, 2], [106.013915, 11.198174, 3],
  [106.266970, 11.442066, 1], [106.246758, 11.725844, 1], [105.964058, 11.361218, 1], [105.960285, 11.575197, 1], [106.137613, 11.268781, 1],
  [106.476098, 10.484552, 1], [106.492537, 10.544380, 1], [106.609767, 10.514196, 1], [106.290686, 10.616604, 3], [106.352669, 10.709580, 1],
  [105.605091, 10.846753, 1], [106.116862, 11.614812, 1], [105.566284, 10.909006, 1], [106.369917, 11.053725, 3], [105.920131, 10.568365, 0],
  [106.728075, 10.576180, 1], [106.689268, 10.616604, 3], [106.364797, 10.785578, 1], [105.978341, 11.218386, 3], [106.191242, 11.522645, 0],
  [106.099075, 11.573580, 3], [106.378810, 11.178231, 1], [106.378002, 11.462817, 0], [105.733910, 10.729523, 1], [105.926059, 10.831122, 1],
  [106.456964, 10.598818, 2], [105.999901, 10.842441, 1], [105.730676, 10.892028, 1], [106.199057, 11.355828, 1], [106.268318, 11.333999, 1],
  [106.492807, 10.817108, 0], [106.707863, 10.650561, 3], [106.065119, 11.455541, 1], [106.485800, 10.621994, 3], [106.297692, 10.905772, 2],
  [106.024694, 11.335616, 2], [105.997206, 10.639242, 1], [106.329493, 11.305972, 3], [106.666900, 10.513119, 1], [105.916627, 11.407302, 1],
  [106.318174, 10.771833, 1], [105.966214, 11.535311, 3], [106.338386, 11.411344, 3], [106.584704, 10.476198, 0], [106.113897, 11.467399, 2],
  [106.040595, 11.415925, 1], [106.124407, 11.193053, 1], [106.621355, 10.571329, 1], [106.292842, 10.840554, 3], [106.355634, 10.786656, 1],
  [106.374768, 11.464704, 0], [106.126024, 11.175536, 1], [106.184235, 10.587230, 1], [106.650730, 10.493984, 2], [106.090721, 11.308128, 2],
  [106.515175, 10.841093, 3], [106.267240, 11.310284, 1], [106.715140, 10.562436, 1], [106.200405, 11.702668, 3], [105.664919, 10.866156, 3],
  [106.109855, 11.528844, 1], [106.691694, 10.458411, 0], [105.739569, 11.000904, 3], [106.391207, 10.864270, 3], [106.627284, 10.553273, 1],
  [106.120904, 11.410535, 1], [106.296884, 10.778840, 1], [106.362910, 11.476831, 0], [106.075898, 11.202216, 3], [105.991008, 10.550039, 2],
  [106.333805, 11.363643, 0], [105.650366, 10.854568, 3], [106.248105, 10.813874, 1], [105.940882, 11.457697, 1], [106.198249, 11.075823, 1],
  [106.198788, 11.293844, 1], [106.252956, 10.929218, 1], [106.206603, 11.027045, 2], [105.956243, 11.459853, 1], [105.974838, 10.807407, 1],
  [105.973221, 11.511326, 1], [106.186661, 11.552290, 2], [105.785114, 11.005755, 1], [106.308203, 11.586246, 1], [106.216036, 11.367686, 2],
  [106.290955, 11.416734, 0], [106.410072, 11.606997, 1], [106.147315, 11.533964, 1], [106.313862, 11.535311, 1], [105.950583, 10.591272, 1],
  [106.190703, 10.861575, 1], [106.058651, 10.767791, 1], [106.256460, 11.388706, 0], [106.151087, 11.628557, 2], [106.190703, 10.775337, 1],
  [105.694294, 10.783152, 0], [106.236248, 11.551481, 1], [106.376924, 10.683439, 3], [106.135457, 11.578161, 1], [106.332996, 11.363643, 0],
  [106.466666, 10.676971, 3], [106.372073, 11.455541, 0], [105.802900, 10.672390, 3], [105.922556, 10.619030, 1], [106.358598, 11.188202, 3],
  [106.186122, 11.694313, 3], [106.437021, 10.685056, 2], [106.250800, 11.256385, 3], [106.152704, 10.907120, 1], [106.212263, 11.691618, 1],
  [106.311976, 10.776954, 1], [106.310898, 11.560374, 3], [106.175611, 11.496235, 1], [105.927137, 11.321333, 1], [106.245141, 10.818186, 1],
  [105.903422, 11.333999, 1], [106.254573, 11.706171, 3], [106.199596, 11.653620, 1], [106.067544, 10.724672, 2], [105.984540, 11.619124, 2],
  [106.555060, 10.500722, 0], [106.305777, 11.613734, 1], [106.316557, 11.424549, 0], [106.197440, 11.035399, 3], [106.698431, 10.495871, 1],
  [106.573924, 10.544380, 1], [106.248105, 10.600165, 1], [106.206873, 11.635833, 1], [106.099075, 11.744439, 1], [106.338117, 10.979883, 3],
  [106.187200, 11.119481, 2], [106.580392, 10.426880, 0], [106.231936, 10.864809, 1], [106.162945, 11.156941, 1], [106.176689, 11.295731, 1],
  [105.609942, 10.934878, 3], [106.338925, 11.667903, 1], [106.249992, 10.837590, 1], [106.576080, 10.538182, 0], [105.998823, 10.766174, 2],
  [105.832545, 10.706346, 1], [106.448609, 10.578875, 1], [106.675254, 10.524976, 3], [106.536195, 10.484822, 1], [105.681089, 10.870468, 1],
  [106.401448, 10.765365, 3], [105.913393, 10.811719, 1], [106.616505, 10.454908, 1], [106.236248, 10.683439, 0], [106.256460, 11.189550, 1],
  [106.379619, 10.718743, 1], [105.928485, 11.382239, 3], [106.420313, 10.818995, 1], [106.662049, 10.570521, 1], [105.947080, 11.331843, 3],
  [106.636986, 10.583187, 1], [106.410880, 11.587054, 1], [106.022269, 11.343431, 3], [106.344854, 11.425627, 3], [106.290955, 10.784769, 1],
  [106.425163, 10.832739, 1], [106.676602, 10.441433, 0], [106.394711, 11.546091, 1], [106.460198, 10.575102, 1], [105.988582, 11.276866, 1],
  [106.199866, 11.073667, 1], [106.413845, 11.130261, 3], [106.311976, 11.171494, 1], [106.286104, 11.404876, 0], [106.323025, 11.460392, 3],
  [106.162137, 11.199791, 1], [105.762207, 10.942154, 3], [106.109855, 10.661610, 1], [106.508437, 10.659724, 1], [106.465857, 10.782613, 2],
  [106.034935, 11.606728, 1], [105.884288, 10.725480, 1], [106.593059, 10.457603, 0], [106.650730, 10.500452, 3], [105.748732, 10.772103, 1],
  [105.903422, 11.512674, 3], [105.661416, 10.863461, 3], [105.989391, 11.401373, 1], [105.944385, 11.347204, 0], [105.970257, 11.646074, 2],
  [106.184235, 11.677066, 1], [106.017418, 11.486263, 3], [106.303082, 11.329148, 1], [106.389321, 10.721707, 3], [105.966214, 10.638433, 1],
  [106.183157, 11.652003, 0], [105.909890, 11.267703, 3], [106.188817, 11.616699, 2], [106.221426, 11.459584, 1], [106.175342, 11.422932, 1],
  [106.109585, 11.595678, 3], [106.301735, 11.053186, 2], [106.564762, 10.463801, 1], [106.494424, 10.921672, 0], [106.077246, 11.148587, 3],
  [106.198788, 11.272015, 1], [106.228971, 10.644362, 1], [106.385278, 10.879901, 3], [106.552904, 10.620377, 1], [106.402526, 10.758359, 3],
  [106.143811, 11.503511, 1], [105.925790, 10.807137, 1], [106.576080, 10.633313, 1], [106.676332, 10.492367, 3], [106.300657, 10.654873, 1],
  [105.985079, 11.309475, 0], [106.276133, 11.223506, 1], [106.350244, 10.796088, 1], [105.922826, 10.828158, 1], [106.686034, 10.557855, 1],
  [106.545089, 10.592619, 3], [106.518678, 10.437660, 2], [106.058112, 11.589749, 3], [105.706421, 10.928949, 1], [106.237326, 11.538006, 1],
  [105.975916, 11.629365, 3], [106.448070, 10.772103, 2], [105.970796, 11.658740, 1], [106.435674, 10.536026, 1], [106.432170, 10.513119, 1],
  [105.922287, 10.825193, 0], [106.277480, 11.609422, 1], [106.434596, 10.911162, 3], [106.178576, 11.082022, 0], [106.297962, 11.418351, 0],
  [105.641743, 10.854299, 3], [106.281792, 11.672484, 1], [105.925251, 10.729253, 0], [106.363449, 11.662782, 1], [105.969718, 10.726558, 1],
  [106.005021, 11.656045, 1], [106.052183, 11.598912, 3], [105.776759, 11.018421, 1], [106.002057, 11.193053, 1], [106.404143, 10.740572, 3],
  [106.513558, 10.830044, 3], [105.956782, 11.373615, 3], [105.624495, 10.888794, 3], [106.245411, 11.409996, 1], [106.401987, 11.579778, 1],
  [106.253765, 11.178231, 3], [106.013376, 10.854568, 1], [106.436482, 10.683978, 1], [106.710828, 10.524168, 3], [105.857877, 10.896609, 1],
  [105.603474, 10.825193, 1], [106.157286, 11.472250, 3], [106.625398, 10.531444, 1], [105.825538, 10.683439, 1], [106.722685, 10.579145, 1],
  [106.292303, 10.979614, 3], [106.683609, 10.518778, 3], [105.847906, 10.710928, 1], [105.883749, 11.471711, 3], [105.932797, 10.803364, 1],
  [105.668423, 10.913587, 1], [106.613540, 10.567017, 1], [106.106351, 11.107893, 1], [106.078054, 10.699878, 1], [106.300657, 10.978805, 1],
  [106.351322, 10.532253, 1], [105.898302, 11.515369, 3], [106.119826, 10.806059, 0], [106.315749, 10.992280, 1], [106.326798, 10.584265, 0],
  [106.537273, 10.685056, 1], [106.485800, 10.560280, 1], [106.490651, 10.657837, 1], [106.291225, 11.567920, 3], [106.241368, 11.511326, 3],
  [105.931719, 11.415656, 3], [105.668962, 10.954820, 1], [106.199327, 11.642570, 3], [106.686304, 10.645440, 0], [106.324372, 11.395174, 1],
  [106.249183, 11.584090, 3], [106.249722, 10.817917, 3], [105.952739, 11.530730, 3], [106.019574, 11.266625, 1], [106.110933, 10.702304, 3],
  [106.113089, 11.179848, 1], [106.431092, 10.437930, 3], [106.321408, 10.983926, 3], [106.535926, 10.510154, 1], [106.303082, 11.077440, 1],
  [106.266970, 11.705902, 1], [106.154860, 11.739049, 1], [106.194746, 11.177962, 2], [106.388243, 10.886638, 2], [106.693580, 10.631157, 1],
  [105.846559, 10.773720, 1], [106.741550, 10.523090, 0], [106.570960, 10.423377, 1], [106.210107, 10.858341, 1], [106.313323, 11.429939, 0],
  [106.096919, 11.168260, 3], [106.328684, 11.365260, 3], [106.463432, 10.544919, 1], [106.437830, 10.583726, 2], [105.795355, 10.732487, 2],
  [106.310359, 11.197635, 1], [106.268048, 11.491653, 3], [105.996937, 11.200330, 3], [105.928485, 10.816569, 2], [106.708672, 10.501261, 0],
  [106.214149, 11.688115, 3], [106.385278, 11.020846, 2], [105.755200, 10.761593, 1], [106.621625, 10.635739, 3], [106.024425, 11.567112, 1],
  [106.461545, 10.750274, 1], [106.463162, 10.664035, 3], [106.319791, 11.446648, 0], [105.608325, 10.966139, 1], [106.319252, 11.566573, 3],
  [106.283948, 11.660896, 3], [106.569882, 10.493715, 0], [106.237865, 11.260966, 3], [106.305777, 10.683439, 1], [106.385548, 10.921133, 3],
  [106.390129, 10.499644, 1], [106.296076, 11.095766, 2], [106.533770, 10.531983, 1], [106.241638, 10.742997, 3], [106.143542, 11.310553, 2],
  [106.205795, 11.162600, 3], [106.192859, 11.137807, 1], [106.335152, 11.539084, 3], [106.171569, 11.142927, 1], [106.176959, 10.760784, 1],
  [106.071587, 11.116517, 3], [105.982384, 11.401912, 2], [106.237326, 10.776415, 1], [105.971604, 10.815222, 1], [106.201483, 10.892297, 1],
  [106.299579, 10.860228, 1], [106.141925, 11.742014, 3], [106.224120, 10.766443, 1], [106.401987, 11.478448, 3], [106.441872, 10.640320, 2],
  [106.380697, 10.716317, 1], [105.753852, 10.751352, 1], [105.878628, 11.393018, 3], [105.880245, 11.675179, 1], [106.218461, 10.846214, 3],
  [106.093685, 11.208145, 1], [106.345663, 11.510248, 1], [106.307664, 11.089567, 2], [106.254843, 11.538276, 1], [106.198249, 11.701590, 3],
  [105.930371, 11.600799, 1], [106.233822, 10.901191, 1], [106.183427, 11.651194, 3], [106.582279, 10.467304, 0], [106.424085, 10.433348, 3],
  [105.550923, 10.914665, 1], [105.884557, 11.404068, 1], [106.306586, 10.777762, 1], [106.499005, 10.603938, 2], [106.036822, 11.460661, 1],
  [106.624050, 10.533331, 1], [106.725650, 10.495332, 0], [106.449957, 10.905233, 3], [106.354017, 10.602591, 1], [105.747924, 10.790698, 1],
  [105.976455, 11.488958, 3], [106.231397, 10.817108, 3], [105.889139, 11.421585, 1], [106.288530, 11.024350, 1], [106.155130, 11.539623, 2],
  [106.438908, 10.723324, 1], [106.113089, 11.226201, 3], [106.416270, 11.547708, 3], [105.998284, 11.318368, 1], [105.664919, 10.986351, 1],
  [106.030893, 10.685865, 2], [106.370456, 10.586421, 1], [106.323294, 11.621011, 1], [106.434057, 10.917630, 2], [105.699145, 10.833817, 3],
  [106.102309, 11.545822, 1], [106.047063, 10.709041, 1], [105.638239, 10.792045, 1], [106.232475, 11.512943, 1], [106.256190, 11.698895, 3],
  [105.774065, 10.694488, 1], [106.611384, 10.491828, 3], [105.992355, 11.263391, 3], [106.705977, 10.651369, 1], [106.068622, 11.318907, 2],
  [106.117940, 10.638164, 1], [106.341351, 10.849987, 1], [106.098805, 10.750543, 1], [106.139230, 11.183352, 0], [106.565840, 10.501261, 1],
  [106.468013, 10.618221, 1], [106.095841, 11.473058, 1], [106.476098, 10.893645, 1], [106.715409, 10.620647, 1], [106.268318, 11.683803, 1],
  [106.560989, 10.440624, 3], [106.270204, 11.694852, 1], [106.050296, 11.727731, 1], [106.311167, 11.259349, 1], [106.417887, 10.856185, 1],
  [106.351591, 11.044562, 1], [106.212532, 10.952934, 1], [106.434326, 10.561628, 0], [106.420852, 10.423646, 1]
];

var BLOCK_M    = 5000;           // kich thuoc khoi o luoi tach train/test (met)
var TRAIN_FRAC = 0.7;            // ty le khoi dung de huan luyen
var SEED_MAIN  = 42;             // seed chia khoi chinh
var RUN_REPEATS = true;          // lap 5 lan chia khac nhau de do do on dinh

// Sau khi doc bang so sanh mo hinh, sua 2 dong nay roi chay lai de xuat ban do
var CHOSEN_MODEL = 'RF';         // 'RF' | 'CART' | 'SVM' | 'GTB'
var CHOSEN_SET   = 'MT';         // 'BANDS' | 'BANDS_IDX' | 'EXT' | 'MT'
var USE_SMOOTH   = false;        // false = KHONG loc majority (cau hinh cua ban do cuoi trong bao cao); true = loc majority 3x3 truoc khi xuat

var DRIVE_FOLDER = 'DACN_Vientham';
var EXPORT_CRS   = 'EPSG:3405';  // VN-2000 / UTM 48N. Neu GEE bao loi, doi thanh 'EPSG:32648'

// Nguon mau: 4 dong duoi gop mau cu (train + test) thanh 1 tap diem cho moi lop.
// Neu ban cham lai mau moi, thay ten bien import tuong ung.
var SRC_WATER = ee.FeatureCollection(water_pts);
var SRC_VEG = ee.FeatureCollection(veg_pts);
var SRC_BUILT = ee.FeatureCollection(built_pts);
var SRC_BARE = ee.FeatureCollection(bare_pts);

var CLASS_KEYS = ['Nuoc', 'ThucVat', 'XayDung', 'DatTrong'];
var CLASS_VN   = ['Nuoc', 'Thuc vat', 'Xay dung', 'Dat trong'];

// ---------------------------------------------------------------------------
// 1. VUNG NGHIEN CUU (tu shapefile cua ban, trung voi base map ArcMap)
// ---------------------------------------------------------------------------
var roi = ee.FeatureCollection(ROI_ASSET).union(1).geometry();
Map.centerObject(roi, 9);
Map.addLayer(roi, {color: 'black'}, 'ROI', false);
print('Dien tich ROI (ha, geodesic):', roi.area(1).divide(10000));

// ---------------------------------------------------------------------------
// 2. ANH LANDSAT 8 + 9, LOC MAY, GHEP MEDIAN
// ---------------------------------------------------------------------------
function prep(img) {
  var qa = img.select('QA_PIXEL');
  // Bit 0 fill, 1 dilated cloud, 2 cirrus, 3 cloud, 4 cloud shadow => 0b11111 = 31
  var clear = qa.bitwiseAnd(31).eq(0);
  var notSat = img.select('QA_RADSAT').eq(0);
  var sr = img.select('SR_B[1-7]').multiply(0.0000275).add(-0.2);
  var st = img.select('ST_B10').multiply(0.00341802).add(149.0).rename('ST_B10'); // nhiet do be mat (K)
  return sr.addBands(st).updateMask(clear).updateMask(notSat)
           .copyProperties(img, ['system:time_start']);
}

function getCol(id, s, e) {
  return ee.ImageCollection(id)
    .filterBounds(roi)
    .filterDate(s, e)
    .filter(ee.Filter.lt('CLOUD_COVER', MAX_SCENE_CLOUD));
}
var l8 = getCol('LANDSAT/LC08/C02/T1_L2', START_DATE, END_DATE);
var l9 = getCol('LANDSAT/LC09/C02/T1_L2', START_DATE, END_DATE);
var annualRaw = getCol('LANDSAT/LC08/C02/T1_L2', ANNUAL_START, ANNUAL_END)
  .merge(getCol('LANDSAT/LC09/C02/T1_L2', ANNUAL_START, ANNUAL_END));
print('So canh Landsat 8+9 trong chuoi 12 thang:', annualRaw.size());
print('So canh Landsat 8:', l8.size());
print('So canh Landsat 9:', l9.size());

var collection = l8.merge(l9).map(prep);
var composite = collection.median().clip(roi);

var obs = collection.select('SR_B4').count().clip(roi);
Map.addLayer(composite, {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.3},
             'Composite mau tu nhien', false);
Map.addLayer(obs, {min: 0, max: 20, palette: ['white', 'yellow', 'green']},
             'So lan quan sat hop le', false);
print('Trung binh so quan sat hop le/pixel:',
      obs.reduceRegion({reducer: ee.Reducer.mean(), geometry: roi, scale: 300,
                        maxPixels: 1e10, tileScale: 4}));

// ---------------------------------------------------------------------------
// 3. DAC TRUNG: 7 BANG + 3 CHI SO (10 dac trung)
// ---------------------------------------------------------------------------
var ndvi = composite.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI'); // (NIR-Red)/(NIR+Red)
var ndwi = composite.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI'); // (Green-NIR)/(Green+NIR)
var ndbi = composite.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI'); // (SWIR1-NIR)/(SWIR1+NIR)
var mndwi = composite.normalizedDifference(['SR_B3', 'SR_B6']).rename('MNDWI'); // (Green-SWIR1)/(Green+SWIR1)
var bsi = composite.expression(
  '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))',
  {SWIR1: composite.select('SR_B6'), RED: composite.select('SR_B4'),
   NIR: composite.select('SR_B5'), BLUE: composite.select('SR_B2')}).rename('BSI'); // chi so dat trong
// Dac trung theo mua: phan vi 10, 50, 90 cua chi so tren chuoi anh 12 thang.
// Cong trinh, mat duong co NDVI thap quanh nam; cao su rung la, ruong sau thu hoach, mi thu hoach
// co NDVI thay doi manh theo mua. Day la thong tin giup tach Xay dung khoi Dat trong va Thuc vat.
function addIdx(img) {
  var ndviI = img.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  var ndbiI = img.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI');
  var mndwiI = img.normalizedDifference(['SR_B3', 'SR_B6']).rename('MNDWI');
  var bsiI = img.expression(
    '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))',
    {SWIR1: img.select('SR_B6'), RED: img.select('SR_B4'),
     NIR: img.select('SR_B5'), BLUE: img.select('SR_B2')}).rename('BSI');
  return ndviI.addBands([ndbiI, mndwiI, bsiI]);
}
var annualStats = annualRaw.map(prep).map(addIdx)
  .reduce(ee.Reducer.percentile([10, 50, 90])).clip(roi);
var ndviAmp = annualStats.select('NDVI_p90').subtract(annualStats.select('NDVI_p10'))
  .rename('NDVI_amp');
var stack = composite.addBands([ndvi, ndwi, ndbi, mndwi, bsi])
  .addBands(annualStats.select(['NDVI_p10', 'NDVI_p90', 'NDBI_p50', 'MNDWI_p50', 'BSI_p50']))
  .addBands(ndviAmp);

var FEATS_BANDS = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];
var FEATS_IDX   = FEATS_BANDS.concat(['NDVI', 'NDWI', 'NDBI']);
var FEATS_EXT   = FEATS_IDX.concat(['MNDWI', 'BSI', 'ST_B10']);   // 13 dac trung
var SEASONAL    = ['NDVI_p10', 'NDVI_p90', 'NDVI_amp', 'NDBI_p50', 'MNDWI_p50', 'BSI_p50'];
var FEATS_MT    = FEATS_IDX.concat(SEASONAL);    // 16 dac trung (10 co ban + 6 theo mua)
var FEATS_ALL   = FEATS_EXT.concat(SEASONAL);    // 19 dac trung, chi dung de chuan hoa
var SETS = {BANDS: FEATS_BANDS, BANDS_IDX: FEATS_IDX, EXT: FEATS_EXT, MT: FEATS_MT};
print('Bo dac trung da mua (MT):', FEATS_MT);
print('Bo dac trung mo rong (EXT):', FEATS_EXT);
print('Bo dac trung Bands:', FEATS_BANDS);
print('Bo dac trung Bands + Indices:', FEATS_IDX);

// Chuan hoa min-max theo phan vi 2-98 cua composite (can cho SVM, khong anh huong cay quyet dinh)
var pct = stack.select(FEATS_ALL).reduceRegion({
  reducer: ee.Reducer.percentile([2, 98]), geometry: roi, scale: 300,
  maxPixels: 1e10, tileScale: 4
});
var normStack = ee.Image.cat(FEATS_ALL.map(function (n) {
  var lo = ee.Number(pct.get(n + '_p2'));
  var hi = ee.Number(pct.get(n + '_p98'));
  return stack.select(n).subtract(lo).divide(hi.subtract(lo)).clamp(0, 1).rename(n);
}));

// ---------------------------------------------------------------------------
// 4. MAU: GOP DIEM, GAN KHOI O LUOI, LAY GIA TRI PHO
// ---------------------------------------------------------------------------
function toPoints(src, cls) {
  var coords = ee.FeatureCollection(src).geometry().coordinates();
  return ee.FeatureCollection(coords.map(function (c) {
    return ee.Feature(ee.Geometry.Point(c), {'class': cls});
  }));
}
var points = toPoints(SRC_WATER, 0)
  .merge(toPoints(SRC_VEG, 1))
  .merge(toPoints(SRC_BUILT, 2))
  .merge(toPoints(SRC_BARE, 3));

if (USE_EXTRA) {
  var extraPts = ee.FeatureCollection(EXTRA_DATA.map(function (r) {
    return ee.Feature(ee.Geometry.Point([r[0], r[1]]), {'class': r[2]});
  }));
  points = points.merge(extraPts);
}

// Khoi o luoi BLOCK_M x BLOCK_M (toa do UTM 48N) lam don vi chia train/test
points = points.map(function (f) {
  var xy = ee.List(f.geometry().transform('EPSG:32648', 1).coordinates());
  var bx = ee.Number(xy.get(0)).divide(BLOCK_M).floor().int();
  var by = ee.Number(xy.get(1)).divide(BLOCK_M).floor().int();
  return f.set('block', bx.format('%d').cat('_').cat(by.format('%d')));
});
print('Tong so diem mau goc theo lop:', points.aggregate_histogram('class'));

var purImg = stack.select(['NDVI', 'NDBI', 'MNDWI']).reduceNeighborhood({
  reducer: ee.Reducer.stdDev(), kernel: ee.Kernel.square(1, 'pixels')
}).reduce(ee.Reducer.mean()).rename('PUR');

var allDataRaw = normStack.addBands(purImg)
  .addBands(stack.select('NDVI_p90').rename('NDVI_p90_raw'))
  .sampleRegions({
    collection: points, properties: ['class', 'block'],
    scale: 30, tileScale: 4, geometries: true
  });

// Chan doan nhan: phan bo PUR va NDVI_p90 (anh thuc, chua chuan hoa) theo lop 0 Nuoc, 1 Thuc vat, 2 Xay dung, 3 Dat trong
['PUR', 'NDVI_p90_raw'].forEach(function (k) {
  print('Phan vi 50/75/90 cua ' + k + ' theo lop:',
    allDataRaw.reduceColumns({
      reducer: ee.Reducer.percentile([50, 75, 90]).group({groupField: 1, groupName: 'class'}),
      selectors: [k, 'class']
    }));
});
print('Giu lai theo lop neu PUR <= PUR_MAX:',
  allDataRaw.filter(ee.Filter.lte('PUR', PUR_MAX)).aggregate_histogram('class'));
Map.addLayer(allDataRaw.filter(ee.Filter.gt('PUR', PUR_MAX)), {color: 'ff00ff'},
             'Diem hon hop (PUR > PUR_MAX)', false);

var allData = APPLY_PURITY ? allDataRaw.filter(ee.Filter.lte('PUR', PUR_MAX)) : allDataRaw;
print('So diem co gia tri pho (sau khi bo diem roi vao vung may):', allData.size());
print('Phan bo theo lop sau lay mau:', allData.aggregate_histogram('class'));
print('So khoi o luoi co mau:', allData.aggregate_array('block').distinct().size());

function splitData(seed) {
  var keys = ee.List(allData.aggregate_array('block').distinct()).shuffle(seed);
  var nTrain = keys.size().multiply(TRAIN_FRAC).round();
  var trainKeys = keys.slice(0, nTrain);
  var inTrain = ee.Filter.inList('block', trainKeys);
  return {
    train: allData.filter(inTrain),
    test: allData.filter(inTrain.not())
  };
}
var sp0 = splitData(SEED_MAIN);
var train0 = sp0.train;
var test0 = sp0.test;
print('Train theo lop:', train0.aggregate_histogram('class'));
print('Test theo lop:', test0.aggregate_histogram('class'));
print('Tong Train / Test:', train0.size(), test0.size());

// ---------------------------------------------------------------------------
// 5. SO SANH 4 MO HINH x 2 BO DAC TRUNG TREN CUNG TAP TEST
// ---------------------------------------------------------------------------
function makeClassifier(name) {
  if (name === 'RF')   return ee.Classifier.smileRandomForest({numberOfTrees: 300, seed: 42});
  if (name === 'CART') return ee.Classifier.smileCart();
  if (name === 'GTB')  return ee.Classifier.smileGradientTreeBoost(
                               {numberOfTrees: 200, shrinkage: 0.1, samplingRate: 0.7, seed: 42});
  if (name === 'SVM')  return ee.Classifier.libsvm({kernelType: 'RBF', gamma: 0.5, cost: 10});
}

function evaluate(name, feats, train, test) {
  var model = makeClassifier(name).train({
    features: train, classProperty: 'class', inputProperties: feats
  });
  return test.classify(model).errorMatrix('class', 'classification', [0, 1, 2, 3]);
}

function metricsFeature(name, setName, cm, nTest) {
  var p = cm.consumersAccuracy().project([1]);   // Precision
  var r = cm.producersAccuracy().project([0]);   // Recall
  var f1 = p.multiply(r).multiply(2).divide(p.add(r));
  var d = {model: name, features: setName, n_test: nTest,
           OA: cm.accuracy(), Kappa: cm.kappa()};
  CLASS_KEYS.forEach(function (c, i) {
    d['P_' + c] = p.get([i]);
    d['R_' + c] = r.get([i]);
    d['F1_' + c] = f1.get([i]);
  });
  return ee.Feature(null, d);
}

var nTest0 = test0.size();
var resList = [];
['RF', 'CART', 'SVM', 'GTB'].forEach(function (m) {
  Object.keys(SETS).forEach(function (s) {
    resList.push(metricsFeature(m, s, evaluate(m, SETS[s], train0, test0), nTest0));
  });
});
var results = ee.FeatureCollection(resList);
print('BANG SO SANH MO HINH (cung tap Test):', results);
Export.table.toDrive({collection: results, description: 'DACN_ModelComparison',
                      folder: DRIVE_FOLDER, fileFormat: 'CSV'});

// Do on dinh: lap 5 lan chia khoi khac nhau, chi voi RF
if (RUN_REPEATS) {
  var rep = ee.FeatureCollection(ee.List.sequence(1, 5).map(function (s) {
    var sp = splitData(s);
    return ee.Feature(null, {
      seed: s,
      OA_bands: evaluate('RF', FEATS_BANDS, sp.train, sp.test).accuracy(),
      OA_bandsIdx: evaluate('RF', FEATS_IDX, sp.train, sp.test).accuracy(),
      OA_ext: evaluate('RF', FEATS_EXT, sp.train, sp.test).accuracy(),
      OA_mt: evaluate('RF', FEATS_MT, sp.train, sp.test).accuracy(),
      OA_svm_mt: evaluate('SVM', FEATS_MT, sp.train, sp.test).accuracy(),
      OA_gtb_mt: evaluate('GTB', FEATS_MT, sp.train, sp.test).accuracy()
    });
  }));
  print('RF lap 5 lan chia khoi:', rep);
  print('OA Bands: trung binh, do lech chuan:',
        rep.aggregate_mean('OA_bands'), rep.aggregate_sample_sd('OA_bands'));
  print('OA Bands+Indices: trung binh, do lech chuan:',
        rep.aggregate_mean('OA_bandsIdx'), rep.aggregate_sample_sd('OA_bandsIdx'));
  print('OA RF EXT: trung binh, do lech chuan:',
        rep.aggregate_mean('OA_ext'), rep.aggregate_sample_sd('OA_ext'));
  print('OA RF MT: trung binh, do lech chuan:',
        rep.aggregate_mean('OA_mt'), rep.aggregate_sample_sd('OA_mt'));
  print('OA SVM MT: trung binh, do lech chuan:',
        rep.aggregate_mean('OA_svm_mt'), rep.aggregate_sample_sd('OA_svm_mt'));
  print('OA GTB MT: trung binh, do lech chuan:',
        rep.aggregate_mean('OA_gtb_mt'), rep.aggregate_sample_sd('OA_gtb_mt'));
  Export.table.toDrive({collection: rep, description: 'DACN_RepeatedSplits',
                        folder: DRIVE_FOLDER, fileFormat: 'CSV'});
}

// ---------------------------------------------------------------------------
// 6. BAN DO CUOI (mo hinh duoc chon), DANH GIA TREN CHINH BAN DO XUAT
// ---------------------------------------------------------------------------
var finalFeats = SETS[CHOSEN_SET];
var finalModel = makeClassifier(CHOSEN_MODEL).train({
  features: train0, classProperty: 'class', inputProperties: finalFeats
});
var mapRaw = normStack.select(finalFeats).classify(finalModel);
var mapSmooth = mapRaw.focal_mode({radius: 1, kernelType: 'square', units: 'pixels'})
                      .updateMask(mapRaw.mask());   // giu nguyen vung khong co du lieu
var FINAL_MAP = USE_SMOOTH ? mapSmooth : mapRaw;

function evalMap(img) {
  return img.sampleRegions({collection: test0, properties: ['class'],
                            scale: 30, tileScale: 4})
            .errorMatrix('class', 'classification', [0, 1, 2, 3]);
}
var cmRaw = evalMap(mapRaw);
var cmSmooth = evalMap(mapSmooth);
print('OA ban do chua loc:', cmRaw.accuracy(), ' | OA ban do loc majority:', cmSmooth.accuracy());

var cmFinal = evalMap(FINAL_MAP);
print('Mo hinh chon:', CHOSEN_MODEL, CHOSEN_SET, 'Loc majority:', USE_SMOOTH);
print('Ma tran nham lan (hang = thuc te, cot = du doan, thu tu Nuoc, Thuc vat, Xay dung, Dat trong):',
      cmFinal);
var finalMetrics = ee.FeatureCollection([
  metricsFeature(CHOSEN_MODEL, CHOSEN_SET, cmFinal, test0.size())
]);
print('Metric ban do cuoi:', finalMetrics);
Export.table.toDrive({collection: finalMetrics, description: 'DACN_FinalMetrics',
                      folder: DRIVE_FOLDER, fileFormat: 'CSV'});

// Diem test bi phan loai sai: de ra soat nhan, phan tich loi (hang dung/sai o cot wrong)
var testPred = FINAL_MAP.sampleRegions({
  collection: test0, properties: ['class', 'block'], scale: 30, tileScale: 4, geometries: true
}).map(function (f) {
  return f.set('wrong', ee.Number(f.get('class')).neq(ee.Number(f.get('classification'))));
});
Map.addLayer(testPred.filter(ee.Filter.eq('wrong', 1)), {color: 'ff00ff'}, 'Diem test phan loai sai', false);
Export.table.toDrive({collection: testPred, description: 'DACN_TestPredictions',
                      folder: DRIVE_FOLDER, fileFormat: 'CSV'});

var classVis = {min: 0, max: 3, palette: ['0066ff', '33a800', 'ff0000', 'ffff00']};
Map.addLayer(FINAL_MAP, classVis, 'Lop phu cuoi (' + CHOSEN_MODEL + ', ' + CHOSEN_SET + ')');

// ---------------------------------------------------------------------------
// 7. DIEN TICH (ha) TREN CHINH BAN DO CUOI
// ---------------------------------------------------------------------------
var areaImg = ee.Image.pixelArea().divide(10000).addBands(FINAL_MAP);
var grp = ee.List(areaImg.reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),
  geometry: roi, scale: 30, maxPixels: 1e13, tileScale: 8
}).get('groups'));

var areaFC = ee.FeatureCollection(grp.map(function (g) {
  g = ee.Dictionary(g);
  var cls = ee.Number(g.get('class')).int();
  return ee.Feature(null, {class_id: cls, class_name: ee.List(CLASS_VN).get(cls),
                           area_ha: g.get('sum')});
}));
var noDataHa = ee.Number(ee.Image.pixelArea().divide(10000)
  .updateMask(FINAL_MAP.mask().not())
  .reduceRegion({reducer: ee.Reducer.sum(), geometry: roi, scale: 30,
                 maxPixels: 1e13, tileScale: 8}).get('area'));
print('Dien tich tung lop (ha):', areaFC);
print('Dien tich tong 4 lop (ha):', areaFC.aggregate_sum('area_ha'));
print('Dien tich khong co du lieu do may (ha):', noDataHa);
Export.table.toDrive({collection: areaFC, description: 'DACN_AreaByClass',
                      folder: DRIVE_FOLDER, fileFormat: 'CSV'});

// ---------------------------------------------------------------------------
// 8. XUAT MAU (phuc vu bang so luong mau o Chuong 2) VA BAN DO GEOTIFF
// ---------------------------------------------------------------------------
var samplesOut = train0.map(function (f) { return f.set('split', 'train'); })
  .merge(test0.map(function (f) { return f.set('split', 'test'); }))
  .select(['class', 'block', 'split']);
Export.table.toDrive({collection: samplesOut, description: 'DACN_Samples_Split',
                      folder: DRIVE_FOLDER, fileFormat: 'CSV'});

// 1-4 = lop, 255 = khong co du lieu trong ROI, 0 = ngoai ROI (dat NoData = 0 trong ArcMap)
var exportImg = FINAL_MAP.add(1).unmask(255).clip(roi).toByte();
Export.image.toDrive({
  image: exportImg,
  description: 'TayNinh_LandCover_v2',
  folder: DRIVE_FOLDER,
  region: roi.bounds(),
  scale: 30,
  crs: EXPORT_CRS,
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF'
});

// ============================================================================
// PHAN BO SUNG: MAU THAM CHIEU NGAU NHIEN PHAN TANG (DAN VAO CUOI SCRIPT CHINH)
// Muc dich: lay 4 x 100 diem ngau nhien trong tung lop CUA BAN DO CUOI de cham
// nhan doc lap (cham mu), tu do tinh do chinh xac va dien tich hieu chinh
// (Olofsson va cong su, 2014). Chi chay khi ban do cuoi da chot.
// Yeu cau: da co bien FINAL_MAP, roi, DRIVE_FOLDER tu script chinh.
// ============================================================================
var RUN_REF = false;                        // true = lay mau tham chieu MOI tu ban do hien tai (tao lai asset)
var RUN_REBUILD = false;                    // true = dung lai bang doi chieu cho asset da co (xem huong dan)
var RUN_KEY = false;                        // true = xuat bang doi chieu tu chinh asset (sau khi tac vu asset da xong)
var REF_SEED = 777;                         // vong 1 da dung 2026; vong kiem dinh cuoi dung seed khac
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
