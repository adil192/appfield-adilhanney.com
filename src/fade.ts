import Clutter from 'gi://Clutter';

import { SIDE_CONTROLS_ANIMATION_TIME } from 'resource:///org/gnome/shell/ui/overviewControls.js';

export const fadeOut = (actor: Clutter.Actor, onComplete?: () => void) => {
    actor.remove_all_transitions();
    if (actor.opacity < 1) return onComplete?.call(this);
    actor.ease({
        opacity: 0,
        duration: SIDE_CONTROLS_ANIMATION_TIME / 2 * (actor.opacity / 255),
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete,
    });
};
export const fadeIn = (actor: Clutter.Actor, onComplete?: () => void) => {
    actor.remove_all_transitions();
    if (actor.opacity > 254) return onComplete?.call(this);
    actor.ease({
        opacity: 255,
        duration: SIDE_CONTROLS_ANIMATION_TIME / 2 * (1 - actor.opacity / 255),
        mode: Clutter.AnimationMode.EASE_IN_QUAD,
        onComplete,
    });
}
