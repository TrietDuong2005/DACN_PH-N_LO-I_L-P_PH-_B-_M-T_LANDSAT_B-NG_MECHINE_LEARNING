# -*- coding: utf-8 -*-
"""Doi chieu dien tich vung nghien cuu (Bang PL2 trong bao cao).
Giai thich khoan chenh 3.420,52 ha giua dien tich da giac tren GEE (mat cau) va tong dien tich cac lop (pixelArea).
Chay: python python/kiem_tra_dien_tich.py --shp duong_dan/ranh_gioi_tay_ninh_moi_dissolve.shp [--tif data/output/TayNinh_LandCover_RF_MT_2026.tif]
Yeu cau: pyshp, shapely, pyproj, rasterio, numpy (xem requirements.txt)
"""
import argparse
import numpy as np
import shapefile
from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Geod, Transformer

GEE_AREA_HA = 858912.63        # ROI.area(1) tren GEE (mat cau)
SUM_LAYERS_HA = 855482.80 + 9.31   # tong 4 lop + vung khong co du lieu (pixelArea)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shp', required=True)
    ap.add_argument('--tif', default=None)
    a = ap.parse_args()
    g = shape(shapefile.Reader(a.shp).shape(0).__geo_interface__)
    ell = abs(Geod(ellps='WGS84').geometry_area_perimeter(g)[0]) / 1e4
    sph = abs(Geod(a=6371007.181, b=6371007.181).geometry_area_perimeter(g)[0]) / 1e4
    t = Transformer.from_crs(4326, 3405, always_xy=True)
    utm = transform(t.transform, g).area / 1e4
    print('Dien tich da giac (ha)')
    print('  mat cau R=6371007.181 m : %12.2f   (GEE: %.2f)' % (sph, GEE_AREA_HA))
    print('  ellipsoid WGS84         : %12.2f' % ell)
    print('  mat phang UTM 48N       : %12.2f' % utm)
    print('  tong 4 lop + khong DL   : %12.2f' % SUM_LAYERS_HA)
    gap = GEE_AREA_HA - SUM_LAYERS_HA
    print('\nChenh lech can giai thich: %.2f ha' % gap)
    print('  do mo hinh mat cau so voi ellipsoid : %.2f ha (%.2f%%)' % (GEE_AREA_HA - ell, 100 * (GEE_AREA_HA - ell) / gap))
    print('  do bien da giac khac bien diem anh   : %.2f ha (%.2f%%)' % (ell - SUM_LAYERS_HA, 100 * (ell - SUM_LAYERS_HA) / gap))
    print('So voi Nghi quyet 202/2025/QH15 (853.644 ha): %+.2f%%' % (100 * (ell - 853644) / 853644))
    if a.tif:
        import rasterio
        from pyproj import Proj
        with rasterio.open(a.tif) as r:
            arr = r.read(1); tr = r.transform
        rows, cols = np.nonzero(arr)
        x = tr.c + (cols + 0.5) * tr.a; y = tr.f + (rows + 0.5) * tr.e
        lon, lat = Transformer.from_crs(r.crs, 4326, always_xy=True).transform(x, y)
        sc = np.asarray(Proj(r.crs).get_factors(lon, lat).areal_scale)
        print('\nTep GeoTIFF: %d diem anh, dien tich thuc (ellipsoid) %.2f ha' % (len(x), (r.res[0] * r.res[1] / sc).sum() / 1e4))

if __name__ == '__main__':
    main()
