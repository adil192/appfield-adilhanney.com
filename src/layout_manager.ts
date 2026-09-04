import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';

/** Lays out its square children so they all fit on screen. */
export const FieldLayoutManager = GObject.registerClass(
    class FieldLayoutManager extends Clutter.LayoutManager {
        declare _lastSizes: {
            /** This cache key must match for the other data to be up to date. */
            cache_key: {
                /** Max width of the container. */
                width: number | null,
                /** Max height of the container. */
                height: number | null,
                /** Number of children. */
                num_children: number,
            },
            /** The computed size of each child. */
            child_size: number,
            /** The number of columns of children. */
            cols: number,
            /** The number of rows of children. */
            rows: number,
            /** Margins to center the app grid. */
            margins: { horizontal: number, vertical: number },
        };

        override _init() {
            super._init();
            this._lastSizes = {
                cache_key: { width: null, height: null, num_children: 0, },
                child_size: 64,
                cols: 1,
                rows: 1,
                margins: { horizontal: 0, vertical: 0 },
            };
        }

        override vfunc_get_preferred_width(container: Clutter.Actor, for_height: number): [minimum: number, natural: number] {
            const { cache_key, child_size } = this._computeSizes(container, undefined, for_height);
            return [cache_key.width ?? child_size, cache_key.width ?? child_size];
        }
        override vfunc_get_preferred_height(container: Clutter.Actor, for_width: number): [minimum: number, natural: number] {
            const { cache_key, child_size } = this._computeSizes(container, for_width, undefined);
            return [cache_key.height ?? child_size, cache_key.height ?? child_size];
        }

        override vfunc_allocate(container: Clutter.Actor, allocation: Clutter.ActorBox) {
            const children = container.get_children();
            const { child_size, cols, margins } = this._computeSizes(container, allocation.get_width(), allocation.get_height(), children.length);

            const childBox = new Clutter.ActorBox();
            for (let i = 0; i < children.length; ++i) {
                const child = children[i];
                const col = i % cols;
                const row = Math.floor(i / cols);

                const x = margins.horizontal + col * child_size;
                const y = margins.vertical + row * child_size;

                // Update icon size. This must come before `child.get_preferred_size()`
                if (child instanceof AppDisplay.AppIcon) {
                    /** Keep this in sync with .appfield-tile in stylesheet.css */
                    const padding = 2 as const;
                    child.icon.setIconSize(
                        Math.floor(child_size) - padding * 2
                    );
                }

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
            }
        }

        _computeSizes(container: Clutter.Actor, width?: number, height?: number, num_children?: number): typeof this._lastSizes {
            if (!width || width <= 0) {
                if (container.has_allocation())
                    width = container.allocation.get_width();
                else
                    width = this._lastSizes.cache_key.width ?? 1280;
            }
            if (!height || height <= 0) {
                if (container.has_allocation())
                    height = container.allocation.get_height();
                else
                    height = this._lastSizes.cache_key.height ?? 720;
            }

            width = Math.round(width);
            height = Math.round(height);
            num_children ??= container.get_n_children();
            if (width === this._lastSizes.cache_key.width &&
                height == this._lastSizes.cache_key.height &&
                num_children == this._lastSizes.cache_key.num_children) {
                return this._lastSizes;
            }

            const [cols, rows] = FieldLayoutManager._getColsRows(num_children, width / height);
            const child_size = Math.min(width / cols, height / rows);

            const margins = {
                horizontal: (width - child_size * cols) / 2,
                vertical: (height - child_size * rows) / 2,
            };

            return this._lastSizes = {
                cache_key: { width, height, num_children },
                child_size,
                cols,
                rows,
                margins,
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
