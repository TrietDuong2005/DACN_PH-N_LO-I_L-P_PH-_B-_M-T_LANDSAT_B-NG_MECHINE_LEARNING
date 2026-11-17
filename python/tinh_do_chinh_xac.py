# -*- coding: utf-8 -*-
"""
Tinh do chinh xac va dien tich hieu chinh theo mau ngau nhien phan tang (Olofsson va cong su, 2014).

Dau vao:
  --labels  tep .txt chua chuoi nhan dang "id:nhan,id:nhan,..." (xuat tu cong cu cham nhan tren GEE)
  --key     tep CSV bang doi chieu (cot id, mc, lon, lat), mc = lop ban do 0 den 3
  --area    tep CSV dien tich tung lop tren ban do (cot class_id, area_ha)
Dau ra: in ra man hinh ma tran sai so, OA, Precision (UA), Recall (PA), F1, dien tich hieu chinh va khoang tin cay 95%.
Cach chay:  python tinh_do_chinh_xac.py --labels kq_vong2.md --key DACN_RefPoints_Key_FromAsset_vong2.csv --area DACN_AreaByClass.csv
"""
import argparse
import numpy as np
import pandas as pd

NAMES = ['Nuoc', 'Thuc vat', 'Xay dung', 'Dat trong']

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--labels', required=True)
    ap.add_argument('--key', required=True)
    ap.add_argument('--area', required=True)
    ap.add_argument('--boot', type=int, default=2000)
    a = ap.parse_args()

    txt = open(a.labels, encoding='utf-8').read().replace('\r', '').strip()
    labs = {int(i): int(l) for i, l in (x.split(':') for x in txt.split(','))}
    key = pd.read_csv(a.key)
    key['ref'] = key['id'].map(labs)
    key = key[key.ref.isin([0, 1, 2, 3])]          # bo diem 'Khong chac' (ma 9)
    area = pd.read_csv(a.area).sort_values('class_id').area_ha.values
    A = area.sum(); W = area / A

    cm = pd.crosstab(key.mc, key.ref).reindex(index=range(4), columns=range(4), fill_value=0).values.astype(float)
    n_i = cm.sum(1)
    print('Ma tran (hang = lop ban do, cot = lop tham chieu):'); print(cm)

    def estimate(c):
        ni = c.sum(1); p = W[:, None] * c / ni[:, None]
        return p, np.trace(p), np.diag(c) / ni, np.diag(p) / p.sum(0), p.sum(0)

    p, OA, UA, PA, pj = estimate(cm)
    se_oa = np.sqrt(np.sum(W**2 * UA * (1 - UA) / (n_i - 1)))
    se_p = np.sqrt(((W[:, None]**2) * (cm / n_i[:, None]) * (1 - cm / n_i[:, None]) / (n_i[:, None] - 1)).sum(0))
    print('\nOA hieu chinh = %.4f (+- %.4f)' % (OA, 1.96 * se_oa))
    for j in range(4):
        Nj = (area / n_i * cm[:, j]).sum()
        var_pa = (1 / Nj**2) * (area[j]**2 * (1 - PA[j])**2 * UA[j] * (1 - UA[j]) / (n_i[j] - 1)
                 + PA[j]**2 * sum(area[i]**2 * (cm[i, j] / n_i[i]) * (1 - cm[i, j] / n_i[i]) / (n_i[i] - 1) for i in range(4) if i != j))
        f1 = 2 * UA[j] * PA[j] / (UA[j] + PA[j])
        print('%-9s UA %.3f +- %.3f | PA %.3f +- %.3f | F1 %.3f | ban do %9.0f ha | hieu chinh %9.0f +- %7.0f ha (%.2f%%)' % (
            NAMES[j], UA[j], 1.96 * np.sqrt(UA[j] * (1 - UA[j]) / (n_i[j] - 1)), PA[j], 1.96 * np.sqrt(var_pa), f1,
            area[j], A * pj[j], 1.96 * A * se_p[j], 100 * pj[j]))

    rng = np.random.default_rng(1)
    groups = {i: key[key.mc == i].ref.values for i in range(4)}
    oas, f1s = [], []
    for _ in range(a.boot):
        c = np.zeros((4, 4))
        for i in range(4):
            s = rng.choice(groups[i], len(groups[i]))
            for j in range(4): c[i, j] = (s == j).sum()
        if (c.sum(0) == 0).any(): continue
        _, oa_, ua_, pa_, _ = estimate(c)
        oas.append(oa_)
        with np.errstate(all='ignore'): f1s.append(2 * ua_ * pa_ / (ua_ + pa_))
    f1s = np.array(f1s)
    print('\nOA bootstrap 95%%: %.3f den %.3f' % tuple(np.percentile(oas, [2.5, 97.5])))
    for j in range(4):
        print('F1 %-9s bootstrap 95%%: %.3f den %.3f' % ((NAMES[j],) + tuple(np.nanpercentile(f1s[:, j], [2.5, 97.5]))))
    pi_ = p.sum(1); pe = (pi_ * pj).sum()
    print('Kappa theo dien tich = %.3f' % ((OA - pe) / (1 - pe)))

if __name__ == '__main__':
    main()
