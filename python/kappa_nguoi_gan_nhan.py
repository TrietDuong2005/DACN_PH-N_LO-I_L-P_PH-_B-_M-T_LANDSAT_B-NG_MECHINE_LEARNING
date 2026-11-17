# -*- coding: utf-8 -*-
"""
Do muc dong y giua hai lan gan nhan (hai nguoi, hoac mot nguoi gan lai sau 1 den 2 tuan).
Dung 2 che do:
  chon : chon ngau nhien phan tang N diem tu bang doi chieu de nguoi thu hai gan (chi dua ID cho nguoi gan, khong dua lop ban do)
         python kappa_nguoi_gan_nhan.py chon --key key.csv --labels nhan1.txt --n 100 --seed 2026
  so    : tinh Cohen kappa giua nhan 1 va nhan 2, ma tran dong y, dong y theo lop, va OA khi doi sang nhan 2
         python kappa_nguoi_gan_nhan.py so --key key.csv --labels nhan1.txt --labels2 nhan2.txt
Dinh dang nhan: chuoi 'id:nhan,id:nhan,...' (nhan 0 Nuoc, 1 Thuc vat, 2 Xay dung, 3 Dat trong, 9 Khong chac)
"""
import argparse, numpy as np, pandas as pd
NAMES = ['Nuoc', 'Thuc vat', 'Xay dung', 'Dat trong']

def load(path):
    t = open(path, encoding='utf-8').read().replace('\r', '').replace('\n', '').strip()
    return {int(i): int(l) for i, l in (x.split(':') for x in t.split(',') if ':' in x)}

def cohen(x, y, k=4):
    cm = pd.crosstab(x, y).reindex(index=range(k), columns=range(k), fill_value=0).values.astype(float)
    n = cm.sum(); po = np.trace(cm) / n; pe = (cm.sum(0) * cm.sum(1)).sum() / n**2
    kap = (po - pe) / (1 - pe)
    # sai so chuan xap xi (Fleiss, Cohen va Everitt, 1969)
    se = np.sqrt(po * (1 - po) / (n * (1 - pe)**2))
    return kap, se, po, cm

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('mode', choices=['chon', 'so'])
    ap.add_argument('--key', required=True); ap.add_argument('--labels', required=True)
    ap.add_argument('--labels2'); ap.add_argument('--n', type=int, default=100); ap.add_argument('--seed', type=int, default=2026)
    a = ap.parse_args()
    key = pd.read_csv(a.key); l1 = load(a.labels); key['r1'] = key.id.map(l1); key = key[key.r1.isin([0, 1, 2, 3])]
    if a.mode == 'chon':
        per = a.n // 4; rng = np.random.default_rng(a.seed)
        ids = []
        for c in range(4):
            pool = key[key.mc == c].id.values
            ids += list(rng.choice(pool, min(per, len(pool)), replace=False))
        ids = sorted(int(i) for i in ids)
        print('DANH SACH %d ID (dan vao ONLY_IDS cua cong cu cham nhan):' % len(ids)); print(ids)
        return
    l2 = load(a.labels2); key['r2'] = key.id.map(l2); both = key[key.r2.isin([0, 1, 2, 3])].copy(); both['r1'] = both.r1.astype(int); both['r2'] = both.r2.astype(int)
    print('So diem co nhan 2 hop le: %d (loai %d diem 9 Khong chac hoac thieu)' % (len(both), key.r2.notna().sum() - len(both)))
    kap, se, po, cm = cohen(both.r1, both.r2)
    print('\nMa tran (hang = nhan 1, cot = nhan 2):'); print(pd.DataFrame(cm.astype(int), index=NAMES, columns=NAMES))
    print('\nDong y tho = %.3f | Cohen kappa = %.3f (sai so chuan %.3f; khoang 95%%: %.3f den %.3f)' % (po, kap, se, kap - 1.96 * se, kap + 1.96 * se))
    lvl = 'gan nhu hoan toan' if kap > .8 else 'dang ke' if kap > .6 else 'trung binh' if kap > .4 else 'thap'
    print('Muc dong y theo Landis va Koch (1977): %s' % lvl)
    for j in range(4):
        n1 = cm[j].sum(); n2 = cm[:, j].sum()
        print('%-9s nhan 1: %3d | nhan 2: %3d | dong y %3d' % (NAMES[j], n1, n2, cm[j, j]))
    print('\nDong y giua ban do va tung nguoi gan nhan tren cung %d diem: nhan 1 = %.3f | nhan 2 = %.3f' % (len(both), (both.mc == both.r1).mean(), (both.mc == both.r2).mean()))
    print('\nCac cap bat dong nhieu nhat (nhan 1 -> nhan 2):')
    for (i, j), n in both[both.r1 != both.r2].groupby(['r1', 'r2']).size().sort_values(ascending=False).head(5).items():
        print('  %s -> %s: %d' % (NAMES[i], NAMES[j], n))
if __name__ == '__main__':
    main()
