import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { InjectionManager } from 'resource:///org/gnome/shell/extensions/extension.js';

import { AppFieldDisplay } from './app_display.js';
import type { SearchController } from './search_controller.d.ts';
import { fadeIn, fadeOut } from './fade.js';

export default class AppFieldExtension extends Extension {
    declare private appFieldDisplay?: typeof AppFieldDisplay.prototype;
    declare private overviewControls?: OverviewControls.ControlsManager;
    declare private overviewLayoutManager?: OverviewControls.ControlsManagerLayout;
    declare private injectionManager?: InjectionManager;

    override enable() {
        const ext = this;
        this.appFieldDisplay = new AppFieldDisplay();

        this.overviewControls = Main.overview._overview.controls;
        this.overviewLayoutManager = this.overviewControls.layout_manager as OverviewControls.ControlsManagerLayout;

        this.overviewControls.add_child(this.appFieldDisplay);
        this.overviewLayoutManager._appDisplay = this.appFieldDisplay;

        this.injectionManager = new InjectionManager();

        this.injectionManager.overrideMethod(
            OverviewControls.ControlsManager.prototype,
            '_updateAppDisplayVisibility',
            () => function (params) {
                params ??= this._stateAdjustment.getStateTransitionParams();

                if (!ext.appFieldDisplay) return;

                const { initialState, finalState } = params;
                const state = initialState > finalState ? initialState : finalState;

                ext.appFieldDisplay.visible = state > OverviewControls.ControlsState.WINDOW_PICKER
                    && !(this._searchController as typeof SearchController.prototype)._searchActive;
                if (ext.appFieldDisplay.visible) {
                    global.stage.set_key_focus(ext.appFieldDisplay);
                }

            },
        );

        this.injectionManager.overrideMethod(
            OverviewControls.ControlsManager.prototype,
            '_onSearchChanged',
            originalFn => function () {
                originalFn.call(this);

                if (!ext.appFieldDisplay) return;

                const { searchActive } = this._searchController as typeof SearchController.prototype;

                if (searchActive) {
                    fadeOut(ext.appFieldDisplay);
                } else {
                    fadeIn(ext.appFieldDisplay);
                }
            },
        );
    }

    override disable() {
        if (this.overviewLayoutManager && this.overviewControls)
            this.overviewLayoutManager._appDisplay = this.overviewControls.appDisplay;
        if (this.appFieldDisplay)
            this.overviewControls?.remove_child(this.appFieldDisplay);
        this.appFieldDisplay?.destroy();
        this.injectionManager?.clear();

        if (this.overviewControls) {
            this.overviewControls.appDisplay._disconnectDnD();
            this.overviewControls.appDisplay._connectDnD();
        }

        this.appFieldDisplay = undefined;
        this.overviewControls = undefined;
        this.overviewLayoutManager = undefined;
        this.injectionManager = undefined;
    }
}
