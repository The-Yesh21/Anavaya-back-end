"""Evaluation helpers: fit preprocessing exclusively on each training partition."""

import numpy as np
from sklearn.metrics import accuracy_score
from sklearn.model_selection import StratifiedKFold


def encoded_split(train, test, encode_frame):
    X_train, y_train, encoders, tfidf, ohe = encode_frame(train, is_fit=True)
    X_test, y_test, _, _, _ = encode_frame(test, ohe=ohe, tfidf=tfidf, is_fit=False)
    return X_train, X_test[X_train.columns], y_train, y_test


def cross_validate_raw(frame, encode_frame, build_tree, folds=5):
    """Return scores with a fresh vocabulary, IDF, encoder and tree per fold."""
    splitter = StratifiedKFold(n_splits=folds, shuffle=True, random_state=42)
    scores = []
    for train_idx, test_idx in splitter.split(frame, frame['priority']):
        train = frame.iloc[train_idx].reset_index(drop=True)
        test = frame.iloc[test_idx].reset_index(drop=True)
        X_train, X_test, y_train, y_test = encoded_split(train, test, encode_frame)
        tree = build_tree()
        tree.fit(X_train, y_train)
        scores.append(accuracy_score(y_test, tree.predict(X_test)))
    return np.asarray(scores)
