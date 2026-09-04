import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';

/** Lays out its square children so they all fit on screen. */
export const FieldLayoutManager = GObject.registerClass(
    class FieldLayoutManager extends Clutter.LayoutManager {
        declare _lastSizes: {
            /** Max width of the container. Used to invalidate cache. */
            for_width: number | null,
            /** Max height of the container. Used to invalidate cache. */
            for_height: number | null,
            /** The computed size of each child. */
            child_size: number,
            /** The number of columns of children. */
            cols: number,
            /** The number of rows of children. */
            rows: number,
        };

        override _init() {
            super._init();
            this._lastSizes = {
                for_width: -1,
                for_height: -1,
                child_size: 64,
                cols: 1,
                rows: 1,
            };
        }

        override vfunc_get_preferred_width(container: Clutter.Actor, for_height: number): [minimum: number, natural: number] {
            const { for_width, child_size } = this._computeSizes(container, undefined, for_height);
            return [for_width ?? child_size, for_width ?? child_size];
        }
        override vfunc_get_preferred_height(container: Clutter.Actor, for_width: number): [minimum: number, natural: number] {
            const { for_height, child_size } = this._computeSizes(container, for_width, undefined);
            return [for_height ?? child_size, for_height ?? child_size];
        }

        override vfunc_allocate(container: Clutter.Actor, allocation: Clutter.ActorBox) {
            const children = container.get_children();
            const { child_size, cols } = this._computeSizes(container, allocation.get_width(), allocation.get_height());

            const childBox = new Clutter.ActorBox();
            for (let i = 0; i < children.length; ++i) {
                const child = children[i];
                const col = i % cols;
                const row = Math.floor(i / cols);

                const x = col * child_size;
                const y = row * child_size;
                const [, , naturalWidth, naturalHeight] = child.get_preferred_size();

                childBox.set_origin(
                    Math.floor(x),
                    Math.floor(y),
                );
                childBox.set_size(
                    Math.max(child_size, naturalWidth),
                    Math.max(child_size, naturalHeight),
                );
                child.allocate(childBox);

                if (child instanceof AppDisplay.AppIcon) {
                    /** Keep this in sync with .appfield-tile in stylesheet.css */
                    const padding = 2 as const;
                    child.icon.setIconSize(
                        Math.floor(child_size) - padding * 2
                    );
                }
            }
        }

        _computeSizes(container: Clutter.Actor, width?: number, height?: number): typeof FieldLayoutManager.prototype._lastSizes {
            if (!width || width <= 0) {
                if (container.has_allocation())
                    width = container.allocation.get_width();
                else
                    width = this._lastSizes.for_width ?? 1280;
            }
            if (!height || height <= 0) {
                if (container.has_allocation())
                    height = container.allocation.get_height();
                else
                    height = this._lastSizes.for_height ?? 720;
            }

            width = Math.round(width);
            height = Math.round(height);

            if (width === this._lastSizes.for_width && height === this._lastSizes.for_height) return this._lastSizes;

            const children = container.get_children();
            const [cols, rows] = FieldLayoutManager._getColsRows(children.length, width / height);
            const child_size = Math.min(width / cols, height / rows);

            return this._lastSizes = {
                for_width: width,
                for_height: height,
                child_size,
                cols,
                rows,
            };
        }

        /**
         * Decides on the number of columns and rows that will fit [children] items.
         * The result will be roughly the same aspect ratio as [aspectRatio].
         */
        static _getColsRows(children: number, aspectRatio: number): [cols: number, rows: number] {
            const cols = Math.ceil(Math.sqrt(children * aspectRatio));
            const rows = Math.ceil(children / cols);

            return [cols, rows];
        }
    }
)
