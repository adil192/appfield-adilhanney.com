import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Shell from 'gi://Shell';

import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as IconGrid from 'resource:///org/gnome/shell/ui/iconGrid.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import type * as Overview from 'resource:///org/gnome/shell/ui/overview.js';
import * as ParentalControlsManager from 'resource:///org/gnome/shell/misc/parentalControlsManager.js';

import { fadeIn, fadeOut } from './fade.js';
import { FieldLayoutManager } from './layout_manager.js';
import { FieldAppIcon } from './field_app_icon.js';

// Copied from resource:///org/gnome/shell/ui/dash.js
const DASH_ITEM_HOVER_TIMEOUT = 300;

export namespace AppFieldDisplay {
    export interface SignalSignatures extends St.Widget.SignalSignatures {
        'view-loaded': () => void;
    }
}
export const AppFieldDisplay = GObject.registerClass(
    {
        Signals: {
            'view-loaded': {},
        },
    },
    class AppFieldDisplay extends St.Widget implements AppDisplay.AppDisplay {
        declare _appSystem: Shell.AppSystem;
        declare _appUsage: Shell.AppUsage;
        declare _parentalControlsManager: ParentalControlsManager.ParentalControlsManager;
        declare _overview: Overview.Overview;
        declare _collator: Intl.Collator;

        declare _redisplayWorkId: string;
        declare _onAppSystemChanged?: number;
        declare _onAppFilterChanged?: number;

        declare _appField: St.Widget<typeof FieldLayoutManager.prototype, Clutter.Content>;
        declare _items: Map<string, typeof FieldAppIcon.prototype>;
        declare _appIcons: typeof FieldAppIcon.prototype[];
        declare _appInfoList: GioUnix.DesktopAppInfo[];
        declare _placeholder: typeof FieldAppIcon.prototype | null;

        /**
         * Whether a tooltip is showing.
         * 
         * This is used when the user hovers over a new app:
         * - When false, the new tooltip will show after {@link DASH_ITEM_HOVER_TIMEOUT}.
         * - When true, the tooltip will be shown immediately.
         */
        declare _tooltipShowing?: boolean;
        declare _showTooltipTimeoutId?: number;
        declare _resetTooltipShowingTimeoutId?: number;

        override _init() {
            super._init({
                layout_manager: new Clutter.BinLayout(),
                can_focus: true,
                reactive: true
            });

            this._appSystem = Shell.AppSystem.get_default();
            this._appUsage = Shell.AppUsage.get_default();
            this._parentalControlsManager = ParentalControlsManager.getDefault();
            this._overview = Main.overview;
            this._collator = new Intl.Collator(undefined, { sensitivity: 'accent' });

            this._appField = new St.Widget({
                layout_manager: new FieldLayoutManager(),
                x_expand: true,
                y_expand: true,
            });
            this.add_child(this._appField);
            this._items = new Map();
            this._appIcons = [];
            this._appInfoList = [];
            this._connectSignals();
            this._redisplayWorkId = Main.initializeDeferredWork(this, () => this._redisplay());
        }

        _connectSignals() {
            // Redisplay the app grid when an app was installed or removed
            this._onAppSystemChanged = this._appSystem.connect('installed-changed', () => {
                if (this._redisplayWorkId) Main.queueDeferredWork(this._redisplayWorkId);
            });
            // Redisplay when parental controls change
            this._onAppFilterChanged = this._parentalControlsManager.connect('app-filter-changed', () => this._redisplay());
        }
        _disconnectSignals() {
            if (this._onAppSystemChanged !== undefined)
                this._appSystem.disconnect(this._onAppSystemChanged);
            if (this._onAppFilterChanged !== undefined)
                this._parentalControlsManager.disconnect(this._onAppFilterChanged);
        }

        _redisplay() {
            const prevAppIcons = this._appIcons;
            const prevAppIds = prevAppIcons.map(icon => icon.id);
            const nextAppIcons = this._loadApps();
            const nextAppIds = nextAppIcons.map(icon => icon.id);

            const staleAppIcons = prevAppIcons.filter(icon => !nextAppIds.includes(icon.id));
            const freshAppIcons = nextAppIcons.filter(icon => !prevAppIds.includes(icon.id));

            const maybeFadeOut = (onComplete: () => void) => {
                if (!staleAppIcons.length && !freshAppIcons.length) {
                    // Same icons, don't fade out or fade in
                    onComplete();
                } else if (!prevAppIcons.length) {
                    // Apps list was empty, nothing to fade out
                    this._appField.opacity = 0;
                    onComplete();
                } else {
                    // Fade out existing apps list
                    fadeOut(this._appField, onComplete);
                }
            }
            maybeFadeOut(() => {
                // Free old resources
                for (const appIcon of staleAppIcons) {
                    this._appField.remove_child(appIcon);
                    this._items.delete(appIcon.id);
                    appIcon.destroy();
                }
                // Apply new data
                this._appIcons = nextAppIcons;
                for (const appIcon of freshAppIcons) {
                    this._appField.add_child(appIcon);
                    this._items.set(appIcon.id, appIcon);
                }
                // Fade back in
                fadeIn(this._appField);
                this.emit('view-loaded');
            });
        }

        _loadApps(): typeof FieldAppIcon.prototype[] {
            this._appInfoList = (this._appSystem.get_installed() as GioUnix.DesktopAppInfo[])
                .filter(appInfo => {
                    try {
                        const appId = appInfo.get_id(); // catch invalid file encodings
                        if (!appId) return false;
                    } catch {
                        return false;
                    }
                    return this._parentalControlsManager.shouldShowApp(appInfo);
                })
                .sort((a, b) => this._compareItems(a, b));

            const appIcons: typeof FieldAppIcon.prototype[] = [];
            for (const appInfo of this._appInfoList) {
                const appId = appInfo.get_id()!;

                let icon = this._items.get(appId);
                if (!icon) {
                    const app = this._appSystem.lookup_app(appId);
                    icon = new FieldAppIcon(app, {
                        syncTooltip: () => this._syncTooltip(icon!),
                    });
                    this._items.set(appId, icon);
                }
                appIcons.push(icon);
            }
            if (this._placeholder)
                appIcons.push(this._placeholder);
            return appIcons;
        }
        _compareItems<T extends AppDisplay.AppViewItem | { get_name(): string | null; }>(a: T, b: T): number {
            return this._collator.compare(a.get_name()!, b.get_name()!);
        }

        _addItem(item: typeof FieldAppIcon.prototype, _page: number, _position: number) {
            this._items.set(item.id, item);
            this._appField.add_child(item);
        }
        _removeItem(item: AppDisplay.AppViewItem) {
            this._items.delete(item.id);
            this._appField.remove_child(item);
        }

        override destroy() {
            this._disconnectSignals();

            for (const appIcon of this._appIcons) appIcon.destroy();

            super.destroy();
        }

        _ensurePlaceholder(source: AppDisplay.AppViewItem) {
            if (this._placeholder) return;
            const app = this._appSystem.lookup_app(source.id);
            const placeholder = this._placeholder = new FieldAppIcon(app, {
                syncTooltip: () => this._syncTooltip(placeholder),
            });
            placeholder.scaleAndFade();
            this._redisplay();
        }
        _removePlaceholder() {
            const placeholder = this._placeholder;
            if (!placeholder) return;
            placeholder.undoScaleAndFade();
            this._placeholder = null;

            const signalId = this.connect('view-loaded', () => {
                this.disconnect(signalId);
                placeholder.destroy();
            });

            this._redisplay();
        }

        _syncTooltip(appIcon: typeof FieldAppIcon.prototype) {
            if (appIcon.shouldShowTooltip()) {
                if (this._resetTooltipShowingTimeoutId) {
                    GLib.source_remove(this._resetTooltipShowingTimeoutId);
                    this._resetTooltipShowingTimeoutId = undefined;
                }
                if (!this._showTooltipTimeoutId) {
                    const timeout = this._tooltipShowing ? 0 : DASH_ITEM_HOVER_TIMEOUT;
                    this._showTooltipTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
                        this._tooltipShowing = true;
                        appIcon.showTooltip();
                        this._showTooltipTimeoutId = undefined;
                        return GLib.SOURCE_REMOVE;
                    });
                    GLib.Source.set_name_by_id(this._showTooltipTimeoutId, '[appfield] appIcon.showTooltip');
                }
            } else {
                if (this._showTooltipTimeoutId) {
                    GLib.source_remove(this._showTooltipTimeoutId);
                    this._showTooltipTimeoutId = undefined;
                }
                appIcon.hideTooltip();
                if (this._tooltipShowing) {
                    this._resetTooltipShowingTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DASH_ITEM_HOVER_TIMEOUT, () => {
                        this._tooltipShowing = false;
                        this._resetTooltipShowingTimeoutId = undefined;
                        return GLib.SOURCE_REMOVE;
                    });
                    GLib.Source.set_name_by_id(this._resetTooltipShowingTimeoutId, '[appfield] this._tooltipShowing');
                }
            }
        }

        /**
         * Compile-time signal type information.
         *
         * This instance property is generated only for TypeScript type checking.
         * It is not defined at runtime and should not be accessed in JS code.
         * @internal
         */
        declare $signals: AppFieldDisplay.SignalSignatures;

        // Unused stuff to satisfy type definition...
        declare readonly _pageManager: AppDisplay.PageManager;
        declare readonly _folderIcons: never[0];
        declare readonly _currentDialog: null;
        declare readonly _displayingDialog: false;
        declare readonly _overviewHiddenId: 0;
        declare readonly _folderSettings: Gio.Settings;
        getAppInfos() { return this._appInfoList; }
        _savePages() { }
        _ensureDefaultFolders() { }
        _onKeyPressEvent(_actor: St.Widget, _event: Clutter.KeyEvent) { return Clutter.EVENT_PROPAGATE; }
        addFolderDialog(_dialog: AppDisplay.AppFolderDialog) { }
        createFolder(_apps: string[]) { return false; }
        _onDestroy() { }
        _getItemPosition(_item: AppDisplay.AppViewItem): [number, number] { return [0, -1] as const; }
        _onScroll(_actor: St.ScrollView, _event: Clutter.ScrollEvent) { return false; }
        _maybeMoveItem(_dragEvent: DND.DragEvent) { }
        _onDragBegin(_overview?: any, _source?: any) { }
        _onDragMotion(_dragEvent: DND.DragEvent) { return !!DND.DragMotionResult.NO_DROP; }
        _onDragEnd() { }
        _onDragCancelled(_overview?: unknown, _source?: unknown) { }
        animateSwitch(animationDirection: AnimationDirection): void {
            this.remove_all_transitions();
            this._appField.remove_all_transitions();
            if (animationDirection === AnimationDirection.ANIMATION_IN) {
                this.show();
                fadeIn(this._appField);
            } else {
                fadeOut(this._appField, () => this.hide());
            }
        }
        goToPage(_pageNumber: number, _animate?: boolean) { }
        acceptDrop(_source: any) { return false; }
        declare readonly _grid: AppDisplay.AppGrid;
        declare readonly _scrollView: St.ScrollView<Clutter.Actor<Clutter.LayoutManager, Clutter.Content>>;
        declare readonly _canScroll = false;
        declare readonly _scrollTimeoutId = 0;
        declare readonly _adjustment: St.Adjustment;
        declare readonly _pageIndicators: undefined;
        declare readonly _nextPageIndicator: St.Widget<Clutter.LayoutManager, Clutter.Content>;
        declare readonly _prevPageIndicator: St.Widget<Clutter.LayoutManager, Clutter.Content>;
        declare readonly _nextPageArrow: St.Button<Clutter.Actor<Clutter.LayoutManager, Clutter.Content>>;
        declare readonly _prevPageArrow: St.Button<Clutter.Actor<Clutter.LayoutManager, Clutter.Content>>;
        declare readonly _appGridLayout: AppDisplay.BaseAppViewGridLayout;
        declare readonly _box: St.BoxLayout;
        declare readonly _swipeTracker: undefined;
        declare readonly _orientation = Clutter.Orientation.VERTICAL;
        get _orderedItems() { return this._appIcons }
        declare readonly _appFavorites: AppFavorites.AppFavorites;
        declare readonly _lastOvershootCoord = 0;
        declare readonly _delayedMoveData: AppDisplay.PageMoveData | null;
        declare readonly _dragBeginId = 0;
        declare readonly _dragEndId = 0;
        declare readonly _dragCancelledId = 0;
        _createGrid(): AppDisplay.AppGrid {
            throw new Error('Method not implemented.');
        }
        _swipeBegin(_tracker: any, _monitor: Clutter.EventSequence) { }
        _swipeUpdate(_tracker: any, _progress: number) { }
        _swipeEnd(_tracker: any, _duration: number, _endProgress: number) { }
        _connectDnD() { }
        _disconnectDnD() { }
        _removeDelayedMove() { }
        _resetDragPageSwitch() { }
        _setupDragPageSwitchRepeat(_direction: number) { }
        _dragMaybeSwitchPageImmediately(_dragEvent: DND.DragEvent) { }
        _maybeSetupDragPageSwitchInitialTimeout(_dragEvent: DND.DragEvent) { }
        _onDragDrop(_dropEvent: DND.DropEvent) { return false; }
        _canAccept(_source: any) { return false; }
        _findBestPageToAppend(_startPage?: number) { return 0; }
        _getLinearPosition(_item: IconGrid.BaseIcon) { return 0; }
        _selectAppInternal(id: string) {
            const item = this._items.get(id);
            if (!item) return log(`No such app ${id}`);
            item.navigate_focus(null, St.DirectionType.TAB_FORWARD, false);
        }
        _getDropTarget(_x: number, _y: number, _source: any): [targetPage: number, targetPosition: number, dragLocation: number] {
            return [0, 0, 0];
        }
        _moveItem(_item: AppDisplay.AppViewItem, _newPage: number, _newPosition: number) { }
        handleDragOver(_source: any): DND.DragMotionResult { return DND.DragMotionResult.NO_DROP; }
        getAllItems(): typeof FieldAppIcon.prototype[] { return this._orderedItems; }
        selectApp(id: string): void {
            const item = this._items.get(id);
            if (!item) {
                // Need to wait until the view is built
                const signalId = this.connect('view-loaded', () => {
                    this.disconnect(signalId);
                    this.selectApp(id);
                });
                return;
            } else if (!item.mapped) {
                // Need to wait until the view is mapped
                const signalId = item.connect('notify::mapped', actor => {
                    if (actor.mapped) {
                        actor.disconnect(signalId);
                        this._selectAppInternal(id);
                    }
                });
                return;
            } else {
                this._selectAppInternal(id);
            }
        }
    }
);

/** https://github.com/GNOME/libadwaita/blob/6e88877f04c5b0eab434e50238ff8545a2506bbd/src/adw-tab-overview.c#L190 */
declare const enum AnimationDirection {
    ANIMATION_NONE,
    ANIMATION_IN,
    ANIMATION_OUT,
};
