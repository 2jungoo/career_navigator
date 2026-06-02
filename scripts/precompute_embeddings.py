"""
SBERT 임베딩 사전 계산 스크립트.
paraphrase-multilingual-MiniLM-L12-v2 (384-d) 모델로 다음 항목의 임베딩을 계산한다:
  - profile.<domain>  : 16개 도메인 시맨틱 프로파일
  - eval.<id>         : 평가셋 텍스트 (68개)
  - pdf.<id>          : 실제 자소서 PDF 텍스트 (30개)

실행 방법:
  pip install -r scripts/requirements.txt
  python scripts/precompute_embeddings.py

출력: public/data/embeddings.json
"""

import json
import os
import time
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).parent.parent
OUT_PATH = ROOT / "public" / "data" / "embeddings.json"
DOMAIN_PROFILES_PATH = ROOT / "src" / "data" / "domain_profiles.json"
EVAL_DATASET_PATH = ROOT / "src" / "data" / "evaluation_dataset.json"
PDF_CORPUS_PATH = ROOT / "public" / "data" / "pdf_corpus.json"

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def sanity_check(vectors: dict, model):
    """
    기본 검증: engineering 프로파일이 humanities 프로파일보다
    engineering 평가셋과 더 가까운지 확인.
    """
    eng_profile = np.array(vectors.get("profile.engineering", []))
    hum_profile = np.array(vectors.get("profile.humanities", []))
    eng_eval    = np.array(vectors.get("eval.eng-1", []))

    if eng_profile.size and hum_profile.size and eng_eval.size:
        sim_correct   = cosine_sim(eng_profile, eng_eval)
        sim_incorrect = cosine_sim(hum_profile, eng_eval)
        status = "PASS" if sim_correct > sim_incorrect else "WARN"
        print(f"\n[Sanity] cosine(profile.eng, eval.eng-1)={sim_correct:.4f}  "
              f"cosine(profile.hum, eval.eng-1)={sim_incorrect:.4f}  [{status}]")

    # 3x3 cross-domain similarity snippet
    domains = ["engineering", "data", "humanities"]
    print("\n[3×3 Cross-domain similarity (profile vs profile)]")
    print(f"{'':22}", end="")
    for d in domains:
        print(f"{d[:10]:>12}", end="")
    print()
    for d1 in domains:
        v1 = np.array(vectors.get(f"profile.{d1}", []))
        print(f"{d1[:22]:22}", end="")
        for d2 in domains:
            v2 = np.array(vectors.get(f"profile.{d2}", []))
            sim = cosine_sim(v1, v2) if v1.size and v2.size else 0.0
            print(f"{sim:>12.4f}", end="")
        print()


def main():
    print(f"모델 로딩: {MODEL_NAME}")
    t0 = time.time()
    model = SentenceTransformer(MODEL_NAME)
    print(f"  로딩 완료 ({time.time() - t0:.1f}s)")

    vectors: dict[str, list[float]] = {}
    texts_to_encode: list[tuple[str, str]] = []  # (key, text)

    # --- 1. 도메인 프로파일 (12개) ---
    domain_profiles = load_json(DOMAIN_PROFILES_PATH)
    for domain, text in domain_profiles.items():
        texts_to_encode.append((f"profile.{domain}", text))
    print(f"\n도메인 프로파일: {len(domain_profiles)}개")

    # --- 2. 평가 데이터셋 ---
    eval_dataset = load_json(EVAL_DATASET_PATH)
    for item in eval_dataset:
        texts_to_encode.append((f"eval.{item['id']}", item["text"]))
    print(f"평가 데이터셋: {len(eval_dataset)}개")

    # --- 3. 자소서 PDF (있을 경우) ---
    pdf_count = 0
    if PDF_CORPUS_PATH.exists():
        pdf_corpus = load_json(PDF_CORPUS_PATH)
        for item in pdf_corpus:
            # 긴 PDF 텍스트는 앞 1500자만 사용 (SBERT 토큰 한계 512)
            text = item["text"][:1500]
            texts_to_encode.append((f"pdf.{item['id']}", text))
            pdf_count += 1
        print(f"PDF 자소서: {pdf_count}개")
    else:
        print("PDF 코퍼스 없음 — 먼저 node scripts/extractPdfTexts.mjs 실행 권장")

    # --- 일괄 인코딩 ---
    print(f"\n총 {len(texts_to_encode)}개 항목 인코딩 중...")
    keys = [k for k, _ in texts_to_encode]
    texts = [t for _, t in texts_to_encode]

    t1 = time.time()
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True, normalize_embeddings=True)
    print(f"  인코딩 완료 ({time.time() - t1:.1f}s)")

    for key, emb in zip(keys, embeddings):
        vectors[key] = emb.tolist()

    # --- 검증 ---
    sanity_check(vectors, model)

    # --- 저장 ---
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "model": MODEL_NAME,
        "dim": int(embeddings.shape[1]),
        "normalized": True,
        "count": len(vectors),
        "vectors": vectors,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\n저장 완료: {OUT_PATH}")
    print(f"  항목 수: {len(vectors)}, 크기: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
