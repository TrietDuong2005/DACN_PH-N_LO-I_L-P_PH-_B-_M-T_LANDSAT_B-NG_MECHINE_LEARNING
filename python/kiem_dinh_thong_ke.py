# -*- coding: utf-8 -*-
"""Kiem dinh t cap tren OA cua 5 lan chia khoi (Bang PL6 trong bao cao).
Chay: python python/kiem_dinh_thong_ke.py --csv data/results/DACN_RepeatedSplits.csv
"""
import argparse
import numpy as np
import pandas as pd
from scipy import stats

PAIRS = [('OA_svm_mt', 'OA_mt', 'SVM so voi RF (bo MT)'),
         ('OA_gtb_mt', 'OA_mt', 'GTB so voi RF (bo MT)'),
         ('OA_svm_mt', 'OA_gtb_mt', 'SVM so voi GTB (bo MT)'),
         ('OA_mt', 'OA_bandsIdx', 'RF: MT so voi bang goc va chi so'),
         ('OA_mt', 'OA_ext', 'RF: MT so voi EXT'),
         ('OA_mt', 'OA_bands', 'RF: MT so voi bang goc'),
         ('OA_bandsIdx', 'OA_bands', 'RF: bang goc va chi so so voi bang goc'),
         ('OA_ext', 'OA_bandsIdx', 'RF: EXT so voi bang goc va chi so')]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', default='data/results/DACN_RepeatedSplits.csv')
    d = pd.read_csv(ap.parse_args().csv)
    n = len(d)
    print('OA trung binh (%%) va do lech chuan qua %d lan chia:' % n)
    print((d[[c for c in d.columns if c.startswith('OA_')]] * 100).agg(['mean', 'std']).round(2).T)
    print()
    for a, b, name in PAIRS:
        x = (d[a] - d[b]) * 100
        t, p = stats.ttest_rel(d[a] * 100, d[b] * 100)
        lo, hi = stats.t.interval(0.95, n - 1, x.mean(), x.std(ddof=1) / np.sqrt(n))
        print('%-40s hieu TB %+.2f | sd %.2f | CI95 (%.2f, %.2f) | t=%.2f | p=%.3f | %d/%d lan duong'
              % (name, x.mean(), x.std(ddof=1), lo, hi, t, p, (x > 0).sum(), n))
    f = stats.friedmanchisquare(d.OA_mt, d.OA_svm_mt, d.OA_gtb_mt)
    print('\nFriedman (RF, SVM, GTB tren bo MT): p = %.3f' % f.pvalue)
    # cong suat: chenh lech nho nhat phat hien duoc (80% cong suat, alpha 0.05)
    for sd in (0.82, 1.37):
        mdd = (stats.t.ppf(.975, n - 1) + stats.t.ppf(.8, n - 1)) * sd / np.sqrt(n)
        print('Chenh lech nho nhat phat hien duoc voi sd cua hieu = %.2f: %.2f diem' % (sd, mdd))

if __name__ == '__main__':
    main()
