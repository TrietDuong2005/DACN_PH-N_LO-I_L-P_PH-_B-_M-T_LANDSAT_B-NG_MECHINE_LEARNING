# -*- coding: utf-8 -*-
"""
McNemar va kiem dinh ghep cap giua 4 mo hinh (RF, CART, SVM, GTB, bo dac trung MT) tren cung tap test.
Dau vao: DACN_PerPointPredictions.csv (xuat tu dacn_bo_sung_v5.js), cot seed, block, class, p_RF, p_CART, p_SVM, p_GTB.
Cach chay: python kiem_dinh_mcnemar.py --pred DACN_PerPointPredictions.csv
Dau ra: (1) McNemar chinh xac (nhi thuc, hai phia) RF voi tung mo hinh, seed 42 va gop 6 lan chia, hieu chinh Holm;
        (2) khoang tin cay 95% bootstrap theo KHOI cua hieu OA (tinh den tuong quan khong gian giua cac diem trong cung khoi);
        (3) OA tung lan chia, kiem dinh t ghep cap va Friedman tren 5 lan lap, co CART.
"""
import argparse, itertools
import numpy as np, pandas as pd
from scipy import stats

MODELS = ['RF', 'CART', 'SVM', 'GTB']

def mcnemar_exact(a_ok, b_ok):
    b = int(np.sum(a_ok & ~b_ok)); c = int(np.sum(~a_ok & b_ok))
    n = b + c
    p = 1.0 if n == 0 else min(1.0, 2 * stats.binom.cdf(min(b, c), n, 0.5))
    return b, c, p

def holm(ps):
    order = np.argsort(ps); m = len(ps); out = np.empty(m); run = 0
    for rank, i in enumerate(order):
        run = max(run, (m - rank) * ps[i]); out[i] = min(1.0, run)
    return out

def block_boot_diff(df, a, b, nboot=5000, seed=7):
    """Bootstrap theo khoi: lay mau co hoan lai cac khoi (seed, block), tinh OA_a - OA_b."""
    rng = np.random.default_rng(seed)
    g = df.groupby(['seed', 'block']).apply(
        lambda d: pd.Series({'n': len(d), 'a': (d['p_' + a] == d['class']).sum(), 'b': (d['p_' + b] == d['class']).sum()}),
        include_groups=False).values
    k = len(g); diffs = []
    for _ in range(nboot):
        s = g[rng.integers(0, k, k)].sum(0)
        diffs.append((s[1] - s[2]) / s[0])
    return np.percentile(diffs, [2.5, 97.5])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--pred', required=True)
    a = ap.parse_args()
    df = pd.read_csv(a.pred)
    ok = {m: (df['p_' + m] == df['class']).values for m in MODELS}

    print('=== OA tung lan chia (bo MT) ===')
    oa = df.assign(**{m: ok[m] for m in MODELS}).groupby('seed')[MODELS].mean().round(4)
    n = df.groupby('seed').size().rename('n_test')
    print(pd.concat([n, oa], axis=1))

    for title, mask in [('Seed 42 (lan chia chinh cua bao cao)', df.seed == 42), ('Gop 6 lan chia (cac diem lap lai, chi tham khao)', df.seed >= 0)]:
        print('\n=== McNemar chinh xac, RF so voi mo hinh con lai: %s ===' % title)
        rows = []
        for m in MODELS[1:]:
            b, c, p = mcnemar_exact(ok['RF'][mask.values], ok[m][mask.values])
            rows.append((m, b, c, p))
        adj = holm(np.array([r[3] for r in rows]))
        sub = df[mask]
        for (m, b, c, p), pa in zip(rows, adj):
            lo, hi = block_boot_diff(sub, 'RF', m)
            print('RF vs %-4s | RF dung & %s sai = %3d | RF sai & %s dung = %3d | p = %.4f | p Holm = %.4f | hieu OA(RF-%s) 95%% theo khoi: %+.3f den %+.3f'
                  % (m, m, b, m, c, p, pa, m, lo, hi))

    print('\n=== Kiem dinh ghep cap tren 5 lan chia lap (seed 1 den 5), 4 mo hinh ===')
    acc = df[df.seed.isin([1, 2, 3, 4, 5])].assign(**{m: ok[m][df.seed.isin([1, 2, 3, 4, 5]).values] for m in MODELS}).groupby('seed')[MODELS].mean()
    print((acc * 100).round(2).to_string())
    print('Trung binh +- do lech chuan (diem): ' + '; '.join('%s %.2f +- %.2f' % (m, 100 * acc[m].mean(), 100 * acc[m].std(ddof=1)) for m in MODELS))
    ps = []
    for m in MODELS[1:]:
        d = acc[m] - acc['RF']
        t, p = stats.ttest_rel(acc[m], acc['RF']); ps.append(p)
        print('t ghep cap %-4s - RF: chenh TB %+.2f diem, t = %.2f, p = %.4f' % (m, 100 * d.mean(), t, p))
    print('p da hieu chinh Holm (3 so sanh):', np.round(holm(np.array(ps)), 4))
    fr = stats.friedmanchisquare(*[acc[m].values for m in MODELS])
    print('Friedman 4 mo hinh: chi2 = %.3f, p = %.4f' % (fr.statistic, fr.pvalue))
    fr3 = stats.friedmanchisquare(*[acc[m].values for m in ['RF', 'SVM', 'GTB']])
    print('Friedman 3 mo hinh khong tinh CART (RF, SVM, GTB): chi2 = %.3f, p = %.4f' % (fr3.statistic, fr3.pvalue))
    print('\nGhi chu: McNemar coi cac diem doc lap; diem trong cung khoi tuong quan khong gian nen p co the qua nho, can doc cung khoang tin cay bootstrap theo khoi.')

if __name__ == '__main__':
    main()
