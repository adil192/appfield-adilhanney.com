import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Shell from 'gi://Shell';

import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as AppMenu from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import type * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { AppFieldDisplay } from './app_display.js';

// Copied from resource:///org/gnome/shell/ui/dash.js
const DASH_ITEM_LABEL_SHOW_TIME = 150;
const DASH_ITEM_LABEL_HIDE_TIME = 100;

export const FieldAppIcon = GObject.registerClass(class FieldAppIcon extends AppDisplay.AppIcon {
    declare _tooltip?: St.Label;

    /** @ts-expect-error (This isn't the real _init signature, just a quirk of the .d.ts bindings) */
    override _init(params?: Partial<St.Button.ConstructorProps>, isDraggable?: boolean, expandTitleOnHover?: boolean): void;
    override _init(app: Shell.App, iconParams: Partial<AppDisplay.AppIcon.ConstructorProps> & {
        syncTooltip: () => void,
    }): void;
    override _init(app: Shell.App, iconParams: Partial<AppDisplay.AppIcon.ConstructorProps> & {
        syncTooltip?: () => void,
    }) {
        const syncTooltip = iconParams.syncTooltip!;
        delete iconParams.syncTooltip;

        iconParams.isDraggable = false;
        iconParams.showLabel = false;
        super._init(app, iconParams);

        this._tooltip = new St.Label({ text: this._name, style_class: 'dash-label' });
        this._tooltip.hide();
        Main.layoutManager.addChrome(this._tooltip);
        this._tooltip.connect('destroy', () => (this._tooltip = undefined));

        this.connect('sync-tooltip', syncTooltip);
        this.connect('destroy', () => {
            this._tooltip?.destroy();
        });
        this.connect('notify::hover', () => {
            this.emit('sync-tooltip');
        });
    }

    override popupMenu() {
        this.setForcedHighlight(true);

        if (!this._menu) {
            this._menu = new AppMenu.AppMenu(this, this._popupMenuSide, {
                favoritesSection: true,
                // @ts-expect-error (.d.ts incorrectly says showSingleWindow not showSingleWindows)
                showSingleWindows: true,
            });
            this._menu.setApp(this.app);
            this._menu.connect('open-state-changed', (_menu, isPoppedUp) => {
                if (!isPoppedUp)
                    this._onMenuPoppedDown();
            });
            Main.overview.connectObject('hiding',
                () => this._menu!.close(BoxPointer.PopupAnimation.NONE), this);

            Main.uiGroup.add_child(this._menu.actor);
            this._menuManager.addMenu(this._menu);
        }

        this.emit('menu-state-changed', true);

        this._menu.open();
        this.emit('sync-tooltip');

        return false;
    }

    /**
     * Shows a tooltip for this app.
     * This must only be called by {@link AppFieldDisplay.prototype._syncTooltip}.
     * Internal usage should call `emit('sync-tooltip')` instead.
     * 
     * This method is basically the same as {@link Dash.DashItemContainer.showLabel}
     */
    showTooltip() {
        if (!this._tooltip) return;

        this._tooltip.set_text(this._name);
        if (this._tooltip.opacity > 250) this._tooltip.opacity = 0;
        this._tooltip.show();

        const [stageX, stageY] = this.get_transformed_position();

        const itemWidth = this.allocation.get_width();

        const tooltipWidth = this._tooltip.get_width();
        const xOffset = Math.floor((itemWidth - tooltipWidth) / 2);
        const x = Math.clamp(stageX + xOffset, 0, global.stage.width - tooltipWidth);

        const node = this._tooltip.get_theme_node();
        const yOffset = node.get_length('-y-offset');

        const y = stageY - this._tooltip.height - yOffset;

        this._tooltip.set_position(x, y);
        this._tooltip.ease({
            opacity: 255,
            duration: DASH_ITEM_LABEL_SHOW_TIME * (1 - this._tooltip.opacity / 255),
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    hideTooltip() {
        this._tooltip?.ease({
            opacity: 0,
            duration: DASH_ITEM_LABEL_HIDE_TIME * (this._tooltip.opacity / 255),
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._tooltip?.hide(),
        });
    }
});
