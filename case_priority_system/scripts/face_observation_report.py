"""Render camera observations without converting movement into mental-state claims."""


def observation_description(summary: dict) -> str:
    if summary.get("measurements_version", 1) != 2:
        return (
            "Legacy facial heuristic record (unvalidated). Historical indices are not "
            "measurements of stress, emotion, recall, deception or credibility."
        )
    return (
        f"Usable tracking: {summary.get('visible_sec', 0)}s; "
        f"speech or mouth activity: {summary.get('time_speaking_sec', 0)}s; "
        f"completed blinks: {summary.get('blink_count', 0)}; "
        f"time with at least one sustained facial action: {summary.get('cue_observed_sec', 0)}s. "
        "Facial actions may overlap. Stress, internal emotion, recall, deception and credibility "
        "were not assessed. Mouth actions are withheld during articulation; "
        "eye direction is an approximate image-relative measurement."
    )
