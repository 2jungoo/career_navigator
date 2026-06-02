"""
분류 헤드(Learned Head) 학습 스크립트 — 고도화 버전 (LogReg vs MLP, 실데이터 투입).

frozen SBERT(MiniLM-L12) 384-d 임베딩 위에 분류 헤드를 학습한다.
기존 코사인 유사도 분류기는 절대 변경하지 않으며, 이 헤드는 추가 레이어로만 사용된다.

고도화 요소 (소규모·불균형 데이터 대응):
  1. 표준화(StandardScaler) + 클래스 가중(LogReg) + 누수 없는 C 선택(nested CV).
  2. 알고리즘 ablation: 선형(LogReg) vs 비선형(MLP) 헤드를 동일 LOOCV로 정직 비교.
  3. 실데이터 투입: 합성 평가셋(eval)에 실제 자소서 PDF(pdf) 임베딩을 학습 corpus로
     추가했을 때 평가셋 정확도가 오르는지 nested LOOCV로 측정(PDF 없는 도메인은 합성만).

배포 헤드는 항상 LogReg다 — 브라우저 추론(classifierHead.js)이 W·x+b → softmax
선형 연산만 수행하기 때문. MLP는 알고리즘 비교(발표 근거)용으로만 평가한다.

출력:
  public/data/classifier_head.json      — 배포 헤드 (LogReg, mean/std/W/b)
  public/data/head_oof_predictions.json — 평가셋 LogReg nested LOOCV OOF (JS ablation 정직 수치)
  public/data/head_comparison.json      — LogReg vs MLP, eval vs eval+pdf 비교표 (발표용)
  public/data/learning_curve.json       — 데이터 크기별 성능(학습곡선)

실행:
  conda activate Language
  python scripts/train_classifier_head.py
"""

import json
import time
import warnings
from pathlib import Path

import numpy as np

# sklearn 전이기 FutureWarning / MLP 수렴 경고는 결과 가독성을 해치므로 억제 (동작 영향 없음)
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)
from sklearn.linear_model import LogisticRegression, LogisticRegressionCV
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import LeaveOneOut, StratifiedKFold, learning_curve
from sklearn.metrics import accuracy_score, f1_score, classification_report
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import make_pipeline

ROOT = Path(__file__).parent.parent
EMBEDDINGS_PATH = ROOT / "public" / "data" / "embeddings.json"
EVAL_DATASET_PATH = ROOT / "src" / "data" / "evaluation_dataset.json"
PDF_CORPUS_PATH = ROOT / "public" / "data" / "pdf_corpus.json"
HEAD_PATH = ROOT / "public" / "data" / "classifier_head.json"
OOF_PATH = ROOT / "public" / "data" / "head_oof_predictions.json"
CURVE_PATH = ROOT / "public" / "data" / "learning_curve.json"
COMPARISON_PATH = ROOT / "public" / "data" / "head_comparison.json"

# 기존 precompute_embeddings.py / nlpSimulator.js 와 동일한 도메인 순서 유지
DOMAINS = [
    "engineering", "data", "planning", "research", "management",
    "public_admin", "economics", "business", "nursing_health",
    "natural_science", "humanities", "arts_design",
    "manufacturing", "energy_plant", "aerospace", "media_content",
]

CS_GRID = np.logspace(-2, 2, 9)  # C 후보 (0.01 ~ 100)
COSINE_REF = 0.971               # SBERT-Hybrid(코사인) 기준선 (runFullEvaluation.mjs)
SEED = 42

# MLP 헤드 설정: 소규모 데이터(클래스당 5개) → 강한 L2(alpha) + 단일 은닉층으로 과적합 억제.
# MLPClassifier는 class_weight를 지원하지 않아 불균형 보정은 못 한다(비교의 한계로 명시).
MLP_HIDDEN = (128,)
MLP_ALPHA = 1e-2


def load_vectors():
    print("임베딩 로드 중...")
    with open(EMBEDDINGS_PATH, encoding="utf-8") as f:
        emb_json = json.load(f)
    return {k: np.array(v, dtype=np.float32) for k, v in emb_json["vectors"].items()}


def load_eval(vectors):
    with open(EVAL_DATASET_PATH, encoding="utf-8") as f:
        dataset = json.load(f)
    X, y, ids, missing = [], [], [], []
    for item in dataset:
        key = f"eval.{item['id']}"
        if key not in vectors:
            missing.append(key)
            continue
        X.append(vectors[key])
        y.append(item["label"])
        ids.append(item["id"])
    if missing:
        print(f"  경고: eval 임베딩 없음 {len(missing)}개 — {missing[:5]}")
    return np.stack(X), y, ids


def load_pdf(vectors):
    """실제 자소서 PDF 임베딩(pdf.*) + 파일명 기반 라벨. 없으면 (None, [], [])."""
    if not PDF_CORPUS_PATH.exists():
        return None, [], []
    with open(PDF_CORPUS_PATH, encoding="utf-8") as f:
        corpus = json.load(f)
    X, y, ids = [], [], []
    for item in corpus:
        key = f"pdf.{item['id']}"
        label = item.get("label")
        if key not in vectors or not label:
            continue
        X.append(vectors[key])
        y.append(label)
        ids.append(item["id"])
    if not X:
        return None, [], []
    return np.stack(X), y, ids


def make_logreg_estimator():
    """표준화 + 클래스가중 + 내부 CV(C 자동선택). 배포 헤드와 동일 알고리즘.
    내부 cv=2 — 외부 LOOCV가 1개를 빼도 최소 클래스(5개)가 충분히 남아 안전."""
    return make_pipeline(
        StandardScaler(),
        LogisticRegressionCV(
            Cs=CS_GRID, cv=2, class_weight="balanced",
            solver="lbfgs", max_iter=5000, scoring="accuracy", random_state=SEED,
        ),
    )


def make_mlp_estimator():
    """표준화 + 단일 은닉층 MLP (알고리즘 비교 전용, 배포 안 함)."""
    return make_pipeline(
        StandardScaler(),
        MLPClassifier(
            hidden_layer_sizes=MLP_HIDDEN, alpha=MLP_ALPHA,
            max_iter=3000, random_state=SEED,
        ),
    )


def nested_loocv(X, y_enc, n_classes, make_est, want_proba=False):
    """외부 LOOCV. LogReg는 내부 C선택(누수 없음), MLP는 고정 hp. OOF 예측/확률 반환."""
    loo = LeaveOneOut()
    oof_pred = np.zeros(len(y_enc), dtype=int)
    oof_prob = np.zeros((len(y_enc), n_classes), dtype=np.float32) if want_proba else None
    for tr, te in loo.split(X):
        est = make_est()
        est.fit(X[tr], y_enc[tr])
        oof_pred[te] = est.predict(X[te])
        if want_proba:
            proba = est.predict_proba(X[te])[0]
            for j, c in enumerate(est.classes_):  # fold별 클래스 순서를 전체 인덱스에 정렬
                oof_prob[te, c] = proba[j]
    return oof_pred, oof_prob


def evaluate(X, y_enc, n_classes, make_est, name, want_proba=False):
    t0 = time.time()
    pred, prob = nested_loocv(X, y_enc, n_classes, make_est, want_proba)
    acc = accuracy_score(y_enc, pred)
    f1 = f1_score(y_enc, pred, average="macro", zero_division=0)
    print(f"  [{name:>10}] acc={acc * 100:5.1f}%  macroF1={f1:.4f}  ({time.time() - t0:.1f}s)")
    return {"pred": pred, "prob": prob, "acc": acc, "f1": f1}


def compute_learning_curve(X, y_enc, best_C):
    """데이터 크기별 성능(학습곡선). C는 고정(best_C)해 데이터-크기 변수만 분리."""
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=SEED)
    fixed = make_pipeline(
        StandardScaler(),
        LogisticRegression(C=best_C, class_weight="balanced",
                           solver="lbfgs", max_iter=5000, random_state=SEED),
    )
    train_sizes = np.linspace(0.25, 1.0, 7)
    sizes_abs, _, acc_te = learning_curve(
        fixed, X, y_enc, train_sizes=train_sizes, cv=cv,
        scoring="accuracy", shuffle=True, random_state=SEED,
    )
    _, _, f1_te = learning_curve(
        fixed, X, y_enc, train_sizes=train_sizes, cv=cv,
        scoring="f1_macro", shuffle=True, random_state=SEED,
    )
    return {
        "cv_folds": 3,
        "fixed_C": round(float(best_C), 4),
        "config": "StandardScaler + LogReg(class_weight=balanced), C 고정",
        "note": "cv=3 기준 데이터 크기 효과의 추세. 곡선이 상승 중이면 데이터 확대 여지를 시사.",
        "trainSizes": [int(s) for s in sizes_abs],
        "accMean": [round(float(v), 4) for v in acc_te.mean(axis=1)],
        "accStd": [round(float(v), 4) for v in acc_te.std(axis=1)],
        "f1Mean": [round(float(v), 4) for v in f1_te.mean(axis=1)],
        "f1Std": [round(float(v), 4) for v in f1_te.std(axis=1)],
        "cosineRef": COSINE_REF,
        "randomRef": round(1.0 / 16, 4),
    }


def main():
    vectors = load_vectors()
    Xe, ye, ide = load_eval(vectors)
    Xp, yp, idp = load_pdf(vectors)
    n_pdf = len(idp)
    print(f"  평가셋: {len(ide)}개, 실데이터 PDF: {n_pdf}개, 차원: {Xe.shape[1]}")

    # 라벨 인코더는 eval+pdf 전체 라벨로 fit (클래스 인덱스 일관)
    le = LabelEncoder()
    le.fit(ye + yp)
    n_classes = len(le.classes_)
    ye_enc = le.transform(ye)

    # ── 1. 알고리즘 ablation: 평가셋 nested LOOCV (LogReg vs MLP) ──
    print("\n[1] 알고리즘 비교 (평가셋 nested LOOCV)")
    res_lr = evaluate(Xe, ye_enc, n_classes, make_logreg_estimator, "LogReg", want_proba=True)
    res_mlp = evaluate(Xe, ye_enc, n_classes, make_mlp_estimator, "MLP", want_proba=False)
    verdict = ("선형(LogReg)이 우수 — 소규모 데이터에서 비선형 MLP는 이점이 없다"
               if res_lr["acc"] >= res_mlp["acc"]
               else "MLP가 우수하나 브라우저 추론 호환성(선형)을 위해 배포는 LogReg 유지")
    print(f"  → {verdict}")

    # LogReg OOF(평가셋)를 ablation 정직 수치로 저장 — 배포 헤드와 동일 알고리즘
    oof_pred_labels = le.inverse_transform(res_lr["pred"])
    acc, macro_f1 = res_lr["acc"], res_lr["f1"]
    print(f"\n[배포(LogReg) 평가셋 nested LOOCV]  acc={acc * 100:.1f}%  macroF1={macro_f1:.4f}")
    print(classification_report(ye, oof_pred_labels, zero_division=0))

    oof_data = []
    for i, eval_id in enumerate(ide):
        probs = {DOMAINS[j]: float(res_lr["prob"][i, le.transform([DOMAINS[j]])[0]])
                 for j in range(len(DOMAINS)) if DOMAINS[j] in le.classes_}
        oof_data.append({
            "id": eval_id,
            "label": ye[i],
            "predicted": oof_pred_labels[i],
            "correct": bool(ye[i] == oof_pred_labels[i]),
            "probs": probs,
        })
    with open(OOF_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "method": "LogReg nested-LOOCV (standardized, class_weight=balanced, leakage-free C)",
            "accuracy": round(acc, 4),
            "macroF1": round(macro_f1, 4),
            "predictions": oof_data,
        }, f, ensure_ascii=False, indent=2)
    print(f"OOF 예측 저장: {OOF_PATH}")

    # ── 2. 실데이터 투입 효과: eval+pdf nested LOOCV (LogReg) ──
    real_effect = None
    use_pdf_for_deploy = False
    if n_pdf > 0:
        print("\n[2] 실데이터 투입 효과 (eval+pdf nested LOOCV, LogReg)")
        Xc = np.vstack([Xe, Xp])
        yc_enc = le.transform(ye + yp)
        res_comb = evaluate(Xc, yc_enc, n_classes, make_logreg_estimator, "LogReg+PDF")
        # 합친 corpus에서 '평가셋 항목'만의 정확도 → pdf를 학습에 더했을 때 eval 정확도 변화
        eval_acc_with_pdf = accuracy_score(yc_enc[:len(ide)], res_comb["pred"][:len(ide)])
        pdf_item_acc = accuracy_score(yc_enc[len(ide):], res_comb["pred"][len(ide):])
        print(f"  평가셋 항목 정확도: eval-only {acc * 100:.1f}% → eval+pdf학습 {eval_acc_with_pdf * 100:.1f}%")
        print(f"  (그중 PDF 항목 정확도: {pdf_item_acc * 100:.1f}%)")
        use_pdf_for_deploy = eval_acc_with_pdf >= acc
        real_effect = {
            "evalAccEvalOnly": round(acc, 4),
            "evalAccWithPdf": round(float(eval_acc_with_pdf), 4),
            "pdfItemAcc": round(float(pdf_item_acc), 4),
            "combinedAcc": round(res_comb["acc"], 4),
            "combinedSize": int(len(yc_enc)),
            "helped": bool(use_pdf_for_deploy),
        }

    # ── 3. 배포 헤드 학습 (LogReg, corpus는 실데이터가 도움될 때만 포함) ──
    if use_pdf_for_deploy:
        deploy_X = np.vstack([Xe, Xp])
        deploy_y = le.transform(ye + yp)
        trained_on = "eval+pdf"
    else:
        deploy_X, deploy_y = Xe, ye_enc
        trained_on = "eval"
    print(f"\n[3] 배포 헤드 학습 (LogReg, corpus={trained_on}, {len(deploy_y)}개)")
    final = make_logreg_estimator()
    final.fit(deploy_X, deploy_y)
    scaler = final.named_steps["standardscaler"]
    clf = final.named_steps["logisticregressioncv"]
    best_C = float(clf.C_[0])
    print(f"  선택 C: {best_C:.3g}")

    W_full = np.zeros((len(DOMAINS), deploy_X.shape[1]), dtype=np.float32)
    b_full = np.zeros(len(DOMAINS), dtype=np.float32)
    for i, domain in enumerate(DOMAINS):
        if domain in le.classes_:
            cls_idx = list(le.classes_).index(domain)
            W_full[i] = clf.coef_[cls_idx]
            b_full[i] = clf.intercept_[cls_idx]

    head = {
        "model": "paraphrase-multilingual-MiniLM-L12-v2",
        "method": "LogisticRegression_frozen_SBERT (standardized, class_weight=balanced)",
        "trainedOn": trained_on,
        "domains": DOMAINS,
        "dim": int(deploy_X.shape[1]),
        "C": round(best_C, 4),
        "loocv_accuracy": round(acc, 4),       # 평가셋 nested LOOCV (정직 수치)
        "loocv_macroF1": round(macro_f1, 4),
        "W": W_full.tolist(),
        "b": b_full.tolist(),
        "mean": scaler.mean_.astype(np.float32).tolist(),
        "std": scaler.scale_.astype(np.float32).tolist(),
    }
    with open(HEAD_PATH, "w", encoding="utf-8") as f:
        json.dump(head, f, ensure_ascii=False)
    print(f"  헤드 저장: {HEAD_PATH}  ({HEAD_PATH.stat().st_size / 1024:.1f} KB)")

    # ── 4. 알고리즘/실데이터 비교표 저장 (발표용) ──
    comparison = {
        "evalOnly": {
            "logreg": {"accuracy": round(res_lr["acc"], 4), "macroF1": round(res_lr["f1"], 4)},
            "mlp": {"accuracy": round(res_mlp["acc"], 4), "macroF1": round(res_mlp["f1"], 4)},
        },
        "realDataEffect": real_effect,
        "deploy": {"model": "LogReg", "trainedOn": trained_on, "C": round(best_C, 4),
                   "size": int(len(deploy_y))},
        "evalSize": len(ide),
        "pdfSize": n_pdf,
        "cosineRef": COSINE_REF,
        "note": ("배포 헤드는 브라우저 선형 추론(W·x+b)과의 호환을 위해 LogReg 고정. "
                 "MLP는 알고리즘 비교 전용. 실데이터(PDF)는 평가셋 정확도가 오를 때만 학습에 포함."),
    }
    with open(COMPARISON_PATH, "w", encoding="utf-8") as f:
        json.dump(comparison, f, ensure_ascii=False, indent=2)
    print(f"  비교표 저장: {COMPARISON_PATH}")

    # ── 5. 학습곡선 (배포 corpus 기준, 데이터 크기 효과) ──
    print("\n[4] 학습곡선 실험 (데이터 크기별 성능)...")
    curve = compute_learning_curve(deploy_X, deploy_y, best_C)
    with open(CURVE_PATH, "w", encoding="utf-8") as f:
        json.dump(curve, f, ensure_ascii=False, indent=2)
    for n, a, fm in zip(curve["trainSizes"], curve["accMean"], curve["f1Mean"]):
        print(f"  n={n:3d}  acc={a * 100:5.1f}%  f1={fm:.3f}")
    print(f"  학습곡선 저장: {CURVE_PATH}")

    print(f"\n완료. 배포(LogReg) 평가셋 LOOCV acc={acc * 100:.1f}%  macroF1={macro_f1:.4f}  (vs 코사인 {COSINE_REF * 100:.1f}%)")


if __name__ == "__main__":
    main()
