# -*- coding: utf-8 -*-
"""
So sanh cac bo dac trung thu nghiem (MT, MT_PLUS, MT_IBI_EBBI_UI, MT_TEXTURE) voi RF tren 6 lan chia khoi.
Dau vao: DACN_ThuNghiemDacTrung.csv. Cach chay: python so_sanh_thu_nghiem.py --file DACN_ThuNghiemDacTrung.csv
Dau ra: trung binh +- sd tren seed 1 den 5; kiem dinh t ghep cap voi MT; ket luan co/khong cai thien Xay dung va Dat trong.
"""
import argparse, numpy as np, pandas as pd
from scipy import stats
COLS = [('OA', 'OA'), ('F1_XayDung', 'F1 Xay dung'), ('P_XayDung', 'Precision Xay dung'), ('R_XayDung', 'Recall Xay dung'),
        ('F1_DatTrong', 'F1 Dat trong'), ('P_DatTrong', 'Precision Dat trong'), ('R_DatTrong', 'Recall Dat trong')]
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--file', required=True); a = ap.parse_args()
    d = pd.read_csv(a.file)
    sets = [s for s in ['MT', 'MT_PLUS', 'MT_IBI_EBBI_UI', 'MT_TEXTURE'] if s in set(d.features)]
    rep = d[d.seed.isin([1, 2, 3, 4, 5])]
    print('Seed 42 (lan chia chinh):')
    print(d[d.seed == 42].set_index('features').loc[sets, [c for c, _ in COLS]].round(3).to_string())
    print('\nTrung binh +- sd tren 5 lan lap (seed 1 den 5), kiem dinh t ghep cap so voi MT:')
    base = rep[rep.features == 'MT'].set_index('seed')
    for s in sets:
        cur = rep[rep.features == s].set_index('seed')
        line = []
        for c, nm in COLS:
            x = cur[c]; m = '%s %.3f+-%.3f' % (nm, x.mean(), x.std(ddof=1))
            if s != 'MT':
                diff = x - base[c]; t, p = stats.ttest_rel(x, base[c]); m += ' (chenh %+.3f, p=%.3f)' % (diff.mean(), p)
            line.append(m)
        print('- %-15s | ' % s + ' | '.join(line))
    print('\nQuy tac doc: chi coi la cai thien khi F1 tang >= 0.03 va p < 0.05 tren 5 lan lap, dong thoi OA khong giam. Neu khong, ghi la thu nghiem khong cai thien va neu huong khac (them Sentinel-1/2, mau thuc dia).')
if __name__ == '__main__':
    main()
