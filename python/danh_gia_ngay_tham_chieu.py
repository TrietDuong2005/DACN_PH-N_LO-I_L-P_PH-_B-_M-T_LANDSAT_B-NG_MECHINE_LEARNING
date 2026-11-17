# -*- coding: utf-8 -*-
"""
Danh gia anh huong cua ngay tham chieu: diem nao bien dong manh trong mua kho (NDVI nua dau khac nua cuoi)
co ty le bat dong giua nhan tham chieu va ban do cao hon khong, va do chinh xac hieu chinh khi chi lay diem on dinh.
Dau vao: --labels (txt), --key (id,mc,lon,lat), --area (DACN_AreaByClass.csv), --dyn (DACN_RefDynamics.csv, cot id va ndvi_s2_dau/cuoi, ndvi_l_dau/cuoi...)
Cach chay: python danh_gia_ngay_tham_chieu.py --labels kq.txt --key key.csv --area DACN_AreaByClass.csv --dyn DACN_RefDynamics.csv
"""
import argparse, numpy as np, pandas as pd
from scipy import stats
NAMES = ['Nuoc', 'Thuc vat', 'Xay dung', 'Dat trong']

def adjusted_oa(df, W):
    cm = pd.crosstab(df.mc, df.ref).reindex(index=range(4), columns=range(4), fill_value=0).values.astype(float)
    ni = cm.sum(1)
    if (ni < 2).any(): return np.nan, np.nan, cm
    UA = np.diag(cm) / ni
    oa = float(np.sum(W * UA)); se = float(np.sqrt(np.sum(W**2 * UA * (1 - UA) / (ni - 1))))
    return oa, 1.96 * se, cm

def main():
    ap = argparse.ArgumentParser()
    for k in ['labels', 'key', 'area', 'dyn']: ap.add_argument('--' + k, required=True)
    ap.add_argument('--nguong', type=float, nargs='+', default=[0.10, 0.15, 0.20])
    a = ap.parse_args()
    labs = {int(i): int(l) for i, l in (x.split(':') for x in open(a.labels, encoding='utf-8').read().replace('\r', '').strip().split(','))}
    key = pd.read_csv(a.key); key['ref'] = key.id.map(labs); key = key[key.ref.isin([0, 1, 2, 3])]
    area = pd.read_csv(a.area).sort_values('class_id').area_ha.values; W = area / area.sum()
    dyn = pd.read_csv(a.dyn)
    dyn = dyn.rename(columns={c: c + '_asset' for c in ['mc', 'lon', 'lat', 'ref'] if c in dyn.columns})
    if '.geo' in dyn.columns:
        import json
        xy = dyn['.geo'].map(lambda g: json.loads(g)['coordinates'])
        dyn['lon_d'] = xy.map(lambda c: c[0]); dyn['lat_d'] = xy.map(lambda c: c[1])
        chk = key.merge(dyn[['id', 'lon_d', 'lat_d']], on='id')
        bad = int(((chk.lon - chk.lon_d).abs() > 1e-5).sum())
        if bad > 0:
            raise SystemExit('LOI: %d/%d diem co toa do khong khop giua bang doi chieu va RefDynamics. Kiem tra REF_ASSET_ID (phai la DACN_ref_points_blind_r2).' % (bad, len(chk)))
    df = key.merge(dyn, on='id', how='left')
    df['agree'] = df.mc == df.ref
    for sensor in ['s2', 'l']:
        df['d_ndvi_' + sensor] = (df['ndvi_%s_cuoi' % sensor] - df['ndvi_%s_dau' % sensor]).abs()
    df['d_gan'] = (df['ndvi_l_gan'] - df['ndvi_l_kho']).abs() if 'ndvi_l_gan' in df else np.nan
    print('So diem co nhan hop le: %d, thieu gia tri dong: %d' % (len(df), df['d_ndvi_s2'].isna().sum()))
    oa_all, ci_all, _ = adjusted_oa(df, W)
    print('OA hieu chinh tat ca diem: %.3f +- %.3f | ty le dong y khong trong so: %.3f' % (oa_all, ci_all, df.agree.mean()))

    for sensor, label in [('s2', 'Sentinel-2 (anh nguoi gan nhan thay)'), ('l', 'Landsat (anh dung phan loai)')]:
        col = 'd_ndvi_' + sensor; sub = df.dropna(subset=[col])
        print('\n--- Do bien dong NDVI nua dau (T1-T2) va nua cuoi (T3-T4) mua kho, %s ---' % label)
        print('Phan vi 25/50/75/90 cua |dNDVI|: ', np.round(np.percentile(sub[col], [25, 50, 75, 90]), 3))
        for th in a.nguong:
            st = sub[sub[col] <= th]; un = sub[sub[col] > th]
            if len(un) < 5 or len(st) < 5: continue
            tab = [[st.agree.sum(), (~st.agree).sum()], [un.agree.sum(), (~un.agree).sum()]]
            odds, p = stats.fisher_exact(tab)
            oa_s, ci_s, _ = adjusted_oa(st, W)
            print('Nguong %.2f | on dinh n=%3d dong y %.3f | bien dong n=%3d dong y %.3f | Fisher p = %.4f | OA hieu chinh chi diem on dinh: %.3f +- %.3f'
                  % (th, len(st), st.agree.mean(), len(un), un.agree.mean(), p, oa_s, ci_s))
        rho, p = stats.spearmanr(sub[col], (~sub.agree).astype(int))
        print('Tuong quan Spearman giua muc bien dong va bat dong: rho = %.3f, p = %.4f' % (rho, p))
        print('Ty le bat dong theo nhom phan vi (tu thap den cao):')
        sub = sub.assign(q=pd.qcut(sub[col], 4, labels=['Q1', 'Q2', 'Q3', 'Q4'], duplicates='drop'))
        print((1 - sub.groupby('q', observed=True).agree.mean()).round(3).to_string())
    if df['d_gan'].notna().any():
        print('\nBien dong NDVI giua mua kho va T9-T10/2026 (Landsat): trung vi %.3f; diem thay doi > 0.2: %d (%.1f%%)' %
              (df.d_gan.median(), (df.d_gan > 0.2).sum(), 100 * (df.d_gan > 0.2).mean()))
    print('\nNhom bat dong lon nhat (ban do -> tham chieu):')
    bad = df[~df.agree].groupby(['mc', 'ref']).size().sort_values(ascending=False).head(5)
    for (m, r), n in bad.items(): print('  %s -> %s: %d diem' % (NAMES[m], NAMES[r], n))
if __name__ == '__main__':
    main()
